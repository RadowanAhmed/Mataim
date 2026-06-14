// backend/services/driverAppService.ts
import { supabase } from "../supabase";
import { formatMoney, toUGX } from "../utils/currency";
import { resolveDriverDeliveryPay, withDriverPay } from "../utils/driverPay";
import { orderRouteForUserType } from "../utils/notificationRoutes";

const db = supabase as any;

export type DriverFilter = "available" | "active" | "completed" | "cancelled";

export type DriverLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
};

export type ServiceResult<T = any> = {
  success: boolean;
  data?: T;
  error?: any;
  message?: string;
};

export const ACTIVE_DRIVER_ORDER_STATUSES = ["ready", "out_for_delivery"];

const orderSelect = `
  *,
  restaurants!orders_restaurant_id_fkey(
    id,
    restaurant_name,
    cuisine_type,
    address,
    latitude,
    longitude,
    image_url,
    restaurant_rating,
    delivery_fee,
    minimum_order
  ),
  users!orders_customer_id_fkey(
    id,
    full_name,
    email,
    phone,
    profile_image_url
  ),
  order_items(
    id,
    quantity,
    unit_price,
    total_price,
    item_name,
    item_description,
    item_image_url,
    menu_items(name, image_url),
    posts(title, image_url)
  )
`;

const compactOrderSelect = `
  *,
  restaurants!orders_restaurant_id_fkey(
    id,
    restaurant_name,
    cuisine_type,
    address,
    latitude,
    longitude,
    image_url,
    restaurant_rating,
    delivery_fee
  ),
  users!orders_customer_id_fkey(
    id,
    full_name,
    phone,
    profile_image_url
  )
`;

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeData = async <T = any>(request: PromiseLike<any>, fallback: T): Promise<T> => {
  try {
    const result = await request;
    if (result?.error) return fallback;
    return (result?.data ?? fallback) as T;
  } catch {
    return fallback;
  }
};

const startOfLocalDayIso = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const startOfLocalWeekIso = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

export const calculateDistanceKm = (
  lat1?: number | string | null,
  lon1?: number | string | null,
  lat2?: number | string | null,
  lon2?: number | string | null,
) => {
  const aLat = toNumber(lat1, NaN);
  const aLon = toNumber(lon1, NaN);
  const bLat = toNumber(lat2, NaN);
  const bLon = toNumber(lon2, NaN);

  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371;
  const dLat = deg2rad(bLat - aLat);
  const dLon = deg2rad(bLon - aLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(aLat)) *
    Math.cos(deg2rad(bLat)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
};

const normalizeOrders = (orders: any[] = [], location?: DriverLocation | null) => {
  return orders.map((order) => {
    const restaurant = order.restaurants || order.restaurant || {};
    const distance = location
      ? calculateDistanceKm(
        location.latitude,
        location.longitude,
        restaurant.latitude,
        restaurant.longitude,
      )
      : null;

    const paid = withDriverPay(order);
    return {
      ...paid,
      distance,
      restaurant,
      customer: order.users || order.customer || null,
    };
  });
};

export class DriverAppService {
  static async getDriverProfile(driverId: string): Promise<ServiceResult> {
    try {
      const [{ data: driver, error: driverError }, { data: baseUser }] = await Promise.all([
        db.from("delivery_users").select("*").eq("id", driverId).maybeSingle(),
        db.from("users").select("*").eq("id", driverId).maybeSingle(),
      ]);

      if (driverError) throw driverError;
      return { success: true, data: { ...(baseUser || {}), ...(driver || {}) } };
    } catch (error) {
      return { success: false, error, message: "Failed to load driver profile" };
    }
  }

  static async getDriverProfileDetails(driverId: string): Promise<ServiceResult> {
    try {
      const profileResult = await this.getDriverProfile(driverId);
      const driver = profileResult.data || {};
      const todayStart = startOfLocalDayIso();
      const weekStart = startOfLocalWeekIso();

      const [wallet, bankAccount, ratings, deliveredOrders, todayTransactions, weekTransactions] =
        await Promise.all([
          safeData(
            db
              .from("user_wallets")
              .select("*")
              .eq("user_id", driverId)
              .eq("user_type", "driver")
              .maybeSingle(),
            null,
          ),
          safeData(
            db
              .from("bank_accounts")
              .select("id, bank_name, account_holder_name, account_number_masked, routing_number_masked, mobile_money_provider, mobile_money_phone_masked, is_default, created_at")
              .eq("user_id", driverId)
              .eq("user_type", "driver")
              .eq("is_active", true)
              .order("is_default", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            null,
          ),
          safeData(
            db.from("reviews").select("rating").eq("driver_id", driverId).eq("type", "driver"),
            [],
          ),
          safeData(
            db
              .from("orders")
              .select("id, delivery_fee, driver_payout_amount, actual_delivery_time, estimated_delivery_time, created_at")
              .eq("driver_id", driverId)
              .eq("status", "delivered"),
            [],
          ),
          safeData(
            db
              .from("transactions")
              .select("amount")
              .eq("user_id", driverId)
              .eq("user_type", "driver")
              .in("type", ["driver_payout", "tip"])
              .eq("status", "completed")
              .gte("created_at", todayStart),
            [],
          ),
          safeData(
            db
              .from("transactions")
              .select("amount")
              .eq("user_id", driverId)
              .eq("user_type", "driver")
              .in("type", ["driver_payout", "tip"])
              .eq("status", "completed")
              .gte("created_at", weekStart),
            [],
          ),
        ]);

      const ratingRows = Array.isArray(ratings) ? ratings : [];
      const walletRecord = wallet as any;
      const bankAccountRecord = bankAccount as any;
      const completedRows = Array.isArray(deliveredOrders) ? deliveredOrders : [];
      const todayRows = Array.isArray(todayTransactions) ? todayTransactions : [];
      const weekRows = Array.isArray(weekTransactions) ? weekTransactions : [];
      const storedCompletedDeliveries = toNumber(driver.total_deliveries, 0);
      const completedDeliveries =
        storedCompletedDeliveries > 0
          ? Math.max(storedCompletedDeliveries, completedRows.length)
          : completedRows.length;
      const storedAcceptedOrders = toNumber(driver.accepted_orders, 0);
      const acceptedOrders =
        storedAcceptedOrders > 0 ? Math.max(storedAcceptedOrders, completedDeliveries) : completedDeliveries;
      const storedOfferedOrders = toNumber(driver.total_offered_orders, 0);
      const offeredOrders =
        storedOfferedOrders > 0 ? Math.max(storedOfferedOrders, acceptedOrders) : acceptedOrders;
      const cancelledOrders = toNumber(driver.cancelled_orders, 0);
      const ordersWithEta = completedRows.filter((order: any) => order.actual_delivery_time && order.estimated_delivery_time);
      const onTimeFromOrders = ordersWithEta.filter((order: any) => {
        if (!order.actual_delivery_time || !order.estimated_delivery_time) return false;
        return new Date(order.actual_delivery_time).getTime() <= new Date(order.estimated_delivery_time).getTime();
      }).length;
      const storedOnTimeDeliveries = toNumber(driver.on_time_deliveries, 0);
      const onTimeDeliveries =
        storedOnTimeDeliveries > 0
          ? Math.max(storedOnTimeDeliveries, onTimeFromOrders)
          : ordersWithEta.length > 0
            ? onTimeFromOrders
            : completedDeliveries;
      const todayOrderFallback = completedRows
        .filter((order: any) => order.actual_delivery_time && order.actual_delivery_time >= todayStart)
        .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);
      const weekOrderFallback = completedRows
        .filter((order: any) => order.actual_delivery_time && order.actual_delivery_time >= weekStart)
        .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);
      const todayEarnings = todayRows.reduce((sum: number, tx: any) => sum + toNumber(tx.amount, 0), 0) || toNumber(driver.earnings_today, todayOrderFallback);
      const weekEarnings = weekRows.reduce((sum: number, tx: any) => sum + toNumber(tx.amount, 0), 0) || toNumber(driver.earnings_week, weekOrderFallback);
      const storedRatingCount = toNumber(driver.rating_count, 0);
      const ratingAverage = ratingRows.length
        ? ratingRows.reduce((sum: number, item: any) => sum + toNumber(item.rating, 0), 0) / ratingRows.length
        : storedRatingCount > 0
          ? toNumber(driver.rating, 0)
          : 0;

      return {
        success: true,
        data: {
          driver,
          wallet: walletRecord,
          bankAccount: bankAccountRecord,
          stats: {
            ratingAverage,
            ratingCount: ratingRows.length || storedRatingCount,
            completedDeliveries,
            acceptanceRate: offeredOrders > 0 ? Math.round((acceptedOrders / offeredOrders) * 100) : 0,
            onTimeRate: completedDeliveries > 0 ? Math.round((onTimeDeliveries / completedDeliveries) * 100) : 0,
            cancellationRate: acceptedOrders > 0 ? Math.round((cancelledOrders / acceptedOrders) * 100) : 0,
            acceptedOrders,
            offeredOrders,
            cancelledOrders,
          },
          earnings: {
            walletBalance: toNumber(walletRecord?.balance, toNumber(driver.wallet_balance, 0)),
            pendingBalance: toNumber(walletRecord?.pending_balance, toNumber(driver.pending_balance, 0)),
            today: todayEarnings,
            week: weekEarnings,
            lifetime: toNumber(walletRecord?.total_earned, toNumber(driver.total_earnings, 0)),
            totalWithdrawn: toNumber(walletRecord?.total_withdrawn, 0),
          },
        },
      };
    } catch (error) {
      return { success: false, error, message: "Failed to load driver profile details" };
    }
  }

  static async getDriverDashboard(driverId: string): Promise<ServiceResult> {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const [
        profileResult,
        activeOrdersResult,
        availableCountResult,
        deliveredTodayResult,
        unreadNotificationsResult,
        recentNotificationsResult,
      ] = await Promise.all([
        this.getDriverProfile(driverId),
        db
          .from("orders")
          .select(compactOrderSelect)
          .eq("driver_id", driverId)
          .in("status", ACTIVE_DRIVER_ORDER_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(3),
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready")
          .is("driver_id", null),
        db
          .from("orders")
          .select("delivery_fee, driver_payout_amount, final_amount, actual_delivery_time, created_at")
          .eq("driver_id", driverId)
          .eq("status", "delivered")
          .gte("actual_delivery_time", startOfDay.toISOString()),
        db
          .from("driver_notifications")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId)
          .eq("read", false),
        db
          .from("driver_notifications")
          .select("*")
          .eq("driver_id", driverId)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      const deliveredToday = deliveredTodayResult.data || [];
      const todayEarnings = deliveredToday.reduce(
        (sum: number, order: any) => sum + resolveDriverDeliveryPay(order),
        0,
      );

      return {
        success: true,
        data: {
          profile: profileResult.data,
          activeOrders: normalizeOrders(activeOrdersResult.data || []),
          availableOrdersCount: availableCountResult.count || 0,
          notificationsCount: unreadNotificationsResult.count || 0,
          recentNotifications: recentNotificationsResult.data || [],
          stats: {
            todayEarnings,
            completedToday: deliveredToday.length,
            rating: toNumber(profileResult.data?.rating, 0),
            totalDeliveries: toNumber(profileResult.data?.total_deliveries, 0),
            totalEarnings: toNumber(profileResult.data?.total_earnings, 0),
            acceptanceRate: 96,
          },
        },
      };
    } catch (error) {
      return { success: false, error, message: "Failed to load dashboard" };
    }
  }

  static async setOnlineStatus(
    driverId: string,
    isOnline: boolean,
    location?: DriverLocation | null,
  ): Promise<ServiceResult> {
    try {
      const updates: Record<string, any> = {
        is_online: isOnline,
        driver_status: isOnline ? "available" : "offline",
        updated_at: new Date().toISOString(),
      };

      if (location) {
        updates.current_location_lat = location.latitude;
        updates.current_location_lng = location.longitude;
        updates.location_accuracy = location.accuracy ? String(location.accuracy) : null;
        updates.last_location_update = new Date().toISOString();
      }

      const { data, error } = await db
        .from("delivery_users")
        .update(updates)
        .eq("id", driverId)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (isOnline) {
        await this.createDriverNotification(driverId, {
          title: "You are online",
          body: "Mataim will show nearby delivery requests when restaurants mark orders ready.",
          type: "system",
          data: { screen: "/(driver)/explore", action: "online" },
        });
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error, message: "Failed to update driver status" };
    }
  }

  static async getActiveOrder(driverId: string): Promise<ServiceResult> {
    try {
      const { data, error } = await db
        .from("orders")
        .select(compactOrderSelect)
        .eq("driver_id", driverId)
        .in("status", ACTIVE_DRIVER_ORDER_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: data ? normalizeOrders([data])[0] : null };
    } catch (error) {
      return { success: false, error, message: "Failed to load active order" };
    }
  }

  static async fetchOrders(
    driverId: string,
    filter: DriverFilter,
    location?: DriverLocation | null,
  ): Promise<ServiceResult<any[]>> {
    try {
      let query = db.from("orders").select(compactOrderSelect);

      if (filter === "available") {
        query = query.eq("status", "ready").is("driver_id", null).order("created_at", { ascending: true });
      } else if (filter === "active") {
        query = query.eq("driver_id", driverId).in("status", ACTIVE_DRIVER_ORDER_STATUSES).order("updated_at", { ascending: false });
      } else if (filter === "completed") {
        query = query.eq("driver_id", driverId).eq("status", "delivered").order("actual_delivery_time", { ascending: false });
      } else {
        query = query.eq("driver_id", driverId).eq("status", "cancelled").order("updated_at", { ascending: false });
      }

      const { data, error } = await query.limit(filter === "available" ? 30 : 50);
      if (error) throw error;

      const orders = normalizeOrders(data || [], location);
      if (location && filter === "available") {
        orders.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
      }

      return { success: true, data: orders };
    } catch (error) {
      return { success: false, error, data: [], message: "Failed to load orders" };
    }
  }

  static async acceptOrder(orderId: string, driverId: string): Promise<ServiceResult> {
    try {
      const rpc = await db.rpc("claim_order_for_driver", {
        p_order_id: orderId,
        p_driver_id: driverId,
      });

      if (!rpc.error && rpc.data?.success !== false) {
        return { success: true, data: rpc.data };
      }
    } catch {
      // The RPC is optional. Fall back to a safe conditional update below.
    }

    try {
      const active = await this.getActiveOrder(driverId);
      if (active.data) {
        return {
          success: false,
          message: "Finish your active delivery before accepting another order.",
        };
      }

      const { data, error } = await db
        .from("orders")
        .update({
          driver_id: driverId,
          driver_assigned_at: new Date().toISOString(),
          driver_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "ready")
        .is("driver_id", null)
        .select(compactOrderSelect)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return { success: false, message: "This order was already taken or is no longer ready." };
      }

      const { data: driverInfo } = await db
        .from("delivery_users")
        .select("id, users!inner(full_name, phone, country_code, profile_image_url)")
        .eq("id", driverId)
        .maybeSingle();

      const driverUser = driverInfo?.users;

      await db
        .from("delivery_users")
        .update({ driver_status: "busy", is_online: true, updated_at: new Date().toISOString() })
        .eq("id", driverId);

      await Promise.all([
        this.createDriverNotification(driverId, {
          title: "Order accepted",
          body: `You accepted order #${data.order_number}. Go to the restaurant pickup point.`,
          type: "assignment",
          data: { order_id: orderId, screen: orderRouteForUserType("driver", orderId) },
        }),
        db.from("user_notifications").insert({
          user_id: data.customer_id,
          title: "Driver assigned",
          body: `A driver accepted order #${data.order_number}.`,
          type: "delivery",
          data: {
            order_id: orderId,
            driver_id: driverId,
            driver_name: driverUser?.full_name,
            driver_profile_image_url: driverUser?.profile_image_url,
            driver_phone: driverUser?.phone,
            driver_country_code: driverUser?.country_code,
            screen: orderRouteForUserType("customer", orderId),
          },
        }),
        db.from("restaurant_notifications").insert({
          restaurant_id: data.restaurant_id,
          title: "Driver assigned",
          body: `A driver accepted order #${data.order_number}.`,
          type: "delivery",
          data: { order_id: orderId, driver_id: driverId },
        }),
      ]);

      return { success: true, data };
    } catch (error) {
      return { success: false, error, message: "Failed to accept order" };
    }
  }

  static async updateOrderStatus(
    orderId: string,
    driverId: string,
    status: "out_for_delivery" | "delivered",
    location?: DriverLocation | null,
  ): Promise<ServiceResult> {
    try {
      const now = new Date().toISOString();
      const updates: Record<string, any> = {
        status,
        updated_at: now,
      };

      if (status === "out_for_delivery") {
        updates.driver_location_updated_at = now;
      }

      if (status === "delivered") {
        updates.actual_delivery_time = now;
        updates.payment_status = "completed";
      }

      if (location) {
        const latitude = Number(location.latitude);
        const longitude = Number(location.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          updates.driver_location_lat = latitude;
          updates.driver_location_lng = longitude;
          updates.driver_location_updated_at = now;
        }
      }

      const { data, error } = await db
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .eq("driver_id", driverId)
        .select(
          `id, order_number, customer_id, restaurant_id, delivery_fee, driver_payout_amount, tip_amount, status,
            restaurants!inner(image_url),
            order_items(
              item_image_url,
              posts!inner(image_url),
              menu_items!inner(image_url)
            )`
        )
        .maybeSingle();

      if (error) throw error;
      if (!data) return { success: false, message: "Order not found for this driver." };

      const { data: driverInfo } = await db
        .from("delivery_users")
        .select("id, users!inner(full_name, phone, country_code, profile_image_url)")
        .eq("id", driverId)
        .maybeSingle();

      const driverUser = driverInfo?.users;
      const orderNotificationImage =
        data.order_items?.[0]?.item_image_url ||
        data.order_items?.[0]?.posts?.image_url ||
        data.order_items?.[0]?.menu_items?.image_url ||
        data.restaurants?.image_url || null;

      if (status === "out_for_delivery") {
        void Promise.allSettled([
          db.from("user_notifications").insert({
            user_id: data.customer_id,
            title: "Your order is on the way",
            body: `Order #${data.order_number} has been picked up and is heading to you.`,
            type: "delivery",
            data: {
              order_id: orderId,
              status,
              screen: orderRouteForUserType("customer", orderId),
              order_image: orderNotificationImage,
              order_image_url: orderNotificationImage,
              restaurant_image: orderNotificationImage,
              restaurant_image_url: orderNotificationImage,
              driver_id: driverId,
              driver_name: driverUser?.full_name,
              driver_profile_image_url: driverUser?.profile_image_url,
              driver_phone: driverUser?.phone,
              driver_country_code: driverUser?.country_code,
            },
          }),
          db.from("restaurant_notifications").insert({
            restaurant_id: data.restaurant_id,
            title: "Order picked up",
            body: `Driver picked up order #${data.order_number}.`,
            type: "delivery",
            data: { order_id: orderId, status },
          }),
        ]);
      }

      if (status === "delivered") {
        const deliveryFee = resolveDriverDeliveryPay(data);

        void Promise.allSettled([
          (async () => {
            try {
              await db.rpc("distribute_payments", { p_order_id: orderId });
            } catch {
              // Wallet settlement may already be handled by DB triggers.
            }
          })(),
          db
            .from("delivery_users")
            .update({
              driver_status: "available",
              updated_at: now,
            })
            .eq("id", driverId),
          this.createDriverNotification(driverId, {
            title: "Delivery completed",
            body: `You earned ${formatMoney(deliveryFee)} for order #${data.order_number}.`,
            type: "earning",
            data: { order_id: orderId, amount: deliveryFee, screen: "/(driver)/earnings" },
          }),
          db.from("user_notifications").insert({
            user_id: data.customer_id,
            title: "Order delivered",
            body: `Order #${data.order_number} has been delivered. Enjoy your meal!`,
            type: "order",
            data: {
              order_id: orderId,
              status,
              screen: orderRouteForUserType("customer", orderId),
              order_image: orderNotificationImage,
              order_image_url: orderNotificationImage,
              restaurant_image: orderNotificationImage,
              restaurant_image_url: orderNotificationImage,
            },
          }),
        ]);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error("Driver order status update failed:", error);
      return {
        success: false,
        error,
        message: error?.message || "Failed to update order",
      };
    }
  }

  static async cancelActiveOrder(
    orderId: string,
    driverId: string,
    reason = "Driver cancelled from Explore",
  ): Promise<ServiceResult> {
    try {
      const { data, error } = await db
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("driver_id", driverId)
        .in("status", ACTIVE_DRIVER_ORDER_STATUSES)
        .select(
          `id, order_number, customer_id, restaurant_id,
            restaurants!inner(image_url),
            order_items(
              item_image_url,
              posts!inner(image_url),
              menu_items!inner(image_url)
            )`
        )
        .maybeSingle();

      if (error) throw error;
      if (!data) return { success: false, message: "This delivery cannot be cancelled from your driver account." };

      const orderNotificationImage =
        data.order_items?.[0]?.item_image_url ||
        data.order_items?.[0]?.posts?.image_url ||
        data.order_items?.[0]?.menu_items?.image_url ||
        data.restaurants?.image_url || null;

      await db
        .from("delivery_users")
        .update({
          driver_status: "available",
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      await Promise.all([
        this.createDriverNotification(driverId, {
          title: "Delivery cancelled",
          body: `Order #${data.order_number} was cancelled.`,
          type: "order",
          data: { order_id: orderId, reason, screen: orderRouteForUserType("driver", orderId) },
        }),
        db.from("user_notifications").insert({
          user_id: data.customer_id,
          title: "Order cancelled",
          body: `Order #${data.order_number} was cancelled by the driver.`,
          type: "order",
          data: {
            order_id: orderId,
            reason,
            screen: orderRouteForUserType("customer", orderId),
            order_image: orderNotificationImage,
            order_image_url: orderNotificationImage,
            restaurant_image: orderNotificationImage,
            restaurant_image_url: orderNotificationImage,
          },
        }),
        db.from("restaurant_notifications").insert({
          restaurant_id: data.restaurant_id,
          title: "Delivery cancelled",
          body: `Driver cancelled order #${data.order_number}.`,
          type: "delivery",
          data: { order_id: orderId, driver_id: driverId, reason },
        }),
      ]);

      return { success: true, data };
    } catch (error) {
      return { success: false, error, message: "Failed to cancel delivery" };
    }
  }

  static async fetchOrderDetails(orderId: string, driverId: string): Promise<ServiceResult> {
    try {
      const { data, error } = await db
        .from("orders")
        .select(orderSelect)
        .eq("id", orderId)
        .or(`driver_id.eq.${driverId},driver_id.is.null`)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { success: false, message: "Order not found" };

      const [{ data: updates }, { data: conversation }] = await Promise.all([
        db
          .from("order_notifications")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
        db
          .from("conversations")
          .select("*")
          .eq("driver_id", driverId)
          .or(`customer_id.eq.${data.customer_id},restaurant_id.eq.${data.restaurant_id}`)
          .eq("is_active", true)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        success: true,
        data: {
          ...normalizeOrders([data])[0],
          updates: updates || [],
          conversation,
        },
      };
    } catch (error) {
      return { success: false, error, message: "Failed to load order details" };
    }
  }

  static async updateLocation(
    driverId: string,
    location: DriverLocation,
    orderId?: string | null,
  ): Promise<ServiceResult> {
    try {
      await db
        .from("delivery_users")
        .update({
          current_location_lat: location.latitude,
          current_location_lng: location.longitude,
          location_accuracy: location.accuracy ? String(location.accuracy) : null,
          last_location_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      if (orderId) {
        await Promise.all([
          db
            .from("orders")
            .update({
              driver_location_lat: String(location.latitude),
              driver_location_lng: String(location.longitude),
              driver_location_updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .eq("driver_id", driverId),
          db.from("location_history").insert({
            order_id: orderId,
            driver_id: driverId,
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            accuracy: location.accuracy ? String(location.accuracy) : null,
            heading: location.heading ? String(location.heading) : null,
            speed: location.speed ? String(location.speed) : null,
          }),
          db.from("driver_locations").upsert(
            {
              driver_id: driverId,
              order_id: orderId,
              lat: location.latitude,
              lng: location.longitude,
              accuracy: location.accuracy ?? null,
              heading: location.heading ?? null,
              speed: location.speed ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "driver_id,order_id" },
          ),
        ]);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error, message: "Failed to update location" };
    }
  }

  static async fetchEarnings(driverId: string): Promise<ServiceResult> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [{ data: driver }, { data: orders }] = await Promise.all([
        db
          .from("delivery_users")
          .select("earnings_today, total_earnings, total_deliveries, rating")
          .eq("id", driverId)
          .maybeSingle(),
        db
          .from("orders")
          .select("id, order_number, delivery_fee, driver_payout_amount, tip_amount, final_amount, actual_delivery_time, created_at, delivery_address, restaurants!orders_restaurant_id_fkey(restaurant_name,image_url,latitude,longitude)")
          .eq("driver_id", driverId)
          .eq("status", "delivered")
          .order("actual_delivery_time", { ascending: false })
          .limit(80),
      ]);

      const allOrders = orders || [];
      const todayEarnings = allOrders
        .filter((order: any) => new Date(order.actual_delivery_time || order.created_at) >= today)
        .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);
      const weeklyEarnings = allOrders
        .filter((order: any) => new Date(order.actual_delivery_time || order.created_at) >= weekStart)
        .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);
      const monthlyEarnings = allOrders
        .filter((order: any) => new Date(order.actual_delivery_time || order.created_at) >= monthStart)
        .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);

      const weekDays = Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const value = allOrders
          .filter((order: any) => {
            const stamp = new Date(order.actual_delivery_time || order.created_at);
            return stamp >= dayStart && stamp <= dayEnd;
          })
          .reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0);
        return {
          label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
          value,
        };
      });

      return {
        success: true,
        data: {
          today: todayEarnings || toNumber(driver?.earnings_today, 0),
          weekly: weeklyEarnings,
          monthly: monthlyEarnings,
          total: toNumber(driver?.total_earnings, 0) || allOrders.reduce((sum: number, order: any) => sum + resolveDriverDeliveryPay(order), 0),
          completed: allOrders.length,
          rating: toNumber(driver?.rating, 0),
          weekDays,
          recentTransactions: allOrders.slice(0, 10),
        },
      };
    } catch (error) {
      return { success: false, error, message: "Failed to load earnings" };
    }
  }

  static async fetchNotifications(driverId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await db
        .from("driver_notifications")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error, data: [], message: "Failed to load notifications" };
    }
  }

  static async markNotificationRead(notificationId: string): Promise<ServiceResult> {
    try {
      const { error } = await db
        .from("driver_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  static async markAllNotificationsRead(driverId: string): Promise<ServiceResult> {
    try {
      const { error } = await db
        .from("driver_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("driver_id", driverId)
        .eq("read", false);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  static async createDriverNotification(
    driverId: string,
    payload: { title: string; body: string; type?: string; data?: Record<string, any> },
  ): Promise<ServiceResult> {
    try {
      const { data, error } = await db
        .from("driver_notifications")
        .insert({
          driver_id: driverId,
          title: payload.title,
          body: payload.body,
          type: payload.type || "system",
          data: payload.data || {},
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }

  static async fetchDriverConversations(driverId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data: conversations, error } = await db
        .from("conversations")
        .select("*")
        .eq("driver_id", driverId)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const rows = conversations || [];
      const customerIds = rows.map((row: any) => row.customer_id).filter(Boolean);
      const restaurantIds = rows.map((row: any) => row.restaurant_id).filter(Boolean);

      const [{ data: customers }, { data: restaurants }] = await Promise.all([
        customerIds.length
          ? db.from("users").select("id, full_name, profile_image_url, phone").in("id", customerIds)
          : Promise.resolve({ data: [] }),
        restaurantIds.length
          ? db.from("restaurants").select("id, restaurant_name, image_url, address").in("id", restaurantIds)
          : Promise.resolve({ data: [] }),
      ]);

      const customerMap = new Map((customers || []).map((user: any) => [user.id, user]));
      const restaurantMap = new Map((restaurants || []).map((restaurant: any) => [restaurant.id, restaurant]));

      return {
        success: true,
        data: rows.map((row: any) => ({
          ...row,
          customer: customerMap.get(row.customer_id),
          restaurant: restaurantMap.get(row.restaurant_id),
        })),
      };
    } catch (error) {
      return { success: false, error, data: [], message: "Failed to load conversations" };
    }
  }

  static async fetchMessages(conversationId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await db
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error, data: [], message: "Failed to load messages" };
    }
  }

  static async sendMessage(
    conversationId: string,
    senderId: string,
    message: string,
  ): Promise<ServiceResult> {
    try {
      const cleanMessage = message.trim();
      if (!cleanMessage) return { success: false, message: "Message is empty" };

      const { data, error } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          message: cleanMessage,
          message_type: "text",
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      await db
        .from("conversations")
        .update({
          last_message: cleanMessage,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return { success: true, data };
    } catch (error) {
      return { success: false, error, message: "Failed to send message" };
    }
  }

  static async getOrCreateOrderConversation(order: any, driverId: string): Promise<ServiceResult> {
    try {
      const { data: existing } = await db
        .from("conversations")
        .select("*")
        .eq("driver_id", driverId)
        .eq("customer_id", order.customer_id)
        .eq("order_id", order.id)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) return { success: true, data: existing };

      const { data: legacyExisting } = await db
        .from("conversations")
        .select("*")
        .eq("driver_id", driverId)
        .eq("customer_id", order.customer_id)
        .eq("restaurant_id", order.restaurant_id)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacyExisting) {
        if (!legacyExisting.order_id && order.id) {
          await db
            .from("conversations")
            .update({ order_id: order.id, conversation_type: "customer_driver" })
            .eq("id", legacyExisting.id);
        }
        return { success: true, data: { ...legacyExisting, order_id: legacyExisting.order_id || order.id } };
      }

      const { data, error } = await db
        .from("conversations")
        .insert({
          driver_id: driverId,
          customer_id: order.customer_id,
          restaurant_id: order.restaurant_id,
          order_id: order.id,
          conversation_type: "customer_driver",
          is_active: true,
          last_message: "Conversation started",
          last_message_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error, message: "Failed to open conversation" };
    }
  }
}
