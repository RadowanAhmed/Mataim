import { logger } from "@/backend/utils/logger";
// backend/services/DriverOrderMatchingService.ts
import { supabase } from "../supabase";
import { formatMoney } from "../utils/currency";
import { EnhancedNotificationService } from "./EnhancedNotificationService";

export interface AvailableOrder {
  id: string;
  order_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_lat: number;
  restaurant_lng: number;
  customer_id: string;
  customer_name: string;
  delivery_address: any;
  final_amount: number;
  delivery_fee: number;
  distance_km?: number;
  estimated_time?: number;
  created_at: string;
  items_count: number;
  special_instructions?: string;
}

export interface DriverAcceptance {
  order_id: string;
  driver_id: string;
  accepted_at: string;
  estimated_arrival: number;
}

export class DriverOrderMatchingService {
  private static activeChannels: Map<string, any> = new Map();
  private static driverChannels: Map<string, any> = new Map();

  /**
   * Broadcast available order to all online drivers
   */
  static async broadcastAvailableOrder(orderId: string) {
    try {
      logger.debug(`📢 Broadcasting available order: ${orderId}`);

      // Get order details with restaurant info
      const { data: order, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          restaurant_id,
          final_amount,
          delivery_fee,
          special_instructions,
          created_at,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            address,
            latitude,
            longitude
          ),
          order_items(
            quantity,
            posts!left(title),
            menu_items!left(name)
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !order) {
        console.error("Error fetching order for broadcast:", error);
        return false;
      }

      // Count items
      const itemsCount =
        order.order_items?.reduce(
          (sum: number, item: any) => sum + (item.quantity || 1),
          0,
        ) || 1;

      // Get first item name
      const firstItem = order.order_items?.[0];
      const itemName =
        firstItem?.posts?.title || firstItem?.menu_items?.name || "Food";

      const availableOrder: AvailableOrder = {
        id: order.id,
        order_number: order.order_number,
        restaurant_id: order.restaurant_id,
        restaurant_name: order.restaurants?.restaurant_name || "Restaurant",
        restaurant_address: order.restaurants?.address || "",
        restaurant_lat: parseFloat(order.restaurants?.latitude) || 0,
        restaurant_lng: parseFloat(order.restaurants?.longitude) || 0,
        customer_id: "",
        customer_name: "Customer",
        delivery_address: {},
        final_amount: order.final_amount,
        delivery_fee: order.delivery_fee,
        created_at: order.created_at,
        items_count: itemsCount,
        special_instructions: order.special_instructions,
      };

      // Get all online available drivers
      const { data: onlineDrivers } = await supabase
        .from("delivery_users")
        .select("id, current_location_lat, current_location_lng")
        .eq("is_online", true)
        .eq("driver_status", "available");

      if (!onlineDrivers || onlineDrivers.length === 0) {
        logger.debug("No online drivers available");

        // Notify restaurant that no drivers are available
        await EnhancedNotificationService.sendToRestaurant(
          order.restaurant_id,
          "⚠️ No Drivers Available",
          `Order #${order.order_number} is ready but no drivers are online. We'll notify you when a driver accepts.`,
          "system",
          { order_id: order.id, order_number: order.order_number },
        );

        return false;
      }

      logger.debug(`📢 Broadcasting to ${onlineDrivers.length} online drivers`);

      // Broadcast to each driver via their personal channel
      for (const driver of onlineDrivers) {
        // Calculate distance if driver has location
        let distance = null;
        if (driver.current_location_lat && driver.current_location_lng) {
          distance = this.calculateDistance(
            driver.current_location_lat,
            driver.current_location_lng,
            availableOrder.restaurant_lat,
            availableOrder.restaurant_lng,
          );
        }

        const orderWithDistance = {
          ...availableOrder,
          distance_km: distance ? parseFloat(distance.toFixed(1)) : null,
          estimated_time: distance ? Math.round(distance * 3) : null, // 3 min per km
        };

        // Send to driver's personal channel
        await this.sendToDriverChannel(driver.id, "new_available_order", {
          order: orderWithDistance,
          timestamp: new Date().toISOString(),
        });

        // Also create a notification in database
        await EnhancedNotificationService.sendToDriver(
          driver.id,
          "🚴 New Delivery Available!",
          `Order from ${availableOrder.restaurant_name} • ${formatMoney(availableOrder.delivery_fee)} delivery fee`,
          "order",
          {
            order_id: order.id,
            order_number: order.order_number,
            restaurant_name: availableOrder.restaurant_name,
            delivery_fee: availableOrder.delivery_fee,
            distance: orderWithDistance.distance_km,
            action: "accept_delivery",
            priority: "high",
          },
        );
      }

      return true;
    } catch (error) {
      console.error("Error broadcasting available order:", error);
      return false;
    }
  }

  /**
   * Send message to a specific driver's channel
   */
  static async sendToDriverChannel(
    driverId: string,
    event: string,
    payload: any,
  ) {
    try {
      const channel = supabase.channel(`driver-${driverId}`);

      await channel.send({
        type: "broadcast",
        event: event,
        payload: payload,
      });

      // Don't unsubscribe immediately - keep channel open for future messages
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 5000);
    } catch (error) {
      console.error(`Error sending to driver ${driverId} channel:`, error);
    }
  }

  /**
   * Driver accepts an order
   */
  static async acceptOrder(
    orderId: string,
    driverId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.debug(`Driver ${driverId} accepting order ${orderId}`);

      // Check if order is still available
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("status, driver_id, restaurant_id, order_number")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        return { success: false, error: "Order not found" };
      }

      if (order.status !== "ready") {
        return { success: false, error: "Order is no longer available" };
      }

      if (order.driver_id) {
        return {
          success: false,
          error: "Order already assigned to another driver",
        };
      }

      // Begin transaction
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "out_for_delivery",
          driver_assigned_at: new Date().toISOString(),
          driver_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "ready")
        .is("driver_id", null);

      if (updateError) {
        console.error("Error assigning driver:", updateError);
        return { success: false, error: "Failed to assign driver" };
      }

      // Update driver status
      await supabase
        .from("delivery_users")
        .update({
          driver_status: "busy",
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      // Get driver details for notifications
      const { data: driver } = await supabase
        .from("delivery_users")
        .select("users!inner(full_name, phone)")
        .eq("id", driverId)
        .single();

      // Notify restaurant
      await EnhancedNotificationService.sendToRestaurant(
        order.restaurant_id,
        "✅ Driver Assigned!",
        `Driver ${driver?.users?.full_name || "has been assigned"} to order #${order.order_number}`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          driver_id: driverId,
          driver_name: driver?.users?.full_name,
        },
      );

      // Notify customer
      await EnhancedNotificationService.sendOrderStatusNotification(
        orderId,
        "out_for_delivery",
      );

      // Broadcast to all drivers that this order is no longer available
      await this.broadcastOrderUnavailable(orderId, order.order_number);

      return { success: true };
    } catch (error: any) {
      console.error("Error in acceptOrder:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast that an order is no longer available
   */
  private static async broadcastOrderUnavailable(
    orderId: string,
    orderNumber: string,
  ) {
    try {
      const { data: drivers } = await supabase
        .from("delivery_users")
        .select("id")
        .eq("is_online", true)
        .eq("driver_status", "available");

      if (!drivers) return;

      for (const driver of drivers) {
        await this.sendToDriverChannel(driver.id, "order_unavailable", {
          order_id: orderId,
          order_number: orderNumber,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error broadcasting order unavailable:", error);
    }
  }

  /**
   * Driver subscribes to their personal channel
   */
  static subscribeDriver(
    driverId: string,
    callbacks: {
      onNewOrder?: (order: any) => void;
      onOrderUnavailable?: (data: any) => void;
      onOrderUpdate?: (data: any) => void;
    },
  ) {
    logger.debug(`Driver ${driverId} subscribing to personal channel`);

    const channel = supabase.channel(`driver-${driverId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on("broadcast", { event: "new_available_order" }, ({ payload }) => {
        logger.debug(
          `Driver ${driverId} received new order:`,
          payload.order?.order_number,
        );
        if (callbacks.onNewOrder) {
          callbacks.onNewOrder(payload.order);
        }
      })
      .on("broadcast", { event: "order_unavailable" }, ({ payload }) => {
        logger.debug(
          `Driver ${driverId} received order unavailable:`,
          payload.order_number,
        );
        if (callbacks.onOrderUnavailable) {
          callbacks.onOrderUnavailable(payload);
        }
      })
      .on("broadcast", { event: "order_update" }, ({ payload }) => {
        if (callbacks.onOrderUpdate) {
          callbacks.onOrderUpdate(payload);
        }
      })
      .subscribe((status) => {
        logger.debug(`Driver ${driverId} channel status:`, status);
      });

    this.driverChannels.set(driverId, channel);

    return () => {
      logger.debug(`Driver ${driverId} unsubscribing`);
      supabase.removeChannel(channel);
      this.driverChannels.delete(driverId);
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
