// backend/services/driverStatusService.ts
import { supabase } from "@/backend/supabase";
import * as Location from "expo-location";

const db = supabase as any;

export type DriverStatus = "available" | "busy" | "offline" | "suspended";

export interface DriverStatusUpdate {
  driver_status: DriverStatus;
  is_online: boolean;
  current_location_lat?: number;
  current_location_lng?: number;
  last_location_update?: string;
  updated_at: string;
}

/**
 * Validate location before going online
 */
export const validateLocation = async (): Promise<{ success: boolean; location: { latitude: number; longitude: number } | null; error: string }> => {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return {
        success: false,
        location: null,
        error: "Location services are disabled. Please enable them in your device settings.",
      };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return {
        success: false,
        location: null,
        error: "Location permission is required to go online.",
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      success: true,
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      error: "",
    };
  } catch (error: any) {
    return {
      success: false,
      location: null,
      error: "Failed to get your location. Please try again.",
    };
  }
};

/**
 * Update driver status to online
 */
export const setDriverOnline = async (userId: string) => {
  try {
    const locationResult = await validateLocation();
    if (!locationResult.success) {
      throw new Error(locationResult.error);
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("delivery_users")
      .update({
        is_online: true,
        driver_status: "available",
        current_location_lat: locationResult.location!.latitude,
        current_location_lng: locationResult.location!.longitude,
        last_location_update: now,
        updated_at: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Error setting driver online:", error);
    throw error;
  }
};

/**
 * Update driver status to offline
 */
export const setDriverOffline = async (userId: string) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("delivery_users")
      .update({
        is_online: false,
        driver_status: "offline",
        updated_at: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Error setting driver offline:", error);
    throw error;
  }
};

/**
 * Update driver status to busy (while on an active delivery)
 */
export const setDriverBusy = async (userId: string) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("delivery_users")
      .update({
        is_online: true,
        driver_status: "busy",
        updated_at: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Error setting driver busy:", error);
    throw error;
  }
};

/**
 * Update driver status to available (after completing a delivery)
 */
export const setDriverAvailable = async (userId: string) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("delivery_users")
      .update({
        is_online: true,
        driver_status: "available",
        updated_at: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Error setting driver available:", error);
    throw error;
  }
};

/**
 * Toggle driver online/offline status quickly
 */
export const toggleDriverStatus = async (userId: string, goOnline: boolean) => {
  if (goOnline) {
    return setDriverOnline(userId);
  } else {
    return setDriverOffline(userId);
  }
};

/**
 * Get current driver status
 */
export const getDriverStatus = async (userId: string) => {
  try {
    const { data, error } = await db
      .from("delivery_users")
      .select("is_online, driver_status, current_location_lat, current_location_lng, last_location_update")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error getting driver status:", error);
    return null;
  }
};

/**
 * Update driver location while online
 */
export const updateDriverLocation = async (
  userId: string,
  latitude: number,
  longitude: number
) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("delivery_users")
      .update({
        current_location_lat: latitude,
        current_location_lng: longitude,
        last_location_update: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating driver location:", error);
    return null;
  }
};

/**
 * Check if driver can receive orders
 */
export const canReceiveOrders = async (userId: string): Promise<boolean> => {
  try {
    const status = await getDriverStatus(userId);
    if (!status) return false;

    return (
      status.is_online === true &&
      status.driver_status === "available" &&
      status.current_location_lat !== null &&
      status.current_location_lng !== null
    );
  } catch (error) {
    console.error("Error checking if driver can receive orders:", error);
    return false;
  }
};

/**
 * Get status color for UI display
 */
export const getStatusColor = (status: DriverStatus): string => {
  switch (status) {
    case "available":
      return "#10B981";
    case "busy":
      return "#F59E0B";
    case "offline":
      return "#6B7280";
    case "suspended":
      return "#EF4444";
    default:
      return "#6B7280";
  }
};

/**
 * Get status label for UI display
 */
export const getStatusLabel = (status: DriverStatus): string => {
  switch (status) {
    case "available":
      return "Available";
    case "busy":
      return "Busy";
    case "offline":
      return "Offline";
    case "suspended":
      return "Suspended";
    default:
      return "Unknown";
  }
};

/**
 * Get status icon for UI display
 */
export const getStatusIcon = (status: DriverStatus): string => {
  switch (status) {
    case "available":
      return "checkmark-circle";
    case "busy":
      return "timer";
    case "offline":
      return "close-circle";
    case "suspended":
      return "alert-circle";
    default:
      return "help-circle";
  }
};
