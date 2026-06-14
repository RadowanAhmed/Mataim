// backend/utils/location.ts
import * as Location from "expo-location";

export const DEFAULT_LOCATION_REGION = {
  latitude: 0.3476, // Kampala fallback
  longitude: 32.5825,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export type SafeLocationPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export type SafeAddress = {
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  country: string;
  postal_code?: string;
  latitude: number;
  longitude: number;
  is_temporary: boolean;
};

export async function getSafeCurrentLocation(): Promise<{
  point: SafeLocationPoint | null;
  region: typeof DEFAULT_LOCATION_REGION;
  error?: string;
}> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return {
        point: null,
        region: DEFAULT_LOCATION_REGION,
        error: "Location services are disabled.",
      };
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      return {
        point: null,
        region: DEFAULT_LOCATION_REGION,
        error: "Location permission was not granted.",
      };
    }

    let current: Location.LocationObject | null = null;

    try {
      current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 1000 * 60 * 10,
        requiredAccuracy: 5000,
      });

      if (lastKnown) {
        current = lastKnown;
      }
    }

    if (!current) {
      return {
        point: null,
        region: DEFAULT_LOCATION_REGION,
        error: "Current location is unavailable.",
      };
    }

    const point = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      accuracy: current.coords.accuracy,
    };

    return {
      point,
      region: {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
    };
  } catch (error: any) {
    return {
      point: null,
      region: DEFAULT_LOCATION_REGION,
      error: error?.message || "Could not get current location.",
    };
  }
}

export async function reverseAddress(
  latitude: number,
  longitude: number,
): Promise<SafeAddress> {
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (address) {
      return {
        label: "Current Location",
        address_line1:
          `${address.street || address.name || ""} ${address.streetNumber || ""}`.trim() ||
          "Selected Location",
        address_line2: address.district || "",
        city: address.city || address.region || "Kampala",
        state: address.region || "",
        country: address.country || "Uganda",
        postal_code: address.postalCode || "",
        latitude,
        longitude,
        is_temporary: true,
      };
    }
  } catch {}

  return {
    label: "Selected Location",
    address_line1: "Selected location",
    city: "Kampala",
    country: "Uganda",
    latitude,
    longitude,
    is_temporary: true,
  };
}
