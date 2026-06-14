import { logger } from "@/backend/utils/logger";
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { toUGX } from "@/backend/utils/currency";
import { calculateDeliveryFee, calculateDriverPayout } from "@/backend/utils/deliveryPricing";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const db = supabase as any;

type DriverPoint = {
  latitude: number;
  longitude: number;
};

export type ReadyOrder = {
  id: string;
  order_number: string;
  status: string;
  final_amount: number;
  delivery_fee: number;
  created_at: string;
  estimated_delivery_time: string | null;
  special_instructions: string | null;
  delivery_address: any;
  restaurant_id: string;
  driver_id?: string | null;
  restaurants?: {
    restaurant_name?: string;
    address?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    image_url?: string | null;
    cuisine_type?: string | null;
    restaurant_rating?: number | string | null;
  } | null;
  distance?: number;
  pickupDistance?: number;
  dropoffDistance?: number;
  tripDistance?: number;
  minutes?: number;
  offerRank?: number;
  valueScore?: number;
  dispatchBand?: "nearby" | "city" | "area" | "far";
};

type ReadyOrdersOptions = {
  enabled?: boolean;
  enableLocation?: boolean;
  pollMs?: number;
};

const ACTIVE_DRIVER_STATUSES = ["ready", "out_for_delivery"];
const NEARBY_RADIUS_KM = 8;
const CITY_RADIUS_KM = 25;
const AREA_RADIUS_KM = 55;
const MAX_READY_ORDERS = 100;

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function distanceKm(from: DriverPoint, to: DriverPoint) {
  const R = 6371;
  const dLat = deg2rad(to.latitude - from.latitude);
  const dLon = deg2rad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(from.latitude)) *
    Math.cos(deg2rad(to.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function getRestaurantPoint(order: ReadyOrder): DriverPoint | null {
  const latitude = toNumber(order.restaurants?.latitude);
  const longitude = toNumber(order.restaurants?.longitude);

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

export function getDeliveryPoint(order: ReadyOrder): DriverPoint | null {
  if (!order?.delivery_address) return null;

  let address = order.delivery_address;

  if (typeof address === "string") {
    try {
      address = JSON.parse(address);
    } catch {
      return null;
    }
  }

  const latitude = toNumber(address?.latitude);
  const longitude = toNumber(address?.longitude);

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function getDispatchBand(distance?: number): ReadyOrder["dispatchBand"] {
  if (distance === undefined || distance === null) return "far";
  if (distance <= NEARBY_RADIUS_KM) return "nearby";
  if (distance <= CITY_RADIUS_KM) return "city";
  if (distance <= AREA_RADIUS_KM) return "area";
  return "far";
}

function scoreOffer(order: ReadyOrder, driverLocation: DriverPoint | null) {
  const restaurantPoint = getRestaurantPoint(order);
  const deliveryPoint = getDeliveryPoint(order);
  const pickupDistance =
    driverLocation && restaurantPoint ? distanceKm(driverLocation, restaurantPoint) : undefined;
  const dropoffDistance =
    restaurantPoint && deliveryPoint ? distanceKm(restaurantPoint, deliveryPoint) : undefined;
  const tripDistance =
    pickupDistance !== undefined || dropoffDistance !== undefined
      ? Number(((pickupDistance || 0) + (dropoffDistance || 0)).toFixed(1))
      : undefined;

  const ageMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(order.created_at || Date.now()).getTime()) / 60000),
  );

  const fee =
    restaurantPoint && deliveryPoint
      ? calculateDeliveryFee({ restaurant: restaurantPoint, address: deliveryPoint })
      : Number(order.delivery_fee || 0);
  const band = getDispatchBand(pickupDistance);
  const minutes =
    tripDistance === undefined
      ? undefined
      : Math.max(6, Math.round(4 + (pickupDistance || 0) * 3.2 + (dropoffDistance || 0) * 3.6));
  const payPerKm = tripDistance ? fee / Math.max(tripDistance, 1) : fee;

  const bandWeight =
    band === "nearby" ? 0 :
      band === "city" ? 24 :
        band === "area" ? 58 :
          130;

  const pickupWeight = Number(pickupDistance ?? 70) * 3.8;
  const dropoffWeight = Number(dropoffDistance ?? 8) * 0.9;
  const timeWeight = Number(minutes ?? 45) * 0.28;
  const feeBoost = Math.min(fee, 40000) / 900;
  const valueBoost = Math.min(payPerKm, 12000) / 500;
  const ageBoost = Math.min(ageMinutes, 45) * 0.4;
  const valueScore = Number((payPerKm / 1000).toFixed(1));

  const offerRank = Number(
    (bandWeight + pickupWeight + dropoffWeight + timeWeight - feeBoost - valueBoost - ageBoost).toFixed(2),
  );

  return {
    ...order,
    delivery_fee: fee,
    driver_payout_amount: calculateDriverPayout(fee),
    distance: pickupDistance,
    pickupDistance,
    dropoffDistance,
    tripDistance,
    minutes,
    dispatchBand: band,
    offerRank,
    valueScore,
  };
}

function sortOffers(a: ReadyOrder, b: ReadyOrder) {
  const rankA = Number(a.offerRank ?? 9999);
  const rankB = Number(b.offerRank ?? 9999);

  if (rankA !== rankB) return rankA - rankB;

  const distanceA = Number(a.distance ?? 9999);
  const distanceB = Number(b.distance ?? 9999);

  if (distanceA !== distanceB) return distanceA - distanceB;

  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

export function useReadyOrdersLive(options?: ReadyOrdersOptions) {
  const { user, refreshUserData } = useAuth() as any;

  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const runningFetchRef = useRef(false);
  const channelKeyRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const enabled = options?.enabled ?? true;
  const enableLocation = options?.enableLocation ?? true;
  const pollMs = options?.pollMs ?? 10_000;

  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<ReadyOrder | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverPoint | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driverOnline, setDriverOnline] = useState(false);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const loadDriverLocation = useCallback(async () => {
    if (!enabled || !user?.id) return null;

    try {
      if (enableLocation) {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (servicesEnabled) {
          const permission = await Location.requestForegroundPermissionsAsync();

          if (permission.status === "granted") {
            let current: Location.LocationObject | null = null;

            try {
              current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
            } catch {
              current = await Location.getLastKnownPositionAsync({
                maxAge: 1000 * 60 * 10,
                requiredAccuracy: 5000,
              });
            }

            if (current) {
              const point = {
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
              };

              if (mountedRef.current) setDriverLocation(point);

              await db
                .from("delivery_users")
                .update({
                  current_location_lat: point.latitude,
                  current_location_lng: point.longitude,
                  last_location_update: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              return point;
            }
          } else if (mountedRef.current) {
            setNotice("Allow location to improve order matching.");
          }
        } else if (mountedRef.current) {
          setNotice("Turn on phone location to improve order matching.");
        }
      }

      const { data } = await db
        .from("delivery_users")
        .select("current_location_lat,current_location_lng,latitude,longitude")
        .eq("id", user.id)
        .maybeSingle();

      const savedLocation = data as any;
      const lat = toNumber(savedLocation?.current_location_lat ?? savedLocation?.latitude);
      const lng = toNumber(savedLocation?.current_location_lng ?? savedLocation?.longitude);

      if (lat !== null && lng !== null) {
        const point = { latitude: lat, longitude: lng };
        if (mountedRef.current) setDriverLocation(point);
        return point;
      }
    } catch (locationError) {
      logger.debug("Ready orders location unavailable:", locationError);
      if (mountedRef.current) setNotice("Location unavailable. Showing city-wide ready orders.");
    }

    return null;
  }, [enableLocation, enabled, user?.id]);

  const fetchCurrentOrder = useCallback(async () => {
    if (!enabled || !user?.id) return null;

    const { data, error: activeError } = await db
      .from("orders")
      .select(
        `
        id,
        order_number,
        status,
        final_amount,
        delivery_fee,
        created_at,
        estimated_delivery_time,
        special_instructions,
        delivery_address,
        restaurant_id,
        driver_id,
        restaurants:restaurants(
          restaurant_name,
          address,
          latitude,
          longitude,
          image_url,
          cuisine_type,
          restaurant_rating
        )
      `,
      )
      .eq("driver_id", user.id)
      .in("status", ACTIVE_DRIVER_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) throw activeError;

    return (data as unknown as ReadyOrder) || null;
  }, [enabled, user?.id]);

  const fetchReadyOrders = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (!enabled || !user?.id) {
        if (mountedRef.current) {
          setOrders([]);
          setCurrentOrder(null);
          setLoading(false);
          setRefreshing(false);
        }
        return [] as ReadyOrder[];
      }

      if (runningFetchRef.current && !opts?.force) return orders;
      runningFetchRef.current = true;

      try {
        if (!opts?.silent) setLoading(true);
        setError(null);

        const { data: driverState } = await db
          .from("delivery_users")
          .select("is_online,driver_status")
          .eq("id", user.id)
          .maybeSingle();

        const driverDispatchState = driverState as any;
        const isDispatchOnline =
          Boolean(driverDispatchState?.is_online) &&
          driverDispatchState?.driver_status !== "offline" &&
          driverDispatchState?.driver_status !== "suspended";

        if (mountedRef.current) setDriverOnline(isDispatchOnline);

        const activeOrder = await fetchCurrentOrder();

        if (!activeOrder?.id && !isDispatchOnline) {
          if (mountedRef.current) {
            setCurrentOrder(null);
            setOrders([]);
            setNotice("Go online from the dashboard to see city delivery offers.");
          }

          return [] as ReadyOrder[];
        }

        const location = await loadDriverLocation();

        if (activeOrder?.id) {
          const scoredActive = scoreOffer(activeOrder, location || driverLocation);

          if (mountedRef.current) {
            setCurrentOrder(scoredActive);
            setOrders([]);
            setNotice(null);
          }

          return [scoredActive];
        }

        if (mountedRef.current) setCurrentOrder(null);

        const { data, error: ordersError } = await db
          .from("orders")
          .select(
            `
            id,
            order_number,
            status,
            final_amount,
            delivery_fee,
            created_at,
            estimated_delivery_time,
            special_instructions,
            delivery_address,
            restaurant_id,
            driver_id,
            restaurants:restaurants(
              restaurant_name,
              address,
              latitude,
              longitude,
              image_url,
              cuisine_type,
              restaurant_rating
            )
          `,
          )
          .eq("status", "ready")
          .is("driver_id", null)
          .order("created_at", { ascending: true })
          .limit(MAX_READY_ORDERS);

        if (ordersError) throw ordersError;

        const scored = ((data || []) as ReadyOrder[])
          .filter((order) => Boolean(getRestaurantPoint(order)))
          .map((order) => scoreOffer(order, location || driverLocation));

        const cityOrders = scored.filter((order) => {
          if (order.distance === undefined) return true;
          return order.distance <= CITY_RADIUS_KM;
        });

        const areaFallbackOrders = scored.filter((order) => {
          if (order.distance === undefined) return true;
          return order.distance <= AREA_RADIUS_KM;
        });

        const finalList = (cityOrders.length ? cityOrders : areaFallbackOrders.length ? areaFallbackOrders : scored)
          .sort(sortOffers)
          .slice(0, MAX_READY_ORDERS);

        if (mountedRef.current) {
          setOrders(finalList);
          setNotice(finalList.length ? null : "You're online. Waiting for ready orders.");
        }

        return finalList;
      } catch (fetchError: any) {
        console.error("Ready orders load error:", fetchError);

        if (mountedRef.current) {
          const message = fetchError?.message || "Could not load ready orders.";
          setError(message);
          setNotice(message);
        }

        return [] as ReadyOrder[];
      } finally {
        runningFetchRef.current = false;

        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [driverLocation, enabled, fetchCurrentOrder, loadDriverLocation, orders, user?.id],
  );

  const scheduleRefresh = useCallback(
    (delay = 250) => {
      clearRefreshTimer();

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        fetchReadyOrders({ silent: true, force: true });
      }, delay);
    },
    [clearRefreshTimer, fetchReadyOrders],
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      return fetchReadyOrders(opts);
    },
    [fetchReadyOrders],
  );

  const readyOrders = useMemo(() => {
    return orders
      .map((order) => scoreOffer(order, driverLocation))
      .sort(sortOffers);
  }, [driverLocation, orders]);

  const acceptOrder = useCallback(
    async (orderId: string) => {
      if (!user?.id) throw new Error("Driver account required");

      const { data: activeOrder, error: activeError } = await db
        .from("orders")
        .select("id")
        .eq("driver_id", user.id)
        .in("status", ACTIVE_DRIVER_STATUSES)
        .limit(1)
        .maybeSingle();

      if (activeError) throw activeError;
      if (activeOrder?.id) throw new Error("Finish your current order first.");

      const { data: rpcData, error: rpcError } = await db.rpc("claim_order_for_driver", {
        p_order_id: orderId,
        p_driver_id: user.id,
      });

      if (rpcError) {
        const { error: updateError } = await db
          .from("orders")
          .update({
            driver_id: user.id,
            driver_assigned_at: new Date().toISOString(),
            driver_accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "ready")
          .is("driver_id", null);

        if (updateError) throw updateError;
      } else if (rpcData === false) {
        throw new Error("This order was already taken.");
      }

      await db
        .from("delivery_users")
        .update({
          driver_status: "busy",
          is_online: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      await refreshUserData?.();

      const accepted = orders.find((order) => order.id === orderId) || null;
      scheduleRefresh(100);

      return accepted;
    },
    [orders, refreshUserData, scheduleRefresh, user?.id],
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchReadyOrders();

    return () => {
      mountedRef.current = false;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, fetchReadyOrders]);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    channelKeyRef.current += 1;
    const topic = `driver-ready-orders-${user.id}-${channelKeyRef.current}-${Date.now()}`;
    const channel = supabase.channel(topic);
    channelRef.current = channel;

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () =>
        scheduleRefresh(150),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () =>
        scheduleRefresh(150),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, () =>
        scheduleRefresh(150),
      )
      .subscribe();

    return () => {
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, scheduleRefresh, user?.id]);

  useEffect(() => {
    if (!enabled || !user?.id || pollMs <= 0) return;

    const interval = setInterval(() => {
      fetchReadyOrders({ silent: true, force: true });
    }, pollMs);

    return () => clearInterval(interval);
  }, [enabled, fetchReadyOrders, pollMs, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") fetchReadyOrders({ silent: true, force: true });
    });

    return () => sub.remove();
  }, [fetchReadyOrders]);

  return {
    orders,
    readyOrders,
    availableOrders: readyOrders,
    readyOrdersCount: readyOrders.length,
    readyCount: readyOrders.length,
    count: readyOrders.length,
    currentOrder,
    hasCurrentOrder: Boolean(currentOrder?.id),
    driverLocation,
    driverOnline,
    loading,
    refreshing,
    error,
    notice,
    fetchReadyOrders,
    refreshReadyOrders: fetchReadyOrders,
    refetch: fetchReadyOrders,
    refresh,
    acceptOrder,
  };
}
