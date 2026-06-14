import { logger } from "@/backend/utils/logger";
// app/orders/create
import NotificationBell from "@/app/components/NotificationBell";
import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import {
  calculateDeliveryDistanceKm,
  calculateDeliveryFee,
  calculateDriverPayout,
  loadDeliveryPricingSettings,
  resolveDeliveryQuote,
  type DeliveryPricingSettings,
} from "@/backend/utils/deliveryPricing";
import { Ionicons } from "@expo/vector-icons";
import { createPaymentIntent } from "@/backend/services/paymentIntentClient";
import { useStripe } from "@stripe/stripe-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

type CartItem = {
  id: string;
  cart_id?: string;
  post_id?: string | null;
  menu_item_id?: string | null;
  restaurant_id?: string | null;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  price?: number;
  name?: string;
  title?: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  restaurant?: string;
  restaurant_name?: string;
  restaurant_image_url?: string | null;
  restaurant_location?: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
};

type Address = {
  id?: string;
  label?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  is_temporary?: boolean;
  is_default?: boolean;
};

const TAX_RATE = 0.05;
const SAVED_ADDRESS_LIMIT = 1;
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop";
const C = {
  bg: "#F4F5F7",
  surface: "#FFFFFF",
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  accent: "#FF6B35",
  accentSoft: "#FFF4EF",
};

function itemName(item: CartItem) {
  return item.name || item.title || "Item";
}

function itemPrice(item: CartItem) {
  return toUGX(item.price ?? item.unit_price ?? item.total_price ?? 0);
}

function itemImage(item: CartItem) {
  return item.image || item.image_url || null;
}

function addressText(address?: Address | null) {
  if (!address) return "Select delivery address";
  return (
    [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.country,
    ]
      .filter(Boolean)
      .join(", ") ||
    address.formatted_address ||
    "Delivery address"
  );
}

function paramToString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parseAddressParam(value: string | string[] | undefined) {
  const raw = paramToString(value);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function safeRun(label: string, task: () => Promise<any>) {
  try {
    await Promise.race([
      task(),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]);
  } catch (error) {
    logger.debug(`${label} skipped:`, error);
  }
}

export default function CreateOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth() as any;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const routeRestaurantId = useMemo(
    () => paramToString(params.restaurantId as any),
    [params.restaurantId],
  );
  const routePostId = useMemo(
    () => paramToString(params.postId as any),
    [params.postId],
  );
  const routeAddress = useMemo(
    () => parseAddressParam(params.addressData as any),
    [params.addressData],
  );
  const routePostTitle = useMemo(
    () => paramToString(params.postTitle as any),
    [params.postTitle],
  );
  const routePostDescription = useMemo(
    () => paramToString(params.postDescription as any),
    [params.postDescription],
  );
  const routePostImage = useMemo(
    () => paramToString(params.postImage as any),
    [params.postImage],
  );
  const routePostPrice = useMemo(
    () => toUGX(paramToString(params.postPrice as any)),
    [params.postPrice],
  );
  const routeRestaurantName = useMemo(
    () => paramToString(params.restaurantName as any),
    [params.restaurantName],
  );
  const routeRestaurantImage = useMemo(
    () => paramToString(params.restaurantImage as any),
    [params.restaurantImage],
  );
  const routeDeliveryFee = useMemo(
    () => toUGX(paramToString(params.deliveryFee as any)),
    [params.deliveryFee],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<any>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [orderType] = useState<"delivery">("delivery");
  const [paymentMethod] = useState("card");
  const [deliverySettings, setDeliverySettings] = useState<DeliveryPricingSettings | null>(null);

  const hasRouteCheckout = Boolean(routeRestaurantId && routePostId);

  useEffect(() => {
    if (!routeRestaurantId && !routePostId) {
      router.replace("/checkout" as any);
    }
  }, [routePostId, routeRestaurantId, router]);

  const orderSummary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const price = itemPrice(item);
      const quantity = Number(item.quantity || 1);

      return sum + price * quantity;
    }, 0);

    const deliveryFee =
      orderType === "delivery"
        ? hasRouteCheckout && routeDeliveryFee > 0 && !cartItems[0]?.restaurant_location
          ? routeDeliveryFee
          : calculateDeliveryFee({
            restaurant: cartItems[0]?.restaurant_location,
            address: selectedAddress,
            settings: deliverySettings,
          })
        : 0;
    const pricedDistanceKm =
      orderType === "delivery"
        ? calculateDeliveryDistanceKm({
          restaurant: cartItems[0]?.restaurant_location,
          address: selectedAddress,
        })
        : null;
    const tax = Math.round((subtotal * TAX_RATE) / 1000) * 1000;
    const total = Math.round(subtotal + deliveryFee + tax);

    return {
      subtotal,
      deliveryFee,
      distanceKm: pricedDistanceKm,
      tax,
      total,
    };
  }, [cartItems, deliverySettings, hasRouteCheckout, orderType, routeDeliveryFee, selectedAddress]);

  const buildCheckoutItemFromRoute = useCallback(async () => {
    if (!routePostId || !routeRestaurantId) return null;

    const fallbackPrice = toUGX(routePostPrice);

    const fallbackItem: CartItem = {
      id: `route_${routePostId}`,
      post_id: routePostId,
      menu_item_id: null,
      restaurant_id: routeRestaurantId,
      quantity: 1,
      price: fallbackPrice,
      unit_price: fallbackPrice,
      total_price: fallbackPrice,
      name: routePostTitle || "Item",
      title: routePostTitle || "Item",
      description: routePostDescription || null,
      image: routePostImage || null,
      image_url: routePostImage || null,
      restaurant: routeRestaurantName || "Restaurant",
      restaurant_image_url: routeRestaurantImage || null,
    };

    try {
      const { data, error } = await db
        .from("posts")
        .select(
          `
          id,
          title,
          description,
          image_url,
          discounted_price,
          original_price,
          restaurant_id,
          restaurants:restaurants(
            restaurant_name,
            image_url,
            latitude,
            longitude
          )
        `,
        )
        .eq("id", routePostId)
        .maybeSingle();

      if (error || !data) return fallbackItem;

      const price = toUGX(
        data.discounted_price ?? data.original_price ?? fallbackItem.price ?? 0,
      );

      return {
        id: `route_${data.id}`,
        post_id: data.id,
        menu_item_id: null,
        restaurant_id: data.restaurant_id || routeRestaurantId,
        quantity: 1,
        price,
        unit_price: price,
        total_price: price,
        name: data.title || fallbackItem.name,
        title: data.title || fallbackItem.title,
        description: data.description || fallbackItem.description,
        image: data.image_url || fallbackItem.image,
        image_url: data.image_url || fallbackItem.image_url,
        restaurant: data.restaurants?.restaurant_name || fallbackItem.restaurant,
        restaurant_image_url:
          data.restaurants?.image_url || routeRestaurantImage || fallbackItem.restaurant_image_url,
        restaurant_location: {
          latitude: data.restaurants?.latitude,
          longitude: data.restaurants?.longitude,
        },
      } as CartItem;
    } catch (error) {
      logger.debug("Route checkout item fallback:", error);
      return fallbackItem;
    }
  }, [
    routePostId,
    routeRestaurantId,
    routePostPrice,
    routePostTitle,
    routePostDescription,
    routePostImage,
    routeRestaurantName,
    routeRestaurantImage,
  ]);

  const fetchAddresses = useCallback(async () => {
    const { data: addressesData, error: addressError } = await db
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SAVED_ADDRESS_LIMIT);

    if (addressError) throw addressError;

    setAddresses((addressesData || []).slice(0, SAVED_ADDRESS_LIMIT));

    // Prioritize address selection
    if (routeAddress) {
      setSelectedAddress(routeAddress);
    } else if (addressesData?.length > 0) {
      const defaultAddress = addressesData.find((addr: any) => addr.is_default);
      setSelectedAddress(defaultAddress || addressesData[0]);
    } else {
      setSelectedAddress(null);
    }
  }, [routeAddress, user?.id]);

  const fetchCheckoutData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      if (hasRouteCheckout) {
        const routeItem = await buildCheckoutItemFromRoute();

        setCart(null);
        setCartItems(routeItem ? [routeItem] : []);

        await fetchAddresses();
        return;
      }

      const { data: cartData, error: cartError } = await db
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cartError) throw cartError;

      setCart(cartData || null);

      if (!cartData?.id) {
        setCartItems([]);
      } else {
        const { data: cartItemsData, error: itemsError } = await db
          .from("cart_items")
          .select(
            `
            id,
            cart_id,
            post_id,
            menu_item_id,
            quantity,
            unit_price,
            total_price,
            special_instructions,
            posts:posts(
              id,
              title,
              description,
              image_url,
              discounted_price,
              original_price,
              restaurant_id,
              restaurants:restaurants(
                restaurant_name,
                image_url,
                latitude,
                longitude
              )
            ),
            menu_items:menu_items(
              id,
              name,
              description,
              image_url,
              price,
              restaurant_id,
              restaurants:restaurants(
                restaurant_name,
                image_url,
                latitude,
                longitude
              )
            )
          `,
          )
          .eq("cart_id", cartData.id);

        if (itemsError) throw itemsError;

        const mappedItems = (cartItemsData || []).map((item: any) => {
          const post = item.posts;
          const menuItem = item.menu_items;
          const price = toUGX(
            item.unit_price ??
            post?.discounted_price ??
            post?.original_price ??
            menuItem?.price ??
            0,
          );

          return {
            id: item.id,
            cart_id: item.cart_id,
            post_id: item.post_id,
            menu_item_id: item.menu_item_id,
            quantity: Number(item.quantity || 1),
            unit_price: price,
            price,
            total_price: price * Number(item.quantity || 1),
            name: post?.title || menuItem?.name || "Item",
            description: post?.description || menuItem?.description || null,
            image: post?.image_url || menuItem?.image_url || null,
            image_url: post?.image_url || menuItem?.image_url || null,
            restaurant_id: post?.restaurant_id || menuItem?.restaurant_id,
            restaurant:
              post?.restaurants?.restaurant_name ||
              menuItem?.restaurants?.restaurant_name ||
              "Restaurant",
            restaurant_image_url:
              post?.restaurants?.image_url || menuItem?.restaurants?.image_url || null,
            restaurant_location: {
              latitude: post?.restaurants?.latitude || menuItem?.restaurants?.latitude,
              longitude: post?.restaurants?.longitude || menuItem?.restaurants?.longitude,
            },
          } as CartItem;
        });

        setCartItems(mappedItems);
      }

      await fetchAddresses();
    } catch (error) {
      console.error("Checkout load error:", error);
      Alert.alert("Error", "Could not load checkout.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    user?.id,
    hasRouteCheckout,
    buildCheckoutItemFromRoute,
    fetchAddresses,
  ]);

  useEffect(() => {
    fetchCheckoutData();
  }, [fetchCheckoutData]);

  useEffect(() => {
    let alive = true;
    loadDeliveryPricingSettings(db).then((settings) => {
      if (alive) setDeliverySettings(settings);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCheckoutData();
  };

  const createStripePayment = async (amountUGX = orderSummary.total) => {
    const data = await createPaymentIntent({
      amountUGX: toUGX(amountUGX),
      customerEmail: user?.email,
      metadata: {
        restaurant_id: String(cartItems[0]?.restaurant_id || routeRestaurantId || ""),
      },
    });

    const initResult = await initPaymentSheet({
      merchantDisplayName: "Mataim",
      paymentIntentClientSecret: data.clientSecret,
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: {
        email: user?.email,
        name: user?.full_name,
        phone: user?.phone,
      },
      appearance: {
        colors: {
          primary: "#FF6B35",
        },
      },
    });

    if (initResult.error) {
      throw new Error(initResult.error.message);
    }

    const paymentResult = await presentPaymentSheet();

    if (paymentResult.error) {
      throw new Error(paymentResult.error.message);
    }

    return {
      paymentIntentId: data.paymentIntentId,
    };
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to place an order");
      router.push("/(auth)/signin");
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty");
      return;
    }

    if (orderType === "delivery" && !selectedAddress) {
      Alert.alert("Address Required", "Please select a delivery address");
      return;
    }

    try {
      setSubmitting(true);

      const restaurantId = cartItems[0]?.restaurant_id || routeRestaurantId;

      if (!restaurantId) {
        throw new Error("Restaurant information missing");
      }

      const liveQuoteResult = await resolveDeliveryQuote({
        restaurant: cartItems[0]?.restaurant_location,
        address: selectedAddress,
        settings: deliverySettings,
      });
      const liveQuote =
        hasRouteCheckout && routeDeliveryFee > 0 && !cartItems[0]?.restaurant_location
          ? { ...liveQuoteResult, deliveryFee: routeDeliveryFee }
          : liveQuoteResult;
      const liveTotal = Math.max(0, orderSummary.total - orderSummary.deliveryFee + liveQuote.deliveryFee);

      const stripePayment = await createStripePayment(liveTotal);

      const orderData = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        status: "pending",

        total_amount: toUGX(orderSummary.subtotal),
        delivery_fee: toUGX(liveQuote.deliveryFee),
        distance_km: liveQuote.distanceKm,
        driver_payout_amount: calculateDriverPayout(liveQuote.deliveryFee),
        tax_amount: toUGX(orderSummary.tax),
        discount_amount: 0,
        final_amount: toUGX(liveTotal),

        payment_method: paymentMethod,
        payment_status: "completed",
        currency: "UGX",
        stripe_payment_intent_id: stripePayment.paymentIntentId,
        stripe_payment_status: "succeeded",

        delivery_address: JSON.stringify(selectedAddress),
        special_instructions: specialInstructions,
        estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: order, error: orderError } = await db
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        post_id: item.post_id || null,
        menu_item_id: item.menu_item_id || null,
        quantity: Number(item.quantity || 1),
        unit_price: toUGX(itemPrice(item)),
        special_instructions: "",
        item_name: itemName(item),
        item_description: item.description || null,
        item_price: toUGX(itemPrice(item)),
        item_image_url: itemImage(item),
      }));

      const { error: itemsError } = await db
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setSubmitting(false);

      router.replace(`/order-tracking/${order.id}` as any);

      safeRun("Cart cleanup", async () => {
        if (!cart?.id) return;

        await db.from("cart_items").delete().eq("cart_id", cart.id);

        await db
          .from("carts")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", cart.id);
      });

      safeRun("Order notification", async () => {
        await NotificationService.sendOrderNotification(order.id, "pending");
      });
    } catch (error: any) {
      console.error("Error placing order:", error);
      setSubmitting(false);

      Alert.alert(
        "Payment Error",
        error.message ||
        "Payment may have succeeded, but the order screen could not open. Please check your orders.",
      );
    }
  };

  const restaurantLabel = cartItems[0]?.restaurant || routeRestaurantName || "Restaurant";
  const restaurantImage = useMemo(() => {
    const fromCart = cartItems[0]?.restaurant_image_url;
    if (fromCart) return fromCart;
    if (routeRestaurantImage) return routeRestaurantImage;
    return FALLBACK_RESTAURANT_IMAGE;
  }, [cartItems, routeRestaurantImage]);

  const savedAddress = addresses[0] ?? null;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Preparing your order</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Place order</Text>
          <Text style={styles.headerSubtitle}>{restaurantLabel}</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
      >
        <View style={styles.contextCard}>
          <Image source={{ uri: restaurantImage }} style={styles.contextImage} />
          <View style={styles.contextBody}>
            <Text style={styles.contextLabel}>Ordering from</Text>
            <Text style={styles.contextTitle}>{restaurantLabel}</Text>
            <View style={styles.contextMetaRow}>
              <Ionicons name="bicycle-outline" size={13} color={C.muted} />
              <Text style={styles.contextMeta}>
                Delivery {formatUGX(orderSummary.deliveryFee)}
              </Text>
              <View style={styles.contextDot} />
              <Ionicons name="bag-handle-outline" size={13} color={C.muted} />
              <Text style={styles.contextMeta}>
                {cartItems.length} item{cartItems.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="restaurant-outline" size={19} color={C.accent} />
            <Text style={styles.sectionEyebrowInline}>Your order</Text>
          </View>
          {cartItems.map((item, index) => (
            <View key={item.id} style={[styles.itemRow, index > 0 && styles.itemRowBorder]}>
              {itemImage(item) ? (
                <Image source={{ uri: itemImage(item)! }} style={styles.itemImage} />
              ) : (
                <View style={styles.itemImageFallback}>
                  <Ionicons name="restaurant-outline" size={20} color={C.accent} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {itemName(item)}
                </Text>
                <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatUGX(itemPrice(item) * Number(item.quantity || 1))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={19} color={C.accent} />
            <Text style={styles.sectionEyebrowInline}>Where to deliver</Text>
          </View>
          <Text style={styles.sectionHint}>Choose current location or your saved address</Text>

          {routeAddress ? (
            <TouchableOpacity
              style={[styles.choiceRow, (selectedAddress?.is_temporary || selectedAddress?.id === routeAddress.id) && styles.choiceRowActive]}
              onPress={() => setSelectedAddress(routeAddress)}
            >
              <View style={styles.choiceIconWrap}>
                <Ionicons name="navigate" size={16} color={C.accent} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={styles.choiceTitle}>{routeAddress.label || "Current location"}</Text>
                <Text style={styles.choiceSubtitle} numberOfLines={1}>
                  {addressText(routeAddress)}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {savedAddress ? (
            <TouchableOpacity
              style={[styles.choiceRow, selectedAddress?.id === savedAddress.id && styles.choiceRowActive]}
              onPress={() => setSelectedAddress(savedAddress)}
            >
              <View style={styles.choiceIconWrap}>
                <Ionicons name="home-outline" size={16} color={C.ink} />
              </View>
              <View style={styles.choiceBody}>
                <Text style={styles.choiceTitle}>{savedAddress.label || "Saved address"}</Text>
                <Text style={styles.choiceSubtitle} numberOfLines={1}>
                  {addressText(savedAddress)}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {!routeAddress && !savedAddress ? (
            <View style={styles.emptyChoice}>
              <Ionicons name="alert-circle-outline" size={18} color={C.muted} />
              <Text style={styles.emptyChoiceText}>Set your location on the previous screen</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="card-outline" size={19} color={C.accent} />
            <Text style={styles.sectionEyebrowInline}>Payment</Text>
          </View>
          <View style={styles.paymentRow}>
            <View style={styles.paymentIconWrap}>
              <Ionicons name="card-outline" size={22} color={'#085221'} />
            </View>
            <View style={styles.paymentCopy}>
              <Text style={styles.paymentTitle}>Card via Stripe</Text>
              <Text style={styles.paymentSubtitle}>Secure checkout · Apple Pay & Google Pay where supported</Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="chatbox-ellipses-outline" size={19} color={C.accent} />
            <Text style={styles.sectionEyebrowInline}>Notes for restaurant</Text>
          </View>
          <TextInput
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            placeholder="Gate code, allergies, or drop-off instructions"
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.notesInput}
          />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="receipt-outline" size={19} color={C.accent} />
            <Text style={styles.sectionEyebrowInline}>Order summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatUGX(orderSummary.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>{formatUGX(orderSummary.deliveryFee)}</Text>
          </View>
          {orderSummary.distanceKm != null ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{orderSummary.distanceKm.toFixed(1)} km</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>{formatUGX(orderSummary.tax)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total due</Text>
            <Text style={styles.totalValue}>{formatUGX(orderSummary.total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, (submitting || cartItems.length === 0) && styles.payButtonDisabled]}
          onPress={handlePlaceOrder}
          disabled={submitting || cartItems.length === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
              <Text style={styles.payButtonText}>Pay with card</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: C.muted, fontSize: 14, fontFamily: "Inter", fontWeight: "500" },
  header: {
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 18,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: C.ink, letterSpacing: 0.2 },
  headerSubtitle: { marginTop: 1, fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: C.muted, letterSpacing: 0.2 },
  scroll: { flex: 1 },
  content: { padding: 11, paddingBottom: 50 },
  contextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    marginBottom: 12,
  },
  contextImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.line },
  contextBody: { flex: 1 },
  contextLabel: { fontSize: 11, fontFamily: "Inter", fontWeight: "600", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  contextTitle: { marginTop: 2, fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: C.ink, letterSpacing: 0.2 },
  contextMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  contextMeta: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: C.muted },
  contextDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.line },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionEyebrowInline: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: C.ink, letterSpacing: 0.2 },
  section: {
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    marginBottom: 10,
  },
  sectionHint: { marginTop: -6, marginBottom: 8, fontSize: 12.8, fontFamily: "Inter", fontWeight: "500", color: C.muted },
  choiceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 2,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  choiceRowActive: { backgroundColor: C.accentSoft, paddingHorizontal: 4, borderRadius: 8 },
  choiceBody: { flex: 1 },
  choiceTitle: { fontSize: 13.5, fontFamily: "Inter", fontWeight: "600", color: C.ink, letterSpacing: 0.1 },
  choiceSubtitle: { marginTop: 2, fontSize: 12.6, fontFamily: "Inter", fontWeight: "500", color: C.muted, letterSpacing: 0.2 },
  emptyChoice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: "dashed",
  },
  emptyChoiceText: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: C.accent },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  itemRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.line },
  itemImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  itemName: { fontSize: 15, lineHeight: 20, fontFamily: "Inter", fontWeight: "600", color: C.ink },
  itemMeta: { marginTop: 4, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: C.muted },
  itemPrice: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: C.ink },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: C.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  paymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  paymentCopy: { flex: 1 },
  paymentTitle: { fontSize: 13.8, fontFamily: "Inter", fontWeight: "600", color: C.ink, letterSpacing: 0.1 },
  paymentSubtitle: { marginTop: 2, fontSize: 12, lineHeight: 14, fontFamily: "Inter", fontWeight: "400", color: C.muted },
  notesInput: {
    minHeight: 72,
    borderRadius: 6,
    backgroundColor: C.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 12,
    color: C.ink,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "600",
    textAlignVertical: "top",
  },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { color: C.muted, fontSize: 14.8, fontFamily: "Inter", fontWeight: "500", letterSpacing: 0.2 },
  summaryValue: { color: C.ink, fontSize: 14, fontFamily: "Inter", fontWeight: "600" },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 8 },
  totalLabel: { color: C.ink, fontSize: 15.8, fontFamily: "Inter", fontWeight: "600", letterSpacing: 0.2 },
  totalValue: { color: C.accent, fontSize: 17.5, fontFamily: "Inter", fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  footerTotal: { minWidth: 92 },
  footerTotalLabel: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: C.muted },
  footerTotalValue: { marginTop: 2, fontSize: 18, fontFamily: "Inter", fontWeight: "700", color: C.ink },
  payButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  payButtonDisabled: { opacity: 0.55 },
  payButtonText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter", fontWeight: "600" },
});
