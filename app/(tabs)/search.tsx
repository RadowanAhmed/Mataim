import { logger } from "@/backend/utils/logger";
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { DELIVERY_MIN_FEE_UGX, calculateDeliveryFromUserLocation } from "@/backend/utils/deliveryPricing";
import { getSafeCurrentLocation } from "@/backend/utils/location";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { images } from "@/constent/images";

const db = supabase as any;
const ACCENT = "#FF6B35";
const RECENT_KEY = "mataim_recent_searches";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=640&fit=crop";
const FALLBACK_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&h=520&fit=crop";

const POPULAR_SEARCHES = ["Pizza", "Chicken", "Burgers", "Sushi", "Coffee", "Desserts"];
const CATEGORY_ITEMS = [
  { label: "Pizza", source: images.CategoryPizza },
  { label: "Burgers", source: images.CategoryBurger },
  { label: "Sushi", source: images.CategorySushi },
  { label: "Drinks", source: images.CategoryDrink },
  { label: "Desserts", source: images.CategoryDessert },
  { label: "Healthy", source: images.CategorySalad },
] as const;
const FILTERS = ["Nearest", "Top rated", "Low delivery fee", "Fastest"] as const;


const CATEGORY_IMAGE_MAP: Record<string, any> = {
  pizza: images.CategoryPizza,
  burgers: images.CategoryBurger,
  sushi: images.CategorySushi,
  drinks: images.CategoryDrink,
  desserts: images.CategoryDessert,
  healthy: images.CategorySalad,
  appetizers: images.CategoryAppetizers,
  lunch: images.CategoryLunch,
  "main course": images.CategoryMainCourse,
};

function getCategoryImage(label: string) {
  return CATEGORY_IMAGE_MAP[label.toLowerCase()] || images.CategorySalad; // fallback to salad or a generic icon
}


type ResultTab = "Restaurants" | "Foods";
type FilterOption = (typeof FILTERS)[number];

type RestaurantResult = {
  id: string;
  name: string;
  cuisine: string;
  image: string;
  rating: number;
  deliveryTimeMinutes: number;
  deliveryFee: number;
  distanceKm: number | null;
  distance: string;
  latitude?: number | null;
  longitude?: number | null;
  promotion?: string;
};

type FoodResult = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  category: string;
  image: string;
  restaurantName: string;
  restaurantRating: number;
  priceUgx: number;
  deliveryTimeMinutes: number;
  deliveryFee: number;
  distanceKm: number | null;
  dietaryTags: string[];
  latitude?: number | null;
  longitude?: number | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function deliveryMinutes(index: number, rating = 0) {
  return rating >= 4.7 ? 18 + (index % 4) * 3 : 24 + (index % 5) * 3;
}

function promotionFor(index: number, rating: number) {
  if (index % 5 === 0) return "20% off";
  if (rating >= 4.8) return "Top rated";
  if (index % 3 === 0) return "Free item";
  return undefined;
}

function SearchChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.searchChip} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="search-outline" size={14} color="#6B7280" />
      <Text style={styles.searchChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SkeletonList() {
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
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((item) => (
        <Animated.View key={item} style={[styles.skeletonCard, { opacity: pulse }]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonLineLarge} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineSmall} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function ResultReveal({ children, index }: { children: ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay: Math.min(index * 35, 180), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, delay: Math.min(index * 35, 180), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function RestaurantCard({ restaurant, onPress }: { restaurant: RestaurantResult; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.restaurantCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={{ uri: restaurant.image }} style={styles.restaurantImage} />
      {restaurant.promotion ? (
        <View style={styles.promoBadge}>
          <Text style={styles.promoText}>{restaurant.promotion}</Text>
        </View>
      ) : null}
      <View style={styles.restaurantBody}>
        <Text style={styles.resultName} numberOfLines={1}>{restaurant.name}</Text>
        <Text style={styles.resultCuisine} numberOfLines={1}>{restaurant.cuisine}</Text>
        <View style={styles.metaRow}>
          <View style={styles.ratingDot}>
            <Ionicons name="star" size={11} color="#111827" />
            <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.metaText}>{restaurant.deliveryTimeMinutes}-{restaurant.deliveryTimeMinutes + 10} min</Text>
          <Text style={styles.metaText}>{formatUGX(restaurant.deliveryFee)} delivery</Text>
        </View>
        <Text style={styles.distanceText}>{restaurant.distance} away</Text>
      </View>
    </TouchableOpacity>
  );
}

function FoodCard({
  food,
  onPress,
  onAdd,
  adding,
}: {
  food: FoodResult;
  onPress: () => void;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <TouchableOpacity style={styles.foodCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={{ uri: food.image }} style={styles.foodImage} />
      <View style={styles.foodBody}>
        <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
        <Text style={styles.resultCuisine} numberOfLines={1}>{food.restaurantName}</Text>
        <Text style={styles.foodDescription} numberOfLines={2}>{food.description}</Text>
        <View style={styles.foodFooter}>
          <View>
            <Text style={styles.priceText}>{formatUGX(food.priceUgx)}</Text>
            <View style={styles.foodMeta}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={styles.foodMetaText}>{food.restaurantRating.toFixed(1)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={onAdd} disabled={adding} activeOpacity={0.85}>
            <Ionicons name={adding ? "hourglass-outline" : "add"} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { user } = useAuth();
  const [query, setQuery] = useState(String(params.q || ""));
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantResult[]>([]);
  const [foods, setFoods] = useState<FoodResult[]>([]);
  const [selectedTab, setSelectedTab] = useState<ResultTab>("Restaurants");
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("Top rated");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null);


  // Animated placeholder
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const phraseAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const phraseOpacity = useRef(new Animated.Value(1)).current;

  const searchPlaceholders = [
    "Search for pizza...",
    "Find burgers & fries...",
    "Discover fresh juices...",
    "Look for desserts & sweets...",
    "Explore restaurants...",
  ];

  const directions = [
    { from: { x: 0, y: 30 }, to: { x: 0, y: 0 } },   // from bottom
    { from: { x: 0, y: -30 }, to: { x: 0, y: 0 } },   // from top
    { from: { x: -40, y: 0 }, to: { x: 0, y: 0 } },   // from left
    { from: { x: 40, y: 0 }, to: { x: 0, y: 0 } },    // from right
  ];

  useEffect(() => {
    let isMounted = true;

    const cyclePhrase = () => {
      if (!isMounted) return;

      const dir = directions[currentPhraseIndex % directions.length];

      // 1. Move out and fade
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

        // 2. Change phrase
        setCurrentPhraseIndex((prev) => (prev + 1) % searchPlaceholders.length);

        // 3. Set start position
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

    const timer = setTimeout(cyclePhrase, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPhraseIndex]);


  const fetchSearchData = useCallback(async () => {
    try {
      // Get user's current location
      let userLocation: { latitude: number; longitude: number } | null = null;
      try {
        const locationResult = await getSafeCurrentLocation();
        if (locationResult.point) {
          userLocation = {
            latitude: locationResult.point.latitude,
            longitude: locationResult.point.longitude,
          };
        }
      } catch (error) {
        logger.debug("Could not get user location for delivery calculation:", error);
      }

      const [{ data: restaurantData, error: restaurantError }, { data: foodData, error: foodError }] = await Promise.all([
        db
          .from("restaurants")
          .select("id,restaurant_name,cuisine_type,image_url,restaurant_rating,delivery_fee,restaurant_status,total_orders,latitude,longitude")
          .neq("restaurant_status", "inactive")
          .limit(80),
        db
          .from("menu_items")
          .select(
            `
            id,
            restaurant_id,
            name,
            description,
            price,
            category,
            image_url,
            dietary_tags,
            preparation_time,
            is_available,
            restaurants!inner(
              id,
              restaurant_name,
              cuisine_type,
              image_url,
              restaurant_rating,
              delivery_fee,
              restaurant_status,
              latitude,
              longitude
            )
          `,
          )
          .eq("is_available", true)
          .neq("restaurants.restaurant_status", "inactive")
          .limit(100),
      ]);

      if (restaurantError) throw restaurantError;
      if (foodError) throw foodError;

      const mappedRestaurants = ((restaurantData || []) as any[]).map((restaurant, index) => {
        const rating = normalizeRating(restaurant.restaurant_rating);
        const { deliveryFee, distanceKm } = calculateDeliveryFromUserLocation({
          restaurantLocation: {
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
          },
          userLocation,
        });

        const distanceStr = distanceKm ? `${distanceKm.toFixed(1)} km` : "Unknown distance";

        return {
          id: restaurant.id,
          name: restaurant.restaurant_name || "Restaurant",
          cuisine: restaurant.cuisine_type || "Food",
          image: restaurant.image_url || FALLBACK_RESTAURANT_IMAGE,
          rating,
          deliveryTimeMinutes: deliveryMinutes(index, rating),
          deliveryFee,
          distanceKm,
          distance: distanceStr,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          promotion: promotionFor(index, rating),
        };
      });

      const mappedFoods = ((foodData || []) as any[]).map((item, index) => {
        const restaurant = firstRelation<any>(item.restaurants);
        const rating = normalizeRating(restaurant?.restaurant_rating);

        const { deliveryFee, distanceKm } = calculateDeliveryFromUserLocation({
          restaurantLocation: {
            latitude: restaurant?.latitude,
            longitude: restaurant?.longitude,
          },
          userLocation,
        });

        return {
          id: item.id,
          restaurantId: item.restaurant_id || restaurant?.id,
          name: item.name || "Menu item",
          description: item.description || "Freshly prepared with quality ingredients.",
          category: item.category || "Food",
          image: item.image_url || FALLBACK_FOOD_IMAGE,
          restaurantName: restaurant?.restaurant_name || "Restaurant",
          restaurantRating: rating,
          priceUgx: toUGX(item.price || 0),
          deliveryTimeMinutes: Number(item.preparation_time || deliveryMinutes(index, rating)),
          deliveryFee,
          distanceKm,
          dietaryTags: Array.isArray(item.dietary_tags) ? item.dietary_tags : [],
          latitude: restaurant?.latitude,
          longitude: restaurant?.longitude,
        };
      });

      setRestaurants(mappedRestaurants);
      setFoods(mappedFoods.filter((item) => item.restaurantId));
    } catch (error) {
      console.error("Search load failed:", error);
      Alert.alert("Search unavailable", "We could not load restaurants and foods. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchData();
    AsyncStorage.getItem(RECENT_KEY)
      .then((value) => {
        if (value) setRecentSearches(JSON.parse(value));
      })
      .catch(() => { });
  }, [fetchSearchData]);

  const saveRecentSearch = useCallback(async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    const next = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [recentSearches]);

  const categoryOptions = useMemo(() => {
    const dynamic = Array.from(new Set(foods.map((item) => item.category).filter(Boolean))).slice(0, 8);
    return ["All", ...dynamic];
  }, [foods]);

  const allCategories = useMemo(() => {
    const staticLabels = CATEGORY_ITEMS.map(c => c.label.toLowerCase());
    const dynamic = categoryOptions
      .slice(1, 5)                        // first 5 dynamic from DB
      .filter(label => !staticLabels.includes(label.toLowerCase()));

    return [
      { label: "All", source: null },
      ...CATEGORY_ITEMS.map(c => ({ label: c.label, source: c.source })),
      ...dynamic.map(label => ({ label, source: getCategoryImage(label) })),
    ];
  }, [categoryOptions]);

  const filteredRestaurants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = restaurants.filter((restaurant) => {
      const matchesQuery =
        !needle ||
        restaurant.name.toLowerCase().includes(needle) ||
        restaurant.cuisine.toLowerCase().includes(needle);
      const matchesCategory =
        selectedCategory === "All" ||
        restaurant.cuisine.toLowerCase().includes(selectedCategory.toLowerCase());
      return matchesQuery && matchesCategory;
    });

    if (selectedFilter === "Nearest") next = [...next].sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    if (selectedFilter === "Top rated") next = [...next].sort((a, b) => b.rating - a.rating);
    if (selectedFilter === "Low delivery fee") next = [...next].sort((a, b) => a.deliveryFee - b.deliveryFee);
    if (selectedFilter === "Fastest") next = [...next].sort((a, b) => a.deliveryTimeMinutes - b.deliveryTimeMinutes);
    return next;
  }, [query, restaurants, selectedCategory, selectedFilter]);

  const filteredFoods = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = foods.filter((food) => {
      const matchesQuery =
        !needle ||
        food.name.toLowerCase().includes(needle) ||
        food.description.toLowerCase().includes(needle) ||
        food.category.toLowerCase().includes(needle) ||
        food.restaurantName.toLowerCase().includes(needle) ||
        food.dietaryTags.some((tag) => String(tag).toLowerCase().includes(needle));
      const matchesCategory = selectedCategory === "All" || food.category.toLowerCase().includes(selectedCategory.toLowerCase());
      return matchesQuery && matchesCategory;
    });

    if (selectedFilter === "Nearest" || selectedFilter === "Fastest") next = [...next].sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    if (selectedFilter === "Top rated") next = [...next].sort((a, b) => b.restaurantRating - a.restaurantRating);
    if (selectedFilter === "Low delivery fee") next = [...next].sort((a, b) => a.deliveryFee - b.deliveryFee);
    return next;
  }, [foods, query, selectedCategory, selectedFilter]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSearchData();
  }, [fetchSearchData]);

  const handleSubmit = useCallback(() => {
    saveRecentSearch(query);
  }, [query, saveRecentSearch]);

  const addFoodToCart = useCallback(async (food: FoodResult, replaceRestaurant = false) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to add items to your cart.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/(auth)/signin" as any) },
      ]);
      return;
    }

    try {
      setAddingFoodId(food.id);
      const { data: carts } = await db
        .from("carts")
        .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      let currentCart = carts?.[0] || null;
      if (currentCart && currentCart.restaurant_id !== food.restaurantId && !replaceRestaurant) {
        Alert.alert("Start a new cart?", "Your cart has items from another restaurant.", [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: () => addFoodToCart(food, true) },
        ]);
        return;
      }

      if (currentCart && currentCart.restaurant_id !== food.restaurantId && replaceRestaurant) {
        await db.from("cart_items").delete().eq("cart_id", currentCart.id);
        const { data: updatedCart, error: updateError } = await db
          .from("carts")
          .update({ restaurant_id: food.restaurantId })
          .eq("id", currentCart.id)
          .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
          .maybeSingle();
        if (updateError) throw updateError;
        currentCart = updatedCart;
      }

      if (!currentCart) {
        const { data: newCart, error: createError } = await db
          .from("carts")
          .insert({ user_id: user.id, restaurant_id: food.restaurantId, status: "active" })
          .select("*, cart_items(id,menu_item_id,quantity,unit_price,total_price)")
          .maybeSingle();
        if (createError) throw createError;
        currentCart = newCart;
      }

      const existingItem = (currentCart.cart_items || []).find((item: any) => item.menu_item_id === food.id);
      if (existingItem) {
        const quantity = Number(existingItem.quantity || 0) + 1;
        const { error } = await db
          .from("cart_items")
          .update({ quantity, total_price: food.priceUgx * quantity })
          .eq("id", existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("cart_items").insert({
          cart_id: currentCart.id,
          menu_item_id: food.id,
          quantity: 1,
          unit_price: food.priceUgx,
          total_price: food.priceUgx,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error("Search add to cart failed:", error);
      Alert.alert("Cart unavailable", "We could not add this item. Please try again.");
    } finally {
      setAddingFoodId(null);
    }
  }, [router, user?.id]);

  const resultCount = selectedTab === "Restaurants" ? filteredRestaurants.length : filteredFoods.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={19} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            autoFocus
            returnKeyType="search"
            style={styles.searchInput}
          />
          {!query && (
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

          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        {!query.trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <View style={styles.chipWrap}>
              {recentSearches.length ? (
                recentSearches.map((item) => <SearchChip key={item} label={item} onPress={() => setQuery(item)} />)
              ) : (
                POPULAR_SEARCHES.slice(0, 4).map((item) => <SearchChip key={item} label={item} onPress={() => setQuery(item)} />)
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.tabRow}>
          {(["Restaurants", "Foods"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
              onPress={() => setSelectedFilter(filter)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
          {allCategories.map((category) => (
            <TouchableOpacity
              key={category.label}
              style={[styles.categoryItem, selectedCategory === category.label && styles.categoryItemActive]}
              onPress={() => {
                setSelectedCategory(category.label);
                if (category.label !== "All") setQuery(category.label);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.categoryIcon}>
                {category.label === "All" ? (
                  <Ionicons name="grid-outline" size={20} color="#111827" />
                ) : category.source ? (
                  <Image source={category.source} style={styles.categoryImage} />
                ) : (
                  <Ionicons name="restaurant-outline" size={20} color="#111827" />
                )}
              </View>
              <Text style={styles.categoryText}>{category.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>{selectedTab}</Text>
          <Text style={styles.resultsCount}>{resultCount} results</Text>
        </View>

        {loading ? (
          <SkeletonList />
        ) : selectedTab === "Restaurants" && filteredRestaurants.length ? (
          <View style={styles.resultsList}>
            {filteredRestaurants.map((restaurant, index) => (
              <ResultReveal key={restaurant.id} index={index}>
                <RestaurantCard
                  restaurant={restaurant}
                  onPress={() => {
                    saveRecentSearch(query || restaurant.name);
                    router.push(`/(tabs)/profiles/restaurant-profile/${restaurant.id}` as any);
                  }}
                />
              </ResultReveal>
            ))}
          </View>
        ) : selectedTab === "Foods" && filteredFoods.length ? (
          <View style={styles.resultsList}>
            {filteredFoods.map((food, index) => (
              <ResultReveal key={food.id} index={index}>
                <FoodCard
                  food={food}
                  adding={addingFoodId === food.id}
                  onAdd={() => addFoodToCart(food)}
                  onPress={() => {
                    saveRecentSearch(query || food.name);
                    router.push({
                      pathname: "/menu/[restaurantId]",
                      params: { restaurantId: food.restaurantId, highlightedItemId: food.id },
                    } as any);
                  }}
                />
              </ResultReveal>
            ))}
          </View>
        ) : (
          <View style={styles.noResults}>
            <View style={styles.noResultsIcon}>
              <Ionicons name="search-outline" size={28} color="#6B7280" />
            </View>
            <Text style={styles.noResultsTitle}>No results found</Text>
            <Text style={styles.noResultsText}>Try another dish, ingredient, or restaurant name.</Text>
            <View style={styles.chipWrapCentered}>
              {POPULAR_SEARCHES.slice(0, 5).map((item) => <SearchChip key={item} label={item} onPress={() => setQuery(item)} />)}
            </View>
          </View>
        )}
        <View style={{ height: 50 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingBottom: -50 },
  header: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  searchBar: {
    flex: 1,
    height: 45,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderColor: "#0f18282f",
    borderWidth: 0.9,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#111827", paddingVertical: 0 },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
    // ensures the placeholder sits perfectly over the input
  },
  placeholderLabel: {
    position: 'absolute',
    left: 44,                  // fine-tune alignment with the cursor
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
    color: '#9CA3AF',
  },
  cancelButton: { height: 42, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#111827", fontSize: 14, fontFamily: "Inter", fontWeight: "500" },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 0, paddingBottom: 118, gap: 16 },
  section: { gap: 10, paddingHorizontal: 14.5 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipWrapCentered: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  searchChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchChipText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  tabRow: { height: 42, padding: 3, borderRadius: 4, backgroundColor: "#F3F4F6", flexDirection: "row", gap: 3, marginHorizontal: 12 },
  tabButton: { flex: 1, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  tabTextActive: { color: "#111827" },
  filterRail: { gap: 8, paddingHorizontal: 14.5, paddingVertical: 4 },
  filterChip: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.6,
    borderColor: "#e5e7ebb3",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  filterTextActive: { color: "#FFFFFF" },
  categoryRail: { gap: 10, paddingHorizontal: 14 },
  categoryItem: { width: 76, alignItems: "center", gap: 7, paddingVertical: 4, borderRadius: 8 },
  categoryItemActive: { backgroundColor: "#FFF7ED" },
  categoryIcon: {
    width: 50,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,     // matches the container
  },
  categoryText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#111827", textAlign: "center" },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14.5 },
  resultsCount: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  resultsList: { gap: 12, paddingHorizontal: 14 },
  restaurantCard: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#10182817",
    overflow: "hidden",
  },
  restaurantImage: { width: "100%", height: 150, backgroundColor: "#E5E7EB" },
  restaurantBody: { padding: 12, gap: 5 },
  promoBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  promoText: { fontSize: 11, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF" },
  resultName: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  resultCuisine: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  ratingDot: {
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  metaText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#374151" },
  distanceText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  foodCard: {
    minHeight: 132,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    flexDirection: "row",
    gap: 12,
  },
  foodImage: { width: 106, height: 110, borderRadius: 8, backgroundColor: "#E5E7EB" },
  foodBody: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
  foodDescription: { fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  foodFooter: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  priceText: { fontSize: 14, fontFamily: "Inter", fontWeight: "800", color: "#111827" },
  foodMeta: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  foodMetaText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  addButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  skeletonList: { gap: 12, paddingHorizontal: 14.5 },
  skeletonCard: { height: 132, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", padding: 12, flexDirection: "row", gap: 12 },
  skeletonImage: { width: 104, borderRadius: 8, backgroundColor: "#E5E7EB" },
  skeletonBody: { flex: 1, justifyContent: "center", gap: 10 },
  skeletonLineLarge: { width: "70%", height: 14, borderRadius: 7, backgroundColor: "#E5E7EB" },
  skeletonLine: { width: "90%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },
  skeletonLineSmall: { width: "45%", height: 12, borderRadius: 6, backgroundColor: "#EEF2F7" },
  noResults: { minHeight: 300, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 10 },
  noResultsIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  noResultsTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  noResultsText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textAlign: "center" },
});
