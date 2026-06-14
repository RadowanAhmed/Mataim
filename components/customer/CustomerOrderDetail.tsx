// component/customer/CustomerOrderDetail.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { calculateDeliveryDistanceKm, calculateDeliveryFee } from "@/backend/utils/deliveryPricing";
import { normalizeRating } from "@/backend/utils/ratings";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700&h=520&fit=crop";
const FALLBACK_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=500&fit=crop";
const FALLBACK_DRIVER_IMAGE =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop";

const STATUS_STEPS = [
  { key: "pending", label: "Pending", icon: "time-outline" },
  { key: "confirmed", label: "Accepted", icon: "checkmark-circle-outline" },
  { key: "preparing", label: "Preparing", icon: "restaurant-outline" },
  { key: "ready", label: "Ready", icon: "bag-check-outline" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "bicycle-outline" },
  { key: "delivered", label: "Delivered", icon: "checkmark-done-outline" },
];

const CONFETTI_COLORS = ["#10B981", "#34D399", "#F59E0B", "#FF6B35", "#3B82F6", "#8B5CF6"];
const CONFETTI_PARTICLES = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  leftRatio: ((index * 37) % 100) / 100,
  size: 6 + (index % 4) * 2,
  duration: 2100 + (index % 5) * 180,
  delay: (index % 8) * 110,
  drift: index % 2 === 0 ? 22 + (index % 5) * 5 : -22 - (index % 5) * 5,
}));

function parseDeliveryAddress(address: any) {
  if (!address) return null;
  if (typeof address === "string") {
    try {
      return JSON.parse(address);
    } catch {
      return { address_line1: address };
    }
  }
  return address;
}

function getAddressText(address: any) {
  const parsed = parseDeliveryAddress(address);
  if (!parsed) return "Delivery address unavailable";
  const parts = [parsed.address_line1, parsed.address_line2, parsed.city, parsed.state, parsed.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Delivery address unavailable";
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status?: string) {
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

function statusLabel(status?: string) {
  if (status === "confirmed") return "Accepted";
  if (status === "out_for_delivery") return "Out for delivery";
  return status?.replace(/_/g, " ") || "Order";
}

function money(value: unknown) {
  return formatUGX(value as any);
}

function ProgressSteps({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.findIndex((step) => step.key === status);
  const completedThrough = status === "delivered" ? STATUS_STEPS.length - 1 : Math.max(0, currentIndex);
  const color = statusColor(status);

  return (
    <View style={styles.progressCard}>
      {/* <View style={styles.progressHeader}>
        <View>
          <Text style={styles.cardKicker}>Current status</Text>
          {/* <Text style={styles.statusTitle}>{statusLabel(status)}</Text> *
        </View>
        
      </View> */}
      <View style={[styles.statusBadge, { backgroundColor: "#111827" }]}>
        <Text style={[styles.statusBadgeText, { color: "#FFFFFF" }]}>{statusLabel(status)}</Text>
      </View>
      {/* <View style={styles.progressTrack}>
        {STATUS_STEPS.map((step, index) => {
          const done = status !== "cancelled" && index <= completedThrough;
          const active = index === currentIndex;

          return (
            <View key={step.key} style={styles.progressStep}>
              <View style={[styles.stepCircle, done && { backgroundColor: "#111827", borderColor: "#111827" }, active && styles.stepCircleActive]}>
                <Ionicons name={step.icon as any} size={15} color={done ? "#FFFFFF" : "#9CA3AF"} />
              </View>
              <Text style={[styles.stepText, done && styles.stepTextDone]} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View> */}
    </View>
  );
}

function ConfettiPiece({
  particle,
  width,
}: {
  particle: (typeof CONFETTI_PARTICLES)[number];
  width: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.timing(progress, { toValue: 1, duration: particle.duration, useNativeDriver: true }),
        Animated.delay(450),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [particle.delay, particle.duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 270],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, particle.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${particle.drift > 0 ? 260 : -260}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.84, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiPiece,
        {
          left: Math.max(12, Math.min(width - 34, particle.leftRatio * width)),
          width: particle.size,
          height: particle.size * 1.55,
          backgroundColor: particle.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

function DeliveredHero({ onOrderAgain }: { onOrderAgain: () => void }) {
  const { width } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.45)).current;
  const copyFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(copyFade, {
        toValue: 1,
        delay: 280,
        duration: 460,
        useNativeDriver: true,
      }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, useNativeDriver: true }),
      ]),
    );

    glowLoop.start();
    return () => glowLoop.stop();
  }, [checkScale, copyFade, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });

  return (
    <View style={styles.deliveredHero}>
      {CONFETTI_PARTICLES.map((particle) => (
        <ConfettiPiece key={particle.id} particle={particle} width={width - 32} />
      ))}
      <Animated.View style={[styles.deliveredIcon, { transform: [{ scale: checkScale }] }]}>
        <LottieView source={animations.successanimation} autoPlay loop style={styles.lottie} />

      </Animated.View>
      <Animated.View style={{ alignItems: "center", opacity: copyFade, transform: [{ translateY: copyFade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }], top: 4 }}>
        <Text style={styles.deliveredTitle}>Order Delivered</Text>
        {/* <Text style={styles.deliveredText}>Thanks for ordering. Your meal has arrived.</Text> */}
        {/* <TouchableOpacity style={styles.orderAgainButton} onPress={onOrderAgain} activeOpacity={0.88}>
          <Text style={styles.orderAgainText}>Order again</Text>
        </TouchableOpacity> */}
      </Animated.View>
    </View>
  );
}

export default function CustomerOrderDetail() {
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [driverUser, setDriverUser] = useState<any>(null);
  const [ratingExists, setRatingExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const screenEntrance = useRef(new Animated.Value(0)).current;

  const loadOrder = useCallback(async () => {
    if (!orderId || !user?.id) {
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
          customer_id,
          restaurant_id,
          driver_id,
          status,
          total_amount,
          delivery_fee,
          distance_km,
          tax_amount,
          discount_amount,
          tip_amount,
          final_amount,
          payment_method,
          payment_status,
          delivery_address,
          special_instructions,
          estimated_delivery_time,
          actual_delivery_time,
          created_at,
          restaurants:restaurants!orders_restaurant_id_fkey(
            id,
            restaurant_name,
            cuisine_type,
            image_url,
            address,
            restaurant_rating,
            latitude,
            longitude
          ),
          delivery_users:delivery_users!orders_driver_id_fkey(
            id,
            vehicle_type,
            vehicle_plate,
            rating,
            total_deliveries
          )
        `,
        )
        .eq("id", orderId)
        .eq("customer_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setOrder(data);

      if (data?.driver_id) {
        const { data: profile } = await db
          .from("users")
          .select("id,full_name,phone,profile_image_url,email")
          .eq("id", data.driver_id)
          .maybeSingle();
        setDriverUser(profile);
      } else {
        setDriverUser(null);
      }

      const { data: orderItems, error: itemError } = await db
        .from("order_items")
        .select(
          `
          id,
          quantity,
          unit_price,
          total_price,
          special_instructions,
          item_name,
          item_description,
          item_price,
          item_image_url,
          posts:posts!order_items_post_id_fkey(id,title,description,image_url),
          menu_items:menu_items!order_items_menu_item_id_fkey(id,name,description,image_url,price)
        `,
        )
        .eq("order_id", orderId);

      if (itemError) throw itemError;
      setItems(orderItems || []);

      try {
        const { data: existingRating } = await db
          .from("ratings")
          .select("id")
          .eq("order_id", orderId)
          .maybeSingle();
        setRatingExists(Boolean(existingRating?.id));
      } catch {
        setRatingExists(false);
      }
    } catch (error) {
      console.error("Error loading customer order:", error);
      Alert.alert("Order unavailable", "We could not load this order.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, user?.id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order) return;
    screenEntrance.setValue(0);
    Animated.timing(screenEntrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [order?.id, order?.status, order, screenEntrance]);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`customer-order-detail-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => loadOrder(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrder, orderId]);

  const isDelivered = order?.status === "delivered";
  const deliveryFee = useMemo(() => {
    if (!order) return 0;
    const calculated = calculateDeliveryFee({
      restaurant: order.restaurants,
      address: order.delivery_address,
    });
    return calculated || Number(order.delivery_fee || 0);
  }, [order]);
  const deliveryDistanceKm = useMemo(() => {
    if (!order) return null;
    return order.distance_km || calculateDeliveryDistanceKm({
      restaurant: order.restaurants,
      address: order.delivery_address,
    });
  }, [order]);

  const orderSubtotal = useMemo(() => {
    if (!items.length) return Number(order?.total_amount || 0);
    return items.reduce((sum, item) => {
      const unitPrice = item.unit_price ?? item.item_price ?? Number(item.posts?.price) ?? Number(item.menu_items?.price) ?? 0;
      const quantity = Number(item.quantity || 1);
      const totalPrice = Number(item.total_price ?? unitPrice * quantity);
      return sum + totalPrice;
    }, 0);
  }, [items, order?.total_amount]);

  const orderDiscount = Number(order?.discount_amount || 0);
  const orderTax = Number(order?.tax_amount || 0);
  const orderTip = Number(order?.tip_amount || 0);
  const derivedOrderTotal = orderSubtotal + deliveryFee + orderTax + orderTip - orderDiscount;
  const displayTotal = Number(order?.final_amount) || derivedOrderTotal;

  const itemPreview = useMemo(() => {
    if (!items.length) return "Items loading";
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    return `${totalQuantity} item${totalQuantity === 1 ? "" : "s"}`;
  }, [items]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrder();
  }, [loadOrder]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOrderAgain = useCallback(() => {
    if (order?.restaurant_id) {
      router.push(`/menu/${order.restaurant_id}` as any);
    }
  }, [order?.restaurant_id, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading order</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Order not found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleGoBack}>
          <Text style={styles.primaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <Animated.View
        style={[
          styles.screenMotion,
          {
            opacity: screenEntrance,
            transform: [
              {
                translateY: screenEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Order details</Text>
            <Text style={styles.headerSubtitle}>#{order.order_number || String(order.id).slice(0, 8)}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/orders/report-issue",
                params: { orderId: order.id, orderNumber: order.order_number || String(order.id).slice(0, 8) },
              } as any)
            }
          >
            <Ionicons name="help-circle-outline" size={22} color={ACCENT} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {isDelivered ? (
            <DeliveredHero onOrderAgain={handleOrderAgain} />
          ) : null}

          <View style={styles.card}>
            <View style={styles.restaurantRow}>
              <Image source={{ uri: order.restaurants?.image_url || FALLBACK_RESTAURANT_IMAGE }} style={styles.restaurantImage} />
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{order.restaurants?.restaurant_name || "Restaurant"}</Text>
                <Text style={styles.mutedText} numberOfLines={1}>
                  {order.restaurants?.cuisine_type || "Food"} | {normalizeRating(order.restaurants?.restaurant_rating).toFixed(1)} rating
                </Text>
                <Text style={styles.mutedText} numberOfLines={1}>
                  {itemPreview} | {formatDate(order.created_at)}
                </Text>
                <View>
                  <ProgressSteps status={order.status} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.map((item) => {
              const product = item.posts || item.menu_items || {};
              const name = item.item_name || product.title || product.name || "Food item";
              const image = item.item_image_url || product.image_url || FALLBACK_FOOD_IMAGE;
              const unitPrice = item.unit_price || item.item_price || product.price || 0;
              const total = item.total_price || Number(item.quantity || 1) * Number(unitPrice || 0);

              return (
                <View key={item.id} style={styles.itemRow}>
                  <Image source={{ uri: image }} style={styles.itemImage} />
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{money(total)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(orderSubtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery{deliveryDistanceKm ? ` (${Number(deliveryDistanceKm).toFixed(1)} km)` : ""}
              </Text>
              <Text style={styles.summaryValue}>{money(deliveryFee)}</Text>
            </View>
            {orderDiscount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.discountValue}>-{money(orderDiscount)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT estimate</Text>
              <Text style={styles.summaryValue}>{money(orderTax)}</Text>
            </View>
            {orderTip > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tip</Text>
                <Text style={styles.summaryValue}>{money(orderTip)}</Text>
              </View>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.summaryRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{money(displayTotal)}</Text></View>
          </View>

          <View style={styles.addressCard}>
            <View style={styles.addressIcon}>
              <Ionicons name="location-outline" size={18} color={ACCENT} />
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressTitle}>Delivery address</Text>
              <Text style={styles.addressText} numberOfLines={2}>{getAddressText(order.delivery_address)}</Text>
              {order.special_instructions ? (
                <Text style={styles.noteText} numberOfLines={1}>Note: {order.special_instructions}</Text>
              ) : null}
            </View>
          </View>

          {driverUser ? (
            <View style={[styles.card, isDelivered && styles.compactCard]}>
              <Text style={styles.sectionTitle}>Driver</Text>
              <View style={styles.driverRow}>
                <Image source={{ uri: driverUser.profile_image_url || FALLBACK_DRIVER_IMAGE }} style={styles.driverImage} />
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{isDelivered ? `Delivered by ${driverUser.full_name || "Driver"}` : driverUser.full_name || "Driver"}</Text>
                  <Text style={styles.mutedText}>
                    {Number(order.delivery_users?.rating || 5).toFixed(1)} rating
                    {!isDelivered ? ` | ${order.delivery_users?.vehicle_type || "Vehicle"} | ${order.delivery_users?.vehicle_plate || "Plate pending"}` : ""}
                  </Text>
                </View>
                {driverUser.phone && !isDelivered ? (
                  <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${driverUser.phone}`)}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {isDelivered && !ratingExists ? (
            <TouchableOpacity
              style={styles.rateOrderButton}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/orders/rate/[orderId]",
                  params: { orderId: order.id },
                } as any)
              }
              activeOpacity={0.88}
            >
              <Ionicons name="star" size={18} color="#FFFFFF" />
              <Text style={styles.rateOrderButtonText}>Rate your order</Text>
            </TouchableOpacity>
          ) : null}

          {isDelivered && ratingExists ? (
            <View style={styles.ratedNotice}>
              <Text style={styles.ratedNoticeText}>You already submitted feedback for this order.</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/orders/report-issue",
                params: { orderId: order.id, orderNumber: order.order_number || String(order.id).slice(0, 8) },
              } as any)
            }
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#111827" />
            <Text style={styles.helpButtonText}>Need help with this order?</Text>
          </TouchableOpacity>
          <View style={{ height: 150 }} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", marginBottom: -60 },
  screenMotion: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", padding: 24 },
  loadingText: { marginTop: 10, fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  emptyTitle: { marginTop: 12, fontSize: 16, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  header: { minHeight: 70, paddingHorizontal: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 43, height: 43, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 0.6, borderColor: "#e5e7ebc7", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 0 },
  headerTitle: { fontSize: 19, fontFamily: "Inter", fontWeight: "700", color: "#111827", letterSpacing: 0.4 },
  headerSubtitle: { marginTop: 1, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  content: { flex: 1 },
  contentInner: { padding: 12, paddingBottom: 0, gap: 9 },
  deliveredHero: { minHeight: 170, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 0.8, borderColor: "#d1fae57b", padding: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  confettiPiece: { position: "absolute", top: 0, borderRadius: 3 },
  deliveredGlow: { position: "absolute", width: 100, height: 100, borderRadius: 75, backgroundColor: "#10B981" },
  deliveredIcon: { width: 80, height: 80, borderRadius: 48, backgroundColor: "rgb(34, 228, 141)", alignItems: "center", justifyContent: "center", top: 4 },
  lottie: {
    width: 80,
    height: 80,
  },
  deliveredTitle: { marginTop: 16, fontSize: 20, fontFamily: "Inter", fontWeight: "700", color: "#065F46", letterSpacing: 0.15 },
  deliveredText: { marginTop: 3, fontSize: 13.8, lineHeight: 19, fontFamily: "Inter", fontWeight: "600", color: "#047857", textAlign: "center" },
  orderAgainButton: { marginTop: 16, height: 46, paddingHorizontal: 18, borderRadius: 8, backgroundColor: "#10B981", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  orderAgainText: { color: "#FFFFFF", fontSize: 13.5, fontFamily: "Inter", fontWeight: "600" },
  progressCard: { borderRadius: 0, backgroundColor: "#FFFFFF", borderWidth: 0, borderColor: "#e5e7ebba", padding: 0 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardKicker: { fontSize: 11, fontFamily: "Inter", fontWeight: "700", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.3 },
  statusTitle: { marginTop: 3, fontSize: 20, fontFamily: "Inter", fontWeight: "600", color: "#111827", textTransform: "capitalize" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, position: "absolute", bottom: 22, right: 4 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter", fontWeight: "600", textTransform: "capitalize" },
  progressTrack: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", gap: 4 },
  progressStep: { flex: 1, alignItems: "center", gap: 7 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  stepCircleActive: { transform: [{ scale: 1.08 }] },
  stepText: { fontSize: 9.5, lineHeight: 12, fontFamily: "Inter", fontWeight: "500", color: "#9CA3AF", textAlign: "center" },
  stepTextDone: { color: "#111827" },
  card: { borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 0.8, borderColor: "#e5e7eb36", padding: 12 },
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  restaurantImage: { width: 70, height: 70, borderRadius: 8, backgroundColor: "#E5E7EB" },
  restaurantInfo: { flex: 1, minWidth: 0 },
  restaurantName: { fontSize: 17, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  mutedText: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  sectionTitle: { marginBottom: 10, fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 0.8, borderTopColor: "#f3f4f6cd" },
  itemImage: { width: 54, height: 54, borderRadius: 14, backgroundColor: "#E5E7EB" },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827", bottom: 0 },
  itemTotal: { fontSize: 12.8, fontFamily: "Inter", fontWeight: "600", color: "#111827", fontVariant: ["tabular-nums"] },
  summaryRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#6B7280" },
  summaryValue: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#111827", fontVariant: ["tabular-nums"] },
  discountValue: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#10B981", fontVariant: ["tabular-nums"] },
  divider: { height: 0.4, backgroundColor: "#E5E7EB", marginVertical: 8 },
  totalLabel: { fontSize: 14.8, fontFamily: "Inter", fontWeight: "600", color: "#111827", letterSpacing: 0.2 },
  totalValue: { fontSize: 17, fontFamily: "Inter", fontWeight: "600", color: ACCENT, fontVariant: ["tabular-nums"] },
  paymentText: { marginTop: 12, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textTransform: "capitalize" },
  addressCard: { minHeight: 55, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 0.6, borderColor: "#e5e7ebb6", padding: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  addressIcon: { width: 34, height: 34, borderRadius: 24, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  addressBody: { flex: 1, minWidth: 0 },
  addressTitle: { fontSize: 12.8, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  addressText: { marginTop: 2, fontSize: 11.8, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#4B5563" },
  noteText: { marginTop: 4, fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "600", color: ACCENT },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  driverImage: { width: 54, height: 54, borderRadius: 4, backgroundColor: "#E5E7EB" },
  driverInfo: { flex: 1, minWidth: 0 },
  compactCard: { padding: 12 },
  driverName: { fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  callButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  helpButton: { height: 54, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7eb7f", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  helpButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  rateOrderButton: { marginTop: 14, minHeight: 52, borderRadius: 16, backgroundColor: ACCENT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 },
  rateOrderButtonText: { fontSize: 15, fontFamily: "Inter", fontWeight: "700", color: "#FFFFFF" },
  ratedNotice: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#D1FAE5" },
  ratedNoticeText: { fontSize: 12.8, fontFamily: "Inter", fontWeight: "600", color: "#065F46", textAlign: "center" },
  primaryButton: { marginTop: 16, height: 50, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter", fontWeight: "600" },
});
