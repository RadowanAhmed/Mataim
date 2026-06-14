import { logger } from "@/backend/utils/logger";
// app/menu/[restaurantId].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { normalizeRating } from "@/backend/utils/ratings";
import { DELIVERY_MIN_FEE_UGX, calculateDeliveryFromUserLocation } from "@/backend/utils/deliveryPricing";
import { getSafeCurrentLocation } from "@/backend/utils/location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
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
import LottieView from "lottie-react-native";
import animations from "@/constent/animations";

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_MENU_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&h=520&fit=crop";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=820&fit=crop";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type MenuItem = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  priceUgx: number;
  formattedPrice: string;
  displayCategory: string;
  dietaryTags: string[];
  rating: number;
  reviewCount: number;
  calories?: number | null;
  preparation_time?: number | null;
  popularity?: string | null;
  spice_level?: number | null;
};

type MenuGroup = {
  title: string;
  data: MenuItem[];
};

const DIETARY_CONFIG: Record<string, { icon: IoniconName; label: string; color: string; bg: string }> = {
  veg: { icon: "leaf", label: "Veg", color: "#047857", bg: "#ECFDF5" },
  vegetarian: { icon: "leaf", label: "Veg", color: "#047857", bg: "#ECFDF5" },
  "non-veg": { icon: "restaurant", label: "Non-veg", color: "#B91C1C", bg: "#FEF2F2" },
  nonveg: { icon: "restaurant", label: "Non-veg", color: "#B91C1C", bg: "#FEF2F2" },
  spicy: { icon: "flame", label: "Spicy", color: "#C2410C", bg: "#FFF7ED" },
  "gluten-free": { icon: "shield-checkmark", label: "GF", color: "#4338CA", bg: "#EEF2FF" },
  glutenfree: { icon: "shield-checkmark", label: "GF", color: "#4338CA", bg: "#EEF2FF" },
  bestseller: { icon: "star", label: "Best", color: "#92400E", bg: "#FFFBEB" },
};

const SIZE_OPTIONS = [
  { id: "regular", label: "Regular", delta: 0 },
  { id: "large", label: "Large", delta: 4000 },
  { id: "family", label: "Family", delta: 9000 },
] as const;

const ADD_ONS = [
  { id: "cheese", label: "Extra cheese", price: 2500 },
  { id: "sauce", label: "House sauce", price: 1500 },
  { id: "protein", label: "Extra protein", price: 5000 },
] as const;

function normalizeDietaryTags(item: any) {
  const rawTags = Array.isArray(item.dietary_tags)
    ? item.dietary_tags
    : typeof item.dietary_tags === "string"
      ? item.dietary_tags.split(",")
      : [];
  const tags = rawTags.map((tag: unknown) => String(tag).trim()).filter(Boolean);

  if (item.is_vegetarian || item.is_veg) tags.push("veg");
  if (item.is_non_veg || item.is_nonveg) tags.push("non-veg");
  if (item.is_gluten_free) tags.push("gluten-free");
  if (Number(item.spice_level || 0) > 0) tags.push("spicy");
  if (String(item.popularity || "").toLowerCase().includes("best")) tags.push("bestseller");

  const seen = new Set<string>();
  return tags.filter((tag: string) => {
    const key = tag.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dietaryConfig(tag: string) {
  const key = tag.toLowerCase().replace(/\s+/g, "-");
  return DIETARY_CONFIG[key] || {
    icon: "nutrition" as IoniconName,
    label: tag.length > 9 ? tag.slice(0, 9) : tag,
    color: "#4B5563",
    bg: "#F3F4F6",
  };
}

function deliveryTime(index = 0, rating = 4.7) {
  const start = rating >= 4.7 ? 20 + (index % 3) * 3 : 26 + (index % 4) * 3;
  return `${start}-${start + 10} min`;
}

function MenuSkeleton() {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 760, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <Animated.View style={[styles.skeletonIcon, { opacity: pulse }]} />
        <Animated.View style={[styles.skeletonTopLine, { opacity: pulse }]} />
        <Animated.View style={[styles.skeletonIcon, { opacity: pulse }]} />
      </View>
      <Animated.View style={[styles.skeletonHero, { opacity: pulse }]} />
      <View style={styles.stickyControlsSkeleton}>
        <Animated.View style={[styles.skeletonSearch, { opacity: pulse }]} />
        <View style={styles.skeletonTabs}>
          {[0, 1, 2, 3].map((item) => <Animated.View key={item} style={[styles.skeletonPill, { opacity: pulse }]} />)}
        </View>
      </View>
      <View style={styles.skeletonList}>
        {[0, 1, 2, 3].map((item) => (
          <Animated.View key={item} style={[styles.skeletonCard, { opacity: pulse }]}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonBody}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLine} />
              <View style={styles.skeletonLineSmall} />
            </View>
          </Animated.View>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function MenuScreen() {
  const router = useRouter();
  const { restaurantId, highlightedItemId } = useLocalSearchParams();
  const { user } = useAuth();
  const activeRestaurantId = String(Array.isArray(restaurantId) ? restaurantId[0] : restaurantId || "");

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["Popular"]);
  const [selectedCategory, setSelectedCategory] = useState("Popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [optionQuantity, setOptionQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<(typeof SIZE_OPTIONS)[number]["id"]>("regular");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const highlightedItem = (highlightedItemId as string) || null;
  const scrollY = useRef(new Animated.Value(0)).current;
  const cartPulse = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList<MenuGroup>>(null);
  const loadRequestRef = useRef(0);

  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [successItemId, setSuccessItemId] = useState<string | null>(null);
  const cartSuccessScale = useRef(new Animated.Value(0)).current;

  const showAddSuccess = useCallback((itemId: string) => {
    setSuccessItemId(itemId);
    cartSuccessScale.setValue(0);

    Animated.sequence([
      Animated.spring(cartSuccessScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(cartSuccessScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSuccessItemId(null));
  }, [cartSuccessScale]);


  // Replace the existing placeholder state & effect with this:

  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
  const phraseAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const phraseOpacity = useRef(new Animated.Value(1)).current;

  const searchPlaceholders = [
    "Search for cheesy pizza...",
    "Find burgers, fries & more...",
    "Discover fresh juices & smoothies...",
    "Look for cakes, ice cream & sweets...",
    "Search the entire menu",
  ];

  // Directions: each element maps to [fromX, fromY, toX, toY]
  const directions = [
    { from: { x: 0, y: 30 }, to: { x: 0, y: 0 } },    // from bottom
    { from: { x: 0, y: -30 }, to: { x: 0, y: 0 } },   // from top
    { from: { x: -40, y: 0 }, to: { x: 0, y: 0 } },   // from left
    { from: { x: 40, y: 0 }, to: { x: 0, y: 0 } },    // from right
  ];



  useEffect(() => {
    let isMounted = true;
    const cyclePhrase = () => {
      if (!isMounted) return;

      // Choose direction based on phrase index
      const dir = directions[currentPhraseIndex % directions.length];

      // 1. Move out and fade
      Animated.parallel([
        Animated.timing(phraseAnim, {
          toValue: { x: -dir.from.x, y: -dir.from.y },  // opposite of from
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(phraseOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isMounted) return;

        // 2. Change phrase
        setCurrentPhraseIndex((prev) => (prev + 1) % searchPlaceholders.length);

        // 3. Set start position (no animation)
        phraseAnim.setValue({ x: dir.from.x, y: dir.from.y });

        // 4. Slide in and fade in
        Animated.parallel([
          Animated.spring(phraseAnim, {
            toValue: { x: dir.to.x, y: dir.to.y },
            friction: 8,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.timing(phraseOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMounted) return;
          setTimeout(cyclePhrase, 2500);
        });
      });
    };

    // Start the first cycle after initial mount
    const timer = setTimeout(cyclePhrase, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPhraseIndex]); // only re‑triggered when phrase changes


  const fetchCart = useCallback(async () => {
    if (!user?.id) {
      return { cartData: null, cartItemsData: [] as any[] };
    }

    try {
      const { data: cartData } = await db
        .from("carts")
        .select(
          `
          *,
          cart_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            total_price
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      return {
        cartData: cartData || null,
        cartItemsData: cartData?.cart_items || [],
      };
    } catch (error) {
      console.error("Error fetching cart:", error);
      return { cartData: null, cartItemsData: [] as any[] };
    }
  }, [user?.id]);

  const clearRestaurantState = useCallback(() => {
    setRestaurant(null);
    setMenuItems([]);
    setCategories(["Popular"]);
    setSelectedCategory("Popular");
    setSearchQuery("");
    setCart(null);
    setCartItems([]);
    setAddingToCart(null);
    setOptionItem(null);
    setOptionQuantity(1);
    setSelectedSize("regular");
    setSelectedAddOns([]);
    setSpecialInstructions("");
  }, []);

  const fetchRestaurantData = useCallback(async (showSkeleton = false) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    if (showSkeleton) {
      setLoading(true);
      setRefreshing(false);
      clearRestaurantState();
    }

    if (!activeRestaurantId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [{ data: restaurantData, error: restaurantError }, { data: menuData, error: menuError }] = await Promise.all([
        db.from("restaurants").select("*").eq("id", activeRestaurantId).maybeSingle(),
        db
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", activeRestaurantId)
          .eq("is_available", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (restaurantError) throw restaurantError;
      if (menuError) throw menuError;

      const processedItems: MenuItem[] = ((menuData || []) as any[]).map((item: any) => {
        const priceUgx = toUGX(item.price || 0);
        return {
          id: item.id,
          name: item.name || "Menu item",
          description: item.description || "Freshly prepared with quality ingredients.",
          image_url: item.image_url || null,
          priceUgx,
          formattedPrice: formatUGX(priceUgx),
          displayCategory: item.category || "Main Course",
          dietaryTags: normalizeDietaryTags(item),
          rating: normalizeRating(item.rating || item.average_rating),
          reviewCount: Number(item.review_count || item.reviews_count || item.orders_count || 24),
          calories: item.calories,
          preparation_time: item.preparation_time,
          popularity: item.popularity || (Number(item.orders_count || 0) > 20 ? "bestseller" : null),
          spice_level: item.spice_level,
        };
      });

      const uniqueCategories = Array.from(new Set(processedItems.map((item) => item.displayCategory))).sort();
      const { cartData, cartItemsData } = await fetchCart();

      if (requestId !== loadRequestRef.current) return;

      setRestaurant(restaurantData);
      setMenuItems(processedItems);
      setCategories(["Popular", ...uniqueCategories]);
      setCart(cartData);
      setCartItems(cartItemsData);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error("Error fetching menu:", error);
        Alert.alert("Menu unavailable", "We could not load this menu. Pull down to try again.");
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeRestaurantId, clearRestaurantState, fetchCart]);

  useEffect(() => {
    fetchRestaurantData(true);
    return () => {
      loadRequestRef.current += 1;
    };
  }, [fetchRestaurantData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRestaurantData(false);
  }, [fetchRestaurantData]);

  const filteredMenuItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === "Popular" || item.displayCategory === selectedCategory;
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.displayCategory.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const groupedItems = useMemo<MenuGroup[]>(() => {
    const source = selectedCategory === "Popular"
      ? [...filteredMenuItems].sort((a, b) => b.rating - a.rating)
      : filteredMenuItems;

    const groups = new Map<string, MenuItem[]>();
    source.forEach((item) => {
      const title = selectedCategory === "Popular" ? item.displayCategory : selectedCategory;
      groups.set(title, [...(groups.get(title) || []), item]);
    });

    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredMenuItems, selectedCategory]);

  useEffect(() => {
    if (highlightedItem && groupedItems.length) {
      const groupIndex = groupedItems.findIndex((group) => group.data.some((item) => item.id === highlightedItem));
      if (groupIndex >= 0) {
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: groupIndex, animated: true, viewPosition: 0.25 }), 450);
      }
    }
  }, [groupedItems, highlightedItem]);

  const getItemQuantity = useCallback((itemId: string) => {
    const cartItem = cartItems.find((item) => item.menu_item_id === itemId);
    return Number(cartItem?.quantity || 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  }, [cartItems]);

  const cartItemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [cartItems]);

  const triggerCartPulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(cartPulse, { toValue: 1.04, duration: 120, useNativeDriver: true }),
      Animated.timing(cartPulse, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [cartPulse]);

  const updateQuantity = useCallback(async (itemId: string, newQuantity: number) => {
    if (!cart?.id) return;
    const cartItem = cartItems.find((item) => item.menu_item_id === itemId);
    if (!cartItem) return;

    try {
      if (newQuantity < 1) {
        await db.from("cart_items").delete().eq("id", cartItem.id);
        setCartItems((items) => items.filter((item) => item.id !== cartItem.id));
        return;
      }

      const { error } = await db
        .from("cart_items")
        .update({
          quantity: newQuantity,
          total_price: Number(cartItem.unit_price || 0) * newQuantity,
        })
        .eq("id", cartItem.id);
      if (error) throw error;

      setCartItems((items) =>
        items.map((item) =>
          item.id === cartItem.id
            ? { ...item, quantity: newQuantity, total_price: Number(item.unit_price || 0) * newQuantity }
            : item,
        ),
      );
      triggerCartPulse();
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Cart unavailable", "We could not update this item.");
    }
  }, [cart?.id, cartItems, triggerCartPulse]);

  const addItemToCart = useCallback(async (
    item: MenuItem,
    options: { quantity?: number; unitPrice?: number; replaceRestaurant?: boolean } = {},
  ) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to add items to cart.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/(auth)/signin" as any) },
      ]);
      return;
    }

    const quantityToAdd = options.quantity || 1;
    const unitPrice = options.unitPrice || item.priceUgx;

    try {
      setAddingToCart(item.id);
      let currentCart = cart;
      let currentItems = cartItems;

      if (currentCart && currentCart.restaurant_id !== activeRestaurantId && !options.replaceRestaurant) {
        Alert.alert("Start a new cart?", "Your cart has items from another restaurant.", [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: () => addItemToCart(item, { ...options, replaceRestaurant: true }) },
        ]);
        return;
      }

      if (currentCart && currentCart.restaurant_id !== activeRestaurantId && options.replaceRestaurant) {
        await db.from("cart_items").delete().eq("cart_id", currentCart.id);
        const { data: updatedCart, error: updateError } = await db
          .from("carts")
          .update({ restaurant_id: activeRestaurantId })
          .eq("id", currentCart.id)
          .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
          .maybeSingle();
        if (updateError) throw updateError;
        currentCart = updatedCart;
        currentItems = [];
        setCart(updatedCart);
        setCartItems([]);
      }

      if (!currentCart) {
        const { data: newCart, error: createError } = await db
          .from("carts")
          .insert({ user_id: user.id, restaurant_id: activeRestaurantId, status: "active" })
          .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
          .maybeSingle();
        if (createError) throw createError;
        currentCart = newCart;
        currentItems = [];
        setCart(newCart);
      }

      const existingItem = currentItems.find((cartItem: any) => cartItem.menu_item_id === item.id);
      if (existingItem) {
        const nextQuantity = Number(existingItem.quantity || 0) + quantityToAdd;
        const { error } = await db
          .from("cart_items")
          .update({ quantity: nextQuantity, unit_price: unitPrice, total_price: unitPrice * nextQuantity })
          .eq("id", existingItem.id);
        if (error) throw error;
        setCartItems((items) =>
          items.map((cartItem) =>
            cartItem.id === existingItem.id
              ? { ...cartItem, quantity: nextQuantity, unit_price: unitPrice, total_price: unitPrice * nextQuantity }
              : cartItem,
          ),
        );
      } else {
        const { data: newItem, error } = await db
          .from("cart_items")
          .insert({
            cart_id: currentCart.id,
            menu_item_id: item.id,
            quantity: quantityToAdd,
            unit_price: unitPrice,
            total_price: unitPrice * quantityToAdd,
          })
          .select()
          .maybeSingle();
        if (error) throw error;
        setCartItems((items) => [...items, newItem]);
      }

      triggerCartPulse();
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Cart unavailable", "We could not add this item. Please try again.");
    } finally {
      setAddingToCart(null);
    }
  }, [activeRestaurantId, cart, cartItems, router, triggerCartPulse, user?.id]);

  const openOptions = useCallback((item: MenuItem) => {
    setOptionItem(item);
    setOptionQuantity(Math.max(1, getItemQuantity(item.id) || 1));
    setSelectedSize("regular");
    setSelectedAddOns([]);
    setSpecialInstructions("");
  }, [getItemQuantity]);

  const selectedSizeOption = SIZE_OPTIONS.find((option) => option.id === selectedSize) || SIZE_OPTIONS[0];
  const addOnTotal = selectedAddOns.reduce((sum, id) => {
    const addOn = ADD_ONS.find((option) => option.id === id);
    return sum + (addOn?.price || 0);
  }, 0);
  const optionUnitPrice = (optionItem?.priceUgx || 0) + selectedSizeOption.delta + addOnTotal;
  const optionTotal = optionUnitPrice * optionQuantity;

  const confirmOptions = useCallback(async () => {
    if (!optionItem) return;
    await addItemToCart(optionItem, { quantity: optionQuantity, unitPrice: optionUnitPrice });
    setShowCartSuccess(true);
    setTimeout(() => setShowCartSuccess(false), 2000);
    setOptionItem(null);
  }, [addItemToCart, optionItem, optionQuantity, optionUnitPrice]);

  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [20, 120],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -18],
    extrapolate: "clamp",
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [1, 0.35],
    extrapolate: "clamp",
  });

  const rating = normalizeRating(restaurant?.restaurant_rating);
  const deliveryFee = calculatedDeliveryFee !== null ? calculatedDeliveryFee : toUGX(DELIVERY_MIN_FEE_UGX);

  // Calculate delivery fee when restaurant or user location changes
  useEffect(() => {
    if (!restaurant?.latitude || !restaurant?.longitude) return;

    const calculateFee = async () => {
      try {
        let currentUserLocation: { latitude: number; longitude: number } | null = null;
        if (!userLocation) {
          try {
            const locationResult = await getSafeCurrentLocation();
            if (locationResult.point) {
              currentUserLocation = {
                latitude: locationResult.point.latitude,
                longitude: locationResult.point.longitude,
              };
              setUserLocation(currentUserLocation);
            }
          } catch (error) {
            logger.debug("Could not get user location for delivery fee calculation:", error);
          }
        } else {
          currentUserLocation = userLocation;
        }

        const { deliveryFee: calculatedFee } = calculateDeliveryFromUserLocation({
          restaurantLocation: {
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
          },
          userLocation: currentUserLocation,
        });
        setCalculatedDeliveryFee(calculatedFee);
      } catch (error) {
        logger.debug("Error calculating delivery fee:", error);
        setCalculatedDeliveryFee(toUGX(DELIVERY_MIN_FEE_UGX));
      }
    };

    calculateFee();
  }, [restaurant?.latitude, restaurant?.longitude, userLocation]);
  const renderCategoryTab = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.categoryTab, selectedCategory === item && styles.categoryTabActive]}
      onPress={() => {
        setSelectedCategory(item);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }}
      activeOpacity={0.85}
    >
      <Text style={[styles.categoryTabText, selectedCategory === item && styles.categoryTabTextActive]} numberOfLines={1}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderMenuItem = ({ item, index }: { item: MenuItem; index: number }) => {
    const quantity = getItemQuantity(item.id);
    const isAdding = addingToCart === item.id;
    const isHighlighted = highlightedItem === item.id;

    return (
      <Animated.View style={[styles.menuItem, isHighlighted && styles.highlightedItem, { opacity: 1 }]}>
        <TouchableOpacity style={styles.menuItemMain} onPress={() => openOptions(item)} activeOpacity={0.88}>
          <Image source={{ uri: item.image_url || FALLBACK_MENU_IMAGE }} style={styles.menuItemImage} />
          <View style={styles.menuItemDetails}>
            <View style={styles.menuTitleRow}>
              <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
              {index < 2 || item.popularity ? (
                <View style={styles.bestBadge}>
                  <Ionicons name="star" size={10} color="#92400E" />
                  <Text style={styles.bestBadgeText}>Best</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.menuItemDescription} numberOfLines={1}>{item.description}</Text>
            <View style={styles.dietaryTags}>
              {item.dietaryTags.slice(0, 4).map((tag) => {
                const config = dietaryConfig(tag);
                return (
                  <View key={tag} style={[styles.dietaryTag, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon as any} size={10} color={config.color} />
                    <Text style={[styles.dietaryTagText, { color: config.color }]}>{config.label}</Text>
                  </View>
                );
              })}
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.menuItemFooter}>
              <View>
                <Text style={styles.menuItemPrice}>{item.formattedPrice}</Text>
                <TouchableOpacity style={styles.notesButton} onPress={() => openOptions(item)} activeOpacity={0.85}>
                  <Ionicons name="create-outline" size={12} color="#6B7280" />
                  <Text style={styles.notesButtonText}>Add notes</Text>
                </TouchableOpacity>
              </View>
              {quantity > 0 ? (
                <View style={styles.quantityControls}>
                  <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, quantity - 1)}>
                    <Ionicons name="remove" size={14} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, quantity + 1)}>
                    <Ionicons name="add" size={14} color="#111827" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addButton, successItemId === item.id && styles.addButtonSuccess]}
                  onPress={() => openOptions(item)}
                  disabled={isAdding || successItemId === item.id}
                  activeOpacity={0.85}
                >
                  {successItemId === item.id ? (
                    <LottieView
                      source={animations.cartsuccessanimation} // ← use your check animation
                      autoPlay
                      loop={false}
                      style={styles.addSuccessLottie}
                    />
                  ) : (
                    <Ionicons name={isAdding ? "hourglass-outline" : "add"} size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) return <MenuSkeleton />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <Animated.View style={[styles.compactTitleWrap, { opacity: compactHeaderOpacity }]}>
          <Text style={styles.compactTitle} numberOfLines={1}>{restaurant?.restaurant_name || "Menu"}</Text>
          <Text style={styles.compactSubtitle}>{rating.toFixed(1)} • {deliveryTime(0, rating)}</Text>
        </Animated.View>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/(tabs)/cart" as any)}>
          <Ionicons name="cart-outline" size={21} color="#111827" />
          {cartItemCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount > 9 ? "9+" : cartItemCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.stickyControls}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />

            {/* Wrap TextInput and the animated label in a relative container */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              // no placeholder prop – we handle it ourselves
              />

              {/* Animated placeholder label – only visible when searchQuery is empty */}
              {!searchQuery && (
                <Animated.Text
                  style={[
                    styles.placeholderLabel,
                    {
                      opacity: phraseOpacity,
                      transform: [
                        { translateX: phraseAnim.x },
                        { translateY: phraseAnim.y },
                      ],
                    },
                  ]}
                  pointerEvents="none"
                  numberOfLines={1}
                >
                  {searchPlaceholders[currentPhraseIndex]}
                </Animated.Text>
              )}
            </View>

            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={styles.categoryTabs}>
          <FlatList
            data={categories}
            renderItem={renderCategoryTab}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContainer}
          />
        </View>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={groupedItems}
        keyExtractor={(item) => item.title}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
        contentContainerStyle={[styles.menuList, cartItemCount > 0 && styles.menuListWithCart]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <Animated.View style={[styles.restaurantHeader, { opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}>
            <Image source={{ uri: restaurant?.image_url || FALLBACK_RESTAURANT_IMAGE }} style={styles.restaurantCover} />
            <View style={styles.restaurantShade} />
            <View style={styles.restaurantCopy}>
              <Text style={styles.restaurantName}>{restaurant?.restaurant_name || "Restaurant"}</Text>
              <Text style={styles.restaurantCuisine}>{restaurant?.cuisine_type || "Fresh food"}</Text>
              <View style={styles.restaurantMetaRow}>
                <View style={styles.metaPill}>
                  <Ionicons name="star" size={12} color="#111827" />
                  <Text style={styles.metaPillText}>{rating.toFixed(1)}</Text>
                </View>
                <Text style={styles.restaurantMetaText}>{deliveryTime(0, rating)}</Text>
                <Text style={styles.restaurantMetaText}>{formatUGX(deliveryFee)} delivery</Text>
              </View>
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={28} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptyText}>Try another category or search term.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{item.title}</Text>
            {item.data.map((menuItem, index) => (
              <View key={menuItem.id}>{renderMenuItem({ item: menuItem, index })}</View>
            ))}
          </View>
        )}
      />

      {cartItemCount > 0 ? (
        <Animated.View style={[styles.cartBarWrap, { transform: [{ scale: cartPulse }] }]}>
          <TouchableOpacity style={styles.cartBar} onPress={() => router.push("/(tabs)/cart" as any)} activeOpacity={0.9}>
            <View style={styles.cartBarCount}>
              <Text style={styles.cartBarCountText}>{cartItemCount}</Text>
            </View>
            <View style={styles.cartBarCopy}>
              <Text style={styles.cartBarTitle}>{cartItemCount === 1 ? "1 item" : `${cartItemCount} items`}</Text>
              <Text style={styles.cartBarTotal}>{formatUGX(cartTotal)}</Text>
            </View>
            <View style={styles.viewCartButton}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {/* --- MODAL WITH SCROLLABLE CONTENT AND FIXED FOOTER --- */}
      <Modal visible={Boolean(optionItem)} transparent animationType="slide" onRequestClose={() => setOptionItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modifierSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{optionItem?.name}</Text>
                <Text style={styles.sheetSubtitle}>Customize your item</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setOptionItem(null)}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {optionItem ? (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Image
                    source={{ uri: optionItem.image_url || FALLBACK_MENU_IMAGE }}
                    style={styles.sheetImage}
                  />

                  <Text style={styles.optionSectionTitle}>Choose size</Text>
                  {SIZE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={styles.optionRow}
                      onPress={() => setSelectedSize(option.id)}
                      activeOpacity={0.85}
                    >
                      <View>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionPrice}>
                          {option.delta ? `+${formatUGX(option.delta)}` : "Included"}
                        </Text>
                      </View>
                      <Ionicons
                        name={selectedSize === option.id ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={selectedSize === option.id ? ACCENT : "#9CA3AF"}
                      />
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.optionSectionTitle}>Add-ons</Text>
                  {ADD_ONS.map((addOn) => {
                    const active = selectedAddOns.includes(addOn.id);
                    return (
                      <TouchableOpacity
                        key={addOn.id}
                        style={styles.optionRow}
                        onPress={() =>
                          setSelectedAddOns((items) =>
                            active ? items.filter((id) => id !== addOn.id) : [...items, addOn.id]
                          )
                        }
                        activeOpacity={0.85}
                      >
                        <View>
                          <Text style={styles.optionLabel}>{addOn.label}</Text>
                          <Text style={styles.optionPrice}>+{formatUGX(addOn.price)}</Text>
                        </View>
                        <Ionicons
                          name={active ? "checkbox" : "square-outline"}
                          size={20}
                          color={active ? ACCENT : "#9CA3AF"}
                        />
                      </TouchableOpacity>
                    );
                  })}

                  <Text style={styles.optionSectionTitle}>Special instructions</Text>
                  <TextInput
                    value={specialInstructions}
                    onChangeText={setSpecialInstructions}
                    placeholder="No onion, extra spicy, sauce on the side..."
                    placeholderTextColor="#9CA3AF"
                    style={styles.instructionsInput}
                    multiline
                  />
                </ScrollView>

                {/* Fixed footer */}
                <View style={styles.sheetFooter}>
                  <View style={styles.sheetQuantity}>
                    <TouchableOpacity
                      style={styles.sheetQuantityButton}
                      onPress={() => setOptionQuantity((v) => Math.max(1, v - 1))}
                    >
                      <Ionicons name="remove" size={15} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.sheetQuantityText}>{optionQuantity}</Text>
                    <TouchableOpacity
                      style={styles.sheetQuantityButton}
                      onPress={() => setOptionQuantity((v) => v + 1)}
                    >
                      <Ionicons name="add" size={15} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.sheetAddButton} onPress={confirmOptions} activeOpacity={0.9}>
                    <Text style={styles.sheetAddText}>Add • {formatUGX(optionTotal)}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {showCartSuccess && (
          <Animated.View
            style={[styles.modalSuccessOverlay, {
              opacity: cartSuccessScale,
              transform: [{ scale: cartSuccessScale }]
            }]}
            pointerEvents="none"
          >
            <View style={styles.modalSuccessBox}>
              <LottieView
                source={animations.cartsuccessanimation}
                autoPlay
                loop={false}
                style={styles.modalSuccessLottie}
              />
              <Text style={styles.modalSuccessText}>Added to cart!</Text>
            </View>
          </Animated.View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    height: 58,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitleWrap: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 12 },
  compactTitle: { fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  compactSubtitle: { marginTop: 1, fontSize: 11, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: ACCENT,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { fontSize: 9, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },
  stickyControls: {
    gap: 10,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    zIndex: 5,
  },
  searchContainer: { paddingHorizontal: 15 },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  placeholderLabel: {
    position: 'absolute',
    left: 2,                // fine-tune to align with the cursor
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#6B7280',
  },
  searchBar: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter", fontWeight: "400", color: "#111827", paddingVertical: 0 },
  categoryTabs: { paddingLeft: 0, paddingVertical: 4 },
  categoryTabsContainer: { gap: 8, paddingRight: 16, paddingLeft: 16, alignItems: "center", },
  categoryTab: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  categoryTabText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  categoryTabTextActive: { color: "#FFFFFF" },
  menuList: { paddingHorizontal: 15, paddingBottom: 28 },
  menuListWithCart: { paddingBottom: 118 },
  restaurantHeader: {
    height: 218,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 14,
    marginBottom: 18,
    backgroundColor: "#111827",
  },
  restaurantCover: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  restaurantShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.36)" },
  restaurantCopy: { position: "absolute", left: 16, right: 16, bottom: 16 },
  restaurantName: { fontSize: 22, lineHeight: 28, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },
  restaurantCuisine: { marginTop: 3, fontSize: 13, fontFamily: "Inter", fontWeight: "400", color: "#F9FAFB" },
  restaurantMetaRow: { marginTop: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  metaPill: { height: 24, borderRadius: 12, paddingHorizontal: 8, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 4 },
  metaPillText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  restaurantMetaText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#FFFFFF" },
  categorySection: { gap: 10, marginBottom: 14 },
  categoryTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  menuItem: {
    minHeight: 128,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.7,
    borderColor: "#e5e7eb96",
    padding: 9,
  },
  highlightedItem: { borderColor: ACCENT, backgroundColor: "#FFF7ED" },
  menuItemMain: { flexDirection: "row", gap: 12 },
  menuItemImage: { width: 108, height: 108, borderRadius: 8, backgroundColor: "#E5E7EB" },
  menuItemDetails: { flex: 1, minWidth: 0, gap: 5 },
  menuTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuItemName: { flex: 1, fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  bestBadge: { height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 3 },
  bestBadgeText: { fontSize: 10, fontFamily: "Inter", fontWeight: "500", color: "#92400E" },
  menuItemDescription: { fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  dietaryTags: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  dietaryTag: { height: 22, borderRadius: 11, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 3 },
  dietaryTagText: { fontSize: 10, fontFamily: "Inter", fontWeight: "500" },
  ratingPill: { height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 10, fontFamily: "Inter", fontWeight: "500", color: "#92400E" },
  menuItemFooter: { marginTop: 2, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  menuItemPrice: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827", fontVariant: ["tabular-nums"] },
  notesButton: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  notesButtonText: { fontSize: 11, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  addButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  quantityControls: {
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  quantityButton: { width: 32, height: 34, alignItems: "center", justifyContent: "center" },
  quantityText: { minWidth: 24, textAlign: "center", fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  emptyState: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  emptyText: { fontSize: 12, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  cartBarWrap: { position: "absolute", left: 16, right: 16, bottom: 28 },
  cartBar: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  cartBarCount: { width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  cartBarCountText: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },
  cartBarCopy: { flex: 1 },
  cartBarTitle: { fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#FFFFFF" },
  cartBarTotal: { marginTop: 2, fontSize: 12, fontFamily: "Inter", fontWeight: "400", color: "#D1D5DB" },
  viewCartButton: { height: 36, borderRadius: 18, paddingHorizontal: 12, backgroundColor: ACCENT, flexDirection: "row", alignItems: "center", gap: 4 },
  viewCartText: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },

  // --- MODAL STYLES (updated) ---
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.36)", justifyContent: "flex-end" },
  modifierSheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitleWrap: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  sheetSubtitle: { marginTop: 2, fontSize: 12, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  sheetImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    marginBottom: 4,
  },
  optionSectionTitle: { marginTop: 2, fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  optionRow: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionLabel: { fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  optionPrice: { marginTop: 2, fontSize: 11, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  instructionsInput: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    textAlignVertical: "top",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter",
    fontWeight: "400",
    color: "#111827",
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  sheetQuantity: { height: 44, borderRadius: 22, backgroundColor: "#F3F4F6", flexDirection: "row", alignItems: "center" },
  sheetQuantityButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  sheetQuantityText: { minWidth: 26, textAlign: "center", fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  sheetAddButton: { flex: 1, height: 46, borderRadius: 23, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  sheetAddText: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },

  // --- SKELETON STYLES ---
  skeletonIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5E7EB" },
  skeletonTopLine: { width: 128, height: 16, borderRadius: 8, backgroundColor: "#E5E7EB" },
  skeletonHero: { height: 190, margin: 16, borderRadius: 8, backgroundColor: "#E5E7EB" },
  stickyControlsSkeleton: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    zIndex: 5,
  },
  skeletonSearch: { height: 44, borderRadius: 8, backgroundColor: "#E5E7EB", },
  skeletonTabs: { flexDirection: "row", gap: 8 },
  skeletonPill: { width: 86, height: 34, borderRadius: 17, backgroundColor: "#E5E7EB" },
  skeletonList: { padding: 16, gap: 12 },
  skeletonCard: { height: 128, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", padding: 10, flexDirection: "row", gap: 12, backgroundColor: "#FFFFFF" },
  skeletonImage: { width: 108, borderRadius: 8, backgroundColor: "#E5E7EB" },
  skeletonBody: { flex: 1, justifyContent: "center", gap: 10 },
  skeletonLineWide: { width: "72%", height: 14, borderRadius: 7, backgroundColor: "#E5E7EB" },
  skeletonLine: { width: "92%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },
  skeletonLineSmall: { width: "44%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },

  addButtonSuccess: {
    backgroundColor: "#10B981",
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  addSuccessLottie: {
    width: 38,
    height: 38,
  },
  modalSuccessOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modalSuccessBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalSuccessLottie: {
    width: 80,
    height: 80,
  },
  modalSuccessText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter",
    color: "#10B981",
  },

});