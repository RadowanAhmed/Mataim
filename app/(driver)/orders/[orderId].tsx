// app/(driver)/orders/[orderId].tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { DriverAppService } from "@/backend/services/driverAppService";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { resolveDriverDeliveryPay } from "@/backend/utils/driverPay";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import {
  Ionicons,
  MaterialCommunityIcons
} from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter
} from "expo-router";
import React,
{
  useCallback,
  useEffect,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatCurrency(value?: number | string | null) {
  return formatMoney(value);
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

function getStatusColor(status?: string) {
  switch (status) {
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

export default function DriverOrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { user } = useAuth();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId || !user?.id) return;

    try {
      if (!refreshing) setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          final_amount,
          total_amount,
          delivery_fee,
          driver_payout_amount,
          distance_km,
          payment_method,
          payment_status,
          estimated_delivery_time,
          actual_delivery_time,
          delivery_address,
          special_instructions,
          created_at,
          driver_id,
          customer_id,
          restaurant_id,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            address,
            latitude,
            longitude,
            image_url
          ),
          customers:users!orders_customer_id_fkey(
            full_name,
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
            menu_items(name, description, image_url),
            posts(title, description, image_url)
          )
        `,
        )
        .eq("id", orderId)
        .maybeSingle();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Could not load order details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, refreshing, user?.id]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
  };

  const callNumber = (phone?: string | null) => {
    if (!phone) {
      Alert.alert("No phone", "Phone number is not available.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleGoBack = useCallback(() => {
    goBackOrDriverFallback(router, "/(driver)/orders", navigation);
  }, [navigation, router]);

  const openConversation = useCallback(async () => {
    if (!order || !user?.id) return;

    const result = await DriverAppService.getOrCreateOrderConversation(order, user.id);
    if (result.success && result.data?.id) {
      router.push(`/(driver)/messages/${result.data.id}` as any);
      return;
    }

    Alert.alert("Chat unavailable", result.message || "Could not open the delivery conversation.");
  }, [order, router, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items = order.order_items || [];
  const statusColor = getStatusColor(order.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order Details</Text>
          <Text style={styles.headerSubtitle}>#{order.order_number}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" colors={["#FF6B35"]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>Delivery pay</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(resolveDriverDeliveryPay(order))}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {String(order.status).replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.summaryNote}>
            Follow pickup and dropoff steps carefully. Contact support if the customer or restaurant is unreachable.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pickup</Text>
          <View style={styles.placeRow}>
            {order.restaurants?.image_url ? (
              <Image source={{ uri: order.restaurants.image_url }} style={styles.placeImage} />
            ) : (
              <View style={styles.placeIcon}>
                <Ionicons name="restaurant" size={22} color="#FF6B35" />
              </View>
            )}
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{order.restaurants?.restaurant_name || "Restaurant"}</Text>
              <Text style={styles.placeAddress}>{order.restaurants?.address || "Address not available"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dropoff</Text>
          <View style={styles.placeRow}>
            {order.customers?.profile_image_url ? (
              <Image source={{ uri: order.customers.profile_image_url }} style={styles.placeImage} />
            ) : (
              <View style={[styles.placeIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="person" size={22} color="#10B981" />
              </View>
            )}
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{order.customers?.full_name || "Customer"}</Text>
              <Text style={styles.placeAddress}>{formatAddress(order.delivery_address)}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.callButton} onPress={() => callNumber(order.customers?.phone)}>
              <Ionicons name="call-outline" size={16} color="#3B82F6" />
              <Text style={styles.callButtonText}>Call Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.callButton}
              onPress={openConversation}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#3B82F6" />
              <Text style={styles.callButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {items.length === 0 ? (
            <Text style={styles.mutedText}>No items attached to this order.</Text>
          ) : (
            items.map((item: any, index: number) => {
              const itemName = item.item_name || item.menu_items?.name || item.posts?.title || `Item ${index + 1}`;
              const itemImage = item.item_image_url || item.menu_items?.image_url || item.posts?.image_url;
              const itemDescription = item.item_description || item.menu_items?.description || item.posts?.description;
              return (
                <View key={item.id || index} style={styles.itemRow}>
                  {itemImage ? (
                    <Image source={{ uri: itemImage }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Ionicons name="fast-food-outline" size={17} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{itemName}</Text>
                    {!!itemDescription && <Text style={styles.itemDescription} numberOfLines={1}>{itemDescription}</Text>}
                    <Text style={styles.itemMeta}>{item.quantity || 1} x {formatCurrency(item.unit_price)}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(item.total_price || Number(item.unit_price || 0) * Number(item.quantity || 1))}</Text>
                </View>
              );
            })
          )}
        </View>

        {!!order.special_instructions && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <Text style={styles.instructions}>{order.special_instructions}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Checklist</Text>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.checkText}>Confirm the order number with the restaurant.</Text>
          </View>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.checkText}>Keep food sealed and upright during delivery.</Text>
          </View>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.checkText}>Mark delivered only after customer handoff.</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          {(order.status === "ready" || order.status === "out_for_delivery") && (
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(driver)/explore" as any)}>
              <Ionicons name="map" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Continue in Explore</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => router.push(`/(driver)/live-track/${order.id}` as any)}
          >
            <MaterialCommunityIcons name="map-marker-path" size={18} color="#FF6B35" />
            <Text style={styles.outlineButtonText}>Open Live Tracking</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 10, color: "#6B7280", fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyTitle: { marginTop: 10, fontSize: 17, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12 },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  summaryLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600", fontFamily: "Inter" },
  summaryAmount: { fontSize: 24, color: "#111827", fontWeight: "800", marginTop: 4, fontFamily: "Inter" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter" },
  summaryNote: { marginTop: 12, fontSize: 12, color: "#6B7280", lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12, fontFamily: "Inter" },
  placeRow: { flexDirection: "row", alignItems: "center" },
  placeImage: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#F3F4F6" },
  placeIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
  placeInfo: { flex: 1, marginLeft: 12 },
  placeName: { fontSize: 14, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  placeAddress: { fontSize: 12, color: "#6B7280", lineHeight: 17, marginTop: 3, fontWeight: "500", fontFamily: "Inter" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  callButton: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  callButtonText: { color: "#3B82F6", fontSize: 12, fontWeight: "700", fontFamily: "Inter" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" },
  itemImagePlaceholder: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  itemInfo: { flex: 1, marginLeft: 10 },
  itemName: { fontSize: 13, color: "#111827", fontWeight: "700", fontFamily: "Inter" },
  itemDescription: { fontSize: 11, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  itemMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 3, fontWeight: "600", fontFamily: "Inter" },
  itemTotal: { fontSize: 12, color: "#111827", fontWeight: "600", fontFamily: "Inter" },
  mutedText: { color: "#6B7280", fontSize: 12, lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  instructions: { fontSize: 13, color: "#374151", lineHeight: 20, fontWeight: "500", fontFamily: "Inter" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  checkText: { flex: 1, fontSize: 12, color: "#374151", lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  actionsSection: { gap: 10, marginTop: 4 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, backgroundColor: "#111827" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14, fontFamily: "Inter" },
  outlineButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA" },
  outlineButtonText: { color: "#FF6B35", fontWeight: "700", fontSize: 14, fontFamily: "Inter" },
});
