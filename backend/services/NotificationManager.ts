import { logger } from "@/backend/utils/logger";
// backend/services/NotificationManager.ts
import { RealTimeNotificationListener } from "../listeners/realTimeNotifications";
import { EnhancedNotificationService } from "./EnhancedNotificationService";
import { NotificationService } from "./notificationService";

export class NotificationManager {
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;

    try {
      logger.debug("🔔 Initializing Notification Manager...");

      // Initialize basic notification service
      await NotificationService.initialize();

      // Start real-time listeners
      RealTimeNotificationListener.start();

      logger.debug("✅ Notification Manager initialized successfully");
      this.initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize Notification Manager:", error);
      throw error;
    }
  }

  static isInitialized() {
    return this.initialized;
  }

  // Helper method to send notifications using the enhanced service
  static async sendOrderNotification(orderId: string, status: string) {
    return EnhancedNotificationService.sendOrderStatusNotification(
      orderId,
      status,
    );
  }

  // Send notification to specific user
  static async sendToUser(
    userId: string,
    userType: string,
    title: string,
    body: string,
    data?: any,
  ) {
    return EnhancedNotificationService.sendRealTimeNotification(
      userId,
      userType,
      title,
      body,
      data,
    );
  }
}
