import { logger } from "@/backend/utils/logger";
import { EnhancedNotificationService } from "../services/EnhancedNotificationService";
import { supabase } from "../supabase";

export class RealTimeNotificationListener {
  static start() {
    logger.debug("🔔 Starting real-time notification listeners...");

    // Listen for new orders
    const ordersChannel = supabase
      .channel("orders-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          logger.debug("New order created:", payload.new);
          // Enhanced notifications are already handled by triggers
          // This is for additional real-time features
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: "status=neq.cancelled",
        },
        async (payload) => {
          logger.debug("Order updated:", payload.new);

          // Send real-time notifications for critical updates
          if (payload.old.status !== payload.new.status) {
            await EnhancedNotificationService.sendRealTimeNotification(
              payload.new.customer_id,
              "customer",
              `Order #${payload.new.order_number} Status Update`,
              `Your order status changed to: ${payload.new.status}`,
              {
                order_id: payload.new.id,
                order_number: payload.new.order_number,
                old_status: payload.old.status,
                new_status: payload.new.status,
              },
            );
          }
        },
      )
      .subscribe();

    // Listen for driver assignments
    const driversChannel = supabase
      .channel("drivers-channel")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: "driver_id=is.not.null",
        },
        async (payload) => {
          if (
            payload.old.driver_id !== payload.new.driver_id &&
            payload.new.driver_id
          ) {
            logger.debug("Driver assigned:", payload.new.driver_id);

            // Send real-time notification to driver
            await EnhancedNotificationService.sendRealTimeNotification(
              payload.new.driver_id,
              "driver",
              "🚴 New Delivery Assignment!",
              `You have been assigned to order #${payload.new.order_number}`,
              {
                order_id: payload.new.id,
                order_number: payload.new.order_number,
                action: "view_delivery",
                priority: "high",
              },
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(driversChannel);
    };
  }
}
