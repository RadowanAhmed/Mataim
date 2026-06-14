import { useAuth } from "@/backend/AuthContext";
import {
  deleteCartItem,
  getCustomerCart,
  getPromoDiscount,
  summarizeCustomerCart,
  updateCartItemQuantity,
  type CustomerAddress,
  type CustomerCartItem,
} from "@/backend/customer/cartService";
import { createPaymentIntent, verifyPaymentIntent } from "@/backend/services/paymentIntentClient";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { normalizeRating } from "@/backend/utils/ratings";
import { useStripe } from "@stripe/stripe-react-native";
import {
  calculateDriverPayout,
  loadDeliveryPricingSettings,
  type DeliveryPricingSettings,
} from "@/backend/utils/deliveryPricing";
import { getSafeCurrentLocation, reverseAddress } from "@/backend/utils/location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const db = supabase as any;
const ACCENT = "#FF6B35";
const GREEN = "#10B981";

type CheckoutStep = "review" | "address" | "payment" | "confirm";
type PaymentMethod = "card";
type OrderType = "delivery" | "pickup";

const CHECKOUT_STEPS: { key: CheckoutStep; label: string; icon: ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "review", label: "Review", icon: "receipt-outline" },
  { key: "address", label: "Address", icon: "location-outline" },
  { key: "payment", label: "Pay", icon: "wallet-outline" },
  { key: "confirm", label: "Confirm", icon: "checkmark-circle-outline" },
];

const TIP_OPTIONS = [0, 1000, 2000, 5000];

function normalizeStripeStatus(status?: string | null) {
  return String(status || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function Stepper({ activeStep }: { activeStep: CheckoutStep }) {
  const activeIndex = CHECKOUT_STEPS.findIndex((step) => step.key === activeStep);

  return (
    <View style={styles.stepper}>
      {CHECKOUT_STEPS.map((step, index) => {
        const isActive = step.key === activeStep;
        const isComplete = index < activeIndex;

        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={[styles.stepCircle, (isActive || isComplete) && styles.stepCircleActive]}>
              <Ionicons
                name={isComplete ? "checkmark" : step.icon}
                size={15}
                color={isActive || isComplete ? "#FFFFFF" : "#9ca3afe8"}
              />
            </View>
            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LineItem({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CustomerCartItem;
  onQuantityChange: (item: CustomerCartItem, quantity: number) => void;
  onRemove: (item: CustomerCartItem) => void;
}) {
  return (
    <View style={styles.lineItem}>
      <Image source={{ uri: item.image }} style={styles.lineItemImage} />
      <View style={styles.lineItemBody}>
        <Text style={styles.lineItemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.lineItemRestaurant} numberOfLines={1}>
          {item.restaurant}
        </Text>
        <Text style={styles.lineItemPrice}>{item.formattedPrice}</Text>
      </View>
      <View style={styles.lineItemActions}>
        <View style={styles.inlineQuantity}>
          <TouchableOpacity style={styles.inlineQuantityButton} onPress={() => onQuantityChange(item, item.quantity - 1)}>
            <Ionicons name="remove" size={14} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.inlineQuantityText}>{item.quantity}</Text>
          <TouchableOpacity style={styles.inlineQuantityButton} onPress={() => onQuantityChange(item, item.quantity + 1)}>
            <Ionicons name="add" size={14} color="#111827" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.removeItemButton} onPress={() => onRemove(item)}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddressCard({
  address,
  selected,
  onPress,
}: {
  address: CustomerAddress;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.addressCard, selected && styles.addressCardActive]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.addressIcon}>
        <Ionicons name={selected ? "checkmark-circle" : "location-outline"} size={20} color={selected ? GREEN : ACCENT} />
      </View>
      <View style={styles.addressBody}>
        <Text style={styles.addressLabel}>{address.label || "Address"}</Text>
        <Text style={styles.addressLine} numberOfLines={1}>
          {address.address_line1 || "No street address"}
        </Text>
        <Text style={styles.addressCity} numberOfLines={1}>
          {[address.city, address.country].filter(Boolean).join(", ") || "Uganda"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StripePaymentRow() {
  return (
    <View style={styles.stripePaymentRow}>
      <View style={styles.stripePaymentIcon}>
        <Ionicons name="card-outline" size={20} color="#111827" />
      </View>
      <View style={styles.stripePaymentCopy}>
        <Text style={styles.stripePaymentTitle}>Card via Stripe</Text>
        <Text style={styles.stripePaymentSubtitle}>Secure checkout · Apple Pay & Google Pay where supported</Text>
      </View>
      <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ promoCode?: string }>();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet, retrievePaymentIntent } = useStripe();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activeStep, setActiveStep] = useState<CheckoutStep>("review");
  const [cart, setCart] = useState<any>(null);
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<DeliveryPricingSettings | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const paymentMethod: PaymentMethod = "card";
  const [tipAmount, setTipAmount] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [promoInput, setPromoInput] = useState(String(params.promoCode || ""));
  const [appliedPromoCode, setAppliedPromoCode] = useState(String(params.promoCode || ""));
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const successScale = useRef(new Animated.Value(0.4)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successProgress = useRef(new Animated.Value(0)).current;
  const successCounter = useRef<NodeJS.Timeout | null>(null);
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    address_line1: "",
    address_line2: "",
    city: "Kampala",
    country: "Uganda",
    postal_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const loadCheckout = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [payload, settings] = await Promise.all([
        getCustomerCart(user.id, { ensureCart: false }),
        loadDeliveryPricingSettings(db),
      ]);
      setCart(payload.cart);
      setCartItems(payload.items);
      setAddresses(payload.addresses);
      setSelectedAddress((current) => current || payload.defaultAddress);
      setDeliverySettings(settings);
    } catch (error) {
      console.error("Checkout load failed:", error);
      Alert.alert("Checkout unavailable", "We could not load checkout details. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    loadCheckout();
  }, [loadCheckout]);

  useEffect(() => {
    if (!showSuccess) {
      if (successCounter.current) {
        clearTimeout(successCounter.current);
        successCounter.current = null;
      }
      return;
    }

    // Haptic feedback for success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Fallback haptic if Haptics fails
      Vibration.vibrate([30, 60, 40]);
    });

    // Animation sequence
    successScale.setValue(0.4);
    successOpacity.setValue(0);
    successProgress.setValue(0);

    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        speed: 12,
        bounciness: 9,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(successProgress, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();

    // Auto-navigate after 4 seconds
    successCounter.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 0.7,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successScale, {
          toValue: 0.95,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Navigate after fade out animation
        if (placedOrder?.id) {
          router.replace(`/(tabs)/orders/${placedOrder.id}` as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      });
    }, 7000) as any; // 7 seconds display time

    return () => {
      if (successCounter.current) {
        clearTimeout(successCounter.current);
        successCounter.current = null;
      }
    };
  }, [showSuccess, successOpacity, successProgress, successScale, placedOrder?.id, router]);

  const summary = useMemo(
    () =>
      summarizeCustomerCart({
        items: cartItems,
        address: selectedAddress,
        orderType,
        promoCode: appliedPromoCode,
        tip: tipAmount,
        deliverySettings,
      }),
    [appliedPromoCode, cartItems, deliverySettings, orderType, selectedAddress, tipAmount],
  );

  const promo = useMemo(
    () => (appliedPromoCode ? getPromoDiscount(appliedPromoCode, summary.subtotal) : null),
    [appliedPromoCode, summary.subtotal],
  );

  const currentStepIndex = CHECKOUT_STEPS.findIndex((step) => step.key === activeStep);
  const canContinue = useMemo(() => {
    if (activeStep === "address") return orderType === "pickup" || Boolean(selectedAddress);
    if (activeStep === "review") return cartItems.length > 0;
    return true;
  }, [activeStep, cartItems.length, orderType, selectedAddress]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCheckout();
  }, [loadCheckout]);

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
        console.error("Checkout item remove failed:", error);
        setCartItems(previousItems);
        Alert.alert("Remove failed", "We could not remove this item.");
      }
    },
    [cartItems],
  );

  const handleQuantityChange = useCallback(
    async (item: CustomerCartItem, quantity: number) => {
      if (quantity < 1) {
        await handleRemove(item);
        return;
      }

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
        console.error("Checkout quantity update failed:", error);
        setCartItems(previousItems);
        Alert.alert("Update failed", "We could not update this item.");
      }
    },
    [cartItems, handleRemove],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const location = await getSafeCurrentLocation();

      if (!location.point) {
        Alert.alert("Location unavailable", location.error || "Please type your address manually.");
        return;
      }

      const address = await reverseAddress(location.point.latitude, location.point.longitude);
      setNewAddress({
        label: "Current",
        address_line1: address.address_line1,
        address_line2: address.address_line2 || "",
        city: address.city,
        country: address.country,
        postal_code: address.postal_code || "",
        latitude: address.latitude,
        longitude: address.longitude,
      });
      setShowAddressForm(true);
    } finally {
      setLocating(false);
    }
  }, []);

  const handleSaveAddress = useCallback(async () => {
    if (!user?.id) return;
    if (!newAddress.address_line1.trim()) {
      Alert.alert("Address required", "Please enter your delivery address.");
      return;
    }

    if (addresses.length >= 2) {
      Alert.alert("Address limit reached", "You can save up to 2 delivery addresses. Remove one to add another.");
      return;
    }

    try {
      const addressToSave = {
        user_id: user.id,
        label: newAddress.label || "Home",
        address_line1: newAddress.address_line1.trim(),
        address_line2: newAddress.address_line2.trim() || null,
        city: newAddress.city.trim() || "Kampala",
        country: newAddress.country.trim() || "Uganda",
        postal_code: newAddress.postal_code.trim() || null,
        latitude: newAddress.latitude,
        longitude: newAddress.longitude,
        is_default: addresses.length === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db.from("addresses").insert(addressToSave).select("*").single();
      if (error) throw error;

      setAddresses((items) => [data, ...items].slice(0, 2));
      setSelectedAddress(data);
      setShowAddressForm(false);
      setNewAddress({
        label: "Home",
        address_line1: "",
        address_line2: "",
        city: "Kampala",
        country: "Uganda",
        postal_code: "",
        latitude: null,
        longitude: null,
      });
    } catch (error) {
      console.error("Address save failed:", error);
      Alert.alert("Could not save address", "Please check the address and try again.");
    }
  }, [addresses.length, newAddress, user?.id]);

  const goNext = useCallback(() => {
    if (!canContinue) {
      Alert.alert("One more thing", "Please complete this step before continuing.");
      return;
    }

    const nextStep = CHECKOUT_STEPS[Math.min(currentStepIndex + 1, CHECKOUT_STEPS.length - 1)]?.key;
    if (nextStep) setActiveStep(nextStep);
  }, [canContinue, currentStepIndex]);

  const goBackStep = useCallback(() => {
    if (currentStepIndex <= 0) {
      router.back();
      return;
    }

    setActiveStep(CHECKOUT_STEPS[currentStepIndex - 1].key);
  }, [currentStepIndex, router]);

  const handlePlaceOrder = useCallback(async () => {
    if (!user?.id) {
      router.push("/(auth)/signin" as any);
      return;
    }

    if (!cartItems.length || !cart?.id) {
      Alert.alert("Cart is empty", "Please add items before checkout.");
      return;
    }

    if (orderType === "delivery" && !selectedAddress) {
      Alert.alert("Address required", "Please select a delivery address.");
      setActiveStep("address");
      return;
    }

    const restaurantId = cartItems[0]?.restaurant_id;
    if (!restaurantId) {
      Alert.alert("Restaurant missing", "We could not identify the restaurant for this cart.");
      return;
    }

    setSubmitting(true);

    // Haptic feedback for button press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      Vibration.vibrate(10);
    });

    try {
      const now = new Date().toISOString();
      const deliveryQuote =
        orderType === "delivery"
          ? {
            deliveryFee: summary.deliveryFee,
            distanceKm: summary.distanceKm,
            source: "haversine" as const,
          }
          : { deliveryFee: 0, distanceKm: null, source: "haversine" as const };
      const normalizedSubtotal = toUGX(summary.subtotal);
      const normalizedDiscount = toUGX(summary.discount);
      const normalizedTip = toUGX(summary.tip);
      const normalizedDeliveryFee = toUGX(deliveryQuote.deliveryFee);
      const payableTotal = Math.max(
        0,
        normalizedSubtotal - normalizedDiscount + normalizedDeliveryFee + normalizedTip,
      );

      // Create payment intent with professional error handling
      let intent: any;
      try {
        intent = await createPaymentIntent({
          amountUGX: toUGX(payableTotal),
          customerEmail: user.email,
          metadata: { restaurant_id: String(restaurantId) },
        });
      } catch (error: any) {
        throw new Error(`Payment setup failed: ${error?.message || "Unknown error"}`);
      }

      // Initialize payment sheet
      const initResult = await initPaymentSheet({
        merchantDisplayName: "Mataim",
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: user.email ?? undefined,
          name: user.full_name ?? undefined,
          phone: user.phone ?? undefined,
        },
        appearance: {
          colors: {
            primary: "#FF6B35",
            background: "#FFFFFF",
            componentBackground: "#F3F4F6",
            componentText: "#111827",
            componentBorder: "#E5E7EB",
          }
        },
      });

      if (initResult.error) {
        throw new Error(`Payment initialization failed: ${initResult.error.message}`);
      }

      // Present payment sheet with haptic feedback
      const paymentResult = await presentPaymentSheet();

      if (paymentResult.error) {
        // Handle different payment error scenarios
        if (paymentResult.error.message?.includes("cancelled") || paymentResult.error.message?.includes("Cancelled")) {
          setSubmitting(false);
          Alert.alert("Payment cancelled", "Your order was not placed. Please try again.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
            Vibration.vibrate(20);
          });
          return;
        }
        throw new Error(`Payment failed: ${paymentResult.error.message}`);
      }

      // ✅ CRITICAL: Verify payment succeeded with Stripe before creating order
      const stripePaymentIntent = await retrievePaymentIntent(intent.clientSecret);
      if (stripePaymentIntent.error || !stripePaymentIntent.paymentIntent) {
        throw new Error(
          `Payment verification failed: ${stripePaymentIntent.error?.message || "Could not read Stripe payment status"}`,
        );
      }

      if (stripePaymentIntent.paymentIntent.id !== intent.paymentIntentId) {
        throw new Error("Payment verification failed: Stripe returned a different payment intent.");
      }

      const localStripeStatus = normalizeStripeStatus(stripePaymentIntent.paymentIntent.status);
      if (localStripeStatus !== "succeeded") {
        throw new Error(`Payment not completed: Payment status: ${localStripeStatus || "unknown"}`);
      }

      let verifiedPaymentStatus: string;
      try {
        const paymentVerification = await verifyPaymentIntent(intent.paymentIntentId);

        if (paymentVerification.id !== intent.paymentIntentId) {
          throw new Error("Payment intent mismatch");
        }

        if (paymentVerification.status !== "succeeded") {
          const statusMessages: Record<string, string> = {
            requires_payment_method: "No payment method provided",
            requires_confirmation: "Payment requires confirmation",
            requires_action: "Payment requires additional action from your bank",
            processing: "Payment is still processing. Please wait a few moments.",
            canceled: "Payment was cancelled",
          };

          const message = statusMessages[paymentVerification.status] || `Payment status: ${paymentVerification.status}`;
          throw new Error(`Payment not completed: ${message}`);
        }

        verifiedPaymentStatus = paymentVerification.status;
      } catch (verifyError: any) {
        throw new Error(`Payment verification failed: ${verifyError?.message || "Could not verify payment with Stripe"}`);
      }

      // Payment successful - haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        Vibration.vibrate([30, 60, 40]);
      });

      const stripePaymentIntentId = intent.paymentIntentId;
      const stripePaymentStatus = verifiedPaymentStatus;
      const paymentStatus = "completed";

      const orderData = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        status: "pending",
        total_amount: normalizedSubtotal,
        delivery_fee: normalizedDeliveryFee,
        distance_km: deliveryQuote.distanceKm,
        driver_payout_amount: toUGX(calculateDriverPayout(normalizedDeliveryFee)),
        tax_amount: toUGX(0),
        discount_amount: normalizedDiscount,
        tip_amount: normalizedTip,
        final_amount: payableTotal,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        currency: "UGX",
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_payment_status: stripePaymentStatus,
        delivery_address: orderType === "delivery" ? selectedAddress : null,
        special_instructions: specialInstructions.trim() || null,
        estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
        created_at: now,
        updated_at: now,
      };

      const { data: order, error: orderError } = await db
        .from("orders")
        .insert(orderData)
        .select("*")
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        post_id: item.post_id || null,
        menu_item_id: item.menu_item_id || null,
        quantity: item.quantity,
        unit_price: item.priceUgx,
        special_instructions: "",
        item_name: item.name,
        item_price: item.priceUgx,
        item_image_url: item.image,
      }));

      const { error: itemsError } = await db.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      await db.from("cart_items").delete().eq("cart_id", cart.id);
      await db
        .from("carts")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", cart.id);

      await NotificationService.sendOrderNotification(order.id, "pending");

      setPlacedOrder(order);
      setShowSuccess(true);
      setCartItems([]);
    } catch (error: any) {
      console.error("Order placement failed:", error);

      // Professional error handling
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        Vibration.vibrate([50, 30, 50]);
      });

      const errorMessage = error?.message || "We could not place this order. Please try again.";
      Alert.alert(
        "Order failed",
        errorMessage,
        [
          {
            text: "Try again",
            onPress: () => {
              // Retry mechanism
              handlePlaceOrder();
            },
          },
          {
            text: "Cancel",
            onPress: () => setSubmitting(false),
            style: "cancel",
          },
        ],
        { cancelable: false }
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    cart?.id,
    cartItems,
    deliverySettings,
    orderType,
    paymentMethod,
    router,
    selectedAddress,
    specialInstructions,
    summary.deliveryFee,
    summary.discount,
    summary.distanceKm,
    summary.subtotal,
    summary.tip,
    summary.total,
    user?.email,
    user?.full_name,
    user?.id,
    user?.phone,
    initPaymentSheet,
    presentPaymentSheet,
  ]);

  if (showSuccess) {
    const receiptId = String(placedOrder?.order_number || placedOrder?.id || "").slice(0, 12);

    return (
      <SafeAreaView style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#10B981" />
        <View style={styles.successContent}>
          <Animated.View
            style={[
              styles.successIcon,
              {
                opacity: successOpacity,
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <Text style={styles.successEmoji}>✅</Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.successTitle,
              {
                opacity: successOpacity,
              }
            ]}
          >
            🎉 Order Confirmed!
          </Animated.Text>

          <Animated.Text
            style={[
              styles.successSubtitle,
              {
                opacity: successOpacity,
              }
            ]}
          >
            Your delicious food is being prepared. Thank you for ordering! 🙏
          </Animated.Text>

          <Animated.View
            style={[
              styles.receiptCard,
              {
                opacity: successOpacity,
              }
            ]}
          >
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>📋 Receipt ID</Text>
              <Text style={styles.receiptValue}>{receiptId || "Pending"}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>💰 Amount Paid</Text>
              <Text style={styles.receiptValue}>{formatUGX(placedOrder?.final_amount || summary.total)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>💳 Payment Method</Text>
              <Text style={styles.receiptValue}>Card via Stripe</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>✨ Status</Text>
              <Text style={styles.receiptStatusSuccess}>Confirmed</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.progressContainer,
              {
                opacity: successOpacity,
              }
            ]}
          >
            {/* <Text style={styles.progressLabel}>⏱️ Redirecting in 4 seconds...</Text> */}
            {/* <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: successProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }
                ]}
              />
            </View> */}
          </Animated.View>

          <Animated.View
            style={[
              styles.actionContainer,
              {
                opacity: successOpacity,
              }
            ]}
          >
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => {
                if (successCounter.current) {
                  clearTimeout(successCounter.current);
                  successCounter.current = null;
                }
                if (placedOrder?.id) router.replace(`/(tabs)/orders/${placedOrder.id}` as any);
                else router.replace("/(tabs)" as any);
              }}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.trackButtonText}>Track order now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => {
                if (successCounter.current) {
                  clearTimeout(successCounter.current);
                  successCounter.current = null;
                }
                router.replace("/(tabs)" as any);
              }}
            >
              <Text style={styles.continueButtonText}>Back home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Preparing checkout</Text>
      </SafeAreaView>
    );
  }

  if (!cartItems.length) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={21} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.iconButtonGhost} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="basket-outline" size={42} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>No items to checkout</Text>
          <Text style={styles.emptyText}>Add meals to your cart first, then come back here.</Text>
          <TouchableOpacity style={styles.trackButton} onPress={() => router.replace("/(tabs)" as any)}>
            <Text style={styles.trackButtonText}>Browse restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={goBackStep}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSubtitle}>{cartItems[0]?.restaurant || "Your order"}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={onRefresh}>
          {refreshing ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Ionicons name="refresh" size={18} color={ACCENT} />
          )}
        </TouchableOpacity>
      </View>

      <Stepper activeStep={activeStep} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        {activeStep === "review" ? (
          <>
            <View style={styles.restaurantHero}>
              <Image source={{ uri: cartItems[0]?.image }} style={styles.restaurantHeroImage} />
              <View style={styles.restaurantHeroBody}>
                <Text style={styles.restaurantHeroLabel}>Ordering from</Text>
                <Text style={styles.restaurantHeroTitle}>{cartItems[0]?.restaurant}</Text>
                <View style={styles.restaurantHeroMeta}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.restaurantHeroMetaText}>{normalizeRating(cartItems[0]?.restaurant_rating).toFixed(1)}</Text>
                  <Text style={styles.restaurantHeroMetaText}>25-40 min</Text>
                </View>
              </View>
            </View>

            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentButton, orderType === "delivery" && styles.segmentButtonActive]}
                onPress={() => setOrderType("delivery")}
              >
                <Ionicons name="bicycle-outline" size={16} color={orderType === "delivery" ? "#FFFFFF" : "#111827"} />
                <Text style={[styles.segmentButtonText, orderType === "delivery" && styles.segmentButtonTextActive]}>
                  Delivery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, orderType === "pickup" && styles.segmentButtonActive]}
                onPress={() => setOrderType("pickup")}
              >
                <Ionicons name="bag-handle-outline" size={16} color={orderType === "pickup" ? "#FFFFFF" : "#111827"} />
                <Text style={[styles.segmentButtonText, orderType === "pickup" && styles.segmentButtonTextActive]}>
                  Pickup
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Items</Text>
                <Text style={styles.sectionHint}>{cartItems.length} total</Text>
              </View>
              <View style={styles.itemList}>
                {cartItems.map((item) => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                  />
                ))}
              </View>
            </View>
          </>
        ) : null}

        {activeStep === "address" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Delivery address</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose where the driver should meet you. {addresses.length}/2 saved.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.textAction}
                onPress={() => setShowAddressForm((value) => !value)}
                disabled={addresses.length >= 2 && !showAddressForm}
              >
                <Text style={styles.textActionText}>{showAddressForm ? "Close" : "Add"}</Text>
              </TouchableOpacity>
            </View>

            {orderType === "pickup" ? (
              <View style={styles.noticeCard}>
                <Ionicons name="bag-check-outline" size={24} color={GREEN} />
                <Text style={styles.noticeText}>Pickup selected. No delivery address is required.</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation} disabled={locating}>
                  {locating ? <ActivityIndicator size="small" color={ACCENT} /> : <Ionicons name="navigate-outline" size={16} color={ACCENT} />}
                  <Text style={styles.locationButtonText}>Use current location</Text>
                </TouchableOpacity>

                {/* {showAddressForm ? (
                  <View style={styles.addressForm}>
                    <View style={styles.labelRow}>
                      {["Home", "Work", "Current"].map((label) => (
                        <TouchableOpacity
                          key={label}
                          style={[styles.labelChip, newAddress.label === label && styles.labelChipActive]}
                          onPress={() => setNewAddress((address) => ({ ...address, label }))}
                        >
                          <Text style={[styles.labelChipText, newAddress.label === label && styles.labelChipTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      value={newAddress.address_line1}
                      onChangeText={(text) => setNewAddress((address) => ({ ...address, address_line1: text }))}
                      placeholder="Street, building, or landmark"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                    <TextInput
                      value={newAddress.address_line2}
                      onChangeText={(text) => setNewAddress((address) => ({ ...address, address_line2: text }))}
                      placeholder="Apartment, floor, gate code"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                    <View style={styles.inputGrid}>
                      <TextInput
                        value={newAddress.city}
                        onChangeText={(text) => setNewAddress((address) => ({ ...address, city: text }))}
                        placeholder="City"
                        placeholderTextColor="#9CA3AF"
                        style={[styles.input, styles.inputHalf]}
                      />
                      <TextInput
                        value={newAddress.country}
                        onChangeText={(text) => setNewAddress((address) => ({ ...address, country: text }))}
                        placeholder="Country"
                        placeholderTextColor="#9CA3AF"
                        style={[styles.input, styles.inputHalf]}
                      />
                    </View>
                    <TouchableOpacity style={styles.saveAddressButton} onPress={handleSaveAddress}>
                      <Text style={styles.saveAddressButtonText}>Save address</Text>
                    </TouchableOpacity>
                  </View>
                ) : null} */}

                <View style={styles.addressList}>
                  {addresses.map((address) => (
                    <AddressCard
                      key={address.id || `${address.label}-${address.address_line1}`}
                      address={address}
                      selected={selectedAddress?.id === address.id}
                      onPress={() => setSelectedAddress(address)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        ) : null}

        {activeStep === "payment" ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="card-outline" size={16} color={ACCENT} />
              <Text style={styles.sectionTitle}>Payment</Text>
            </View>
            <StripePaymentRow />
            <Text style={styles.stripeHint}>Tap continue, then pay securely with the Stripe sheet.</Text>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Add a driver tip</Text>
              <View style={styles.tipRow}>
                {TIP_OPTIONS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.tipButton, tipAmount === amount && styles.tipButtonActive]}
                    onPress={() => setTipAmount(amount)}
                  >
                    <Text style={[styles.tipButtonText, tipAmount === amount && styles.tipButtonTextActive]}>
                      {amount === 0 ? "No tip" : formatUGX(amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.promoCard}>
              <View>
                <Text style={styles.promoTitle}>Promo code</Text>
                <Text style={styles.promoSubtitle}>{promo ? promo.label : "Apply a code before placing your order."}</Text>
              </View>
              <View style={styles.promoInputRow}>
                <TextInput
                  value={promoInput}
                  onChangeText={(text) => {
                    setPromoInput(text.toUpperCase());
                    if (!text.trim()) setAppliedPromoCode("");
                  }}
                  placeholder="SOFRA10"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  style={styles.promoInput}
                />
                <TouchableOpacity style={styles.promoButton} onPress={handleApplyPromo}>
                  <Text style={styles.promoButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {activeStep === "confirm" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm order</Text>
            <Text style={styles.sectionSubtitleReview}>Review your total and any notes for the restaurant.</Text>
            <StripePaymentRow />
            <TextInput
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              placeholder="Add delivery notes or food instructions"
              placeholderTextColor="#9CA3AF"
              style={styles.notesInput}
            />
            {orderType === "delivery" && selectedAddress ? (
              <AddressCard address={selectedAddress} selected onPress={() => setActiveStep("address")} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
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
          {summary.tip > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Driver tip</Text>
              <Text style={styles.summaryValue}>{formatUGX(summary.tip)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatUGX(summary.total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {/* <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerAmount}>{formatUGX(summary.total)}</Text>
        </View> */}
        {activeStep === "confirm" ? (
          <TouchableOpacity
            style={[styles.footerButton, submitting && styles.footerButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
                <Text style={styles.footerButtonText}>Pay with card</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.footerButton, !canContinue && styles.footerButtonDisabled]} onPress={goNext}>
            <Text style={styles.footerButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 13,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.5
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12.2,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.2,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonGhost: {
    width: 42,
    height: 42,
  },
  stepper: {
    marginHorizontal: 8,
    marginBottom: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7eb8f",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  stepCircleActive: {
    backgroundColor: "#111827",
  },
  stepLabel: {
    fontSize: 10.2,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#9CA3AF",
  },
  stepLabelActive: {
    color: "#111827",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 132,
    gap: 14,
  },
  restaurantHero: {
    minHeight: 92,
    borderRadius: 8,
    padding: 6,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  restaurantHeroImage: {
    width: 82,
    height: 82,
    borderRadius: 8,
    backgroundColor: "#374151",
  },
  restaurantHeroBody: {
    flex: 1,
  },
  restaurantHeroLabel: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#D1D5DB",
    letterSpacing: 0.4,
  },
  restaurantHeroTitle: {
    marginTop: 3,
    fontSize: 16.6,
    fontFamily: "Inter",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  restaurantHeroMeta: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restaurantHeroMetaText: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#D1D5DB",
  },
  segment: {
    height: 48,
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7ebc2",
    flexDirection: "row",
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: "#111827",
  },
  segmentButtonText: {
    fontSize: 12.2,
    fontFamily: "Inter",
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.3,
  },
  segmentButtonTextActive: {
    color: "#FFFFFF",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16.4,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.2
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12.8,
    lineHeight: 16,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#9CA3AF",
  },
  itemList: {
    gap: 6,
  },
  lineItem: {
    minHeight: 94,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7ebb0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineItemImage: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  lineItemBody: {
    flex: 1,
    minWidth: 0,
  },
  lineItemName: {
    fontSize: 14.2,
    lineHeight: 18,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.3,
  },
  lineItemRestaurant: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  lineItemPrice: {
    marginTop: 7,
    fontSize: 13.5,
    fontFamily: "Inter",
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.3,
  },
  lineItemActions: {
    alignItems: "flex-end",
    gap: 9,
  },
  inlineQuantity: {
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 4,
  },
  inlineQuantityButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  inlineQuantityText: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  removeItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  textAction: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: "#FFF1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  textActionText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  noticeCard: {
    minHeight: 74,
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#047857",
    letterSpacing: 0.3,
  },
  locationButton: {
    height: 40,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#fed2c491",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  locationButtonText: {
    fontSize: 13.5,
    fontFamily: "Inter",
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.4,
  },
  addressList: {
    gap: 8,
  },
  addressCard: {
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7eba6",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressCardActive: {
    borderColor: GREEN,
    backgroundColor: "#F0FDF4",
  },
  addressIcon: {
    width: 41,
    height: 41,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  addressBody: {
    flex: 1,
    minWidth: 0,
  },
  addressLabel: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
  },
  addressLine: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#374151",
  },
  addressCity: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  addressForm: {
    borderRadius: 8,
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  labelRow: {
    flexDirection: "row",
    gap: 8,
  },
  labelChip: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  labelChipActive: {
    backgroundColor: "#111827",
  },
  labelChipText: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
  },
  labelChipTextActive: {
    color: "#FFFFFF",
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 13,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
  },
  inputGrid: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  saveAddressButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  saveAddressButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  stripePaymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  stripePaymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  stripePaymentCopy: { flex: 1 },
  stripePaymentTitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
  },
  stripePaymentSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  stripeHint: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    color: "#6B7280",
  },
  paymentList: {
    gap: 10,
  },
  paymentCard: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7ebca",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentCardActive: {
    borderColor: ACCENT,
    backgroundColor: "#FFF7ED",
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  paymentIconActive: {
    backgroundColor: ACCENT,
  },
  paymentBody: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.2,
  },
  paymentSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  tipCard: {
    marginTop: 4,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7ebca",
    gap: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.2,
  },
  tipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tipButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  tipButtonActive: {
    backgroundColor: "#111827",
  },
  tipButtonText: {
    fontSize: 11.5,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.3,
  },
  tipButtonTextActive: {
    color: "#FFFFFF",
  },
  promoCard: {
    marginTop: 3,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7ebca",
    gap: 8,
  },
  promoTitle: {
    fontSize: 14.5,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.2,
  },
  promoSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  promoInputRow: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#e5e7eba3",
    flexDirection: "row",
    overflow: "hidden",
  },
  promoInput: {
    flex: 1,
    paddingHorizontal: 13,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.3
  },
  promoButton: {
    width: 86,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  promoButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  notesInput: {
    minHeight: 96,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7ebc6",
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    textAlignVertical: "top",
  },
  sectionSubtitleReview: {
    marginTop: -8,
    fontSize: 12.7,
    lineHeight: 16,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  summaryCard: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7eba5",
    gap: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    letterSpacing: 0.4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  discountValue: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "700",
    color: GREEN,
    fontVariant: ["tabular-nums"],
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e5e7eba2",
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 15.5,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.3,

  },
  totalValue: {
    fontSize: 16.2,
    fontFamily: "Inter",
    fontWeight: "700",
    color: ACCENT,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    minHeight: 90,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#e5e7ebd6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.4,
  },
  footerAmount: {
    marginTop: 2,
    fontSize: 18,
    fontFamily: "Inter",
    fontWeight: "800",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  footerButton: {
    width: '100%',
    height: 53,
    paddingHorizontal: 0,
    borderRadius: 8,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerButtonDisabled: {
    opacity: 0.55,
  },
  footerButtonText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.5,
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
    fontSize: 18,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  successContainer: {
    flex: 1,
    backgroundColor: "#ECFDF5",
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  successIcon: {
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  successEmoji: {
    fontSize: 36,
    fontWeight: "bold",
  },
  successTitle: {
    marginTop: 18,
    fontSize: 18,
    fontFamily: "Inter",
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.3,
  },
  successSubtitle: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#047857",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  receiptCard: {
    alignSelf: "stretch",
    marginTop: 20,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    gap: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  receiptLabel: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#047857",
    letterSpacing: 0.3,
  },
  receiptValue: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#065F46",
    fontVariant: ["tabular-nums"],
  },
  trackButton: {
    alignSelf: "stretch",
    height: 54,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  trackButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  continueButton: {
    alignSelf: "stretch",
    height: 54,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    color: "#111827",
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  progressContainer: {
    alignSelf: "stretch",
    marginTop: 20,
    paddingHorizontal: 4,
    gap: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#047857",
    textAlign: "center",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1FAE5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  actionContainer: {
    alignSelf: "stretch",
    marginTop: 20,
    gap: 12,
  },
  receiptStatusSuccess: {
    fontSize: 13,
    fontFamily: "Inter",
    fontWeight: "600",
    color: "#059669",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
});
