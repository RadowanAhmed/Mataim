import { useGuestAction } from "@/backend/hooks/useGuestAction";
import {
  clearCustomerCart,
  deleteCartItem,
  getCustomerCart,
  getPromoDiscount,
  summarizeCustomerCart,
  updateCartItemQuantity,
  type CustomerCartItem,
} from "@/backend/customer/cartService";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../backend/AuthContext";
import { GuestProfileBanner } from "../components/GuestProfileBanner";

const ACCENT = "#FF6B35";

function CartItemCard({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CustomerCartItem;
  onQuantityChange: (item: CustomerCartItem, quantity: number) => void;
  onRemove: (item: CustomerCartItem) => void;
}) {
  const renderRightActions = () => (
    <Pressable style={styles.swipeDelete} onPress={() => onRemove(item)}>
      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable overshootRight={false} renderRightActions={renderRightActions}>
      <View style={styles.itemCard}>
        <Image source={{ uri: item.image }} style={styles.itemImage} />
        <View style={styles.itemBody}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.itemRestaurant} numberOfLines={1}>
            {item.restaurant}
          </Text>
          <View style={styles.itemMeta}>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{normalizeRating(item.restaurant_rating).toFixed(1)}</Text>
            </View>
            <Text style={styles.itemPrice}>{item.formattedPrice}</Text>
          </View>
        </View>
        <View style={styles.quantityBox}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => onQuantityChange(item, item.quantity - 1)}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={16} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => onQuantityChange(item, item.quantity + 1)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { checkGuestAction, isGuest } = useGuestAction();
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [defaultAddress, setDefaultAddress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const channelRef = useRef<any>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  const loadCart = useCallback(async () => {
    if (!user?.id) {
      setCartItems([]);
      setCart(null);
      setDefaultAddress(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const payload = await getCustomerCart(user.id, { ensureCart: true });
      setCart(payload.cart);
      setCartItems(payload.items);
      setDefaultAddress(payload.defaultAddress);
    } catch (error) {
      console.error("Customer cart load failed:", error);
      Alert.alert("Cart unavailable", "We could not load your cart. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (!cart?.id || !user?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const topic = `customer-cart-${cart.id}-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `cart_id=eq.${cart.id}`,
        },
        () => {
          loadCart();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [cart?.id, loadCart, user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCart();
  }, [loadCart]);

  const summary = useMemo(
    () =>
      summarizeCustomerCart({
        items: cartItems,
        address: defaultAddress,
        promoCode: appliedPromoCode,
      }),
    [appliedPromoCode, cartItems, defaultAddress],
  );

  const promo = useMemo(
    () => (appliedPromoCode ? getPromoDiscount(appliedPromoCode, summary.subtotal) : null),
    [appliedPromoCode, summary.subtotal],
  );

  const restaurantInfo = useMemo(() => {
    const firstItem = cartItems[0];
    if (!firstItem) return null;
    return {
      name: firstItem.restaurant,
      cuisine: firstItem.cuisine || "Food",
      rating: firstItem.restaurant_rating,
      minOrder: firstItem.min_order,
      image: firstItem.image,
    };
  }, [cartItems]);

  useEffect(() => {
    if (loading) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [cartItems.length, entrance, loading]);

  const handleApplyPromo = useCallback(() => {
    const result = getPromoDiscount(promoInput, summary.subtotal);
    if (!result) {
      Alert.alert("Promo not found", "Try SOFRA10 or SAVE5000.");
      return;
    }

    setAppliedPromoCode(result.code);
    setPromoInput(result.code);
  }, [promoInput, summary.subtotal]);

  const handleRemove = useCallback(
    async (item: CustomerCartItem) => {
      const previousItems = cartItems;
      setCartItems((items) => items.filter((current) => current.id !== item.id));

      try {
        await deleteCartItem(item.id);
      } catch (error) {
        console.error("Cart item remove failed:", error);
        setCartItems(previousItems);
        Alert.alert("Remove failed", "We could not remove this item.");
      }
    },
    [cartItems],
  );

  const handleQuantityChange = useCallback(
    async (item: CustomerCartItem, quantity: number) => {
      if (quantity < 1) return; // just ignore, do not delete

      const previousItems = cartItems;
      setCartItems((items) =>
        items.map((current) =>
          current.id === item.id
            ? {
              ...current,
              quantity,
              totalPriceUgx: current.priceUgx * quantity,
            }
            : current,
        ),
      );

      try {
        await updateCartItemQuantity(item, quantity);
      } catch (error) {
        console.error("Cart quantity update failed:", error);
        setCartItems(previousItems);
        Alert.alert("Update failed", "We could not update this item.");
      }
    },
    [cartItems, handleRemove],
  );

  const handleClearCart = useCallback(() => {
    if (!cart?.id) return;

    Alert.alert("Clear cart", "Remove all items from this cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          const previousItems = cartItems;
          setCartItems([]);
          try {
            await clearCustomerCart(cart.id);
          } catch (error) {
            console.error("Cart clear failed:", error);
            setCartItems(previousItems);
            Alert.alert("Clear failed", "We could not clear your cart.");
          }
        },
      },
    ]);
  }, [cart?.id, cartItems]);

  const handleCheckout = useCallback(() => {
    setCheckingOut(true);
    const allowed = checkGuestAction(
      "canCheckout",
      () => {
        router.push({
          pathname: "/checkout",
          params: appliedPromoCode ? { promoCode: appliedPromoCode } : {},
        } as any);
        setTimeout(() => setCheckingOut(false), 650);
      },
      "You need to sign in to complete your order",
    );
    if (!allowed) setCheckingOut(false);
  }, [appliedPromoCode, checkGuestAction, router]);

  useEffect(() => {
    (global as any).refreshCart = loadCart;

    return () => {
      delete (global as any).refreshCart;
    };
  }, [loadCart]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading your cart</Text>
      </SafeAreaView>
    );
  }

  if (!user?.id || isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={21} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <View style={styles.headerSpacer} />
        </View>
        {isGuest ? <GuestProfileBanner /> : null}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name={isGuest ? "person-circle-outline" : "log-in-outline"} size={40} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>{isGuest ? "Sign in to save your cart" : "Please sign in"}</Text>
          <Text style={styles.emptyText}>
            Your meals, addresses, and checkout stay ready when you use an account.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(auth)/signin" as any)}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Cart</Text>
          <Text style={styles.headerSubtitle}>
            {cartItems.length ? `${cartItems.length} item${cartItems.length === 1 ? "" : "s"} ready` : "Ready when you are"}
          </Text>
        </View>
        {cartItems.length ? (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearCart}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="basket-outline" size={42} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Browse nearby restaurants and add something delicious.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)" as any)}>
            <Text style={styles.primaryButtonText}>Start ordering</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
            }
          >
            {restaurantInfo ? (
              <Animated.View
                style={[
                  styles.restaurantCard,
                  {
                    opacity: entrance,
                    transform: [
                      {
                        translateY: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [14, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image source={{ uri: restaurantInfo.image }} style={styles.restaurantImage} />
                <View style={styles.restaurantCopy}>
                  <Text style={styles.restaurantLabel}>Restaurant</Text>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {restaurantInfo.name}
                  </Text>
                  <Text style={styles.restaurantMeta} numberOfLines={1}>
                    {restaurantInfo.cuisine} | {restaurantInfo.rating.toFixed(1)} rating
                  </Text>
                </View>
                <View style={styles.restaurantPill}>
                  <Text style={styles.restaurantPillText}>
                    {restaurantInfo.minOrder > 0 ? `${formatUGX(restaurantInfo.minOrder)} min` : "Ready"}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            <View style={styles.deliveryCard}>
              <View style={styles.deliveryIcon}>
                <Ionicons name="location-outline" size={17} color={ACCENT} />
              </View>
              <View style={styles.deliveryTextWrap}>
                <Text style={styles.deliveryLabel}>Delivering to</Text>
                <Text style={styles.deliveryAddress} numberOfLines={1}>
                  {defaultAddress?.address_line1 || "Add a delivery address in checkout"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your items</Text>
              <Text style={styles.sectionHint}>Swipe left to delete</Text>
            </View>

            <View style={styles.itemList}>
              {cartItems.map((item, index) => (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: entrance,
                    transform: [
                      {
                        translateY: entrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: [16 + index * 2, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <CartItemCard
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                  />
                </Animated.View>
              ))}
            </View>

            <View style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <View style={styles.promoIcon}>
                  <Ionicons name="ticket-outline" size={17} color={ACCENT} />
                </View>
                <View>
                  <Text style={styles.promoTitle}>Promo code</Text>
                  <Text style={styles.promoSubtitle}>{promo ? promo.label : "Try SOFRA10 or SAVE5000"}</Text>
                </View>
              </View>
              <View style={styles.promoInputRow}>
                <TextInput
                  value={promoInput}
                  onChangeText={(text) => {
                    setPromoInput(text.toUpperCase());
                    if (!text.trim()) setAppliedPromoCode("");
                  }}
                  placeholder="Enter code"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  style={styles.promoInput}
                />
                <TouchableOpacity style={styles.promoButton} onPress={handleApplyPromo}>
                  <Text style={styles.promoButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Order summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatUGX(summary.subtotal)}</Text>
              </View>
              {summary.discount > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Promo discount</Text>
                  <Text style={styles.discountValue}>-{formatUGX(summary.discount)}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Delivery{summary.distanceKm ? ` (${summary.distanceKm.toFixed(1)} km)` : ""}
                </Text>
                <Text style={styles.summaryValue}>{formatUGX(summary.deliveryFee)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>VAT estimate</Text>
                <Text style={styles.summaryValue}>{formatUGX(summary.tax)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatUGX(summary.total)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.checkoutBar}>
            {/* <View>
              <Text style={styles.checkoutLabel}>Total</Text>
              <Text style={styles.checkoutAmount}>{formatUGX(summary.total)}</Text>
            </View> */}
            <TouchableOpacity
              style={[styles.checkoutButton, checkingOut && styles.checkoutButtonDisabled]}
              onPress={handleCheckout}
              activeOpacity={0.88}
              disabled={checkingOut}
            >
              {checkingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.checkoutButtonText}>Checkout</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  headerSpacer: {
    width: 42,
  },
  clearButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 55,
    backgroundColor: "#fff1ed8e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.8,
    borderColor: "#fed7c456",
  },
  clearButtonText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingBottom: 132,
    gap: 13,
    top: 2,
  },
  restaurantCard: {
    minHeight: 72,
    borderRadius: 8,
    padding: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb99",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  restaurantImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  restaurantCopy: {
    flex: 1,
    minWidth: 0,
  },
  restaurantLabel: {
    fontSize: 11.2,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  restaurantName: {
    marginTop: 2,
    fontSize: 15.5,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#111827",
    letterSpacing: 0.4,
  },
  restaurantMeta: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  restaurantPill: {
    minHeight: 30,
    borderRadius: 20,
    paddingHorizontal: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  restaurantPillText: {
    fontSize: 10.8,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#047857",
  },
  deliveryCard: {
    minHeight: 40,
    borderRadius: 0,
    padding: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.6,
    borderColor: "#e5e7eb92",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deliveryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff1ede9",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTextWrap: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 11.2,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.2,
  },
  deliveryAddress: {
    marginTop: 1.5,
    fontSize: 12.3,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#111827",
  },
  sectionHeader: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 16.6,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#9CA3AF",
  },
  itemList: {
    gap: 8,
  },
  itemCard: {
    minHeight: 80,
    borderRadius: 12,
    padding: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7ebad",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  itemName: {
    fontSize: 13.4,
    lineHeight: 14,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
  },
  itemRestaurant: {
    marginTop: 4,
    fontSize: 12.2,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  itemMeta: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFFBEB",
  },
  ratingText: {
    fontSize: 11,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#92400E",
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "500",
    color: ACCENT,
  },
  quantityBox: {
    width: 36,
    borderRadius: 18,
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    gap: 3,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  quantityText: {
    minHeight: 20,
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  swipeDelete: {
    width: 92,
    minHeight: 112,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeDeleteText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontFamily: "Inter",
    fontWeight: "500",
  },
  promoCard: {
    borderRadius: 2,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb77",
    gap: 12,
  },
  promoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promoIcon: {
    width: 34,
    height: 34,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1edc4",
  },
  promoTitle: {
    fontSize: 13.6,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.2,
  },
  promoSubtitle: {
    marginTop: 2,
    fontSize: 11.2,
    fontFamily: "Inter",
    fontWeight: "400",
    color: "#6B7280",
    letterSpacing: 0.1,
  },
  promoInputRow: {
    height: 46,
    flexDirection: "row",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.8,
    borderColor: "#e5e7ebbd",
    overflow: "hidden",
  },
  promoInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.1,
  },
  promoButton: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  promoButtonText: {
    color: "#FFFFFF",
    fontSize: 12.8,
    fontFamily: "Inter",
    fontWeight: "500",
  },
  summaryCard: {
    borderRadius: 6,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb8c",
    gap: 10,
  },
  summaryTitle: {
    marginBottom: 2,
    fontSize: 15.3,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 13,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 12.9,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
    letterSpacing: 0.1,
  },
  summaryValue: {
    fontSize: 12.9,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  discountValue: {
    fontSize: 12.9,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#059669",
    fontVariant: ["tabular-nums"],
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e5e7eb7a",
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#111827",
  },
  totalValue: {
    fontSize: 16.2,
    fontFamily: "Inter",
    fontWeight: "700",
    color: ACCENT,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.1,
  },
  checkoutBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 90,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 96,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  checkoutLabel: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  checkoutAmount: {
    marginTop: 2,
    fontSize: 17,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  checkoutButton: {
    height: 54,
    width: '100%',
    paddingHorizontal: 0,
    borderRadius: 8,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter",
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: "#FFF1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 20,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 22,
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter",
    fontWeight: "500",
  },
});
