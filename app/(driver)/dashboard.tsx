// app/(driver)/dashboard.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import NotificationBell from "@/app/components/NotificationBell";
import {
  useAuth
} from "@/backend/AuthContext";
import { useReadyOrdersLive } from "@/backend/hooks/useReadyOrdersLive";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { resolveDriverDeliveryPay } from "@/backend/utils/driverPay";
import * as driverStatusService from "@/backend/services/driverStatusService";
import animationAssets, { animations } from "@/constent/animations";
import {
  Ionicons,
  MaterialCommunityIcons
} from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  useRouter
} from "expo-router";
import LottieView from "lottie-react-native";
import React,
{
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppText from "../components/common/AppText";
import { SafeAreaView } from "react-native-safe-area-context";

const ACTIVE_STATUSES = ["ready", "out_for_delivery"];
const db = supabase as any;

function money(v?: number | string | null) {
  return formatMoney(v);
}

function addressText(address: any) {
  if (!address) return "Address not available";
  if (typeof address === "string") {
    try {
      return addressText(JSON.parse(address));
    } catch {
      return address;
    }
  }
  return (
    [address.address_line1, address.address_line2, address.city, address.state, address.country]
      .filter(Boolean)
      .join(", ") ||
    address.formatted_address ||
    "Address not available"
  );
}

function statusColor(status?: string) {
  if (status === "ready") return "#10B981";
  if (status === "out_for_delivery") return "#FF6B35";
  if (status === "delivered") return "#10B981";
  if (status === "cancelled") return "#1F2937";
  return "#6B7280";
}

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const {
    count: liveReadyCount,
    currentOrder: liveActiveOrder,
    notice: liveNotice,
    refreshReadyOrders,
  } = useReadyOrdersLive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [locationMessage, setLocationMessage] = useState("Location not checked yet");
  const [stats, setStats] = useState({ deliveriesToday: 0, totalDeliveries: 0, rating: 0, ratingCount: 0, todayPay: 0, totalPay: 0 });
  const [performance, setPerformance] = useState({ completionRate: 0, onTimeRate: 0, cancellationRate: 0 });
  const hasLoadedDashboardRef = useRef(false);


  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOnline) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);


  const fetchDashboard = useCallback(async () => {
    if (!user?.id) return;

    try {
      if (!refreshing && !hasLoadedDashboardRef.current) setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [driverRes, todayRes, activeRes, unreadRes, ratingRes, metricsRes] = await Promise.all([
        supabase
          .from("delivery_users")
          .select("is_online, total_deliveries, rating, earnings_today, total_earnings, current_location_lat, current_location_lng")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id, delivery_fee, driver_payout_amount, delivery_address, restaurants!orders_restaurant_id_fkey(latitude, longitude)", { count: "exact" })
          .eq("driver_id", user.id)
          .eq("status", "delivered")
          .gte("actual_delivery_time", today.toISOString())
          .lt("actual_delivery_time", tomorrow.toISOString()),
        supabase
          .from("orders")
          .select(
            `
            id,
            customer_id,
            order_number,
            status,
            delivery_fee,
            final_amount,
            delivery_address,
            special_instructions,
            restaurants:restaurants!orders_restaurant_id_fkey(restaurant_name,address,latitude,longitude),
            customers:users!orders_customer_id_fkey(full_name,phone)
          `,
          )
          .eq("driver_id", user.id)
          .in("status", ACTIVE_STATUSES)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("driver_notifications")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", user.id)
          .eq("read", false),
        supabase
          .from("reviews")
          .select("rating")
          .eq("driver_id", user.id)
          .eq("type", "driver"),
        supabase
          .from("orders")
          .select("status, estimated_delivery_time, actual_delivery_time")
          .eq("driver_id", user.id)
          .in("status", ["delivered", "cancelled"])
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      if (driverRes.error) throw driverRes.error;
      if (activeRes.error) throw activeRes.error;

      const driver = driverRes.data as any;
      const ratings = (ratingRes.data || []) as any[];
      const ratingAverage = ratings.length
        ? ratings.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / ratings.length
        : Number(driver?.rating || 0);
      setIsOnline(Boolean(driver?.is_online));
      setDriverStatus(driver?.driver_status || null);
      setStats({
        deliveriesToday: todayRes.count || 0,
        totalDeliveries: Number(driver?.total_deliveries || 0),
        rating: ratingAverage,
        ratingCount: ratings.length,
        todayPay: Number(
          driver?.earnings_today ||
          (todayRes.data || []).reduce((sum: number, o: any) => sum + resolveDriverDeliveryPay(o), 0),
        ),
        totalPay: Number(driver?.total_earnings || 0),
      });

      const metricRows = (metricsRes.data || []) as any[];
      const deliveredRows = metricRows.filter((row) => row.status === "delivered");
      const cancelledRows = metricRows.filter((row) => row.status === "cancelled");
      const assignedCount = deliveredRows.length + cancelledRows.length;
      const onTimeCount = deliveredRows.filter((row) => {
        if (!row.estimated_delivery_time || !row.actual_delivery_time) return true;
        const estimated = new Date(row.estimated_delivery_time).getTime();
        const actual = new Date(row.actual_delivery_time).getTime();
        return actual <= estimated + 10 * 60 * 1000;
      }).length;

      setPerformance({
        completionRate: assignedCount ? Math.round((deliveredRows.length / assignedCount) * 100) : 100,
        onTimeRate: deliveredRows.length ? Math.round((onTimeCount / deliveredRows.length) * 100) : 100,
        cancellationRate: assignedCount ? Math.round((cancelledRows.length / assignedCount) * 100) : 0,
      });
      setCurrentOrder(liveActiveOrder || activeRes.data || null);
      setUnreadNotifications(unreadRes.count || 0);

      if (driver?.current_location_lat && driver?.current_location_lng) {
        setLocationMessage("Location ready for dispatch");
      }
    } catch (error) {
      console.error("Driver dashboard error:", error);
      Alert.alert("Error", "Could not load driver dashboard.");
    } finally {
      hasLoadedDashboardRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [liveActiveOrder, refreshing, user?.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    refreshReadyOrders({ silent: true, force: true });
    fetchDashboard();
  }, [fetchDashboard, refreshReadyOrders]);

  useEffect(() => {
    if (liveActiveOrder?.id) setCurrentOrder(liveActiveOrder);
  }, [liveActiveOrder]);

  const getCurrentLocation = async () => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationMessage("Turn on device location before going online");
        return null;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationMessage("Allow location permission before going online");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationMessage("Location ready for dispatch");
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      setLocationMessage("Current location is unavailable. Enable GPS and try again.");
      return null;
    }
  };

  const toggleOnlineStatus = async () => {
    if (!user?.id) return;
    const goOnline = !isOnline;

    try {
      // Optimistic UI
      setIsOnline(goOnline);
      setDriverStatus(goOnline ? "available" : "offline");

      if (goOnline) {
        await driverStatusService.setDriverOnline(user.id);
      } else {
        await driverStatusService.setDriverOffline(user.id);
      }

      // Refresh local data and ready orders quickly
      await refreshReadyOrders({ silent: true, force: true });
      fetchDashboard();
    } catch (err: any) {
      console.error("Status update error:", err);
      Alert.alert("Error", err?.message || "Could not update status.");
      // Re-fetch to correct optimistic state
      fetchDashboard();
    }
  };

  const setBusy = async () => {
    if (!user?.id) return;
    try {
      // Optimistic
      setDriverStatus("busy");
      await driverStatusService.setDriverBusy(user.id);
      await refreshReadyOrders({ silent: true, force: true });
      fetchDashboard();
    } catch (err: any) {
      console.error("Set busy error:", err);
      Alert.alert("Error", err?.message || "Could not set busy.");
      fetchDashboard();
    }
  };

  const setAvailable = async () => {
    if (!user?.id) return;
    try {
      setDriverStatus("available");
      await driverStatusService.setDriverAvailable(user.id);
      await refreshReadyOrders({ silent: true, force: true });
      fetchDashboard();
    } catch (err: any) {
      console.error("Set available error:", err);
      Alert.alert("Error", err?.message || "Could not set available.");
      fetchDashboard();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshReadyOrders({ silent: true, force: true });
    await fetchDashboard();
  };

  const currentHour = new Date().getHours();

  const greeting =
    currentHour < 12
      ? "Good Morning ☀️"
      : currentHour < 18
        ? "Good Afternoon 🌤️"
        : "Good Evening 🌙";

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <AppText style={styles.loadingText} weight="regular">Loading...</AppText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.greetingRow}>

            <View>
              <AppText style={styles.greetingText} weight="bold">
                {greeting}
              </AppText>

              <AppText style={styles.headerSubtitle} weight="regular">
                {isOnline ? "Ready for deliveries 🚴" : "Currently offline"}
              </AppText>
            </View>
          </View>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" colors={["#FF6B35"]} />}
      >
        <View style={styles.content}>
          <View style={[styles.statusCard, isOnline && styles.statusCardOnline]}>
            <View style={styles.statusInfo}>
              <View style={[styles.statusAnimationContainer, isOnline && styles.statusAnimationContainerOnline]}>
                <Animated.View
                  style={[
                    styles.statusTextBadge,
                    isOnline && styles.statusTextBadgeOnline,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <AppText style={[styles.statusBadgeText, isOnline && styles.statusBadgeTextOnline]} weight="heavy">
                    {isOnline ? "ON" : "OFF"}
                  </AppText>
                </Animated.View>
              </View>
              <View style={styles.statusTextContainer}>
                <View style={styles.statusRow}>
                  <AppText style={[styles.statusText, isOnline && styles.statusTextOnline]} weight="heavy">
                    {isOnline ? "Online" : "Offline"}
                  </AppText>
                  {isOnline && (
                    <View style={styles.liveDotContainer}>
                      <View style={styles.liveDotPulse} />
                      <View style={styles.liveDot} />
                    </View>
                  )}
                </View>
                <AppText style={[styles.statusSubtext, isOnline && styles.statusSubtextOnline]} weight="medium">
                  {isOnline
                    ? `${liveReadyCount} ${liveReadyCount === 1 ? "order" : "orders"} waiting`
                    : "Tap to start delivering"}
                </AppText>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.statusToggle, isOnline ? styles.statusToggleOnline : styles.statusToggleOffline]}
              onPress={toggleOnlineStatus}
              activeOpacity={0.85}
            >
              <View style={[styles.statusToggleKnob, isOnline && styles.statusToggleKnobOnline]}>
                <Ionicons
                  name={isOnline ? "pause-circle" : "play-circle"}
                  size={16}
                  color={isOnline ? "#FFFFFF" : "#FFFFFF"}
                />
              </View>
              <AppText style={styles.statusToggleText} weight="bold">
                {isOnline ? "Go Offline" : "Go Online"}
              </AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.earningsSummaryCard}>
            <View style={styles.earningsHeader}>
              <View>
                <AppText style={styles.earningsEyebrow} weight="medium">Today earnings</AppText>
                <AppText style={styles.earningsValue} weight="heavy">{money(stats.todayPay)}</AppText>
              </View>
              {/* <TouchableOpacity
                style={styles.withdrawShortcut}
                onPress={() => router.push("/(driver)/withdraw" as any)}
              >
                <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity> */}
              <TouchableOpacity
                style={styles.withdrawShortcut}
                onPress={() => router.push("/(driver)/withdraw" as any)}
              >
                <LottieView
                  source={animations.cardanimation}
                  style={styles.cardanimation}
                  autoPlay
                  loop={false}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.earningsMetricRow}>
              <View style={styles.earningsMetric}>
                <AppText style={styles.earningsMetricValue} weight="bold">{stats.deliveriesToday}</AppText>
                <AppText style={styles.earningsMetricLabel} weight="regular">Trips today</AppText>
              </View>
              <View style={styles.earningsMetricDivider} />
              <View style={styles.earningsMetric}>
                <AppText style={styles.earningsMetricValue} weight="bold">{money(stats.totalPay)}</AppText>
                <AppText style={styles.earningsMetricLabel} weight="regular">Lifetime</AppText>
              </View>
              <View style={styles.earningsMetricDivider} />
              <View style={styles.earningsMetric}>
                <AppText style={styles.earningsMetricValue} weight="bold">{liveReadyCount}</AppText>
                <AppText style={styles.earningsMetricLabel} weight="regular">Ready now</AppText>
              </View>
            </View>
          </View>

          {/* SECTION 1: Performance Metrics */}
          <View style={styles.performanceCard}>
            <AppText style={styles.performanceSectionTitle} weight="bold">Performance</AppText>
            <View style={styles.performanceMetricsGrid}>
              <View style={styles.performanceMetricContainer}>
                <View style={styles.circleProgressWrapper}>
                  <View style={[styles.circleProgress, { borderColor: "#FF6B35" }]}>
                    <View style={styles.circleProgressInner}>
                      <AppText style={styles.circleProgressText} weight="heavy">
                        {performance.completionRate}%
                      </AppText>
                    </View>
                  </View>
                </View>
                <AppText style={styles.performanceMetricLabel} weight="medium">Completed</AppText>
                <AppText style={styles.performanceMetricValue} weight="regular">Last 120 trips</AppText>
              </View>

              <View style={styles.performanceMetricContainer}>
                <View style={styles.circleProgressWrapper}>
                  <View style={[styles.circleProgress, { borderColor: "#10B981" }]}>
                    <View style={styles.circleProgressInner}>
                      <AppText style={styles.circleProgressText} weight="heavy">{performance.onTimeRate}%</AppText>
                    </View>
                  </View>
                </View>
                <AppText style={styles.performanceMetricLabel} weight="medium">On time</AppText>
                <AppText style={styles.performanceMetricValue} weight="regular">Delivered trips</AppText>
              </View>

              <View style={styles.performanceMetricContainer}>
                <View style={styles.circleProgressWrapper}>
                  <View style={[styles.circleProgress, { borderColor: "#1F2937" }]}>
                    <View style={styles.circleProgressInner}>
                      <AppText style={styles.circleProgressText} weight="heavy">{performance.cancellationRate}%</AppText>
                    </View>
                  </View>
                </View>
                <AppText style={styles.performanceMetricLabel} weight="medium">Cancelled</AppText>
                <AppText style={styles.performanceMetricValue} weight="regular">Assigned trips</AppText>
              </View>
            </View>
          </View>

          {/* SECTION 2: Earning Milestones & Bonuses */}
          {/* <View style={styles.milestonesCard}>
            <View style={styles.milestonesHeader}>
              <View>
                <AppText style={styles.milestonesTitle} weight="bold">Earning Milestones</AppText>
                <AppText style={styles.milestonesSubtitle} weight="regular">Complete challenges to unlock bonuses</AppText>
              </View>
              <View style={styles.milestoneBadge}>
                <Ionicons name="sparkles" size={16} color="#FF6B35" />
              </View>
            </View>

            <View style={styles.milestonesList}>
              <View style={styles.milestoneItem}>
                <View style={styles.milestoneCheckbox}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.milestoneContent}>
                  <AppText style={styles.milestoneText} weight="bold">10 Deliveries Today</AppText>
                  <AppText style={styles.milestoneReward} weight="regular">+₹100 bonus</AppText>
                </View>
                <View style={styles.milestoneProgress}>
                  <AppText style={styles.milestoneProgressText} weight="bold">5/10</AppText>
                </View>
              </View>

              <View style={styles.milestoneItem}>
                <View style={[styles.milestoneCheckbox, { backgroundColor: "#D1D5DB" }]}>
                  <Ionicons name="lock" size={14} color="#6B7280" />
                </View>
                <View style={styles.milestoneContent}>
                  <AppText style={styles.milestoneText} weight="bold">Maintain 4.8+ Rating</AppText>
                  <AppText style={styles.milestoneReward} weight="regular">Unlock Premium Bonus</AppText>
                </View>
                <View style={styles.milestoneProgress}>
                  <AppText style={styles.milestoneProgressText} weight="bold">{stats.rating.toFixed(1)}/5</AppText>
                </View>
              </View>

              <View style={styles.milestoneItem}>
                <View style={[styles.milestoneCheckbox, { backgroundColor: "#10B981" }]}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.milestoneContent}>
                  <AppText style={styles.milestoneText} weight="bold">Zero Cancellations</AppText>
                  <AppText style={styles.milestoneReward} weight="regular">+₹50 daily bonus</AppText>
                </View>
                <View style={styles.milestoneProgress}>
                  <AppText style={styles.milestoneProgressText} weight="bold">✓</AppText>
                </View>
              </View>
            </View>
          </View> */}

          {(liveReadyCount > 0 || liveNotice) && (
            <TouchableOpacity
              style={styles.mapBanner}
              onPress={() => router.push("/(driver)/explore" as any)}
            >
              <View style={styles.mapBannerLeft}>
                <View style={styles.mapIconWrap}>
                  <LottieView source={animations.location} style={styles.mapIcon} autoPlay loop />
                </View>

                <View>
                  <AppText style={styles.mapBannerTitle} weight="bold">
                    {liveReadyCount > 0
                      ? `${liveReadyCount} Ready 🚀`
                      : "Explore Map"}
                  </AppText>

                  <AppText style={styles.mapBannerSubtitle} weight="regular">
                    {liveReadyCount > 0
                      ? "Tap to view"
                      : "Find deliveries nearby"}
                  </AppText>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255,255,255,0.8)"
              />
            </TouchableOpacity>
          )}

          {currentOrder ? (
            <View style={styles.currentOrderCard}>
              <View style={styles.orderHeader}>
                <AppText style={styles.orderTitle} weight="bold">Current order</AppText>
                <View style={[styles.orderStatusBadge, { backgroundColor: `${statusColor(currentOrder.status)}20` }]}>
                  <AppText style={[styles.orderStatusText, { color: statusColor(currentOrder.status) }]} weight="medium">{String(currentOrder.status).replace(/_/g, " ").toUpperCase()}</AppText>
                </View>
              </View>
              <AppText style={styles.orderNumber} weight="heavy">#{currentOrder.order_number}</AppText>
              <View style={styles.orderDetail}><Ionicons name="restaurant" size={16} color="#6B7280" /><AppText style={styles.orderDetailText} weight="regular">{currentOrder.restaurants?.restaurant_name || "Restaurant"}</AppText></View>
              <View style={styles.orderDetail}><Ionicons name="person" size={16} color="#6B7280" /><AppText style={styles.orderDetailText} weight="regular">{currentOrder.customers?.full_name || "Customer"}</AppText></View>
              <View style={styles.orderDetail}><Ionicons name="location" size={16} color="#6B7280" /><AppText style={styles.orderDetailText} weight="regular">{addressText(currentOrder.delivery_address)}</AppText></View>
              <View style={styles.orderActions}>
                <TouchableOpacity style={styles.orderActionButton} onPress={() => router.push("/(driver)/explore" as any)}><Ionicons name="map" size={18} color="#fff" /><AppText style={styles.orderActionText} weight="bold">Continue in Explore</AppText></TouchableOpacity>
                <TouchableOpacity style={styles.orderActionSecondary} onPress={() => router.push(`/(driver)/orders/${currentOrder.id}` as any)}><Ionicons name="document-text-outline" size={18} color="#ff6b35c7" /><AppText style={styles.orderActionSecondaryText} weight="bold">Details</AppText></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noOrderCard}>
              <LottieView source={animationAssets.driver_empty_state} style={styles.noOrderAnimation} autoPlay loop speed={0.9} />
              <Text style={styles.noOrderTitle}>No order right now</Text>
              <Text style={styles.noOrderText}>{isOnline ? "Ready orders will appear here and on the map." : "Go online to receive delivery offers."}</Text>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Ionicons name="bicycle" size={22} color="#FF6B35" /><AppText style={styles.statValue} weight="heavy">{stats.deliveriesToday}</AppText><AppText style={styles.statLabel} weight="regular">Today</AppText></View>
            <View style={styles.statCard}><Ionicons name="cash" size={22} color="#10B981" /><AppText style={styles.statValue} weight="heavy">{money(stats.todayPay)}</AppText><AppText style={styles.statLabel} weight="regular">Pay</AppText></View>
            <View style={styles.statCard}><Ionicons name="star" size={22} color="#FF6B35" /><AppText style={styles.statValue} weight="heavy">{stats.rating.toFixed(1)} <AppText style={styles.statCount} weight="regular">({stats.ratingCount})</AppText></AppText><AppText style={styles.statLabel} weight="regular">Rating</AppText></View>
            <View style={styles.statCard}><MaterialCommunityIcons name="truck-delivery-outline" size={22} color="#1F2937" /><AppText style={styles.statValue} weight="heavy">{stats.totalDeliveries}</AppText><AppText style={styles.statLabel} weight="regular">Total</AppText></View>
          </View>

          <View style={styles.quickActions}>
            <AppText style={styles.sectionTitle} weight="bold">Shortcuts</AppText>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(driver)/explore" as any)}><Ionicons name="map" size={22} color="#FF6B35" /><AppText style={styles.actionText} weight="bold">Explore</AppText></TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(driver)/orders" as any)}><Ionicons name="receipt" size={22} color="#FF6B35" /><AppText style={styles.actionText} weight="bold">Orders</AppText></TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(driver)/earnings" as any)}><Ionicons name="cash" size={22} color="#10B981" /><AppText style={styles.actionText} weight="bold">Earnings</AppText></TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(driver)/notifications/driver_notifications" as any)}><Ionicons name="notifications" size={22} color="#FF6B35" /><AppText style={styles.actionText} weight="bold">Inbox {unreadNotifications > 0 ? `(${unreadNotifications})` : ""}</AppText></TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", marginBottom: -22 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 10, fontSize: 12, color: "#6B7280", fontWeight: "500", fontFamily: "Inter" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#e5e7ebb8" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  scrollView: { flex: 1 },
  content: { padding: 12, paddingBottom: 110 },

  // --- Replace existing status card styles ---
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 0.7,
    borderColor: "#F3F4F6",
  },
  statusCardOnline: {
    borderColor: "#D1FAE5",
    borderLeftWidth: 2.5,
    borderLeftColor: "#10B981",
    shadowColor: "#10B981",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    backgroundColor: "#FAFFFC",
  },

  // --- Status info area ---
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },

  statusAnimationContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.4,
    borderColor: "#e5e7eb9c",
    overflow: "hidden",
  },
  statusAnimationContainerOnline: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },

  // --- Animated text badge ---
  statusTextBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextBadgeOnline: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    fontFamily: "Inter",
    letterSpacing: 0.4,
  },
  statusBadgeTextOnline: {
    color: "#FFFFFF",
  },

  statusLottieWrapper: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLottie: {
    width: 60,
    height: 60,
    marginTop: -2,
  },

  // --- Text container ---
  statusTextContainer: {
    flex: 1,
    paddingLeft: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    fontFamily: "Inter",
    letterSpacing: -0.2,
  },
  statusTextOnline: {
    color: "#059669",
  },
  statusSubtext: {
    fontSize: 11.5,
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  statusSubtextOnline: {
    color: "#6B7280",
  },

  // --- Live dot with pulse ring ---
  liveDotContainer: {
    width: 18,
    height: 4,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  liveDot: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#10B981",
    zIndex: 2,
  },
  liveDotPulse: {
    position: "absolute",
    width: 18,
    height: 12,
    borderRadius: 9,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    zIndex: 1,
  },

  // --- Toggle button (pill-shaped) ---
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    minWidth: 120,
    justifyContent: "center",
  },
  statusToggleOnline: {
    backgroundColor: "#1F2937",
  },
  statusToggleOffline: {
    backgroundColor: "#FF6B35",
  },
  statusToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusToggleKnobOnline: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  statusToggleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },

  statusButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 100, alignItems: "center" },
  statusButtonOnline: { backgroundColor: "#FF6B35" },
  statusButtonOffline: { backgroundColor: "#1F2937" },
  statusButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", fontFamily: "Inter" },
  earningsSummaryCard: { backgroundColor: "#1F2937", borderRadius: 6, padding: 14, marginBottom: 16, shadowColor: "#1F2937", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 3 },
  earningsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  earningsEyebrow: { color: "#10B981", fontSize: 11.9, fontWeight: "700", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: 0.2 },
  earningsValue: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", fontFamily: "Inter", marginTop: 5 },
  withdrawShortcutText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  cardanimation: {
    width: 57,
    height: 57,
  },
  earningsMetricRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 0.3, borderTopColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center" },
  earningsMetric: { flex: 1 },
  earningsMetricValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", fontFamily: "Inter" },
  earningsMetricLabel: { color: "#CBD5E1", fontSize: 11.5, fontWeight: "600", fontFamily: "Inter", marginTop: 2.8 },
  earningsMetricDivider: { width: 0.3, height: 32, backgroundColor: "rgba(255,255,255,0.12)", marginHorizontal: 12 },
  currentOrderCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.3, borderColor: "#e5e7eb92" },
  orderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  orderTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", fontFamily: "Inter" },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  orderStatusText: { fontSize: 10, fontWeight: "600", fontFamily: "Inter" },
  orderNumber: { fontSize: 20, fontWeight: "800", color: "#1F2937", marginBottom: 12, fontFamily: "Inter" },
  orderDetail: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 7 },
  orderDetailText: { flex: 1, fontSize: 12, color: "#374151", lineHeight: 17, fontWeight: "500", fontFamily: "Inter" },
  orderActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  orderActionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 6, backgroundColor: "#1F2937" },
  orderActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", fontFamily: "Inter" },
  orderActionSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 6, backgroundColor: "#FFF7ED", borderWidth: 0.6, borderColor: "#fed7aa67" },
  orderActionSecondaryText: { color: "#ff6b35e3", fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  noOrderCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 16 },
  noOrderAnimation: { width: 120, height: 120 },
  noOrderTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Inter" },
  noOrderText: { fontSize: 12, color: "#6B7280", textAlign: "center", lineHeight: 18, marginTop: 6, fontWeight: "500", fontFamily: "Inter" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  statCard: { width: "48%", backgroundColor: "#FFFFFF", padding: 14, borderRadius: 8, borderWidth: 0.4, borderColor: "#e5e7eb94" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1F2937", marginTop: 8, fontFamily: "Inter" },
  statCount: { fontSize: 12, color: "#6B7280", fontWeight: "600", fontFamily: "Inter" },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 3, fontWeight: "600", fontFamily: "Inter" },
  quickActions: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 12, fontFamily: "Inter" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionCard: { width: "48%", backgroundColor: "#FFFFFF", padding: 15, borderRadius: 14, borderWidth: 0.8, borderColor: "#e5e7ebb7", alignItems: "center", gap: 6 },
  actionText: { fontSize: 12, fontWeight: "700", color: "#374151", fontFamily: "Inter" },
  headerLeft: {
    flex: 1,
  },

  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  waveAnimation: {
    width: 42,
    height: 42,
    marginRight: 6,
  },

  greetingText: {
    fontSize: 17,
    color: "#1F2937",
    fontWeight: "800",
    fontFamily: "Inter",
  },
  withdrawShortcut: {
    width: 41,
    height: 41,
    borderRadius: 30,
    backgroundColor: "#84f9d072",
    alignItems: "center",
    justifyContent: "center",
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    marginRight: 8,
  },

  mapBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  mapBanner: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mapIcon: {
    width: 50,
    height: 50,
  },

  mapIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  mapBannerTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },

  mapBannerSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 1,
    fontWeight: "500",
    fontFamily: "Inter",
  },

  // SECTION 1: Performance Metrics
  performanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: "#e5e7eb58",
  },
  performanceSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    fontFamily: "Inter",
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  performanceMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  performanceMetricContainer: {
    alignItems: "center",
    flex: 1,
  },
  circleProgressWrapper: {
    marginBottom: 10,
  },
  circleProgress: {
    width: 68,
    height: 68,
    borderRadius: 35,
    borderWidth: 3.3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.01)",
  },
  circleProgressInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  circleProgressText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    fontFamily: "Inter",
  },
  performanceMetricLabel: {
    fontSize: 10.8,
    fontWeight: "600",
    color: "#6B7280",
    fontFamily: "Inter",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  performanceMetricValue: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "Inter",
    marginTop: 2,
  },

  // SECTION 2: Milestones & Bonuses
  milestonesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb9c",
    shadowColor: "#0f172ab4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 0.8,
  },
  milestonesHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  milestonesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    fontFamily: "Inter",
  },
  milestonesSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "Inter",
    marginTop: 2,
  },
  milestoneBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestonesList: {
    gap: 10,
  },
  milestoneItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  milestoneCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
    fontFamily: "Inter",
  },
  milestoneReward: {
    fontSize: 10,
    color: "#10B981",
    fontFamily: "Inter",
    marginTop: 2,
    fontWeight: "500",
  },
  milestoneProgress: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  milestoneProgressText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    fontFamily: "Inter",
  },

});
