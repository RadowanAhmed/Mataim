// app/(driver)/history.tsx
import { DriverListItem, DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import animationAssets from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import React,
{
  useCallback,
  useEffect,
  useState
} from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

function formatCurrency(value?: number | string | null) {
  return formatMoney(value);
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStartDate(period: string) {
  const now = new Date();
  const start = new Date(now);

  if (period === "today") start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - 7);
  if (period === "month") start.setMonth(start.getMonth() - 1);
  if (period === "all") return new Date(0);

  return start;
}

function getStatusColor(status?: string) {
  switch (status) {
    case "delivered":
      return "#10B981";
    case "cancelled":
      return "#EF4444";
    case "out_for_delivery":
      return "#3B82F6";
    case "ready":
      return "#F59E0B";
    default:
      return "#6B7280";
  }
}

export default function DriverHistoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completed: 0,
    cancelled: 0,
    totalEarnings: 0,
    onTimeRate: 0,
  });

  const fetchHistory = useCallback(async (showSpinner = true) => {
    if (!user?.id) return;

    try {
      if (showSpinner) setLoading(true);
      const startDate = getStartDate(selectedPeriod);

      const { data, error } = await db
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          final_amount,
          delivery_fee,
          driver_payout_amount,
          created_at,
          actual_delivery_time,
          estimated_delivery_time,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            address
          )
        `,
        )
        .eq("driver_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = (data || []) as any[];
      const completed = rows.filter((order) => order.status === "delivered");
      const cancelled = rows.filter((order) => order.status === "cancelled");
      const totalEarnings = completed.reduce((sum: number, order: any) => sum + Number(order.driver_payout_amount || 0), 0);
      const onTimeCount = completed.filter((order) => {
        if (!order.actual_delivery_time || !order.estimated_delivery_time) return true;
        return new Date(order.actual_delivery_time).getTime() <= new Date(order.estimated_delivery_time).getTime();
      }).length;

      setDeliveries(rows);
      setStats({
        totalDeliveries: rows.length,
        completed: completed.length,
        cancelled: cancelled.length,
        totalEarnings,
        onTimeRate: completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching driver history:", error);
      setDeliveries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, user?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory(false);
  };

  const renderDelivery = ({ item, index }: { item: any; index: number }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <DriverListItem index={index}>
        <View style={styles.deliveryCard}>
          <View style={styles.deliveryHeader}>
            <View>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
              <Text style={styles.restaurantName}>{item.restaurants?.restaurant_name || "Restaurant"}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {String(item.status || "").replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{formatDate(item.actual_delivery_time || item.created_at)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={14} color="#10B981" />
              <Text style={styles.earningText}>{formatCurrency(item.driver_payout_amount)}</Text>
            </View>
          </View>
        </View>
      </DriverListItem>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>Past trips and delivery performance</Text>
      </View>

      <View style={styles.periodsContainer}>
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[styles.periodChip, selectedPeriod === period.id && styles.periodChipActive]}
            onPress={() => setSelectedPeriod(period.id)}
          >
            <Text style={[styles.periodText, selectedPeriod === period.id && styles.periodTextActive]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" colors={["#FF6B35"]} />}
        ListHeaderComponent={
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatCurrency(stats.totalEarnings)}</Text>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.onTimeRate}%</Text>
                <Text style={styles.statLabel}>On Time</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color="#FF6B35" />
              <Text style={styles.infoText}>
                History helps you verify delivered trips, payment totals, and performance. Delivered orders count toward earnings.
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LottieView source={animationAssets.driver_empty_state} style={styles.emptyAnimation} autoPlay loop />
            <Text style={styles.emptyTitle}>No trips found</Text>
            <Text style={styles.emptyText}>No deliveries match this period yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", marginBottom: -50 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 10, fontSize: 15, color: "#6B7280", fontWeight: "600", fontFamily: "Inter" },
  header: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 0.8, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 23, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  periodsContainer: { flexDirection: "row", gap: 8, padding: 14, backgroundColor: "#fff" },
  periodChip: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 999, backgroundColor: "#F3F4F6" },
  periodChipActive: { backgroundColor: "#FFF1EB", borderWidth: 0.8, borderColor: "#FF6B35" },
  periodText: { fontSize: 12.2, fontWeight: "600", color: "#6B7280", fontFamily: "Inter" },
  periodTextActive: { color: "#FF6B35" },
  listContent: { padding: 13, paddingBottom: 110 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: { width: "48%", backgroundColor: "#fff", borderRadius: 8, padding: 14, borderWidth: 0.8, borderColor: "#E5E7EB" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#111827", fontFamily: "Inter" },
  statLabel: { fontSize: 11.2, color: "#6B7280", marginTop: 3, fontWeight: "600", fontFamily: "Inter" },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF7ED", borderRadius: 14, padding: 12, borderWidth: 0.8, borderColor: "#fed7aa94", marginBottom: 12 },
  infoText: { flex: 1, fontSize: 12, color: "#9A3412", lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  deliveryCard: { backgroundColor: "#fff", borderRadius: 8, padding: 14, borderWidth: 0.8, borderColor: "#e5e7ebef", marginBottom: 12 },
  deliveryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  restaurantName: { fontSize: 13, color: "#6B7280", marginTop: 3, fontWeight: "600", fontFamily: "Inter" },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 5 },
  statusText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.8, borderTopColor: "#F3F4F6", paddingTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "#6B7280", fontSize: 12.2, fontWeight: "600", fontFamily: "Inter" },
  earningText: { color: "#10B981", fontSize: 13.7, fontWeight: "600", fontFamily: "Inter" },
  emptyState: { alignItems: "center", paddingTop: 40 },
  emptyAnimation: { width: 150, height: 150 },
  emptyTitle: { fontSize: 18, color: "#111827", fontWeight: "700", fontFamily: "Inter", letterSpacing: 0.2 },
  emptyText: { color: "#6B7280", marginTop: 6, fontSize: 12.8, fontWeight: "500", fontFamily: "Inter" },
});
