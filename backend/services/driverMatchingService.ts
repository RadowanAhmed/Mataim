// backend/services/driverMatchingService.ts
import { supabase } from "../supabase";
import { NotificationService } from "./notificationService";

export class DriverMatchingService {
  // Find nearest available driver for an order
  static async findNearestDriver(
    orderId: string,
    restaurantLocation: { lat: number; lng: number },
  ) {
    try {
      // Get available drivers
      const { data: availableDrivers } = await supabase
        .from("delivery_users")
        .select(
          "id, current_location_lat, current_location_lng, is_online, driver_status",
        )
        .eq("is_online", true)
        .eq("driver_status", "available");

      if (!availableDrivers || availableDrivers.length === 0) {
        return null;
      }

      // Calculate distances and find nearest driver
      const driversWithDistance = availableDrivers.map((driver) => {
        const distance = this.calculateDistance(
          restaurantLocation.lat,
          restaurantLocation.lng,
          driver.current_location_lat || 0,
          driver.current_location_lng || 0,
        );
        return { ...driver, distance };
      });

      // Sort by distance and find nearest
      const nearestDriver = driversWithDistance
        .filter((driver) => driver.distance <= 20) // Within 20km
        .sort((a, b) => a.distance - b.distance)[0];

      return nearestDriver;
    } catch (error) {
      console.error("Error finding nearest driver:", error);
      return null;
    }
  }

  // Assign driver to order
  static async assignDriverToOrder(orderId: string, driverId: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "out_for_delivery",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Update driver status
      await supabase
        .from("delivery_users")
        .update({
          driver_status: "busy",
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      return { success: true };
    } catch (error) {
      console.error("Error assigning driver:", error);
      return { success: false, error };
    }
  }

  // Auto-assign driver when order is ready
  static async autoAssignDriver(orderId: string) {
    try {
      // Get order and restaurant location
      const { data: order } = await supabase
        .from("orders")
        .select("*, restaurants(latitude, longitude)")
        .eq("id", orderId)
        .single();

      if (!order || !order.restaurants) {
        return { success: false, error: "Order not found" };
      }

      const restaurantLocation = {
        lat: order.restaurants.latitude || 0,
        lng: order.restaurants.longitude || 0,
      };

      // Find nearest driver
      const nearestDriver = await this.findNearestDriver(
        orderId,
        restaurantLocation,
      );

      if (!nearestDriver) {
        return { success: false, error: "No drivers available" };
      }

      // Assign driver
      const result = await this.assignDriverToOrder(orderId, nearestDriver.id);

      if (result.success) {
        // Send notifications
        await NotificationService.sendDriverAssignmentNotification(
          orderId,
          nearestDriver.id,
        );
      }

      return result;
    } catch (error) {
      console.error("Error in auto-assign driver:", error);
      return { success: false, error };
    }
  }

  // Calculate distance between two points (Haversine formula)
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
    const distance = R * c;
    return distance;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
