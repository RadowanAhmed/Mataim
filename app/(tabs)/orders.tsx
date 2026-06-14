import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuestProfileBanner } from "../components/GuestProfileBanner";
import NotificationBell from "../components/NotificationBell";

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=460&fit=crop";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type CustomerOrder = {
  id: string;
  order_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  status: OrderStatus;
  final_amount: number;
  created_at: string;
  estimated_delivery_time?: string | null;
  items: { id: string; name: string; quantity: number; image?: string | null }[];
};

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "preparing", "ready", "out_for_delivery"]);

function statusColor(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "#F59E0B";
    case "confirmed":
    case "preparing":
      return "#3B82F6";
    case "ready":
      return "#8B5CF6";
    case "out_for_delivery":
      return ACCENT;
    case "delivered":
      return "#10B981";
    case "cancelled":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

function statusLabel(status: OrderStatus) {
  if (status === "confirmed") return "Accepted";
  if (status === "out_for_delivery") return "On the way";
  return status.replace(/_/g, " ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function progressTimer(value?: string | null) {
  if (!value) return "ETA pending";
  const eta = new Date(value).getTime();
  if (Number.isNaN(eta)) return "ETA pending";
  const minutes = Math.max(1, Math.ceil((eta - Date.now()) / 60000));
  return minutes <= 1 ? "Arriving soon" : `${minutes} min left`;
}

function itemPreview(items: CustomerOrder["items"]) {
  if (!items.length) return "Items loading";
  const preview = items.slice(0, 2).map((item) => `${item.quantity}x ${item.name}`).join(", ");
  return items.length > 2 ? `${preview} and ${items.length - 2} more` : preview;
}

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <Ionicons name="receipt-outline" size={42} color={ACCENT} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onAction}>
        <Text style={styles.emptyButtonText}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderCard({
  order,
  mode,
  onOpen,
  onTrack,
  onReorder,
}: {
  order: CustomerOrder;
  mode: "active" | "history";
  onOpen: () => void;
  onTrack: () => void;
  onReorder: () => void;
}) {
  const color = statusColor(order.status);

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onOpen} activeOpacity={0.88}>
      <Image source={{ uri: order.items[0]?.image || order.restaurant_image || FALLBACK_IMAGE }} style={styles.orderImage} />
      <View style={styles.orderBody}>
        <View style={styles.orderTopRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {order.restaurant_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${color}16` }]}>
            <Text style={[styles.statusText, { color }]}>{statusLabel(order.status)}</Text>
          </View>
        </View>

        <Text style={styles.orderMeta} numberOfLines={1}>
          #{order.order_number} | {mode === "active" ? progressTimer(order.estimated_delivery_time) : formatDate(order.created_at)}
        </Text>
        <Text style={styles.itemsPreview} numberOfLines={2}>
          {itemPreview(order.items)}
        </Text>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{formatUGX(order.final_amount)}</Text>
          {mode === "active" ? (
            <TouchableOpacity style={styles.trackButton} onPress={onTrack}>
              <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
              <Text style={styles.trackButtonText}>Track</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.reorderButton} onPress={onReorder}>
              <Ionicons name="refresh-outline" size={14} color={ACCENT} />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { checkGuestAction, isGuest } = useGuestAction();
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await db
        .from("orders")
        .select(
          `
          id,
          order_number,
          restaurant_id,
          status,
          final_amount,
          created_at,
          estimated_delivery_time,
          restaurants!inner (
            restaurant_name,
            image_url
          ),
          order_items (
            id,
            quantity,
            item_name,
            item_image_url,
            posts(title,image_url),
            menu_items(name,image_url)
          )
        `,
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const nextOrders = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number || String(order.id).slice(0, 8),
        restaurant_id: order.restaurant_id,
        restaurant_name: order.restaurants?.restaurant_name || "Restaurant",
        restaurant_image: order.restaurants?.image_url || FALLBACK_IMAGE,
        status: order.status,
        final_amount: Number(order.final_amount || 0),
        created_at: order.created_at,
        estimated_delivery_time: order.estimated_delivery_time,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          quantity: Number(item.quantity || 1),
          name: item.item_name || item.posts?.title || item.menu_items?.name || "Item",
          image: item.item_image_url || item.posts?.image_url || item.menu_items?.image_url,
        })),
      }));

      setOrders(nextOrders);
    } catch (error) {
      console.error("Customer orders load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const activeOrders = useMemo(
    () => orders.filter((order) => ACTIVE_STATUSES.has(order.status)),
    [orders],
  );

  const historyOrders = useMemo(
    () => orders.filter((order) => !ACTIVE_STATUSES.has(order.status)),
    [orders],
  );

  const visibleOrders = activeTab === "active" ? activeOrders : historyOrders;

  const openOrder = useCallback(
    (orderId: string) => {
      checkGuestAction("canViewOrderDetails", () => router.push(`/(tabs)/orders/${orderId}` as any));
    },
    [checkGuestAction, router],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading orders</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>Track active orders and reorder favorites</Text>
        </View>
        <NotificationBell />
      </View>

      {isGuest ? <GuestProfileBanner /> : null}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "active" && styles.tabButtonActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>Active Orders</Text>
          <View style={[styles.tabCount, activeTab === "active" && styles.tabCountActive]}>
            <Text style={[styles.tabCountText, activeTab === "active" && styles.tabCountTextActive]}>{activeOrders.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>Order History</Text>
          <View style={[styles.tabCount, activeTab === "history" && styles.tabCountActive]}>
            <Text style={[styles.tabCountText, activeTab === "history" && styles.tabCountTextActive]}>{historyOrders.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode={activeTab}
              onOpen={() => openOrder(order.id)}
              onTrack={() => router.push(`/(tabs)/orders/${order.id}` as any)}
              onReorder={() => router.push(`/menu/${order.restaurant_id}` as any)}
            />
          ))
        ) : activeTab === "active" ? (
          <EmptyState
            title="No active orders"
            body="When you place an order, its live status will appear here."
            action="Browse restaurants"
            onAction={() => router.push("/(tabs)" as any)}
          />
        ) : (
          <EmptyState
            title="No order history yet"
            body="Your delivered and cancelled orders will be saved here."
            action="Start an order"
            onAction={() => router.push("/(tabs)" as any)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 10, fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  header: { paddingHorizontal: 13.5, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 3, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  tabs: { marginHorizontal: 8, marginBottom: 8, height: 52, padding: 4, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7eba7", flexDirection: "row", gap: 4 },
  tabButton: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  tabButtonActive: { backgroundColor: "#111827" },
  tabText: { fontSize: 12.5, fontFamily: "Inter", fontWeight: "600", color: "#6B7280", letterSpacing: 0.2 },
  tabTextActive: { color: "#FFFFFF" },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  tabCountText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  tabCountTextActive: { color: "#FFFFFF" },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 12, paddingBottom: 120, gap: 12 },
  orderCard: { minHeight: 132, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 0.7, borderColor: "#00000012", flexDirection: "row", overflow: "hidden" },
  orderImage: { width: 108, minHeight: 132, backgroundColor: "#E5E7EB" },
  orderBody: { flex: 1, padding: 10, gap: 4 },
  orderTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  restaurantName: { flex: 1, fontSize: 15, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 10.5, fontFamily: "Inter", fontWeight: "500", textTransform: "capitalize" },
  orderMeta: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  itemsPreview: { minHeight: 18, fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#4B5563" },
  orderFooter: { marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderTotal: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#111827", fontVariant: ["tabular-nums"] },
  trackButton: { height: 32, paddingHorizontal: 10, borderRadius: 30, backgroundColor: "#111827", flexDirection: "row", alignItems: "center", gap: 5 },
  trackButtonText: { color: "#FFFFFF", fontSize: 11.8, fontFamily: "Inter", fontWeight: "600", letterSpacing: 0.2 },
  reorderButton: { height: 34, paddingHorizontal: 10, borderRadius: 55, backgroundColor: "#FFF1ED", flexDirection: "row", alignItems: "center", gap: 5 },
  reorderButtonText: { color: ACCENT, fontSize: 12, fontFamily: "Inter", fontWeight: "500" },
  emptyState: { minHeight: 420, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIllustration: { width: 94, height: 94, borderRadius: 32, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 18, fontSize: 20, fontFamily: "Inter", fontWeight: "600", color: "#111827", textAlign: "center" },
  emptyText: { marginTop: 7, fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textAlign: "center" },
  emptyButton: { marginTop: 22, height: 50, paddingHorizontal: 22, borderRadius: 8, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  emptyButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter", fontWeight: "500" },
});
