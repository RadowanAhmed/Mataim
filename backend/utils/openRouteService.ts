import Constants from "expo-constants";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  coordinates: Coordinate[];
  distanceKm: number;
  durationMin: number;
}

const getApiKey = () => {
  const extra = (Constants.expoConfig?.extra || (Constants as any).manifest2?.extra || {}) as any;
  return extra.openRouteServiceApiKey || extra.orsApiKey || "";
};

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

export const calculateDirectDistance = (from: Coordinate, to: Coordinate) => {
  const earthRadiusKm = 6371;
  const dLat = deg2rad(to.latitude - from.latitude);
  const dLon = deg2rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(from.latitude)) *
      Math.cos(deg2rad(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const decodePolyline = (encoded: string): Coordinate[] => {
  let index = 0;
  const coordinates: Coordinate[] = [];
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
};

export const calculateRoute = async (
  start: Coordinate,
  end: Coordinate,
): Promise<RouteResult> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    const distanceKm = calculateDirectDistance(start, end);
    return {
      coordinates: [start, end],
      distanceKm,
      durationMin: Math.max(4, Math.round((distanceKm / 28) * 60)),
    };
  }

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [start.longitude, start.latitude],
          [end.longitude, end.latitude],
        ],
      }),
    });

    if (!response.ok) throw new Error(`Route request failed: ${response.status}`);

    const data = await response.json();
    const route = data.routes?.[0];
    const summary = route?.summary || {};
    const geometry = route?.geometry;

    const coordinates = typeof geometry === "string" ? decodePolyline(geometry) : [start, end];
    const distanceKm = toNumber(summary.distance, calculateDirectDistance(start, end) * 1000) / 1000;
    const durationMin = Math.max(1, Math.round(toNumber(summary.duration, distanceKm * 120) / 60));

    return { coordinates: coordinates.length ? coordinates : [start, end], distanceKm, durationMin };
  } catch {
    const distanceKm = calculateDirectDistance(start, end);
    return {
      coordinates: [start, end],
      distanceKm,
      durationMin: Math.max(4, Math.round((distanceKm / 28) * 60)),
    };
  }
};

export const geocodeAddress = async (address: string): Promise<Coordinate | null> => {
  const apiKey = getApiKey();
  if (!apiKey || !address?.trim()) return null;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      text: address,
      size: "1",
    });
    const response = await fetch(`https://api.openrouteservice.org/geocode/search?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) return null;
    return { latitude: coordinates[1], longitude: coordinates[0] };
  } catch {
    return null;
  }
};
