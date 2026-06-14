import { logger } from "@/backend/utils/logger";
// backend/services/notificationService.tsx
import Constants from "expo-constants";
import { supabase } from "../supabase";
import { orderRouteForUserType } from "../utils/notificationRoutes";

const db = supabase as any;
const isExpoGo = Constants.appOwnership === "expo";
let notificationsModule: any | null | false = undefined as any;

async function getNotifications() {
  if (notificationsModule !== undefined) return notificationsModule || null;

  if (isExpoGo) {
    notificationsModule = false;
    return null;
  }

  try {
    const mod = await import("expo-notifications");
    notificationsModule = mod;
    return mod;
  } catch (error) {
    logger.debug("Notifications unavailable in this runtime:", error);
    notificationsModule = false;
    return null;
  }
}

async function scheduleLocalNotification(title: string, body: string, data: any = {}) {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true, badge: 1 },
      trigger: null,
    });
    return true;
  } catch (error) {
    logger.debug("Local notification skipped:", error);
    return false;
  }
}

function normalizeNotificationUserType(userType?: unknown) {
  const raw = Array.isArray(userType) ? userType[0] : userType;
  const value = typeof raw === "string" ? raw.toLowerCase() : "customer";

  if (value === "restaurant" || value === "driver" || value === "customer") {
    return value;
  }

  return "customer";
}

function notificationTarget(userType?: unknown) {
  switch (normalizeNotificationUserType(userType)) {
    case "restaurant":
      return { tableName: "restaurant_notifications", userIdColumn: "restaurant_id" };
    case "driver":
      return { tableName: "driver_notifications", userIdColumn: "driver_id" };
    default:
      return { tableName: "user_notifications", userIdColumn: "user_id" };
  }
}

export class NotificationService {
  static async initialize() {
    const Notifications = await getNotifications();

    if (!Notifications) {
      logger.debug("🔔 Notifications skipped in Expo Go. Use a development build for remote push notifications.");
      return;
    }

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }

      logger.debug("🔔 Notification service initialized");
    } catch (error) {
      logger.debug("Notification initialization skipped:", error);
    }
  }

  static async sendNotification(
    userId: string,
    title: string,
    body: string,
    type: string = "info",
    data: any = {},
    userType?: unknown,
  ) {
    try {
      let finalUserType = userType;

      if (!finalUserType) {
        const { data: userData } = await db
          .from("users")
          .select("user_type")
          .eq("id", userId)
          .maybeSingle();
        finalUserType = normalizeNotificationUserType(userData?.user_type);
      }

      const normalizedUserType = normalizeNotificationUserType(finalUserType);
      const rpcPayload = {
        ...data,
        type,
        user_type: normalizedUserType,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const selfId = sessionData?.session?.user?.id;
      const isSelf = selfId === userId;

      // Cross-user inserts (e.g. customer -> driver_notifications) fail RLS; use security definer RPC.
      const { data: rpcResult, error: rpcError } = await db.rpc("send_push_notification", {
        p_user_id: userId,
        p_title: title,
        p_body: body,
        p_data: rpcPayload,
      });

      if (rpcError) {
        if (!isSelf) throw rpcError;

        const { tableName, userIdColumn } = notificationTarget(normalizedUserType);
        const { data: notification, error } = await db
          .from(tableName)
          .insert({
            [userIdColumn]: userId,
            title,
            body,
            type,
            data,
            read: false,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (error) throw error;
        await this.sendPushNotification(title, body, data);
        return { success: true, data: notification };
      }

      if (isSelf) {
        await this.sendPushNotification(title, body, data);
      }

      return { success: true, data: rpcResult };
    } catch (error: any) {
      console.error("Error sending notification:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendOrderNotification(orderId: string, status: string, extraData: Record<string, any> = {}) {
    try {
      const { data: order, error } = await db
        .from("orders")
        .select(
          `id,order_number,customer_id,restaurant_id,driver_id,status,post_id,
           restaurants:restaurants!orders_restaurant_id_fkey(restaurant_name,image_url),
           customers:users!orders_customer_id_fkey(full_name,profile_image_url)`,
        )
        .eq("id", orderId)
        .maybeSingle();

      if (error) throw error;
      if (!order) return { success: false, error: "Order not found" };

      let postData: any = null;
      if (order.post_id) {
        const { data: post } = await db
          .from("posts")
          .select("id,title,image_url")
          .eq("id", order.post_id)
          .maybeSingle();
        postData = post;
      }

      const restaurantName = order.restaurants?.restaurant_name || "Restaurant";
      const restaurantImageUrl = order.restaurants?.image_url || null;
      const customerProfileImageUrl = order.customers?.profile_image_url || null;
      const postTitle = postData?.title || `order #${order.order_number}`;

      const config: Record<string, any> = {
        pending: { customer: "Order placed", restaurant: "New order" },
        confirmed: { customer: "Order confirmed", restaurant: "Order confirmed" },
        preparing: { customer: "Order is being prepared", restaurant: "Preparing order" },
        ready: { customer: "Order ready", restaurant: "Ready for pickup", driver: "New delivery available" },
        out_for_delivery: { customer: "Order on the way", driver: "Delivery started" },
        delivered: { customer: "Order delivered", driver: "Delivery completed" },
        cancelled: { customer: "Order cancelled", restaurant: "Order cancelled", driver: "Order cancelled" },
      };

      const titles = config[status] || config.pending;
      const baseData = {
        order_id: orderId,
        order_number: order.order_number,
        status,
        post_id: postData?.id,
        post_title: postTitle,
        post_image_url: postData?.image_url,
        restaurant_name: restaurantName,
        restaurant_image_url: restaurantImageUrl,
        customer_profile_image_url: customerProfileImageUrl,
        ...extraData,
      };

      if (order.customer_id && titles.customer) {
        await this.sendNotification(
          order.customer_id,
          titles.customer,
          `${restaurantName}: ${postTitle}`,
          "order",
          { ...baseData, screen: orderRouteForUserType("customer", orderId) },
          "customer",
        );
      }

      if (order.restaurant_id && titles.restaurant) {
        await this.sendNotification(
          order.restaurant_id,
          titles.restaurant,
          `Order #${order.order_number}: ${postTitle}`,
          "order",
          { ...baseData, screen: `/(restaurant)/orders/${orderId}` },
          "restaurant",
        );
      }

      if (order.driver_id && titles.driver) {
        await this.sendNotification(
          order.driver_id,
          titles.driver,
          `${restaurantName}: ${postTitle}`,
          "order",
          { ...baseData, screen: orderRouteForUserType("driver", orderId) },
          "driver",
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error sending order notification:", error);
      return { success: false, error: error.message };
    }
  }

  static async sendWelcomeNotification(userId: string, userName = "User", userType: unknown = "customer") {
    const normalizedUserType = normalizeNotificationUserType(userType);
    const titles: Record<string, string> = {
      customer: `Welcome to Mataim, ${userName}!`,
      restaurant: `Welcome to Mataim, ${userName}!`,
      driver: `Welcome to Mataim, ${userName}!`,
    };

    return this.sendNotification(
      userId,
      titles[normalizedUserType] || titles.customer,
      normalizedUserType === "driver" ? "Go online to start receiving deliveries." : "Your account is ready.",
      "system",
      { action: "welcome", screen: normalizedUserType === "driver" ? "/(driver)/dashboard" : "/(tabs)" },
      normalizedUserType,
    );
  }

  static async sendSignInNotification(userId: string, userType: unknown = "customer") {
    const normalizedUserType = normalizeNotificationUserType(userType);
    return this.sendNotification(
      userId,
      "Welcome back",
      "You signed in to your account.",
      "security",
      { action: "sign_in", screen: normalizedUserType === "driver" ? "/(driver)/dashboard" : "/(tabs)" },
      normalizedUserType,
    );
  }

  static async sendDriverAssignmentNotification(orderId: string, driverId: string) {
    try {
      const { data: order } = await db
        .from("orders")
        .select(
          `id,order_number,customer_id,restaurant_id,final_amount,estimated_delivery_time,delivery_address,
           restaurants:restaurants!orders_restaurant_id_fkey(restaurant_name,address),
           customers:users!orders_customer_id_fkey(full_name)`,
        )
        .eq("id", orderId)
        .maybeSingle();

      if (!order) throw new Error("Order not found");

      await this.sendNotification(
        driverId,
        "New delivery assigned",
        `Pickup order #${order.order_number} from ${order.restaurants?.restaurant_name || "the restaurant"}.`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          restaurant_name: order.restaurants?.restaurant_name,
          restaurant_address: order.restaurants?.address,
          customer_name: order.customers?.full_name,
          delivery_address: order.delivery_address,
          screen: orderRouteForUserType("driver", orderId),
        },
        "driver",
      );

      if (order.customer_id) {
        await this.sendNotification(
          order.customer_id,
          "Driver assigned",
          `A driver has been assigned to order #${order.order_number}.`,
          "order",
          { order_id: orderId, screen: orderRouteForUserType("customer", orderId) },
          "customer",
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error sending driver assignment notification:", error);
      return { success: false, error: error.message };
    }
  }

  static async findAndAssignNearestDriver(orderId: string) {
    try {
      const { data: order } = await db
        .from("orders")
        .select("id,restaurant_id")
        .eq("id", orderId)
        .maybeSingle();

      if (!order) throw new Error("Order not found");

      const { data: drivers } = await db
        .from("delivery_users")
        .select("id")
        .eq("is_online", true)
        .eq("driver_status", "available")
        .limit(1);

      const nearestDriver = drivers?.[0];
      if (!nearestDriver) return null;

      const { error } = await db
        .from("orders")
        .update({
          driver_id: nearestDriver.id,
          driver_assigned_at: new Date().toISOString(),
          driver_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .is("driver_id", null);

      if (error) throw error;

      await db
        .from("delivery_users")
        .update({ driver_status: "busy", is_online: true, updated_at: new Date().toISOString() })
        .eq("id", nearestDriver.id);

      await this.sendDriverAssignmentNotification(orderId, nearestDriver.id);
      return nearestDriver;
    } catch (error) {
      console.error("Error finding driver:", error);
      return null;
    }
  }

  static async assignNearestDriver(orderId: string) {
    return this.findAndAssignNearestDriver(orderId);
  }

  static async getUserNotifications(userId: string, userType: unknown, limit = 50) {
    try {
      const { tableName, userIdColumn } = notificationTarget(userType);
      const { data, error } = await db
        .from(tableName)
        .select("*")
        .eq(userIdColumn, userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async markNotificationAsRead(notificationId: string, userType: unknown = "customer") {
    try {
      const { tableName } = notificationTarget(userType);
      const { error } = await db
        .from(tableName)
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async markAllNotificationsAsRead(userId: string, userType: unknown) {
    try {
      const { tableName, userIdColumn } = notificationTarget(userType);
      const { error } = await db
        .from(tableName)
        .update({ read: true, read_at: new Date().toISOString() })
        .eq(userIdColumn, userId)
        .eq("read", false);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async getUnreadCount(userId: string, userType: unknown) {
    try {
      const { tableName, userIdColumn } = notificationTarget(userType);
      const { count, error } = await db
        .from(tableName)
        .select("id", { count: "exact", head: true })
        .eq(userIdColumn, userId)
        .eq("read", false);

      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error: any) {
      return { success: false, count: 0, error: error.message };
    }
  }

  static async sendNewOrderToRestaurant(orderId: string) {
    const { data: order } = await db
      .from("orders")
      .select("id,order_number,restaurant_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { success: false, error: "Order not found" };

    return this.sendNotification(
      order.restaurant_id,
      "New order received",
      `You have a new order #${order.order_number}.`,
      "order",
      { order_id: orderId, order_number: order.order_number, screen: `/(restaurant)/orders/${orderId}` },
      "restaurant",
    );
  }

  static async sendMessageNotification(
    conversationId: string,
    senderId: string,
    message: string,
    senderName: string,
    senderType: string,
    recipientId: string,
    recipientType: string,
  ) {
    if (!recipientId || senderId === recipientId) return { success: true, skipped: true };

    const screen =
      recipientType === "driver"
        ? `/(driver)/messages/${conversationId}`
        : recipientType === "restaurant"
          ? `/(restaurant)/messages/${conversationId}`
          : `/messages/${conversationId}`;

    return this.sendNotification(
      recipientId,
      `New message from ${senderName}`,
      message.length > 70 ? `${message.slice(0, 70)}...` : message,
      "message",
      {
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        sender_type: senderType,
        message: message.slice(0, 100),
        recipient_id: recipientId,
        screen,
      },
      recipientType,
    );
  }

  static async sendPushNotificationToUser(userId: string, title: string, body: string, data: any = {}) {
    try {
      const { data: tokens } = await db
        .from("user_push_tokens")
        .select("expo_push_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!tokens?.length) return false;

      const messages = tokens.map((token: any) => ({
        to: token.expo_push_token,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });

      return true;
    } catch (error) {
      logger.debug("Push notification send skipped:", error);
      return false;
    }
  }

  static async sendMessagePushNotification(title: string, body: string, data: any = {}) {
    return scheduleLocalNotification(title, body, data);
  }

  static async triggerRealtimeNotification(recipientId: string, recipientType: string, notificationData: any) {
    try {
      const channel = db.channel(`notifications-${recipientId}`);
      await channel.send({ type: "broadcast", event: "new_notification", payload: notificationData });
    } catch (error) {
      logger.debug("Realtime notification skipped:", error);
    }
  }

  private static async sendPushNotification(title: string, body: string, data: any = {}) {
    if (isExpoGo) return false;
    return scheduleLocalNotification(title, body, data);
  }

  private static async sendPushNotificationWithImage(
    title: string,
    body: string,
    imageUrl: string | null,
    data: any = {},
  ) {
    return this.sendPushNotification(title, body, { ...data, sender_image_url: imageUrl || null });
  }
}
