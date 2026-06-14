import { logger } from "@/backend/utils/logger";
//app/(tabs)/profiles/restaurant-profile/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { DELIVERY_MIN_FEE_UGX, calculateDeliveryFromUserLocation } from "@/backend/utils/deliveryPricing";
import { getSafeCurrentLocation } from "@/backend/utils/location";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=820&fit=crop";
const FALLBACK_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&h=520&fit=crop";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  priceUgx: number;
  formattedPrice: string;
  dietaryTags: string[];
  preparationTime: number;
  rating: number;
};

function normalizeDietaryTags(item: any) {
  const rawTags = Array.isArray(item.dietary_tags)
    ? item.dietary_tags
    : typeof item.dietary_tags === "string"
      ? item.dietary_tags.split(",")
      : [];
  const tags = rawTags.map((tag: unknown) => String(tag).trim()).filter(Boolean);
  if (item.is_vegetarian || item.is_veg) tags.push("veg");
  if (item.is_gluten_free) tags.push("gluten-free");
  if (Number(item.spice_level || 0) > 0) tags.push("spicy");
  const seen = new Set<string>();
  return tags.filter((tag: string) => {
    const key = tag.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DietaryIcon({ tag }: { tag: string }) {
  const key = tag.toLowerCase().replace(/\s+/g, "-");
  const config =
    key.includes("veg") ? { icon: "leaf", color: "#047857", bg: "#ECFDF5" } :
      key.includes("spicy") ? { icon: "flame", color: "#C2410C", bg: "#FFF7ED" } :
        key.includes("gluten") ? { icon: "shield-checkmark", color: "#4338CA", bg: "#EEF2FF" } :
          { icon: "nutrition", color: "#4B5563", bg: "#F3F4F6" };
  return (
    <View style={[styles.dietaryIcon, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
    </View>
  );
}

function ProfileSkeleton() {
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
      <Animated.View style={[styles.skeletonHero, { opacity: pulse }]} />
      <View style={styles.content}>
        <Animated.View style={[styles.skeletonLineHero, { opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { opacity: pulse }]} />
        <View style={styles.skeletonTabs}>
          {[0, 1, 2, 3].map((item) => <Animated.View key={item} style={[styles.skeletonPill, { opacity: pulse }]} />)}
        </View>
        {[0, 1, 2, 3].map((item) => (
          <Animated.View key={item} style={[styles.skeletonMenuCard, { opacity: pulse }]}>
            <View style={styles.skeletonFoodImage} />
            <View style={styles.skeletonFoodBody}>
              <View style={styles.skeletonLineLarge} />
              <View style={styles.skeletonLine} />
              <View style={styles.skeletonLineSmall} />
            </View>
          </Animated.View>
        ))}
      </View>
    </SafeAreaView>
  );
}

import LottieView from "lottie-react-native";
import animations from "@/constent/animations";

function MenuItemCard({
  item,
  onAdd,
  adding,
  success,
}: {
  item: MenuItem;
  onAdd: () => void;
  adding: boolean;
  success: boolean;
}) {
  return (
    <View style={styles.menuItemCard}>
      <Image source={{ uri: item.image }} style={styles.menuItemImage} />
      <View style={styles.menuItemBody}>
        <View style={styles.menuItemTitleRow}>
          <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            style={[
              styles.addButton,
              success && styles.addButtonSuccess,
            ]}
            onPress={onAdd}
            disabled={adding || success}
            activeOpacity={0.85}
          >
            {success ? (
              <LottieView
                source={animations.cartsuccessanimation} // replace with your animation path
                autoPlay
                loop={false}
                style={styles.successLottie}
              />
            ) : (
              <Ionicons
                name={adding ? "hourglass-outline" : "add"}
                size={18}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.menuItemDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.dietaryRow}>
          {item.dietaryTags.slice(0, 3).map((tag) => <DietaryIcon key={tag} tag={tag} />)}
          <View style={styles.ratingMini}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingMiniText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.menuItemPrice}>{item.formattedPrice}</Text>
      </View>
    </View>
  );
}

export default function RestaurantProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurantId = Array.isArray(id) ? id[0] : id;

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Popular");
  const [menuQuery, setMenuQuery] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [cart, setCart] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userDeliveryPoint, setUserDeliveryPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const loadRequestRef = useRef(0);

  // Added States
  const [successItemId, setSuccessItemId] = useState<string | null>(null);
  const [showVegOnly, setShowVegOnly] = useState(false);

  // Animated placeholder
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const phraseAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const phraseOpacity = useRef(new Animated.Value(1)).current;
  const searchPlaceholders = [
    "Search for pizza...",
    "Find burgers & fries...",
    "Discover drinks & smoothies...",
    "Look for desserts & sweets...",
    "Search the menu",
  ];
  const directions = [
    { from: { x: 0, y: 30 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: -30 }, to: { x: 0, y: 0 } },
    { from: { x: -40, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 40, y: 0 }, to: { x: 0, y: 0 } },
  ];

  useEffect(() => {
    let isMounted = true;
    const cyclePhrase = () => {
      if (!isMounted) return;
      const dir = directions[currentPhraseIndex % directions.length];
      Animated.parallel([
        Animated.timing(phraseAnim, {
          toValue: { x: -dir.from.x, y: -dir.from.y },
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
        setCurrentPhraseIndex((prev) => (prev + 1) % searchPlaceholders.length);
        phraseAnim.setValue({ x: dir.from.x, y: dir.from.y });
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
    const timer = setTimeout(cyclePhrase, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPhraseIndex]);

  const clearRestaurantState = useCallback(() => {
    setRestaurant(null);
    setMenuItems([]);
    setSelectedCategory("Popular");
    setMenuQuery("");
    setFavorite(false);
    setCart(null);
    setCartItems([]);
    setAddingItemId(null);
  }, []);

  const loadRestaurant = useCallback(async (showSkeleton = false) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    if (showSkeleton) {
      setLoading(true);
      setRefreshing(false);
      clearRestaurantState();
    }
    if (!restaurantId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const requests: PromiseLike<any>[] = [
        db.from("restaurants").select("*").eq("id", restaurantId).maybeSingle(),
        db
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("is_available", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true })
          .limit(80),
      ];
      if (user?.id) {
        requests.push(db.from("favorites").select("id,restaurant_id").eq("user_id", user.id).eq("restaurant_id", restaurantId).maybeSingle());
        requests.push(db.from("carts").select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)").eq("user_id", user.id).eq("status", "active").limit(1));
      }
      const [restaurantResult, menuResult, favoriteResult, cartResult] = await Promise.all(requests);
      if (restaurantResult.error) throw restaurantResult.error;
      if (menuResult.error) throw menuResult.error;
      const mappedItems: MenuItem[] = ((menuResult.data || []) as any[]).map((item, index) => {
        const priceUgx = toUGX(item.price || 0);
        return {
          id: item.id,
          name: item.name || "Menu item",
          description: item.description || "Freshly prepared and ready to order.",
          category: item.category || "Popular",
          image: item.image_url || FALLBACK_FOOD_IMAGE,
          priceUgx,
          formattedPrice: formatUGX(priceUgx),
          dietaryTags: normalizeDietaryTags(item),
          preparationTime: Number(item.preparation_time || 18 + (index % 4) * 3),
          rating: normalizeRating(item.rating || item.average_rating),
        };
      });
      if (requestId !== loadRequestRef.current) return;
      setRestaurant(restaurantResult.data);
      setMenuItems(mappedItems);
      setFavorite(Boolean(favoriteResult?.data));
      setCart(cartResult?.data?.[0] || null);
      setCartItems(cartResult?.data?.[0]?.cart_items || []);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        console.error("Restaurant profile load failed:", error);
        Alert.alert("Restaurant unavailable", "We could not load this restaurant. Pull down to try again.");
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearRestaurantState, restaurantId, user?.id]);

  useEffect(() => {
    loadRestaurant(true);
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadRestaurant]);

  useEffect(() => {
    let alive = true;
    getSafeCurrentLocation()
      .then((result) => {
        if (alive && result.point) setUserDeliveryPoint(result.point);
      })
      .catch((error) => logger.debug("Restaurant profile delivery location unavailable:", error));
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRestaurant(false);
  }, [loadRestaurant]);

  const rating = normalizeRating(restaurant?.restaurant_rating);
  const deliveryQuote = calculateDeliveryFromUserLocation({
    restaurantLocation: {
      latitude: restaurant?.latitude,
      longitude: restaurant?.longitude,
    },
    userLocation: userDeliveryPoint,
  });
  const deliveryFee = deliveryQuote.deliveryFee || DELIVERY_MIN_FEE_UGX;
  const deliveryTime = 22 + (Math.round(rating * 10) % 4) * 4;
  const distance = deliveryQuote.distanceKm ? `${deliveryQuote.distanceKm.toFixed(1)} km` : "Distance pending";
  const isOpen = restaurant?.is_open !== false;

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(menuItems.map((item) => item.category).filter(Boolean))
    ).filter((cat) => cat.toLowerCase() !== "popular");
    return ["Popular", ...uniqueCategories.slice(0, 11)];
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const needle = menuQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === "Popular" || item.category === selectedCategory;
      const matchesSearch =
        !needle ||
        item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle);
      const vegMatch = !showVegOnly || item.dietaryTags.some(tag => tag.toLowerCase().includes("veg"));
      return matchesCategory && matchesSearch && vegMatch;
    });
  }, [menuItems, menuQuery, selectedCategory, showVegOnly]);

  const reviewCount = Math.max(Number(restaurant?.total_orders || 0), 24);
  const ratingBreakdown = [0.88, 0.68, 0.38, 0.16, 0.08];

  const totalCartPrice = cartItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  const toggleFavorite = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to save restaurants.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/(auth)/signin" as any) },
      ]);
      return;
    }
    const next = !favorite;
    setFavorite(next);
    try {
      if (next) {
        const { error } = await db.from("favorites").insert({ user_id: user.id, restaurant_id: restaurantId });
        if (error) throw error;
      } else {
        const { error } = await db.from("favorites").delete().eq("user_id", user.id).eq("restaurant_id", restaurantId);
        if (error) throw error;
      }
    } catch (error) {
      setFavorite(!next);
      console.error("Favorite update failed:", error);
      Alert.alert("Favorites unavailable", "We could not update this restaurant.");
    }
  }, [favorite, restaurantId, router, user?.id]);

  const shareRestaurant = useCallback(async () => {
    await Share.share({
      message: `${restaurant?.restaurant_name || "Restaurant"} on Mataim - ${restaurant?.cuisine_type || "fresh food"} near you.`,
    });
  }, [restaurant?.cuisine_type, restaurant?.restaurant_name]);

  const addItemToCart = useCallback(async (item: MenuItem, replaceRestaurant = false) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to add items to cart.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/(auth)/signin" as any) },
      ]);
      return;
    }
    try {
      setAddingItemId(item.id);
      let currentCart = cart;
      let currentItems = cartItems;
      if (currentCart && currentCart.restaurant_id !== restaurantId && !replaceRestaurant) {
        Alert.alert("Start a new cart?", "Your cart has items from another restaurant.", [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: () => addItemToCart(item, true) },
        ]);
        return;
      }
      if (currentCart && currentCart.restaurant_id !== restaurantId && replaceRestaurant) {
        await db.from("cart_items").delete().eq("cart_id", currentCart.id);
        const { data: updatedCart, error: updateError } = await db
          .from("carts")
          .update({ restaurant_id: restaurantId })
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
          .insert({ user_id: user.id, restaurant_id: restaurantId, status: "active" })
          .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
          .maybeSingle();
        if (createError) throw createError;
        currentCart = newCart;
        currentItems = [];
        setCart(newCart);
      }
      const existingItem = currentItems.find((cartItem) => cartItem.menu_item_id === item.id);
      if (existingItem) {
        const quantity = Number(existingItem.quantity || 0) + 1;
        const { error } = await db
          .from("cart_items")
          .update({ quantity, total_price: item.priceUgx * quantity })
          .eq("id", existingItem.id);
        if (error) throw error;
        setCartItems((items) => items.map((cartItem) => cartItem.id === existingItem.id ? { ...cartItem, quantity } : cartItem));
      } else {
        const { data: newItem, error } = await db
          .from("cart_items")
          .insert({
            cart_id: currentCart.id,
            menu_item_id: item.id,
            quantity: 1,
            unit_price: item.priceUgx,
            total_price: item.priceUgx,
          })
          .select()
          .maybeSingle();
        if (error) throw error;
        setCartItems((items) => [...items, newItem]);
      }
      setSuccessItemId(item.id);
      setTimeout(() => setSuccessItemId(null), 1500);
    } catch (error) {
      console.error("Restaurant add to cart failed:", error);
      Alert.alert("Cart unavailable", "We could not add this item. Please try again.");
    } finally {
      setAddingItemId(null);
    }
  }, [cart, cartItems, restaurantId, router, user?.id]);

  if (loading) return <ProfileSkeleton />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#111827" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        <View style={styles.hero}>
          <Image source={{ uri: restaurant?.image_url || FALLBACK_RESTAURANT_IMAGE }} style={styles.heroImage} />
          <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroIconButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={21} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroActionGroup}>
              <TouchableOpacity style={styles.heroIconButton} onPress={shareRestaurant}>
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroIconButton} onPress={toggleFavorite}>
                <Ionicons name={favorite ? "heart" : "heart-outline"} size={20} color={favorite ? "#FF6B35" : "#FFFFFF"} />
              </TouchableOpacity>
            </View>
            {/* Status Badge */}
            <View style={[styles.statusBadge, isOpen ? styles.openBadge : styles.closedBadge]}>
              <Text style={styles.statusText}>{isOpen ? "● Open Now" : "Closed"}</Text>
            </View>
          </View>


        </View>

        <View style={styles.profileHeader}>
          <Image source={{ uri: restaurant?.image_url || FALLBACK_RESTAURANT_IMAGE }} style={styles.logo} />
          <View style={styles.profileCopy}>
            <Text style={styles.restaurantName}>{restaurant?.restaurant_name || "Restaurant"}</Text>
            <Text style={styles.restaurantCuisine}>{restaurant?.cuisine_type || "Fresh food"}</Text>
          </View>

        </View>

        <View style={styles.content}>
          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{rating.toFixed(1)}</Text>
              <Text style={styles.metaLabel}>{reviewCount} ratings</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{deliveryTime}-{deliveryTime + 10} min</Text>
              <Text style={styles.metaLabel}>Delivery time</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{formatUGX(deliveryFee)}</Text>
              <Text style={styles.metaLabel}>{distance}</Text>
            </View>
          </View>

          <View style={styles.promoBanner}>
            <Ionicons name="pricetag-outline" size={17} color="#111827" />
            <Text style={styles.promoTitle}>20% off your first order</Text>
            <Text style={styles.promoSubtitle}>Limited-time restaurant offer</Text>
          </View>

          {/* Chef's Special */}
          <View style={styles.specialSection}>
            <Text style={styles.specialTitle}>👨‍🍳 Chef's Special</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contentSpecialSection} >
              {menuItems.slice(0, 4).map((item) => (
                <TouchableOpacity key={item.id} style={styles.specialCard} onPress={() => addItemToCart(item)}>
                  <Image source={{ uri: item.image }} style={styles.specialImage} />
                  <Text style={styles.specialName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.specialPrice}>{item.formattedPrice}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ width: 30 }} />
            </ScrollView>
          </View>

          <View style={styles.menuSearch}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <View style={styles.inputWrapper}>
              <TextInput
                value={menuQuery}
                onChangeText={setMenuQuery}
                style={styles.menuSearchInput}
              />
              {!menuQuery && (
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
            {menuQuery ? (
              <TouchableOpacity onPress={() => setMenuQuery("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Veg Only Filter */}
          <TouchableOpacity style={styles.vegFilter} onPress={() => setShowVegOnly(!showVegOnly)}>
            <Ionicons name={showVegOnly ? "leaf" : "leaf-outline"} size={18} color={showVegOnly ? "#10B981" : "#6B7280"} />
            <Text style={[styles.vegText, showVegOnly && styles.vegTextActive]}>Veg Only</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.categoryTab, selectedCategory === category && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.85}
              >
                <Text style={[styles.categoryTabText, selectedCategory === category && styles.categoryTabTextActive]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedCategory === "Popular" ? "Popular items" : selectedCategory}</Text>
            <Text style={styles.sectionSubtitle}>{filteredMenuItems.length} items</Text>
          </View>

          <View style={styles.menuList}>
            {filteredMenuItems.length ? (
              filteredMenuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  adding={addingItemId === item.id}
                  success={successItemId === item.id}
                  onAdd={() => addItemToCart(item)}
                />
              ))
            ) : (
              <View style={styles.emptyMenu}>
                <Ionicons name="restaurant-outline" size={26} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No matching items</Text>
                <Text style={styles.emptyText}>Try another menu search or category.</Text>
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Restaurant info</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text style={styles.infoText}>{restaurant?.address || "Address not available"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#6B7280" />
              <Text style={styles.infoText}>{restaurant?.opening_hours || "Open today"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#6B7280" />
              <Text style={styles.infoText}>{restaurant?.phone || "Contact through Mataim support"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="restaurant-outline" size={18} color="#6B7280" />
              <Text style={styles.infoText}>{restaurant?.cuisine_type || "Food"}{restaurant?.is_halal ? " | Halal" : ""}</Text>
            </View>
          </View>

          <View style={styles.reviewSection}>
            <View style={styles.reviewSummary}>
              <View>
                <Text style={styles.reviewScore}>{rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>{reviewCount} reviews</Text>
              </View>
              <View style={styles.breakdown}>
                {ratingBreakdown.map((width, index) => (
                  <View key={index} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{5 - index}</Text>
                    <View style={styles.breakdownTrack}>
                      <View style={[styles.breakdownFill, { width: `${width * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.reviewCard}>
              <View style={styles.reviewAvatar}>
                <Text style={styles.reviewAvatarText}>A</Text>
              </View>
              <View style={styles.reviewBody}>
                <Text style={styles.reviewName}>Amina</Text>
                <Text style={styles.reviewText}>Food arrived warm, packed neatly, and tasted fresh. Easy reorder choice.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Cart */}
      {cartItems.length > 0 && (
        <TouchableOpacity style={styles.floatingCart} onPress={() => router.push('/(tabs)/cart' as any)}>
          <View style={styles.cartContent}>
            <View style={styles.cartIconContainer}>
              <Ionicons name="cart" size={22} color="#FFFFFF" />
              <View style={styles.cartBadge}>
                <Text style={styles.cartCount}>{cartItems.length}</Text>
              </View>
            </View>
            <Text style={styles.cartTotal}>{formatUGX(totalCartPrice)}</Text>
          </View>
        </TouchableOpacity>
      )}
      <View style={{ height: 0 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingBottom: -55 },
  hero: { height: 230, backgroundColor: "#111827" },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroActions: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroActionGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(17,24,39,0.55)", alignItems: "center", justifyContent: "center" },
  profileHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  logo: { width: 58, height: 58, borderRadius: 8, backgroundColor: "#E5E7EB" },
  profileCopy: { flex: 1, minWidth: 0 },
  restaurantName: { fontSize: 18, lineHeight: 28, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  restaurantCuisine: { marginTop: 3, fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  content: { padding: 14, paddingBottom: 148, gap: 14 },
  metaCard: {
    minHeight: 55,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb8b",
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
  },
  metaItem: { flex: 1, alignItems: "center", gap: 1 },
  metaValue: { fontSize: 12.6, fontFamily: "Inter", fontWeight: "600", color: "#111827", textAlign: "center" },
  metaLabel: { fontSize: 11.1, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textAlign: "center", letterSpacing: 0.2 },
  metaDivider: { width: 0.8, height: 34, backgroundColor: "#e5e7eba2" },
  promoBanner: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    borderWidth: 0.8,
    borderColor: "#fed7aaa6",
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  promoTitle: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  promoSubtitle: { fontSize: 11.8, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  menuSearch: { height: 48, borderRadius: 8, backgroundColor: "#F3F4F6", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0.4, borderColor: "#0000009e" },
  menuSearchInput: { flex: 1, fontSize: 14.5, fontFamily: "Inter", fontWeight: "500", color: "#111827", paddingVertical: 4 },
  inputWrapper: { flex: 1, justifyContent: 'center' },
  placeholderLabel: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    fontSize: 14.5,
    fontWeight: '400',
    fontFamily: "Inter",
    color: '#9CA3AF',
  },
  categoryTabs: { gap: 8, paddingRight: 16 },
  categoryTab: { height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  categoryTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  categoryTabText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  categoryTabTextActive: { color: "#FFFFFF" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  menuList: { gap: 14.5 },
  menuItemCard: {
    minHeight: 100,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#e5e7eb97",
    padding: 0,
    flexDirection: "row",
    gap: 13,
    maxHeight: 124,
  },
  addButtonSuccess: {
    backgroundColor: "#10B981",
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  successLottie: {
    width: 38,
    height: 38,
  },
  menuItemImage: { width: 115, height: '100%', borderRadius: 8, backgroundColor: "#E5E7EB" },
  menuItemBody: { flex: 1, minWidth: 0, justifyContent: "center", gap: 3, paddingRight: 6, paddingBottom: 6, paddingTop: 4 },
  menuItemTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuItemName: { flex: 1, fontSize: 14.5, fontFamily: "Inter", fontWeight: "700", color: "#111827", maxWidth: '83%', letterSpacing: 0.3 },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginTop: 4, marginRight: 3, position: "absolute", right: 0, top: 0 },
  menuItemDescription: { fontSize: 12.8, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", maxWidth: '85%' },
  dietaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dietaryIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  ratingMini: { height: 22, borderRadius: 11, paddingHorizontal: 8, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 3 },
  ratingMiniText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#92400E" },
  menuItemPrice: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  emptyMenu: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, backgroundColor: "#F9FAFB" },
  emptyTitle: { fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  emptyText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  infoSection: { gap: 10, paddingTop: 6 },
  infoRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: "Inter", fontWeight: "500", color: "#374151" },
  reviewSection: { gap: 12, paddingTop: 4 },
  reviewSummary: { borderRadius: 8, borderWidth: 0.8, borderColor: "#e5e7ebbe", padding: 12, flexDirection: "row", gap: 16, backgroundColor: "#FFFFFF" },
  reviewScore: { fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  reviewCount: { marginTop: 2, fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  breakdown: { flex: 1, gap: 6 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownLabel: { width: 10, fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  breakdownTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" },
  breakdownFill: { height: 6, borderRadius: 3, backgroundColor: "#111827" },
  reviewCard: { borderRadius: 8, borderWidth: 0.8, borderColor: "#e5e7ebbd", padding: 10, backgroundColor: "#FFFFFF", flexDirection: "row", gap: 10 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  reviewBody: { flex: 1, gap: 3 },
  reviewName: { fontSize: 13, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  reviewText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  skeletonHero: { height: 230, backgroundColor: "#E5E7EB" },
  skeletonLineHero: { width: "72%", height: 22, borderRadius: 11, backgroundColor: "#E5E7EB" },
  skeletonLine: { width: "90%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },
  skeletonTabs: { flexDirection: "row", gap: 8 },
  skeletonPill: { width: 84, height: 34, borderRadius: 17, backgroundColor: "#E5E7EB" },
  skeletonMenuCard: { height: 130, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", padding: 10, flexDirection: "row", gap: 12 },
  skeletonFoodImage: { width: 108, borderRadius: 8, backgroundColor: "#E5E7EB" },
  skeletonFoodBody: { flex: 1, justifyContent: "center", gap: 10 },
  skeletonLineLarge: { width: "70%", height: 14, borderRadius: 7, backgroundColor: "#E5E7EB" },
  skeletonLineSmall: { width: "45%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },

  // New Added Styles
  statusBadge: {
    position: 'absolute',
    top: 165,
    right: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  openBadge: { backgroundColor: '#22C55E' },
  closedBadge: { backgroundColor: '#EF4444' },
  statusText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  specialSection: { marginTop: 6 },
  specialTitle: { fontSize: 14.8, fontWeight: '700', marginBottom: 12, color: '#111827', paddingHorizontal: 4, letterSpacing: 0.3 },
  contentSpecialSection: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  specialCard: { width: 130, marginRight: 14, marginTop: 8, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', elevation: 1.4, shadowColor: '#00000044', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  specialImage: { width: '100%', height: 90 },
  specialName: { fontSize: 13.4, fontWeight: '500', paddingHorizontal: 10, paddingTop: 8, letterSpacing: 0.2, color: '#111827' },
  specialPrice: { fontSize: 13.8, fontWeight: '700', color: ACCENT, paddingHorizontal: 10, paddingBottom: 8, marginTop: 2 },

  vegFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  vegText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  vegTextActive: { color: '#10B981' },

  floatingCart: {
    position: 'absolute',
    bottom: 30,
    left: 14,
    right: 14,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cartContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCount: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cartTotal: {
    color: '#FFFFFF',
    fontSize: 15.3,
    fontWeight: '700',
  },
});