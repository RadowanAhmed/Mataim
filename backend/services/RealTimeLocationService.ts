import * as Location from "expo-location";
import { supabase } from "../supabase";
import { DriverAppService, DriverLocation } from "./driverAppService";

const db = supabase as any;

const DEBUG = __DEV__;

export class RealTimeLocationService {
  private static subscription: Location.LocationSubscription | null = null;
  private static activeOrderId: string | null = null;
  private static driverId: string | null = null;
  private static lastWarningAt = 0;

  private static warnOnce(message: string, error?: unknown) {
    const now = Date.now();
    if (now - this.lastWarningAt < 15000) return;
    this.lastWarningAt = now;
    if (DEBUG) {
      console.warn(`📍 ${message}`, error || "");
    }
  }

  static async requestPermission() {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        this.warnOnce("Location services are disabled on this device.");
        return false;
      }

      const currentPermission = await Location.getForegroundPermissionsAsync();
      if (currentPermission.status === "granted") return true;

      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    } catch (error) {
      this.warnOnce("Could not check location permission.", error);
      return false;
    }
  }

  static async getCurrentLocation(): Promise<DriverLocation | null> {
    try {
      const granted = await this.requestPermission();
      if (!granted) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
      };
    } catch (error) {
      this.warnOnce(
        "Current location is unavailable. Driver app will continue without live GPS until location is available.",
        error,
      );
      return null;
    }
  }

  static async updateCurrentLocation(driverId: string, orderId?: string | null) {
    try {
      const location = await this.getCurrentLocation();
      if (!location) {
        return {
          success: false,
          message: "Location is unavailable. Turn on device location to update live tracking.",
        };
      }
      return DriverAppService.updateLocation(driverId, location, orderId);
    } catch (error) {
      this.warnOnce("Could not update current location.", error);
      return { success: false, error, message: "Could not update current location." };
    }
  }

  static async startTracking(driverId: string, orderId?: string | null) {
    this.driverId = driverId;
    this.activeOrderId = orderId || null;

    try {
      const granted = await this.requestPermission();
      if (!granted) {
        await this.stopTracking();
        return {
          success: false,
          message: "Location permission is required for live delivery tracking.",
        };
      }

      await this.stopTracking();

      const firstActiveOrder = orderId || (await this.findActiveOrderId(driverId));
      const firstLocation = firstActiveOrder ? await this.getCurrentLocation() : null;
      if (firstLocation && firstActiveOrder) {
        this.activeOrderId = firstActiveOrder;
        await DriverAppService.updateLocation(driverId, firstLocation, firstActiveOrder);
      }

      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
          mayShowUserSettingsDialog: true,
        },
        async (location) => {
          try {
            const payload: DriverLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              heading: location.coords.heading,
              speed: location.coords.speed,
            };

            const activeOrder = this.activeOrderId || (await this.findActiveOrderId(driverId));
            if (!activeOrder) return;
            this.activeOrderId = activeOrder;
            await DriverAppService.updateLocation(driverId, payload, activeOrder);
          } catch (error) {
            this.warnOnce("Could not save live location update.", error);
          }
        },
      );

      return { success: true };
    } catch (error) {
      await this.stopTracking();
      this.warnOnce("Live location tracking could not start.", error);
      return {
        success: false,
        error,
        message: "Live tracking could not start. Turn on location services and try again.",
      };
    }
  }

  static async stopTracking() {
    try {
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }
    } catch (error) {
      this.warnOnce("Could not stop location tracking cleanly.", error);
    }
  }

  static setActiveOrder(orderId?: string | null) {
    this.activeOrderId = orderId || null;
  }

  static async findActiveOrderId(driverId: string) {
    try {
      const { data } = await db
        .from("orders")
        .select("id")
        .eq("driver_id", driverId)
        .in("status", ["ready", "out_for_delivery"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data?.id || null;
    } catch {
      return null;
    }
  }

  static async getDriverLocation(driverId: string) {
    try {
      const { data, error } = await db
        .from("delivery_users")
        .select("current_location_lat,current_location_lng,last_location_update,location_accuracy,is_online,driver_status")
        .eq("id", driverId)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  static subscribeToOrderLocation(orderId: string, onLocation: (location: any) => void) {
    const channel = db
      .channel(`driver-location-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `order_id=eq.${orderId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row.lat && row.lng) {
            onLocation({
              latitude: Number(row.lat),
              longitude: Number(row.lng),
              accuracy: row.accuracy,
              heading: row.heading,
              speed: row.speed,
              updated_at: row.updated_at,
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row.driver_location_lat && row.driver_location_lng) {
            onLocation({
              latitude: Number(row.driver_location_lat),
              longitude: Number(row.driver_location_lng),
              updated_at: row.driver_location_updated_at,
            });
          }
        },
      )
      .subscribe();

    return () => db.removeChannel(channel);
  }
}
