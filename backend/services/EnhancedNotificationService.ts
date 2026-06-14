import { logger } from "@/backend/utils/logger";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../supabase";
import { formatMoney } from "../utils/currency";
import { calculateDriverPayout } from "../utils/deliveryPricing";
import { orderRouteForUserType } from "../utils/notificationRoutes";

const isExpoGo = Constants.appOwnership === "expo";

export class EnhancedNotificationService {
  // Initialize push notifications
  static async initializePushNotifications() {
    logger.debug("📱 Initializing push notifications...");

    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Create notification channels (Android)
      if (Platform.OS === "android") {
        await this.createNotificationChannels();
      }

      logger.debug("✅ Push notifications initialized");
    } catch (error) {
      console.error("❌ Error initializing push notifications:", error);
    }
  }

  // Request notification permissions
  private static async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      logger.debug("📱 Not a physical device, skipping permissions");
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.debug("⚠️ Notification permission not granted");
      return false;
    }

    logger.debug("✅ Notification permission granted");
    return true;
  }

  // Create notification channels for Android
  private static async createNotificationChannels() {
    try {
      // Main orders channel
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Orders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // System notifications channel
      await Notifications.setNotificationChannelAsync("system", {
        name: "System",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: "#3B82F6",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        description: "Message notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3B82F6",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      logger.debug("✅ Notification channels created");
    } catch (error) {
      console.error("❌ Error creating notification channels:", error);
    }
  }

  // Send a local notification
  static async sendLocalNotification(
    title: string,
    body: string,
    data: any = {},
    channelId: string = "orders",
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          badge: 1,
          color: "#FF6B35",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId,
        },
        trigger: null, // Show immediately
      });

      logger.debug(`📱 Local notification sent: ${title}`);
      return true;
    } catch (error) {
      console.error("❌ Error sending local notification:", error);
      return false;
    }
  }

  // Send comprehensive order notifications to all parties
  static async sendOrderStatusNotification(orderId: string, newStatus: string) {
    try {
      logger.debug(`📦 Sending ${newStatus} notification for order:`, orderId);

      // Get order with simplified query to avoid join errors
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error("❌ Error fetching order:", orderError);
        throw orderError;
      }

      if (!order) {
        throw new Error("Order not found");
      }

      // Fetch related data separately
      const [customerData, restaurantData, driverData, orderItems] =
        await Promise.all([
          // Get customer info
          supabase
            .from("users")
            .select("id, full_name, email, phone, user_type")
            .eq("id", order.customer_id)
            .single(),

          // Get restaurant info
          supabase
            .from("restaurants")
            .select("id, restaurant_name, address, latitude, longitude")
            .eq("id", order.restaurant_id)
            .single(),

          // Get driver info if assigned
          order.driver_id
            ? supabase
                .from("delivery_users")
                .select(
                  "id, users!inner(full_name, phone), vehicle_type, rating",
                )
                .eq("id", order.driver_id)
                .single()
            : Promise.resolve({ data: null, error: null }),

          // Get order items
          supabase
            .from("order_items")
            .select(
              `
            *,
            posts!left(title, image_url),
            menu_items!left(name, image_url)
          `,
            )
            .eq("order_id", orderId),
        ]);

      // Get restaurant owner's phone from users table
      const { data: restaurantOwner } = await supabase
        .from("users")
        .select("phone, email")
        .eq("id", order.restaurant_id)
        .single();

      // Combine all data
      const enrichedOrder = {
        ...order,
        customers: customerData.data || null,
        restaurants: {
          ...restaurantData.data,
          phone: restaurantOwner?.phone,
          email: restaurantOwner?.email,
        },
        delivery_users: driverData.data,
        order_items: orderItems.data || [],
      };

      // Get order items summary
      const itemNames = enrichedOrder.order_items
        .map(
          (item: any) => item.posts?.title || item.menu_items?.name || "Item",
        )
        .join(", ");

      const totalItems = enrichedOrder.order_items.reduce(
        (sum: number, item: any) => sum + (item.quantity || 1),
        0,
      );

      // Prepare notification data
      const notificationData = {
        order_id: orderId,
        order_number:
          enrichedOrder.order_number || `ORD-${orderId.slice(0, 8)}`,
        status: newStatus,
        items_count: totalItems,
        item_names: itemNames.substring(0, 50),
        final_amount: enrichedOrder.final_amount || 0,
        estimated_delivery_time: enrichedOrder.estimated_delivery_time,
        special_instructions: enrichedOrder.special_instructions,
        restaurant_name:
          enrichedOrder.restaurants?.restaurant_name || "Restaurant",
        customer_name: enrichedOrder.customers?.full_name || "Customer",
        restaurant_phone: enrichedOrder.restaurants?.phone,
        created_at: new Date().toISOString(),
      };

      // Send notifications based on status
      await this.handleStatusNotification(
        enrichedOrder,
        newStatus,
        notificationData,
      );

      // Send push notification
      await this.sendOrderPushNotification(
        enrichedOrder,
        newStatus,
        notificationData,
      );

      logger.debug("✅ Notifications sent successfully for status:", newStatus);
      return { success: true };
    } catch (error: any) {
      console.error(
        "❌ Error sending order status notifications:",
        error.message || error,
      );
      return { success: false, error: error.message || "Unknown error" };
    }
  }

  // Send push notification for order status
  private static async sendOrderPushNotification(
    order: any,
    status: string,
    data: any,
  ) {
    const config = this.getOrderPushNotificationConfig(status, order, data);

    // Send push notification to customer
    if (order.customer_id) {
      await this.sendLocalNotification(
        config.customer.title,
        config.customer.body,
        {
          order_id: data.order_id,
          order_number: data.order_number,
          status: status,
          restaurant_name: data.restaurant_name,
          screen: orderRouteForUserType("customer", data.order_id),
          notificationType: "order",
          timestamp: new Date().toISOString(),
        },
      );
    }

    // Send push notification to restaurant
    if (order.restaurant_id) {
      await this.sendLocalNotification(
        config.restaurant.title,
        config.restaurant.body,
        {
          order_id: data.order_id,
          order_number: data.order_number,
          status: status,
          customer_name: data.customer_name,
          screen: `/(restaurant)/orders/${data.order_id}`,
          notificationType: "order",
          timestamp: new Date().toISOString(),
        },
        "system",
      );
    }

    // Send push notification to driver if assigned
    if (order.driver_id && config.driver) {
      await this.sendLocalNotification(
        config.driver.title,
        config.driver.body,
        {
          order_id: data.order_id,
          order_number: data.order_number,
          status: status,
          restaurant_name: data.restaurant_name,
          customer_name: data.customer_name,
          screen: orderRouteForUserType("driver", data.order_id),
          notificationType: "order",
          timestamp: new Date().toISOString(),
        },
        "orders",
      );
    }
  }

  // Handle status notifications
  private static async handleStatusNotification(
    order: any,
    status: string,
    data: any,
  ) {
    switch (status) {
      case "pending":
        await this.handlePendingOrder(order, data);
        break;
      case "confirmed":
        await this.handleConfirmedOrder(order, data);
        break;
      case "preparing":
        await this.handlePreparingOrder(order, data);
        break;
      case "ready":
        await this.handleReadyOrder(order, data);
        break;
      case "out_for_delivery":
        await this.handleOutForDelivery(order, data);
        break;
      case "delivered":
        await this.handleDeliveredOrder(order, data);
        break;
      case "cancelled":
        await this.handleCancelledOrder(order, data);
        break;
      default:
        logger.debug("Unknown status:", status);
    }
  }

  // Handle pending order (order created)
  private static async handlePendingOrder(order: any, data: any) {
    // Notify Restaurant
    await this.sendToRestaurant(
      order.restaurant_id,
      "🆕 New Order Received!",
      `You have a new order #${data.order_number} from ${data.customer_name}. 
      Total: ${formatMoney(order.final_amount)}
      Items: ${data.items_count} items`,
      "order",
      data,
    );

    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "✅ Order Placed Successfully!",
      `Your order #${data.order_number} has been placed with ${data.restaurant_name}.
      Total: ${formatMoney(order.final_amount)}
      Estimated delivery: ${this.formatTime(order.estimated_delivery_time)}`,
      "order",
      data,
    );
  }

  // Handle confirmed order
  private static async handleConfirmedOrder(order: any, data: any) {
    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "✅ Order Confirmed!",
      `${data.restaurant_name} has confirmed your order #${data.order_number}.
      Your food is now being prepared.`,
      "order",
      data,
    );

    // Notify Restaurant (optional confirmation)
    await this.sendToRestaurant(
      order.restaurant_id,
      "✅ Order Confirmed",
      `You confirmed order #${data.order_number}.
      Proceed with preparation.`,
      "order",
      data,
    );
  }

  // Handle preparing order
  private static async handlePreparingOrder(order: any, data: any) {
    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "👨‍🍳 Order Being Prepared",
      `${data.restaurant_name} is now preparing your order #${data.order_number}.
      Estimated ready time: ${this.formatTime(order.estimated_delivery_time)}`,
      "order",
      data,
    );
  }

  // Handle ready order
  private static async handleReadyOrder(order: any, data: any) {
    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "📦 Order Ready!",
      `Your order #${data.order_number} from ${data.restaurant_name} is now ready!
      A driver will be assigned shortly.`,
      "order",
      data,
    );

    // Notify Restaurant
    await this.sendToRestaurant(
      order.restaurant_id,
      "📦 Order Ready for Pickup",
      `Order #${data.order_number} is ready for pickup/delivery.`,
      "order",
      data,
    );

    // Notify Available Drivers
    await this.notifyAvailableDrivers(order, data);
  }

  // Handle out for delivery
  private static async handleOutForDelivery(order: any, data: any) {
    const driverName = order.delivery_users?.users?.full_name || "Driver";

    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "🚚 Order On The Way!",
      `Great news! Your order #${data.order_number} is now out for delivery.
      Driver: ${driverName}
      Estimated arrival: ${this.formatTime(order.estimated_delivery_time)}`,
      "order",
      data,
    );

    // Notify Restaurant
    await this.sendToRestaurant(
      order.restaurant_id,
      "🚚 Order Out for Delivery",
      `Order #${data.order_number} has been picked up and is on its way to ${data.customer_name}.`,
      "order",
      data,
    );

    // Notify Driver
    if (order.driver_id) {
      await this.sendToDriver(
        order.driver_id,
        "📍 Delivery In Progress",
        `You are delivering order #${data.order_number} to ${data.customer_name}.
        Restaurant: ${data.restaurant_name}
        Instructions: ${order.special_instructions || "None"}`,
        "order",
        data,
      );
    }
  }

  // Handle delivered order
  private static async handleDeliveredOrder(order: any, data: any) {
    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "✅ Order Delivered!",
      `Your order #${data.order_number} has been delivered successfully!
      Total: ${formatMoney(order.final_amount)}
      Thank you for ordering with us.`,
      "order",
      data,
    );

    // Notify Restaurant
    await this.sendToRestaurant(
      order.restaurant_id,
      "✅ Order Delivered",
      `Order #${data.order_number} has been delivered to ${data.customer_name}.
      Amount: ${formatMoney(order.final_amount)}`,
      "order",
      data,
    );

    // Notify Driver
    if (order.driver_id) {
      await this.sendToDriver(
        order.driver_id,
        "🎉 Delivery Completed!",
        `Successfully delivered order #${data.order_number}.
        Thank you for the delivery!`,
        "earning",
        data,
      );
    }

    // Send rating reminder after 10 minutes
    setTimeout(
      async () => {
        await this.sendRatingReminder(order.customer_id, data.order_id);
      },
      10 * 60 * 1000,
    );
  }

  // Handle cancelled order
  private static async handleCancelledOrder(order: any, data: any) {
    // Notify Customer
    await this.sendToCustomer(
      order.customer_id,
      "❌ Order Cancelled",
      `Your order #${data.order_number} has been cancelled.
      Refund will be processed within 3-5 business days if payment was made.`,
      "order",
      data,
    );

    // Notify Restaurant
    await this.sendToRestaurant(
      order.restaurant_id,
      "❌ Order Cancelled",
      `Order #${data.order_number} from ${data.customer_name} has been cancelled.`,
      "order",
      data,
    );

    // Notify Driver if assigned
    if (order.driver_id) {
      await this.sendToDriver(
        order.driver_id,
        "⚠️ Order Cancelled",
        `Order #${data.order_number} has been cancelled.
        You are no longer assigned to this delivery.`,
        "order",
        data,
      );
    }
  }

  // Notify available drivers when order is ready
  private static async notifyAvailableDrivers(order: any, data: any) {
    try {
      // Get available drivers
      const { data: availableDrivers } = await supabase
        .from("delivery_users")
        .select(
          `
          id,
          users!inner(
            id,
            full_name
          ),
          is_online
        `,
        )
        .eq("is_online", true)
        .eq("driver_status", "available");

      if (availableDrivers && availableDrivers.length > 0) {
        const restaurantName = data.restaurant_name || "Restaurant";
        const earnings = Number(order.driver_payout_amount || calculateDriverPayout(order.delivery_fee));

        for (const driver of availableDrivers) {
          await this.sendToDriver(
            driver.id,
            "🚴 New Delivery Available!",
            `New order ready at ${restaurantName}
            Order #${data.order_number}
            Earnings: ${formatMoney(earnings)}
            Items: ${data.items_count} items
            Tap to accept delivery.`,
            "order",
            {
              ...data,
              action: "accept_delivery",
              restaurant_name: restaurantName,
              earnings: earnings,
              distance: "Calculating...",
            },
          );
        }

        logger.debug(`📤 Notified ${availableDrivers.length} available drivers`);
      }
    } catch (error) {
      console.error("Error notifying drivers:", error);
    }
  }

  // Send rating reminder
  private static async sendRatingReminder(customerId: string, orderId: string) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, restaurants(restaurant_name)")
        .eq("id", orderId)
        .single();

      if (order) {
        await this.sendToCustomer(
          customerId,
          "⭐ Rate Your Experience",
          `How was your order #${order.order_number} from ${order.restaurants?.restaurant_name || "Restaurant"}?
          Please take a moment to rate your experience.`,
          "rating",
          {
            order_id: orderId,
            order_number: order.order_number,
            action: "rate_order",
            restaurant_name: order.restaurants?.restaurant_name,
          },
        );
      }
    } catch (error) {
      console.error("Error sending rating reminder:", error);
    }
  }

  // Helper methods to send to specific user types
  private static async sendToCustomer(
    customerId: string,
    title: string,
    body: string,
    type: string,
    data: any,
  ) {
    await this.insertNotification(
      "user_notifications",
      "user_id",
      customerId,
      title,
      body,
      type,
      data,
    );
  }

  private static async sendToRestaurant(
    restaurantId: string,
    title: string,
    body: string,
    type: string,
    data: any,
  ) {
    await this.insertNotification(
      "restaurant_notifications",
      "restaurant_id",
      restaurantId,
      title,
      body,
      type,
      data,
    );
  }

  private static async sendToDriver(
    driverId: string,
    title: string,
    body: string,
    type: string,
    data: any,
  ) {
    await this.insertNotification(
      "driver_notifications",
      "driver_id",
      driverId,
      title,
      body,
      type,
      data,
    );
  }

  // Generic notification insertion
  private static async insertNotification(
    table: string,
    idColumn: string,
    id: string,
    title: string,
    body: string,
    type: string,
    data: any,
  ) {
    try {
      const { error } = await supabase.from(table).insert({
        [idColumn]: id,
        title,
        body,
        type,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          notification_type: type,
        },
        read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`Error inserting ${table} notification:`, error);
      } else {
        logger.debug(`✅ ${table} notification sent to ${id}`);
      }
    } catch (error) {
      console.error(`Exception inserting ${table} notification:`, error);
    }
  }

  // Get order push notification config
  private static getOrderPushNotificationConfig(
    status: string,
    order: any,
    data: any,
  ) {
    const restaurantName = data.restaurant_name || "Restaurant";
    const customerName = data.customer_name || "Customer";
    const driverName = order.delivery_users?.users?.full_name || "Driver";
    const orderNumber = data.order_number;

    const configs: any = {
      pending: {
        customer: {
          title: "✅ Order Placed Successfully!",
          body: `Your order #${orderNumber} has been placed with ${restaurantName}.`,
        },
        restaurant: {
          title: "🆕 New Order Received!",
          body: `New order #${orderNumber} from ${customerName}.`,
        },
      },
      confirmed: {
        customer: {
          title: "✅ Order Confirmed!",
          body: `${restaurantName} has confirmed your order #${orderNumber}.`,
        },
        restaurant: {
          title: "✅ Order Confirmed",
          body: `You confirmed order #${orderNumber}.`,
        },
      },
      preparing: {
        customer: {
          title: "👨‍🍳 Order Being Prepared",
          body: `${restaurantName} is preparing your order #${orderNumber}.`,
        },
      },
      ready: {
        customer: {
          title: "📦 Order Ready!",
          body: `Your order #${orderNumber} from ${restaurantName} is now ready!`,
        },
        restaurant: {
          title: "📦 Order Ready for Pickup",
          body: `Order #${orderNumber} is ready for pickup/delivery.`,
        },
        driver: {
          title: "🚴 New Delivery Available!",
          body: `Order #${orderNumber} from ${restaurantName} is ready for delivery.`,
        },
      },
      out_for_delivery: {
        customer: {
          title: "🚚 Order On The Way!",
          body: `Your order #${orderNumber} is now out for delivery. Driver: ${driverName}`,
        },
        restaurant: {
          title: "🚚 Order Out for Delivery",
          body: `Order #${orderNumber} is on its way to ${customerName}.`,
        },
        driver: {
          title: "📍 Delivery In Progress",
          body: `You are delivering order #${orderNumber} to ${customerName}.`,
        },
      },
      delivered: {
        customer: {
          title: "✅ Order Delivered!",
          body: `Your order #${orderNumber} has been delivered successfully!`,
        },
        restaurant: {
          title: "✅ Order Delivered",
          body: `Order #${orderNumber} has been delivered to ${customerName}.`,
        },
        driver: {
          title: "🎉 Delivery Completed!",
          body: `Successfully delivered order #${orderNumber}.`,
        },
      },
      cancelled: {
        customer: {
          title: "❌ Order Cancelled",
          body: `Your order #${orderNumber} has been cancelled.`,
        },
        restaurant: {
          title: "❌ Order Cancelled",
          body: `Order #${orderNumber} from ${customerName} has been cancelled.`,
        },
        driver: {
          title: "⚠️ Order Cancelled",
          body: `Order #${orderNumber} has been cancelled.`,
        },
      },
    };

    return configs[status] || configs.pending;
  }

  // Format time helper
  private static formatTime(dateString: string | null): string {
    if (!dateString) return "shortly";

    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "shortly";
    }
  }

  // Update badge count
  static async updateBadgeCount() {
    try {
      const currentCount = await Notifications.getBadgeCountAsync();
      await Notifications.setBadgeCountAsync(currentCount + 1);
    } catch (error) {
      console.error("❌ Error updating badge count:", error);
    }
  }

  // Clear all notifications
  static async clearAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
      logger.debug("✅ All notifications cleared");
    } catch (error) {
      console.error("❌ Error clearing notifications:", error);
    }
  }

  // Setup notification handler
  static setupNotificationHandler(onNotificationTap?: (data: any) => void) {
    // Handle notification received in foreground
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.debug("📱 Notification received:", notification);
      },
    );

    // Handle notification response (tap)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        logger.debug("📱 Notification tapped:", data);

        if (onNotificationTap) {
          onNotificationTap(data);
        }
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  // Test function
  static async testNotification(userId: string) {
    await this.sendLocalNotification(
      "Test Notification 📱",
      "This is a test notification from Mataim!",
      {
        test: true,
        userId: userId,
        timestamp: new Date().toISOString(),
      },
    );
  }
}
