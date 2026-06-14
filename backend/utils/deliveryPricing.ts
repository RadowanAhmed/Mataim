import { logger } from "@/backend/utils/logger";
type PointLike = {
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type DeliveryPricingInput = {
  restaurant?: PointLike | null;
  address?: PointLike | string | null;
  settings?: DeliveryPricingSettings | null;
};

export const DELIVERY_BASE_FEE_UGX = 0;
export const DELIVERY_MIN_FEE_UGX = 3000;
export const DELIVERY_MAX_FEE_UGX = 25000;
export const DELIVERY_PER_KM_UGX = 1500;
export const DRIVER_DELIVERY_PAYOUT_PERCENTAGE = 0.8;

export type DeliveryPricingSettings = {
  baseFareUgx?: number | string | null;
  minFeeUgx?: number | string | null;
  maxFeeUgx?: number | string | null;
  pricePerKmUgx?: number | string | null;
};

const FIXED_DELIVERY_PRICING_SETTINGS: Required<DeliveryPricingSettings> = {
  baseFareUgx: DELIVERY_BASE_FEE_UGX,
  minFeeUgx: DELIVERY_MIN_FEE_UGX,
  maxFeeUgx: DELIVERY_MAX_FEE_UGX,
  pricePerKmUgx: DELIVERY_PER_KM_UGX,
};

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function deliveryPricingSettingsFromRows(_rows: any[] | null | undefined): DeliveryPricingSettings {
  return { ...FIXED_DELIVERY_PRICING_SETTINGS };
}

export async function loadDeliveryPricingSettings(_client: any): Promise<DeliveryPricingSettings> {
  return { ...FIXED_DELIVERY_PRICING_SETTINGS };
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function parsePoint(value?: PointLike | string | null) {
  if (!value) return null;

  let point = value as PointLike;

  if (typeof value === "string") {
    try {
      point = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const latitude = toNumber(point.latitude);
  const longitude = toNumber(point.longitude);

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

export function distanceKm(from?: PointLike | string | null, to?: PointLike | string | null) {
  const start = parsePoint(from);
  const end = parsePoint(to);

  if (!start || !end) return null;

  const earthRadiusKm = 6371;
  const dLat = deg2rad(end.latitude - start.latitude);
  const dLon = deg2rad(end.longitude - start.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(start.latitude)) *
    Math.cos(deg2rad(end.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
}

export function calculateDeliveryFee(input: DeliveryPricingInput) {
  const distance = distanceKm(input.restaurant, input.address);

  if (distance === null) {
    return DELIVERY_MIN_FEE_UGX;
  }

  const rawFee = Math.max(0, distance) * DELIVERY_PER_KM_UGX;

  return Math.min(
    DELIVERY_MAX_FEE_UGX,
    Math.max(DELIVERY_MIN_FEE_UGX, Math.round(rawFee)),
  );
}

export function calculateDeliveryDistanceKm(input: DeliveryPricingInput) {
  return distanceKm(input.restaurant, input.address);
}

export function calculateDeliveryFeeFromDistance(distance: number | null | undefined) {
  if (distance === null || distance === undefined || !Number.isFinite(Number(distance))) {
    return DELIVERY_MIN_FEE_UGX;
  }

  const rawFee = Math.max(0, Number(distance)) * DELIVERY_PER_KM_UGX;
  return Math.min(
    DELIVERY_MAX_FEE_UGX,
    Math.max(DELIVERY_MIN_FEE_UGX, Math.round(rawFee)),
  );
}

export function calculateDriverPayout(deliveryFee: number | string | null | undefined) {
  const fee = Number(deliveryFee || 0);
  if (!Number.isFinite(fee) || fee <= 0) return 0;
  return Math.round(fee * DRIVER_DELIVERY_PAYOUT_PERCENTAGE);
}

type DeliveryQuote = {
  deliveryFee: number;
  distanceKm: number | null;
  source: "google_distance_matrix" | "openroute_service" | "haversine";
};

async function getGoogleDrivingDistanceKm(restaurant: ReturnType<typeof parsePoint>, address: ReturnType<typeof parsePoint>) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !restaurant || !address) return null;

  const origins = `${restaurant.latitude},${restaurant.longitude}`;
  const destinations = `${address.latitude},${address.longitude}`;
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&mode=driving` +
    `&origins=${encodeURIComponent(origins)}` +
    `&destinations=${encodeURIComponent(destinations)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const meters = data?.rows?.[0]?.elements?.[0]?.distance?.value;
  const status = data?.rows?.[0]?.elements?.[0]?.status;

  if (status !== "OK" || !Number.isFinite(Number(meters))) return null;
  return Number((Number(meters) / 1000).toFixed(1));
}

async function getOpenRouteDrivingDistanceKm(restaurant: ReturnType<typeof parsePoint>, address: ReturnType<typeof parsePoint>) {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTE_API_KEY || process.env.OPENROUTE_API_KEY;
  if (!apiKey || !restaurant || !address) return null;

  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [restaurant.longitude, restaurant.latitude],
        [address.longitude, address.latitude],
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const meters = data?.routes?.[0]?.summary?.distance;
  if (!Number.isFinite(Number(meters))) return null;
  return Number((Number(meters) / 1000).toFixed(1));
}

/**
 * Gets billable driving distance for order creation. Google Distance Matrix is
 * preferred, OpenRouteService is supported, and Haversine keeps checkout usable offline.
 */
export async function resolveDeliveryQuote(input: DeliveryPricingInput): Promise<DeliveryQuote> {
  const restaurant = parsePoint(input.restaurant);
  const address = parsePoint(input.address);
  const fallbackDistance = distanceKm(restaurant, address);

  if (!restaurant || !address) {
    return {
      deliveryFee: DELIVERY_MIN_FEE_UGX,
      distanceKm: fallbackDistance,
      source: "haversine",
    };
  }

  try {
    const googleDistance = await getGoogleDrivingDistanceKm(restaurant, address);
    if (googleDistance !== null) {
      return {
        deliveryFee: calculateDeliveryFeeFromDistance(googleDistance),
        distanceKm: googleDistance,
        source: "google_distance_matrix",
      };
    }
  } catch (error) {
    logger.debug("Google delivery distance unavailable:", error);
  }

  try {
    const openRouteDistance = await getOpenRouteDrivingDistanceKm(restaurant, address);
    if (openRouteDistance !== null) {
      return {
        deliveryFee: calculateDeliveryFeeFromDistance(openRouteDistance),
        distanceKm: openRouteDistance,
        source: "openroute_service",
      };
    }
  } catch (error) {
    logger.debug("OpenRouteService delivery distance unavailable:", error);
  }

  return {
    deliveryFee: calculateDeliveryFeeFromDistance(fallbackDistance),
    distanceKm: fallbackDistance,
    source: "haversine",
  };
}

/**
 * Calculate delivery fee and distance for a restaurant from user's location
 * @param restaurantLocation Restaurant latitude/longitude
 * @param userLocation User's current latitude/longitude (optional, uses address if not provided)
 * @param address Delivery address (used if userLocation not provided)
 * @returns Object with deliveryFee and distanceKm
 */
export function calculateDeliveryFromUserLocation(params: {
  restaurantLocation?: PointLike | null;
  userLocation?: PointLike | null;
  address?: PointLike | null;
}) {
  const { restaurantLocation, userLocation, address } = params;

  // Use user location first, fallback to address
  const deliveryTarget = userLocation || address;

  if (!restaurantLocation || !deliveryTarget) {
    return {
      deliveryFee: DELIVERY_MIN_FEE_UGX,
      distanceKm: null,
    };
  }

  const distance = distanceKm(restaurantLocation, deliveryTarget);

  return {
    deliveryFee: calculateDeliveryFee({
      restaurant: restaurantLocation,
      address: deliveryTarget,
    }),
    distanceKm: distance,
  };
}
