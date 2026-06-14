// app/(driver)/earnings.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppText from "../components/common/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import animations from "@/constent/animations";

const db = supabase as any;

function formatCurrency(value?: number | string | null) {
  return formatMoney(value);
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
    total: 0,
    pending: 0,
    completedTrips: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);


  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const filteredTransactions = useCallback(() => {
    if (selectedFilter === "all") return recentTransactions;

    const now = new Date();
    const today = startOfDay();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return recentTransactions.filter((transaction) => {
      const deliveryDate = new Date(transaction.actual_delivery_time || transaction.created_at);

      switch (selectedFilter) {
        case "today":
          return deliveryDate >= today && deliveryDate < new Date(today.getTime() + 86400000);
        case "weekly":
          return deliveryDate >= weekStart;
        case "monthly":
          return deliveryDate >= monthStart;
        default:
          return true;
      }
    });
  }, [recentTransactions, selectedFilter]);

  const getFilterLabel = () => {
    switch (selectedFilter) {
      case "today": return "Today";
      case "weekly": return "Week";
      case "monthly": return "Month";
      default: return "All";
    }
  };

  const fetchEarningsData = useCallback(async (showSpinner = true) => {
    if (!user?.id) return;

    try {
      if (showSpinner) setLoading(true);

      const today = startOfDay();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const { data: driverData } = await db
        .from("delivery_users")
        .select("earnings_today, total_earnings")
        .eq("id", user.id)
        .maybeSingle();

      const { data: deliveredOrders, error } = await db
        .from("orders")
        .select(`
          id, 
          order_number, 
          driver_payout_amount, 
          actual_delivery_time, 
          created_at,
          restaurants:restaurants!orders_restaurant_id_fkey(restaurant_name)
        `)
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .order("actual_delivery_time", { ascending: false });

      if (error) throw error;

      const orders = deliveredOrders || [];
      let todayTotal = 0;
      let weekTotal = 0;
      let monthTotal = 0;
      let pending = 0;

      orders.forEach((order: any) => {
        const deliveryDate = new Date(order.actual_delivery_time || order.created_at);
        const fee = Number(order.driver_payout_amount || 0);

        if (deliveryDate >= today && deliveryDate < tomorrow) todayTotal += fee;
        if (deliveryDate >= weekStart) weekTotal += fee;
        if (deliveryDate >= monthStart) monthTotal += fee;
        if (order.payment_status !== "completed") pending += fee;
      });

      setEarnings({
        today: Number(driverData?.earnings_today || todayTotal),
        weekly: weekTotal,
        monthly: monthTotal,
        total: Number(driverData?.total_earnings || 0),
        pending,
        completedTrips: orders.length,
      });
      setRecentTransactions(orders.slice(0, 8));
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEarningsData(false);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <AppText style={styles.loadingText} weight="medium">Loading earnings...</AppText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View>
          <AppText style={styles.headerTitle} weight="bold">Earnings</AppText>
          <AppText style={styles.headerSubtitle} weight="regular">
            Track your delivery income
          </AppText>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push("/(driver)/support" as any)}>
          <MaterialCommunityIcons name="help-circle-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
      >
        {/* Total Earnings */}
        <View style={styles.totalCard}>
          <View style={{ flexDirection: 'row', height: 22, width: '100%' }}>
            <AppText style={styles.totalLabel} weight="medium">Total Earnings</AppText>
            <LottieView
              source={animations.cardanimation}
              style={styles.cardanimation}
              autoPlay
              loop={false}
            />
          </View>
          <AppText style={styles.totalAmount} weight="heavy">
            {formatCurrency(earnings.total)}
          </AppText>
          <AppText style={styles.totalNote} weight="regular">
            {earnings.completedTrips} completed deliveries
          </AppText>

          <TouchableOpacity style={styles.withdrawButton} onPress={() => router.push("/(driver)/withdraw" as any)}>
            <Ionicons name="wallet-outline" size={18} color="#111827" />
            <AppText style={styles.withdrawButtonText} weight="bold">Withdraw</AppText>
          </TouchableOpacity>
        </View>

        {/* Period Earnings */}
        {/* <View style={styles.earningsGrid}>
          <View style={styles.earningCard}>
            <Ionicons name="today-outline" size={20} color="#FF6B35" />
            <AppText style={styles.earningValue} weight="heavy">{formatCurrency(earnings.today)}</AppText>
            <AppText style={styles.earningLabel} weight="regular">Today</AppText>
          </View>

          <View style={styles.earningCard}>
            <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            <AppText style={styles.earningValue} weight="heavy">{formatCurrency(earnings.weekly)}</AppText>
            <AppText style={styles.earningLabel} weight="regular">Last 7 Days</AppText>
          </View>

          <View style={styles.earningCard}>
            <Ionicons name="stats-chart-outline" size={20} color="#10B981" />
            <AppText style={styles.earningValue} weight="heavy">{formatCurrency(earnings.monthly)}</AppText>
            <AppText style={styles.earningLabel} weight="regular">This Month</AppText>
          </View>

          <View style={styles.earningCard}>
            <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
            <AppText style={styles.earningValue} weight="heavy">{formatCurrency(earnings.pending)}</AppText>
            <AppText style={styles.earningLabel} weight="regular">Pending</AppText>
          </View>
        </View> */}

        {/* Recent Transactions */}
        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <AppText style={styles.sectionTitle} weight="bold">Recent Transactions</AppText>
            <TouchableOpacity
              style={styles.filterTrigger}
              onPress={() => setShowFilterOptions(!showFilterOptions)}
              activeOpacity={0.85}
            >
              <Ionicons name="funnel-outline" size={14} color="#6B7280" />
              <AppText style={styles.filterTriggerText} weight="medium">{getFilterLabel()}</AppText>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Filter Dropdown */}
          {showFilterOptions && (
            <View style={styles.filterDropdown}>
              {[
                { id: "all", label: "All" },
                { id: "today", label: "Today" },
                { id: "weekly", label: "This Week" },
                { id: "monthly", label: "This Month" },
              ].map((option) => {
                const isActive = selectedFilter === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.filterOption, isActive && styles.filterOptionActive]}
                    onPress={() => {
                      setSelectedFilter(option.id);
                      setShowFilterOptions(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <AppText style={[styles.filterOptionText, isActive && styles.filterOptionTextActive]} weight="medium">
                      {option.label}
                    </AppText>
                    {isActive && (
                      <Ionicons name="checkmark" size={16} color="#FF6B35" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {filteredTransactions().length === 0 ? (
            <AppText style={styles.emptyText} weight="regular">
              No completed deliveries for this period.
            </AppText>
          ) : (
            filteredTransactions().map((transaction) => (
              <View key={transaction.id} style={styles.transactionRow}>
                <View style={styles.transactionIcon}>
                  <Ionicons name="bicycle" size={20} color="#10B981" />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>
                    Order #{transaction.order_number}
                  </Text>
                  <AppText style={styles.transactionSubtitle} weight="regular">
                    {transaction.restaurants?.restaurant_name || "Restaurant"}
                  </AppText>
                </View>
                <AppText style={styles.transactionAmount} weight="bold">
                  {formatCurrency(transaction.driver_payout_amount)}
                </AppText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginBottom: -50
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB"
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 16
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1"
  },
  headerTitle: {
    fontSize: 22,
    color: "#111827"
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center"
  },

  scrollView: { flex: 1 },
  content: { padding: 12, paddingBottom: 100 },

  /* Total Card - Clean & Prominent */
  totalCard: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20
  },

  cardanimation: {
    width: 57,
    height: 57,
    left: "62%",
    bottom: 8
  },

  totalLabel: {
    color: "#D1D5DB",
    fontSize: 13.5
  },
  totalAmount: {
    color: "#fff",
    fontSize: 28,
    marginVertical: 6
  },
  totalNote: {
    color: "#9CA3AF",
    fontSize: 13
  },
  withdrawButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 30,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  withdrawButtonText: {
    color: "#111827",
    fontSize: 15,
    letterSpacing: 0.2
  },

  /* Earnings Grid */
  earningsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24
  },
  earningCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6
  },
  earningValue: {
    fontSize: 16.5,
    color: "#111827",
    marginTop: 10
  },
  earningLabel: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4
  },

  /* Transactions */
  transactionsCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12
  },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 0.5,
    borderColor: "#000000ab",
  },
  filterTriggerText: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "Inter",
  },
  filterDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.4,
    borderColor: "#0000005f",
    marginBottom: 12,
    overflow: "hidden",
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.3,
    borderBottomColor: "#F3F4F6",
  },
  filterOptionActive: {
    backgroundColor: "#FFF7ED",
  },
  filterOptionText: {
    fontSize: 13,
    color: "#374151",
    fontFamily: "Inter",
  },
  filterOptionTextActive: {
    color: "#FF6B35",
  },

  sectionTitle: {
    fontSize: 17,
    color: "#111827",
    marginBottom: 12
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f66e"
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 30,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },
  transactionInfo: { flex: 1 },
  transactionTitle: {
    fontSize: 14.8,
    fontWeight: '600',
  },
  transactionSubtitle: {
    color: "#6B7280",
    fontSize: 12.8,
    marginTop: 2
  },
  transactionAmount: {
    color: "#10B981",
    fontSize: 15
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 13.6,
    textAlign: "center",
    paddingVertical: 30
  },
});