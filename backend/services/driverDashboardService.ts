// backend/services/driverDashboardService.ts
import { supabase } from "@/backend/supabase";

const db = supabase as any;

export interface DashboardStats {
  // Earnings
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;
  earningsTotal: number;

  // Trips
  tripsCompleted: number;
  tripsCancelled: number;
  tripsPending: number;
  averageRating: number;
  ratingCount: number;

  // Status
  totalDeliveries: number;
  acceptanceRate: number;
  onTimeRate: number;
}

/**
 * Calculate earnings for a specific time period (uses driver_payout_amount which includes distance-based calculations)
 */
export const calculateEarnings = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<number> => {
  try {
    const { data, error } = await db
      .from("orders")
      .select("driver_payout_amount, distance_km")
      .eq("driver_id", userId)
      .eq("status", "delivered")
      .gte("actual_delivery_time", startDate.toISOString())
      .lt("actual_delivery_time", endDate.toISOString());

    if (error) throw error;

    return (data || []).reduce((sum: number, order: any) => sum + Number(order.driver_payout_amount || 0), 0);
  } catch (error) {
    console.error("Error calculating earnings:", error);
    return 0;
  }
};

/**
 * Get comprehensive dashboard stats
 */
export const getDashboardStats = async (userId: string): Promise<DashboardStats> => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      earningsTodayRes,
      earningsWeekRes,
      earningsMonthRes,
      driverRes,
      ratingsRes,
      tripsCompleteRes,
      tripsCancelledRes,
      tripsPendingRes,
    ] = await Promise.all([
      // Today's earnings
      db
        .from("orders")
        .select("driver_payout_amount")
        .eq("driver_id", userId)
        .eq("status", "delivered")
        .gte("actual_delivery_time", today.toISOString())
        .lt("actual_delivery_time", tomorrow.toISOString()),

      // Weekly earnings
      db
        .from("orders")
        .select("driver_payout_amount")
        .eq("driver_id", userId)
        .eq("status", "delivered")
        .gte("actual_delivery_time", weekStart.toISOString())
        .lt("actual_delivery_time", weekEnd.toISOString()),

      // Monthly earnings
      db
        .from("orders")
        .select("driver_payout_amount")
        .eq("driver_id", userId)
        .eq("status", "delivered")
        .gte("actual_delivery_time", monthStart.toISOString())
        .lte("actual_delivery_time", monthEnd.toISOString()),

      // Driver info
      db
        .from("delivery_users")
        .select("total_earnings, total_deliveries, acceptance_rate, on_time_rate")
        .eq("user_id", userId)
        .maybeSingle(),

      // Ratings
      db.from("reviews").select("rating").eq("driver_id", userId).eq("type", "driver"),

      // Completed trips
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .eq("status", "delivered"),

      // Cancelled trips
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .eq("status", "cancelled"),

      // Pending trips
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .in("status", ["ready", "out_for_delivery"]),
    ]);

    const driver = driverRes.data as any;
    const ratings = (ratingsRes.data || []) as any[];
    const ratingAverage = ratings.length
      ? ratings.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / ratings.length
      : 0;

    const earningsToday = (earningsTodayRes.data || []).reduce(
      (sum: number, o: any) => sum + Number(o.driver_payout_amount || 0),
      0
    );
    const earningsWeek = (earningsWeekRes.data || []).reduce(
      (sum: number, o: any) => sum + Number(o.driver_payout_amount || 0),
      0
    );
    const earningsMonth = (earningsMonthRes.data || []).reduce(
      (sum: number, o: any) => sum + Number(o.driver_payout_amount || 0),
      0
    );

    return {
      earningsToday,
      earningsWeek,
      earningsMonth,
      earningsTotal: Number(driver?.total_earnings || 0),
      tripsCompleted: tripsCompleteRes.count || 0,
      tripsCancelled: tripsCancelledRes.count || 0,
      tripsPending: tripsPendingRes.count || 0,
      averageRating: ratingAverage,
      ratingCount: ratings.length,
      totalDeliveries: Number(driver?.total_deliveries || 0),
      acceptanceRate: Number(driver?.acceptance_rate || 0),
      onTimeRate: Number(driver?.on_time_rate || 0),
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      earningsToday: 0,
      earningsWeek: 0,
      earningsMonth: 0,
      earningsTotal: 0,
      tripsCompleted: 0,
      tripsCancelled: 0,
      tripsPending: 0,
      averageRating: 0,
      ratingCount: 0,
      totalDeliveries: 0,
      acceptanceRate: 0,
      onTimeRate: 0,
    };
  }
};

/**
 * Get trip statistics
 */
export const getTripStats = async (userId: string) => {
  try {
    const [completed, cancelled, active, ratings] = await Promise.all([
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .eq("status", "delivered"),
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .eq("status", "cancelled"),
      db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId)
        .in("status", ["ready", "out_for_delivery"]),
      db.from("reviews").select("rating").eq("driver_id", userId).eq("type", "driver"),
    ]);

    const ratingsList = (ratings.data || []) as any[];
    const averageRating = ratingsList.length
      ? ratingsList.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / ratingsList.length
      : 0;

    return {
      completed: completed.count || 0,
      cancelled: cancelled.count || 0,
      active: active.count || 0,
      averageRating: averageRating.toFixed(1),
      ratingCount: ratingsList.length,
    };
  } catch (error) {
    console.error("Error fetching trip stats:", error);
    return {
      completed: 0,
      cancelled: 0,
      active: 0,
      averageRating: "0",
      ratingCount: 0,
    };
  }
};
