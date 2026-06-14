// app/(driver)/orders/index.tsx
import { DriverListItem, DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import NotificationBell from "@/app/components/NotificationBell";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { resolveDriverDeliveryPay } from "@/backend/utils/driverPay";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import animationAssets from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
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
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Order = {
  id: string;
  order_number: string;
  status: string;
  final_amount: number;
  delivery_fee: number;
  created_at: string;
  estimated_delivery_time: string | null;
  special_instructions: string | null;
  driver_id: string | null;
  restaurant_id: string;
  customer_id: string;
  restaurants?: {
    restaurant_name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    restaurant_rating?: number;
    delivery_fee?: number;
  } | null;
  customers?: {
    full_name?: string;
    phone?: string | null;
  } | null;
  delivery_address?: any;
  distance?: number | null;
  earnings?: number;
  eta?: number | null;
  isNearby?: boolean;
};

const FILTERS = [
  { id: "active", label: "Active", icon: "bicycle" },
  { id: "completed", label: "Completed", icon: "checkmark-done" },
  { id: "cancelled", label: "Cancelled", icon: "close-circle" },
];

function formatCurrency(value?: number | string | null) {
  return formatMoney(value);
}

function formatTime(dateString?: string | null) {
  if (!dateString) return "--";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(address: any) {
  if (!address) return "Address not available";
  if (typeof address === "string") {
    try {
      return formatAddress(JSON.parse(address));
    } catch {
      return address;
    }
  }

  return [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.country,
  ]
    .filter(Boolean)
    .join(", ") || address.formatted_address || "Address not available";
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "ready":
      return "#10B981";
    case "out_for_delivery":
      return "#3B82F6";
    case "delivered":
      return "#10B981";
    case "cancelled":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export default function DriverOrdersScreen() {
  const router = useRouter();

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("active");
  const [isOnline, setIsOnline] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const isMounted = useRef(true);

  const fetchDriverStatus = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("delivery_users")
      .select("is_online")
      .eq("id", user.id)
      .maybeSingle();

    if (!isMounted.current || !data) return;

    setIsOnline(Boolean((data as any)?.is_online));
  }, [user?.id]);

  const checkActiveOrder = useCallback(async () => {
    if (!user?.id) return;

    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .in("status", ["ready", "out_for_delivery"]);

    if (isMounted.current) {
      setHasActiveOrder((count || 0) > 0);
    }
  }, [user?.id]);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
      if (!refreshing) setLoading(true);

      let query = supabase
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
          estimated_delivery_time,
          special_instructions,
          driver_id,
          restaurant_id,
          customer_id,
          delivery_address,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            address,
            latitude,
            longitude,
            restaurant_rating,
            delivery_fee
          ),
          customers:users!orders_customer_id_fkey(
            full_name,
            phone
          )
        `,
        );

      if (selectedFilter === "active") {
        query = query.eq("driver_id", user.id).in("status", ["ready", "out_for_delivery"]).order("created_at", { ascending: false });
      } else if (selectedFilter === "completed") {
        query = query.eq("driver_id", user.id).eq("status", "delivered").order("created_at", { ascending: false }).limit(50);
      } else {
        query = query.eq("driver_id", user.id).eq("status", "cancelled").order("created_at", { ascending: false }).limit(50);
      }

      const { data, error } = await query;
      if (error) throw error;

      const ordersData = (data || []) as Order[];

      if (isMounted.current) setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching driver orders:", error);
      if (isMounted.current) setOrders([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [refreshing, selectedFilter, user?.id]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchDriverStatus();
    checkActiveOrder();
    fetchOrders();
  }, [checkActiveOrder, fetchDriverStatus, fetchOrders]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`driver-orders-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          checkActiveOrder();
          fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkActiveOrder, fetchOrders, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDriverStatus(), checkActiveOrder(), fetchOrders()]);
  };

  const handleGoBack = useCallback(() => {
    goBackOrDriverFallback(router, "/(driver)/dashboard", navigation);
  }, [navigation, router]);

  const renderOrderItem = ({ item, index }: { item: Order; index: number }) => {
    const earnings = resolveDriverDeliveryPay(item);

    return (
      <DriverListItem index={index}>
        <TouchableOpacity
          style={styles.orderCard}
          onPress={() => router.push(`/(driver)/orders/${item.id}` as any)}
          activeOpacity={0.75}
        >
          <View style={styles.orderCardHeader}>
            <View style={styles.orderTitleBlock}>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {item.restaurants?.restaurant_name || "Restaurant"}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                {item.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={15} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                Pickup: {item.restaurants?.address || "Restaurant address"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={15} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                Dropoff: {formatAddress(item.delivery_address)}
              </Text>
            </View>
            {item.special_instructions && (
              <View style={styles.detailRow}>
                <Ionicons name="chatbox-ellipses-outline" size={15} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.special_instructions}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.orderMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{formatTime(item.estimated_delivery_time || item.created_at)}</Text>
            </View>
            {item.distance !== null && item.distance !== undefined && (
              <View style={styles.metaItem}>
                <Ionicons name="navigate-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{item.distance} km</Text>
              </View>
            )}
            {item.eta && (
              <View style={styles.metaItem}>
                <Ionicons name="timer-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{item.eta} min</Text>
              </View>
            )}
            <View style={styles.earningsContainer}>
              <Ionicons name="cash-outline" size={14} color="#10B981" />
              <Text style={styles.earningsText}>{formatCurrency(earnings)}</Text>
            </View>
          </View>

          {selectedFilter === "active" && (
            <View style={styles.orderActions}>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: "#FF6B35" }]}
                onPress={() => router.push("/(driver)/explore" as any)}
              >
                <Ionicons name="map-outline" size={14} color="#FF6B35" />
                <Text style={[styles.actionButtonText, { color: "#FF6B35" }]}>Continue in Explore</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </DriverListItem>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>
            {isOnline ? "Online" : "Offline"} • {hasActiveOrder ? "Active delivery" : "Ready for one delivery"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
        </View>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#FF6B35" />
        <Text style={styles.infoBannerText}>
          Use Explore to accept, cancel, pick up, and complete deliveries.
        </Text>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === item.id && styles.filterTabActive]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Ionicons
                name={item.icon as any}
                size={16}
                color={selectedFilter === item.id ? "#f8f8f8" : "#6B7280"}
              />
              <Text style={[styles.filterTabText, selectedFilter === item.id && styles.filterTabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {orders.length > 0 && (
        <View style={styles.countBanner}>
          <Text style={styles.countText}>
            {orders.length} {selectedFilter} deliver{orders.length === 1 ? "y" : "ies"}
          </Text>
        </View>
      )}

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <LottieView
            source={animationAssets.driver_empty_state}
            style={styles.emptyStateAnimation}
            autoPlay
            loop
          />
          <Text style={styles.emptyStateTitle}>
            No {selectedFilter} deliveries
          </Text>
          <Text style={styles.emptyStateText}>
            {selectedFilter === "active"
              ? isOnline
                ? hasActiveOrder
                  ? "Open Explore to continue your current delivery."
                  : "Accept your next delivery from the Explore map."
                : "Go online from the dashboard, then use Explore for new offers."
              : `You do not have any ${selectedFilter} deliveries right now.`}
          </Text>
          <TouchableOpacity style={styles.refreshButtonLarge} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" colors={["#FF6B35"]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginBottom: -22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    fontFamily: "Inter",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#9A3412",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  filtersContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 14,
  },
  filtersContent: {
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14.5,
    paddingVertical: 9,
    borderRadius: 19,
    backgroundColor: "#ffff",
    marginRight: 8,
    gap: 6,
    borderColor: "#000",
    borderWidth: 0.5,
  },
  filterTabActive: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#0000",
  },
  filterTabText: {
    fontSize: 12,
    color: "#090909",
    fontWeight: "500",
    fontFamily: "Inter",
  },
  filterTabTextActive: {
    color: "#f8f8f8",
  },
  countBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "Inter",
  },
  countSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  ordersList: {
    padding: 14.5,
    paddingBottom: 110,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 14.5,
    marginBottom: 12,
    borderWidth: 0.8,
    borderColor: "#c9c9c96e",
    shadowColor: "#000000aa",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderTitleBlock: {
    flex: 1,
    marginRight: 10,
  },
  orderNumber: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter",
    letterSpacing: 0.25,
  },
  restaurantName: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 3,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 24,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "600",
    fontFamily: "Inter",
    letterSpacing: 0.3,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 11.8,
    color: "#374151",
    lineHeight: 17,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  orderMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6b9",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
  earningsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  earningsText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  acceptButton: {
    marginTop: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  orderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#ffffffc2",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 50,
  },
  emptyStateAnimation: {
    width: 150,
    height: 150,
  },
  emptyStateTitle: {
    fontSize: 17.5,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
    fontFamily: "Inter",
    letterSpacing: 0.25,
  },
  emptyStateText: {
    fontSize: 13.3,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "500",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
  refreshButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FFF7ED",
  },
  refreshButtonText: {
    color: "#FF6B35",
    fontWeight: "700",
    fontSize: 12,
    fontFamily: "Inter",
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  alertContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  alertTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
    fontFamily: "Inter",
  },
  alertRestaurant: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  alertInfo: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 5,
    lineHeight: 19,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  alertActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: "center",
  },
  alertCancelText: {
    color: "#374151",
    fontWeight: "600",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
  alertAcceptButton: {
    flex: 1,
    backgroundColor: "#FF6B35",
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: "center",
  },
  alertAcceptText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
});
