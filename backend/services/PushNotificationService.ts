import { logger } from "@/backend/utils/logger";
// backend/services/PushNotificationService.ts
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "../supabase";

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
    logger.debug("Push notifications unavailable in this runtime:", error);
    notificationsModule = false;
    return null;
  }
}

export class PushNotificationService {
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;

    if (isExpoGo) {
      this.initialized = true;
      logger.debug("📱 Remote push skipped in Expo Go. Use a development build for push notifications.");
      return;
    }

    const Notifications = await getNotifications();
    if (!Notifications) {
      this.initialized = true;
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

      await this.requestPermissions();

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("orders", {
          name: "Orders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF6B35",
          sound: "default",
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync("messages", {
          name: "Messages",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#3B82F6",
          sound: "default",
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync("withdrawals", {
          name: "Withdrawals",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#10B981",
          sound: "default",
          enableVibrate: true,
          showBadge: true,
        });
      }

      this.initialized = true;
      logger.debug("✅ Push notifications initialized");
    } catch (error) {
      this.initialized = true;
      logger.debug("Push notification initialization skipped:", error);
    }
  }

  static async registerPushToken(userId: string) {
    try {
      const { data: appUser } = await db.from("users").select("user_type").eq("id", userId).maybeSingle();
      const userType = appUser?.user_type || "customer";

      if (isExpoGo) {
        const mockToken = `ExpoGo_${Platform.OS}_${userId}`;
        await db.from("user_push_tokens").upsert(
          {
            user_id: userId,
            user_type: userType,
            expo_push_token: mockToken,
            device_id: `${Platform.OS}-expo-go-${userId}`,
            platform: Platform.OS,
            device_type: `${Platform.OS}_expo_go`,
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "expo_push_token" },
        );
        logger.debug("✅ Expo Go mock push token saved");
        return true;
      }

      const Notifications = await getNotifications();
      if (!Notifications) return false;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return false;

      if (!Device.isDevice) {
        const mockToken = `Emulator_${Platform.OS}_${userId}`;
        await db.from("user_push_tokens").upsert(
          {
            user_id: userId,
            user_type: userType,
            expo_push_token: mockToken,
            device_id: `${Platform.OS}-emulator-${userId}`,
            platform: Platform.OS,
            device_type: `${Platform.OS}_emulator`,
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "expo_push_token" },
        );
        return true;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;

      if (!projectId) {
        logger.debug("No EAS projectId found. Push token registration skipped.");
        return false;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      const nativeDeviceId = `${Platform.OS}-${(Device as any).osInternalBuildId || (Device as any).modelId || "device"}`;

      await db.from("user_push_tokens").upsert(
        {
          user_id: userId,
          user_type: userType,
          expo_push_token: token.data,
          device_id: nativeDeviceId,
          platform: Platform.OS,
          device_type: Platform.OS,
          is_active: true,
          last_used_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "expo_push_token" },
      );

      return true;
    } catch (error) {
      logger.debug("Push token registration skipped:", error);
      return false;
    }
  }

  static async sendToUser(userId: string, title: string, body: string, data: any = {}) {
    try {
      const { data: tokens, error } = await db
        .from("user_push_tokens")
        .select("expo_push_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (error || !tokens?.length) return false;

      const realTokens = tokens
        .map((item: any) => item.expo_push_token)
        .filter((token: string) => token && !token.startsWith("ExpoGo_") && !token.startsWith("Emulator_"));

      if (!realTokens.length) return false;

      const messages = realTokens.map((token: string) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: { ...data, _displayInForeground: true },
        channelId: data?.channelId || data?.channel_id || "orders",
        priority: "high",
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });

      return true;
    } catch (error) {
      logger.debug("Push send skipped:", error);
      return false;
    }
  }

  static async sendNotification(
    title: string,
    body: string,
    data: any = {},
    options: { sound?: string; channelId?: string; vibrate?: boolean; priority?: string } = {},
  ) {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: options.sound || "default",
          ...(options.channelId ? { channelId: options.channelId } : {}),
          ...(options.priority ? { priority: options.priority } : {}),
        },
        trigger: null,
      });
      return true;
    } catch (error) {
      logger.debug("Test notification skipped:", error);
      return false;
    }
  }

  static async testNotificationSounds() {
    const sounds = ["default", "neworder", "orderready", "delivery", "alert", "success"];

    for (const sound of sounds) {
      await this.sendNotification(
        `Test: ${sound}`,
        `Testing ${sound} notification sound`,
        { test: true, sound },
        { sound, channelId: "orders", priority: "high" },
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  static async sendOrderNotification(
    orderId: string,
    orderNumber: string,
    status: string,
    restaurantName: string,
  ) {
    const titleByStatus: Record<string, string> = {
      pending: "Order placed",
      confirmed: "Order confirmed",
      preparing: "Order is being prepared",
      ready: "Order ready",
      out_for_delivery: "Order on the way",
      delivered: "Order delivered",
      cancelled: "Order cancelled",
    };

    return this.sendNotification(
      titleByStatus[status] || "Order update",
      `${restaurantName}: order #${orderNumber}`,
      { order_id: orderId, order_number: orderNumber, status, restaurant_name: restaurantName },
      { channelId: "orders", priority: "high" },
    );
  }

  static async removeUserTokens(userId: string) {
    try {
      await db.from("user_push_tokens").delete().eq("user_id", userId);
    } catch (error) {
      logger.debug("Remove push tokens skipped:", error);
    }
  }

  private static async requestPermissions() {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  }

  static setupNotificationHandler(onNotificationTap?: (data: any) => void) {
    let cleanup = () => {};

    getNotifications().then((Notifications) => {
      if (!Notifications) return;

      const receivedSubscription = Notifications.addNotificationReceivedListener(() => {});
      const responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;
        onNotificationTap?.(data);
      });

      cleanup = () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      };
    });

    return () => cleanup();
  }

  static async clearAllNotifications() {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      logger.debug("Clear notifications skipped:", error);
    }
  }
}
