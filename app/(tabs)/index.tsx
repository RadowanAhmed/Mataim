import { logger } from "@/backend/utils/logger";
import { useAuth } from "@/backend/AuthContext";
import { HOME_FEED_LIMITS } from "@/backend/hooks/useHomeFeed";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { getSafeCurrentLocation } from "@/backend/utils/location";
import { calculateDeliveryFromUserLocation } from "@/backend/utils/deliveryPricing";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Reanimated, { FadeInUp } from "react-native-reanimated";
import { GuestProfileBanner } from "../components/GuestProfileBanner";
import NotificationBell from "../components/NotificationBell";
import AsyncStorage from "@react-native-async-storage/async-storage";

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&h=640&fit=crop";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=640&fit=crop";

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  image: string;
  rating: number;
  deliveryTime: string;
  totalOrders: number;
  verified: boolean;
  minOrder: number;
  deliveryFee: number;
  categoryTags: string;
};

type FeaturedItem = {
  id: string;
  title: string;
  restaurantId?: string | null;
  restaurantName: string;
  image: string;
  price: number;
  oldPrice?: number;
  rating: number;
  discount?: number;
};

type Category = {
  id: string;
  title: string;
  image: string;
};

type ShowcaseCard = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  image: string;
  routeCategory: string;
};

type Story = {
  id: string;
  restaurantId: string;
  name: string;
  image: string;
  isLive?: boolean;
};

function categoryRouteKey(value: unknown) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const aliases: Record<string, string> = {
    burger: "burgers",
    burgers: "burgers",
    beverage: "drinks",
    beverages: "drinks",
    drink: "drinks",
    drinks: "drinks",
    dessert: "desserts",
    desserts: "desserts",
    sweet: "desserts",
    sweets: "desserts",
    pizza: "pizza",
    pizzas: "pizza",
  };
  return aliases[slug] || slug;
}

const FALLBACK_CATEGORIES: Category[] = [
  {
    id: "pizza",
    title: "Pizza",
    image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=320&h=320&fit=crop",
  },
  {
    id: "burgers",
    title: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=320&h=320&fit=crop",
  },
  {
    id: "chicken",
    title: "Chicken",
    image: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=320&h=320&fit=crop",
  },
  {
    id: "drinks",
    title: "Drinks",
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=320&h=320&fit=crop",
  },
];

const HOME_RESTAURANT_SECTIONS = [
  {
    id: "pizza-italian",
    title: "Pizza & Italian",
    subtitle: "Pizzas, pasta, and Italian-style favorites",
    keywords: ["pizza", "italian", "pasta", "spaghetti", "lasagna", "risotto"],
  },
  {
    id: "burgers-fast-food",
    title: "Burgers & Fast Food",
    subtitle: "Burgers, fries, fried chicken, and quick bites",
    keywords: ["burger", "burgers", "fast food", "fries", "chips", "fried chicken", "shawarma"],
  },
  {
    id: "drinks-juices",
    title: "Drinks & Juices",
    subtitle: "Fresh juices, coffee, sodas, and smoothies",
    keywords: ["drink", "drinks", "juice", "juices", "smoothie", "soda", "coffee", "tea", "milkshake", "mocktail"],
  },
  {
    id: "desserts-sweets",
    title: "Desserts & Sweets",
    subtitle: "Cakes, pastries, ice cream, and sweet treats",
    keywords: ["dessert", "desserts", "sweet", "sweets", "cake", "pastry", "ice cream", "donut", "waffle", "chocolate"],
  },
];

const CUISINE_SHOWCASES: Record<string, ShowcaseCard[]> = {
  "pizza-italian": [
    {
      id: "margherita",
      title: "Margherita",
      subtitle: "Tomato, mozzarella, basil",
      badge: "20% OFF",
      image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=900&h=680&fit=crop",
      routeCategory: "Pizza",
    },
    {
      id: "pepperoni",
      title: "Pepperoni",
      subtitle: "Crisp edges, melty cheese",
      badge: "Popular",
      image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=900&h=680&fit=crop",
      routeCategory: "Pizza",
    },
    {
      id: "carbonara",
      title: "Creamy pasta",
      subtitle: "Italian comfort classics",
      image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900&h=680&fit=crop",
      routeCategory: "Pasta",
    },
  ],
  "burgers-fast-food": [
    {
      id: "double-smash",
      title: "Double smash",
      subtitle: "Seared patties, soft bun",
      badge: "Hot",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&h=680&fit=crop",
      routeCategory: "Burgers",
    },
    {
      id: "fried-chicken",
      title: "Crispy chicken",
      subtitle: "Crunchy, juicy, fast",
      badge: "Combo",
      image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=900&h=680&fit=crop",
      routeCategory: "Chicken",
    },
    {
      id: "loaded-fries",
      title: "Loaded fries",
      subtitle: "Cheese, spice, sauces",
      image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=900&h=680&fit=crop",
      routeCategory: "Fries",
    },
  ],
  "drinks-juices": [
    {
      id: "fresh-juice",
      title: "Fresh juices",
      subtitle: "Cold-pressed and bright",
      badge: "Fresh",
      image: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=900&h=680&fit=crop",
      routeCategory: "Drinks",
    },
    {
      id: "iced-coffee",
      title: "Iced coffee",
      subtitle: "Smooth cafe picks",
      image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&h=680&fit=crop",
      routeCategory: "Coffee",
    },
    {
      id: "smoothies",
      title: "Smoothies",
      subtitle: "Fruit blends and shakes",
      badge: "Popular",
      image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=900&h=680&fit=crop",
      routeCategory: "Smoothies",
    },
  ],
  "desserts-sweets": [
    {
      id: "chocolate-cake",
      title: "Chocolate cake",
      subtitle: "Rich slices, quick delivery",
      badge: "Sweet",
      image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=680&fit=crop",
      routeCategory: "Desserts",
    },
    {
      id: "ice-cream",
      title: "Ice cream",
      subtitle: "Scoops, sundaes, shakes",
      image: "https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=900&h=680&fit=crop",
      routeCategory: "Ice Cream",
    },
    {
      id: "waffles",
      title: "Waffles",
      subtitle: "Golden and warm",
      badge: "20% OFF",
      image: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=900&h=680&fit=crop",
      routeCategory: "Waffles",
    },
  ],
};

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function searchText(...values: unknown[]) {
  return values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function getDeliveryTime(index: number, rating: number) {
  const base = rating >= 4.7 ? 22 : 28;
  const start = base + (index % 4) * 3;
  return `${start}-${start + 12} min`;
}

function randomize<T>(items: T[], limit: number) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, limit)
    .map(({ item }) => item);
}

// ========================
// Shared UI Components
// ========================
function SectionHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        <View style={styles.sectionTitleRow}>
          {icon ? (
            <View style={styles.sectionTitleIcon}>
              <Ionicons name={icon} size={14} color={ACCENT} />
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity style={styles.sectionAction} onPress={action}>
          <Text style={styles.sectionActionText}>See all</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function TopPickCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.topPickCard} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: restaurant.image }} style={styles.topPickImage} />
      <View style={styles.topPickOverlay} />
      <View style={styles.topPickBadge}>
        <Ionicons name="star" size={11} color="#F59E0B" />
        <Text style={styles.topPickBadgeText}>{restaurant.rating.toFixed(1)}</Text>
      </View>
      <View style={styles.topPickBody}>
        <Text style={styles.topPickName} numberOfLines={1}>{restaurant.name}</Text>
        <Text style={styles.topPickMeta} numberOfLines={1}>
          {restaurant.deliveryTime} | {formatUGX(restaurant.deliveryFee)} delivery
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function RecommendedCard({ item, onPress }: { item: FeaturedItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recommendedCard} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: item.image }} style={styles.recommendedImage} />
      <View style={styles.recommendedBody}>
        <Text style={styles.recommendedTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.recommendedRestaurant} numberOfLines={1}>{item.restaurantName}</Text>
        <View style={styles.recommendedFooter}>
          <Text style={styles.recommendedPrice}>{formatUGX(item.price)}</Text>
          <View style={styles.recommendedRating}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.recommendedRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CategoryChip({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.categoryChip} onPress={onPress} activeOpacity={0.86}>
      <Image source={{ uri: category.image }} style={styles.categoryImage} />
      <Text style={styles.categoryTitle} numberOfLines={1}>
        {category.title}
      </Text>
    </TouchableOpacity>
  );
}

function RestaurantCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.restaurantCard} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: restaurant.image }} style={styles.restaurantImage} />
      <View style={styles.restaurantBody}>
        <View style={styles.restaurantTitleRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {restaurant.verified ? (
            <Ionicons name="checkmark-circle" size={17} color="#10B981" />
          ) : null}
        </View>
        <Text style={styles.restaurantCuisine} numberOfLines={1}>
          {restaurant.cuisine}
        </Text>
        <View style={styles.restaurantMeta}>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
          <Text style={styles.metaText}>Min {formatUGX(restaurant.minOrder || 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function NearbyRestaurantCard({ restaurant, width, onPress }: { restaurant: Restaurant; width: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.nearbyRestaurantCard, { width }]} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: restaurant.image }} style={styles.nearbyRestaurantImage} />
      <View style={styles.nearbyRestaurantBody}>
        <Text style={styles.nearbyRestaurantName} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.nearbyRestaurantCuisine} numberOfLines={1}>
          {restaurant.cuisine}
        </Text>
        <View style={styles.nearbyRestaurantMeta}>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={12} color="#4B5563" />
            <Text style={styles.timePillText}>{restaurant.deliveryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CuisineCarousel({
  title,
  subtitle,
  cards,
  width,
  autoStartDelay = 0,
  onPress,
}: {
  title: string;
  subtitle: string;
  cards: ShowcaseCard[];
  width: number;
  autoStartDelay?: number;
  onPress: (card: ShowcaseCard) => void;
}) {
  const listRef = useRef<FlatList<ShowcaseCard>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const snapWidth = width + 12;

  useEffect(() => {
    if (cards.length <= 1) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimer = () => {
      interval = setInterval(() => {
        setActiveIndex((current) => {
          const next = (current + 1) % cards.length;
          listRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 3800);
    };
    const delay = setTimeout(startTimer, autoStartDelay);
    return () => {
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [autoStartDelay, cards.length]);

  const handleMomentumEnd = (event: any) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / snapWidth);
    setActiveIndex(Math.max(0, Math.min(cards.length - 1, next)));
  };

  const handleScrollToIndexFailed = () => {
    setActiveIndex((current) => {
      const next = (current + 1) % cards.length;
      listRef.current?.scrollToOffset({ offset: next * snapWidth, animated: true });
      return next;
    });
  };

  return (
    <Reanimated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      <Animated.FlatList
        ref={listRef}
        data={cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        snapToInterval={snapWidth}
        decelerationRate="fast"
        contentContainerStyle={styles.showcaseRail}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * snapWidth, index * snapWidth, (index + 1) * snapWidth];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.94, 1, 0.94],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.82, 1, 0.82],
            extrapolate: "clamp",
          });
          return (
            <Animated.View style={[styles.showcaseAnimatedCard, { width, transform: [{ scale }], opacity }]}>
              <TouchableOpacity style={styles.showcaseCard} onPress={() => onPress(item)} activeOpacity={0.9}>
                <Image source={{ uri: item.image }} style={styles.showcaseImage} />
                <LinearGradient
                  colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.42)", "rgba(0,0,0,0.76)"]}
                  style={styles.showcaseGradient}
                />
                {item.badge ? (
                  <View style={styles.showcaseBadge}>
                    <Text style={styles.showcaseBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                <View style={styles.showcaseCopy}>
                  <Text style={styles.showcaseTitle}>{item.title}</Text>
                  <Text style={styles.showcaseSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />
      <View style={styles.carouselDots}>
        {cards.map((card, index) => (
          <View key={card.id} style={[styles.carouselDot, activeIndex === index && styles.carouselDotActive]} />
        ))}
      </View>
    </Reanimated.View>
  );
}

// ========================
// Skeleton Components
// ========================
function SkeletonCategoryChip() {
  return (
    <View style={styles.categoryChip}>
      <View style={[styles.categoryImage, { backgroundColor: "#E5E7EB" }]} />
      <View style={{ width: 60, height: 12, backgroundColor: "#E5E7EB", borderRadius: 6, marginTop: 8 }} />
    </View>
  );
}

function SkeletonFeaturedCard({ width }: { width: number }) {
  return (
    <View style={[styles.featuredCard, { width }]}>
      <View style={[styles.featuredImage, { backgroundColor: "#E5E7EB" }]} />
      <View style={styles.featuredBody}>
        <View style={{ height: 16, width: "80%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 12, width: "60%", backgroundColor: "#E5E7EB", borderRadius: 4, marginTop: 8 }} />
        <View style={[styles.featuredFooter, { marginTop: 12 }]}>
          <View style={{ height: 26, width: 50, backgroundColor: "#E5E7EB", borderRadius: 13 }} />
          <View style={{ height: 14, width: 60, backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

function SkeletonRestaurantCard() {
  return (
    <View style={styles.restaurantCard}>
      <View style={{ width: 92, height: 90, backgroundColor: "#E5E7EB", borderRadius: 8 }} />
      <View style={styles.restaurantBody}>
        <View style={{ height: 16, width: "70%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 12, width: "50%", backgroundColor: "#E5E7EB", borderRadius: 4, marginTop: 8 }} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={{ height: 24, width: 40, backgroundColor: "#E5E7EB", borderRadius: 12 }} />
          <View style={{ height: 12, width: 50, backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

// ========================
// Cart Animation & Reorder
// ========================
function FeaturedCardWithCart({
  item,
  width,
  onPress,
  onAddToCart,
}: {
  item: FeaturedItem;
  width: number;
  onPress: () => void;
  onAddToCart: (event: any, item: FeaturedItem) => void;
}) {
  return (
    <TouchableOpacity style={[styles.featuredCard, { width }]} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: item.image }} style={styles.featuredImage} />
      {item.discount ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{item.discount}% off</Text>
        </View>
      ) : null}
      <View style={styles.featuredBody}>
        <Text style={styles.featuredTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.featuredRestaurant} numberOfLines={1}>
          {item.restaurantName}
        </Text>
        <View style={styles.featuredFooter}>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.priceRow}>
            {item.oldPrice && item.oldPrice > item.price ? (
              <Text style={styles.oldPrice}>{formatUGX(item.oldPrice)}</Text>
            ) : null}
            <Text style={styles.priceText}>{formatUGX(item.price)}</Text>
          </View>
        </View>
        {/* <TouchableOpacity
          style={styles.addToCartButton}
          onPress={(e) => onAddToCart(e, item)}
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
          <Text style={styles.addToCartText}>Add</Text>
        </TouchableOpacity> */}
      </View>
    </TouchableOpacity>
  );
}

function ReorderButton({ restaurantId, userId }: { restaurantId: string; userId: string }) {
  const [reordering, setReordering] = useState(false);
  const router = useRouter();

  const handleReorder = async () => {
    if (!userId) {
      Alert.alert("Please log in to reorder");
      return;
    }
    setReordering(true);
    try {
      const { data: lastOrder } = await db
        .from("orders")
        .select("id")
        .eq("customer_id", userId)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!lastOrder) {
        Alert.alert("No previous order", "We couldn't find an order from this restaurant.");
        return;
      }

      const { data: orderItems } = await db
        .from("order_items")
        .select("menu_item_id, quantity, price, menu_items(name)")
        .eq("order_id", lastOrder.id);

      if (!orderItems || orderItems.length === 0) {
        Alert.alert("No items", "No items found in your last order.");
        return;
      }

      let { data: activeCart } = await db
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!activeCart) {
        const { data: newCart, error } = await db
          .from("carts")
          .insert({ user_id: userId, status: "active" })
          .select()
          .single();
        if (error) throw error;
        activeCart = newCart;
      }

      for (const item of orderItems) {
        await db.from("cart_items").upsert({
          cart_id: activeCart.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          price: item.price,
        });
      }

      Alert.alert("Added to cart", "Your previous order has been added to your cart.", [
        { text: "View Cart", onPress: () => router.push("/(tabs)/cart" as any) },
        { text: "OK" },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Reorder failed", "Could not reorder. Please try again.");
    } finally {
      setReordering(false);
    }
  };

  return (
    <TouchableOpacity style={styles.reorderButton} onPress={handleReorder} disabled={reordering}>
      {reordering ? (
        <ActivityIndicator size="small" color={ACCENT} />
      ) : (
        <>
          <Ionicons name="repeat-outline" size={14} color={ACCENT} />
          <Text style={styles.reorderButtonText}>Reorder</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ========================
// Recently Viewed Helpers
// ========================
const RECENTLY_VIEWED_KEY = "@recently_viewed_restaurants";
const MAX_RECENT = 10;

async function addRecentlyViewed(restaurantId: string) {
  try {
    const stored = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    let list: string[] = stored ? JSON.parse(stored) : [];
    list = list.filter((id) => id !== restaurantId);
    list.unshift(restaurantId);
    if (list.length > MAX_RECENT) list.pop();
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
  } catch (error) {
    console.error("Failed to save recently viewed", error);
  }
}

async function getRecentlyViewed(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// ========================
// Main Screen Component
// ========================
export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Kampala, Uganda");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [cartCount, setCartCount] = useState(0);
  const [orderAgainRestaurants, setOrderAgainRestaurants] = useState<Restaurant[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [recentlyViewedRestaurants, setRecentlyViewedRestaurants] = useState<Restaurant[]>([]);

  // Flying animation
  const flyingAnimation = useRef(new Animated.Value(0)).current;
  const flyingPosition = useRef({ x: 0, y: 0 }).current;
  const [flyingItem, setFlyingItem] = useState<FeaturedItem | null>(null);

  const cardWidth = Math.min(width - 56, 280);
  const showcaseCardWidth = Math.min(width - 48, 348);
  const nearbyCardWidth = Math.min(width * 0.72, 276);
  const bannerWidth = Math.max(280, width - 32);

  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const locationScale = useRef(new Animated.Value(1)).current;
  const cartScale = useRef(new Animated.Value(1)).current;
  const refreshSpin = useRef(new Animated.Value(0)).current;

  // Stories from top restaurants
  useEffect(() => {
    if (restaurants.length === 0) return;
    const topRestaurants = [...restaurants].sort((a, b) => b.rating - a.rating).slice(0, 8);
    const storyList: Story[] = topRestaurants.map((r, idx) => ({
      id: r.id,
      restaurantId: r.id,
      name: r.name,
      image: r.image,
      isLive: idx === 0 || idx === 2,
    }));
    setStories(storyList);
  }, [restaurants]);

  // Load recently viewed
  useEffect(() => {
    const loadRecent = async () => {
      if (restaurants.length === 0) return;
      const recentIds = await getRecentlyViewed();
      const recent = recentIds
        .map((id) => restaurants.find((r) => r.id === id))
        .filter((r): r is Restaurant => r !== undefined)
        .slice(0, 5);
      setRecentlyViewedRestaurants(recent);
    };
    loadRecent();
  }, [restaurants]);

  const loadHome = useCallback(async () => {
    try {
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
        logger.debug("Could not get user location:", error);
      }

      const restaurantQuery = db
        .from("restaurants")
        .select(`
          id,
          restaurant_name,
          cuisine_type,
          image_url,
          restaurant_rating,
          min_order_amount,
          restaurant_status,
          is_verified,
          total_orders,
          address,
          latitude,
          longitude
        `)
        .neq("restaurant_status", "inactive")
        .order("restaurant_rating", { ascending: false })
        .limit(HOME_FEED_LIMITS.restaurants);

      const postsQuery = db
        .from("posts")
        .select(`
          id,
          restaurant_id,
          title,
          image_url,
          discounted_price,
          original_price,
          discount_percentage,
          created_at,
          restaurants!inner (
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            image_url
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(HOME_FEED_LIMITS.featuredPosts);

      const menuQuery = db
        .from("menu_items")
        .select("restaurant_id,name,category,description,image_url")
        .eq("is_available", true)
        .limit(HOME_FEED_LIMITS.menuItemsForTags);

      const addressQuery = user?.id
        ? db
          .from("addresses")
          .select("label,address_line1,city,country,is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [restaurantResult, postsResult, menuResult, addressResult] = await Promise.all([
        restaurantQuery,
        postsQuery,
        menuQuery,
        addressQuery,
      ]);

      if (restaurantResult.error) throw restaurantResult.error;
      if (postsResult.error) throw postsResult.error;

      const restaurantRows = restaurantResult.data || [];
      const restaurantLookup = new Map<string, any>(restaurantRows.map((restaurant: any) => [restaurant.id, restaurant]));
      const menuTagsByRestaurant = new Map<string, string[]>();

      (menuResult.data || []).forEach((item: any) => {
        if (!item.restaurant_id) return;
        const tags = menuTagsByRestaurant.get(item.restaurant_id) || [];
        tags.push(searchText(item.name, item.category, item.description));
        menuTagsByRestaurant.set(item.restaurant_id, tags);
      });

      setRestaurants(
        restaurantRows.map((restaurant: any, index: number) => {
          const rating = normalizeRating(restaurant.restaurant_rating);
          const { deliveryFee } = calculateDeliveryFromUserLocation({
            restaurantLocation: {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            },
            userLocation,
          });
          return {
            id: restaurant.id,
            name: restaurant.restaurant_name || "Restaurant",
            cuisine: restaurant.cuisine_type || "Fresh food",
            image: restaurant.image_url || FALLBACK_RESTAURANT_IMAGE,
            rating,
            deliveryTime: getDeliveryTime(index, rating),
            totalOrders: numberValue(restaurant.total_orders, 0),
            verified: Boolean(restaurant.is_verified),
            minOrder: toUGX(restaurant.min_order_amount || 0),
            deliveryFee,
            categoryTags: menuTagsByRestaurant.get(restaurant.id)?.join(" ") || "",
          };
        })
      );

      setFeaturedItems(
        (postsResult.data || []).map((post: any) => {
          const relationRestaurant = Array.isArray(post.restaurants) ? post.restaurants[0] : post.restaurants;
          const restaurant = restaurantLookup.get(post.restaurant_id) || {};
          const price = toUGX(post.discounted_price ?? post.original_price ?? 0);
          const oldPrice = post.discounted_price ? toUGX(post.original_price || 0) : undefined;
          const rating = normalizeRating(relationRestaurant?.restaurant_rating || restaurant.restaurant_rating);
          const restaurantName = relationRestaurant?.restaurant_name || restaurant.restaurant_name || "Restaurant";
          return {
            id: post.id,
            title: post.title || "Featured meal",
            restaurantId: post.restaurant_id,
            restaurantName,
            image: post.image_url || relationRestaurant?.image_url || restaurant.image_url || FALLBACK_FOOD_IMAGE,
            price,
            oldPrice,
            rating,
            discount: numberValue(post.discount_percentage, 0) || undefined,
          };
        })
      );

      if (!menuResult.error) {
        const seen = new Set<string>();
        const nextCategories = (menuResult.data || [])
          .filter((item: any) => {
            const name = String(item.category || "").trim();
            if (!name || seen.has(name.toLowerCase())) return false;
            seen.add(name.toLowerCase());
            return true;
          })
          .slice(0, 8)
          .map((item: any) => ({
            id: String(item.category).toLowerCase(),
            title: String(item.category),
            image: item.image_url || FALLBACK_FOOD_IMAGE,
          }));
        setCategories(nextCategories.length ? nextCategories : FALLBACK_CATEGORIES);
      }

      const address = addressResult.data;
      if (address?.address_line1) {
        setLocationLabel(address.address_line1);
      } else if (address?.city) {
        setLocationLabel([address.city, address.country].filter(Boolean).join(", "));
      }

      if (user?.id && !(user as any)?.is_guest) {
        const { data: pastOrders } = await db
          .from("orders")
          .select(`
            restaurant_id,
            restaurants!orders_restaurant_id_fkey(
              id,
              restaurant_name,
              cuisine_type,
              image_url,
              restaurant_rating,
              min_order_amount,
              restaurant_status,
              is_verified,
              total_orders,
              address,
              latitude,
              longitude
            )
          `)
          .eq("customer_id", user.id)
          .eq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(12);

        const seenRestaurants = new Set<string>();
        const againList: Restaurant[] = [];
        (pastOrders || []).forEach((row: any, index: number) => {
          const restaurant = row.restaurants;
          if (!restaurant?.id || seenRestaurants.has(restaurant.id)) return;
          seenRestaurants.add(restaurant.id);
          const rating = normalizeRating(restaurant.restaurant_rating);
          const { deliveryFee } = calculateDeliveryFromUserLocation({
            restaurantLocation: {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            },
            userLocation,
          });
          againList.push({
            id: restaurant.id,
            name: restaurant.restaurant_name || "Restaurant",
            cuisine: restaurant.cuisine_type || "Fresh food",
            image: restaurant.image_url || FALLBACK_RESTAURANT_IMAGE,
            rating,
            deliveryTime: getDeliveryTime(index, rating),
            totalOrders: numberValue(restaurant.total_orders, 0),
            verified: Boolean(restaurant.is_verified),
            minOrder: toUGX(restaurant.min_order_amount || 0),
            deliveryFee,
            categoryTags: searchText(restaurant.restaurant_name, restaurant.cuisine_type),
          });
        });
        setOrderAgainRestaurants(againList.slice(0, 6));
      } else {
        setOrderAgainRestaurants([]);
      }

      if (user?.id) {
        const { data: activeCart } = await db
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        if (activeCart?.id) {
          const { count } = await db
            .from("cart_items")
            .select("id", { count: "exact", head: true })
            .eq("cart_id", activeCart.id);
          setCartCount(count || 0);
        } else {
          setCartCount(0);
        }
      } else {
        setCartCount(0);
      }
    } catch (error) {
      console.error("Customer home load failed:", error);
      Alert.alert("Home unavailable", "We could not refresh the latest restaurants.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    loadHome();
  }, [loadHome]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(cartScale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(cartScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [cartCount]);

  const handleAddToCart = async (event: any, item: FeaturedItem) => {
    if (!user?.id) {
      Alert.alert("Please log in to add items to cart");
      return;
    }
    const button = event.currentTarget;
    button.measureInWindow((x, y, w, h) => {
      flyingPosition.x = x + w / 2;
      flyingPosition.y = y + h / 2;
      setFlyingItem(item);
      Animated.sequence([
        Animated.timing(flyingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(flyingAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => setFlyingItem(null));
    });

    try {
      const { data: menuItem } = await db
        .from("menu_items")
        .select("id, price")
        .eq("restaurant_id", item.restaurantId)
        .limit(1)
        .single();
      if (!menuItem) {
        Alert.alert("Cannot add", "This item is not available for ordering.");
        return;
      }
      let { data: activeCart } = await db
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      if (!activeCart) {
        const { data: newCart } = await db
          .from("carts")
          .insert({ user_id: user.id, status: "active" })
          .select()
          .single();
        activeCart = newCart;
      }
      await db.from("cart_items").insert({
        cart_id: activeCart.id,
        menu_item_id: menuItem.id,
        quantity: 1,
        price: menuItem.price,
      });
      setCartCount((prev) => prev + 1);
    } catch (error) {
      console.error("Add to cart error", error);
    }
  };

  const navigateToRestaurant = (restaurantId: string) => {
    addRecentlyViewed(restaurantId);
    router.push(`/menu/${restaurantId}` as any);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
    await loadHome();
    refreshSpin.stopAnimation();
    refreshSpin.setValue(0);
    setRefreshing(false);
  }, [loadHome]);

  const handleLocationPress = async () => {
    setLocating(true);
    try {
      const location = await getSafeCurrentLocation();
      if (!location.point) {
        Alert.alert("Location unavailable", location.error || "Please check location permissions.");
        return;
      }
      setLocationLabel("Current location");
    } finally {
      setLocating(false);
    }
  };

  const onLocationPressIn = () => Animated.spring(locationScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onLocationPressOut = () => Animated.spring(locationScale, { toValue: 1, useNativeDriver: true }).start();

  const refreshSpinInterpolate = refreshSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const nearbyRestaurants = useMemo(
    () => [...restaurants].sort((a, b) => b.rating - a.rating || b.totalOrders - a.totalOrders).slice(0, 8),
    [restaurants]
  );
  const topPickRestaurants = useMemo(
    () => randomize(restaurants.filter((r) => r.rating >= 4.4 || r.totalOrders > 0), 6),
    [restaurants]
  );
  const recommendedItems = useMemo(() => randomize(featuredItems, 8), [featuredItems]);
  const banners = useMemo(
    () => [
      {
        id: "fast",
        title: "Dinner without the wait",
        subtitle: "Top-rated meals around Kampala, delivered hot.",
        image: featuredItems[0]?.image || FALLBACK_FOOD_IMAGE,
        tone: "#111827",
      },
      {
        id: "fresh",
        title: "Fresh picks near you",
        subtitle: "Explore restaurants with great ratings and quick prep.",
        image: featuredItems[1]?.image || FALLBACK_RESTAURANT_IMAGE,
        tone: "#7C2D12",
      },
    ],
    [featuredItems]
  );

  // Skeleton loading
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.topBar}>
          <View style={[styles.locationBar, { backgroundColor: "#E5E7EB" }]} />
          <View style={{ width: 46, height: 46, backgroundColor: "#E5E7EB", borderRadius: 8 }} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.greetingRow}>
            <View>
              <View style={{ height: 14, width: 60, backgroundColor: "#E5E7EB", borderRadius: 4 }} />
              <View style={{ height: 24, width: 200, backgroundColor: "#E5E7EB", borderRadius: 4, marginTop: 8 }} />
            </View>
            <View style={{ width: 46, height: 46, backgroundColor: "#E5E7EB", borderRadius: 8 }} />
          </View>
          <View style={styles.bannerRail}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.bannerCard, { width: bannerWidth, backgroundColor: "#E5E7EB" }]} />
            ))}
          </View>
          <View style={styles.section}>
            <SectionHeader title="Explore Categories" subtitle="..." />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCategoryChip key={i} />
              ))}
            </ScrollView>
          </View>
          <View style={styles.section}>
            <SectionHeader title="Top Picks" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPicksRail}>
              {[1, 2, 3].map((i) => (
                <SkeletonRestaurantCard key={i} />
              ))}
            </ScrollView>
          </View>
          <View style={styles.section}>
            <SectionHeader title="Recommended" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRail}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonFeaturedCard key={i} width={cardWidth} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {flyingItem && (
        <Animated.View
          style={[
            styles.flyingCartItem,
            {
              left: flyingPosition.x - 20,
              top: flyingPosition.y - 20,
              opacity: flyingAnimation,
              transform: [
                {
                  translateY: flyingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -300],
                  }),
                },
                {
                  scale: flyingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.5, 0.3],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="cart-outline" size={32} color={ACCENT} />
        </Animated.View>
      )}

      <View style={styles.topBar}>
        <LinearGradient
          colors={['#FFFFFF', '#fef8f4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.locationBar, { borderWidth: 0.8, borderColor: '#ffffff' }]}
        >
          <Animated.View style={{ transform: [{ scale: locationScale }] }}>
            <TouchableOpacity
              style={styles.locationIcon}
              onPress={handleLocationPress}
              activeOpacity={0.86}
              onPressIn={onLocationPressIn}
              onPressOut={onLocationPressOut}
            >
              {locating ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons name="location-outline" size={19} color={ACCENT} />
              )}
            </TouchableOpacity>
          </Animated.View>
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        </LinearGradient>
        <NotificationBell tintColor="#111827" size={22} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {refreshing && (
          <Animated.View style={[styles.refreshSpinner, { transform: [{ rotate: refreshSpinInterpolate }] }]}>
            <Ionicons name="restaurant-outline" size={28} color={ACCENT} />
          </Animated.View>
        )}

        {(user as any)?.is_guest ? <GuestProfileBanner /> : null}

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.eyebrow}>Mataim</Text>
            <Text style={styles.greetingText}>What would you like to eat?</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: cartScale }] }}>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => router.push("/(tabs)/cart" as any)}
              activeOpacity={0.86}
            >
              <Ionicons name="basket-outline" size={21} color="#111827" />
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRail}>
          {banners.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              style={[styles.bannerCard, { width: bannerWidth, backgroundColor: banner.tone }]}
              onPress={() => router.push("/(tabs)/search" as any)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: banner.image }} style={styles.bannerImage} />
              <View style={styles.bannerOverlay} />
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                {/* <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text> */}
                <View style={styles.bannerButton}>
                  <Text style={styles.bannerButtonText}>Explore now</Text>
                  <Ionicons name="arrow-forward" size={13} color="#111827d6" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <SectionHeader title="Explore Categories" subtitle="Browse by craving, cuisine, or dietary preference" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                category={category}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/categories/[type]",
                    params: { type: categoryRouteKey(category.id || category.title) },
                  } as any)
                }
              />
            ))}
          </ScrollView>
        </View>

        {topPickRestaurants.length ? (
          <View style={styles.section}>
            <SectionHeader title="Top Picks" icon="flame-outline" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPicksRail}>
              {topPickRestaurants.map((restaurant) => (
                <TopPickCard
                  key={`top-pick-${restaurant.id}`}
                  restaurant={restaurant}
                  onPress={() => navigateToRestaurant(restaurant.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {recommendedItems.length ? (
          <View style={styles.section}>
            <SectionHeader title="Recommended" icon="sparkles-outline" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRail}>
              {recommendedItems.map((item) => (
                <RecommendedCard
                  key={`recommended-${item.id}`}
                  item={item}
                  onPress={() => router.push(`/post/${item.id}` as any)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Stories Section */}
        {stories.length > 0 && (
          <View style={styles.storiesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRail}>
              {stories.map((story) => (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyItem}
                  onPress={() => navigateToRestaurant(story.restaurantId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.storyRing}>
                    <Image source={{ uri: story.image }} style={styles.storyImage} />
                    {story.isLive && (
                      <View style={styles.liveDot}>
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>{story.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader
            title="Featured today"
            subtitle="Popular dishes and new deals"
            action={() => router.push("/(tabs)/search" as any)}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {featuredItems.length ? (
              featuredItems.slice(0, 10).map((item) => (
                <FeaturedCardWithCart
                  key={item.id}
                  item={item}
                  width={cardWidth}
                  onPress={() => router.push(`/post/${item.id}` as any)}
                  onAddToCart={handleAddToCart}
                />
              ))
            ) : (
              <Animated.View style={[styles.emptyCard, { opacity: pulseAnim }]}>
                <Ionicons name="fast-food-outline" size={34} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No featured meals yet</Text>
              </Animated.View>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Nearby restaurants"
            subtitle="A focused set of the best options near you"
            action={() => router.push("/(tabs)/search" as any)}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRail}>
            {nearbyRestaurants.length ? (
              nearbyRestaurants.map((restaurant) => (
                <NearbyRestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  width={nearbyCardWidth}
                  onPress={() => navigateToRestaurant(restaurant.id)}
                />
              ))
            ) : (
              <View style={styles.infoCard}>
                <Ionicons name="sparkles-outline" size={26} color={ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Nearby restaurants are refreshing</Text>
                  <Text style={styles.infoText}>You can still explore featured meals and recommendations below.</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {HOME_RESTAURANT_SECTIONS.map((section, index) => (
          <CuisineCarousel
            key={section.id}
            title={section.title}
            subtitle={section.subtitle}
            width={showcaseCardWidth}
            cards={CUISINE_SHOWCASES[section.id]}
            autoStartDelay={index * 2000}
            onPress={(card) =>
              router.push({
                pathname: "/(tabs)/categories/[type]",
                params: { type: categoryRouteKey(card.routeCategory) },
              } as any)
            }
          />
        ))}

        {/* Recently Viewed with Continue Shopping */}
        {recentlyViewedRestaurants.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Recently viewed" subtitle="Jump back into familiar picks" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRail}>
              {recentlyViewedRestaurants.map((restaurant) => (
                <View key={`recent-${restaurant.id}`} style={{ marginRight: 0 }}>
                  <NearbyRestaurantCard
                    restaurant={restaurant}
                    width={nearbyCardWidth}
                    onPress={() => navigateToRestaurant(restaurant.id)}
                  />
                  <TouchableOpacity
                    style={styles.continueShoppingButton}
                    onPress={() => navigateToRestaurant(restaurant.id)}
                  >
                    <Text style={styles.continueShoppingText}>Continue shopping →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {orderAgainRestaurants.length ? (
          <View style={styles.section}>
            <SectionHeader
              title="Order again"
              subtitle="Restaurants from your past deliveries"
              action={() => router.push("/(tabs)/orders" as any)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRail}>
              {orderAgainRestaurants.map((restaurant) => (
                <View key={`again-${restaurant.id}`} style={{ marginRight: 6 }}>
                  <NearbyRestaurantCard
                    restaurant={restaurant}
                    width={nearbyCardWidth}
                    onPress={() => navigateToRestaurant(restaurant.id)}
                  />
                  {/* {user?.id && <ReorderButton restaurantId={restaurant.id} userId={user.id} />} */}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Top rated near you"
            subtitle="Highly rated spots in your area"
            action={() => router.push("/(tabs)/search" as any)}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRail}>
            {nearbyRestaurants.slice(0, 6).map((restaurant) => (
              <NearbyRestaurantCard
                key={`top-${restaurant.id}`}
                restaurant={restaurant}
                width={nearbyCardWidth}
                onPress={() => navigateToRestaurant(restaurant.id)}
              />
            ))}
          </ScrollView>
        </View>
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 10, fontSize: 16, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  scrollView: { flex: 1, paddingTop: 12 },
  content: { paddingBottom: 118 },
  topBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  locationBar: { flex: 1, minHeight: 40, borderRadius: 32, backgroundColor: "#FFFFFF", borderWidth: 0.8, borderColor: "#02020313", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  locationIcon: { width: 34, height: 34, borderRadius: 18, backgroundColor: "#fff1ede9", alignItems: "center", justifyContent: "center" },
  locationTextWrap: { flex: 1, minWidth: 0 },
  locationLabel: { fontSize: 11.2, fontFamily: "Inter", fontWeight: "600", color: "#6B7280", letterSpacing: 0.4 },
  locationText: { marginTop: 0, fontSize: 12.5, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  greetingRow: { paddingHorizontal: 15, paddingTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: ACCENT, textTransform: "uppercase" },
  greetingText: { marginTop: 3, fontSize: 16.2, lineHeight: 20, fontFamily: "Inter", fontWeight: "700", color: "#111827", maxWidth: 280, letterSpacing: 0.3 },
  cartButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 0.6, borderColor: "#f0f0f037", alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -5, right: -5, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  cartBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter", fontWeight: "600" },
  bannerRail: { paddingHorizontal: 12, paddingTop: 16, gap: 12 },
  bannerCard: { height: 176, borderRadius: 8, overflow: "hidden", marginRight: 12, backgroundColor: "#F8FAFC" },
  bannerImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  bannerContent: { flex: 1, padding: 14, justifyContent: "flex-end", bottom: 20 },
  bannerTitle: { maxWidth: 250, fontSize: 16, fontFamily: "Inter", fontWeight: "700", color: "#ffffffe5", letterSpacing: 0.3 },
  bannerSubtitle: { maxWidth: 265, marginTop: 6, fontSize: 12.8, lineHeight: 14, fontFamily: "Inter", fontWeight: "700", color: "#E5E7EB" },
  bannerButton: { alignSelf: "flex-start", marginTop: 0, height: 30, paddingHorizontal: 8, borderRadius: 30, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 6 },
  bannerButtonText: { color: "#111827", fontSize: 11.5, fontFamily: "Inter", fontWeight: "400" },
  section: { marginTop: 22 },
  sectionHeader: { paddingHorizontal: 12, marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  sectionText: { flex: 1 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitleIcon: { width: 22, height: 22, borderRadius: 18, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15.5, fontFamily: "Inter", fontWeight: "700", color: "#111827", letterSpacing: 0.4 },
  sectionSubtitle: { marginTop: 3, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  sectionAction: { height: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  sectionActionText: { color: ACCENT, fontSize: 12, fontFamily: "Inter", fontWeight: "500" },
  horizontalRail: { paddingHorizontal: 12, gap: 10 },
  topPicksRail: { paddingHorizontal: 12, gap: 10 },
  topPickCard: { width: 230, height: 150, borderRadius: 8, overflow: "hidden", backgroundColor: "#111827", marginRight: 4 },
  topPickImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  topPickOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.34)" },
  topPickBadge: { position: "absolute", top: 10, left: 10, height: 28, paddingHorizontal: 9, borderRadius: 8, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 4 },
  topPickBadgeText: { fontSize: 11, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  topPickBody: { position: "absolute", left: 12, right: 12, bottom: 12 },
  topPickName: { fontSize: 17, fontFamily: "Inter", fontWeight: "800", color: "#FFFFFF" },
  topPickMeta: { marginTop: 5, fontSize: 12, fontFamily: "Inter", fontWeight: "600", color: "#F3F4F6" },
  recommendedRail: { paddingHorizontal: 10, gap: 10 },
  recommendedCard: { width: 160, borderRadius: 10, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 0.6, borderColor: "#e5e7eb64", marginRight: 0 },
  recommendedImage: { width: "100%", height: 114, backgroundColor: "#E5E7EB" },
  recommendedBody: { minHeight: 86, padding: 8 },
  recommendedTitle: { minHeight: 12, fontSize: 13.5, lineHeight: 18, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  recommendedRestaurant: { marginTop: 2, fontSize: 11.5, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  recommendedFooter: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recommendedPrice: { flex: 1, fontSize: 13, fontFamily: "Inter", fontWeight: "800", color: ACCENT, fontVariant: ["tabular-nums"] },
  recommendedRating: { height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 3 },
  recommendedRatingText: { fontSize: 10.5, fontFamily: "Inter", fontWeight: "700", color: "#92400E" },
  categoryChip: { width: 82, alignItems: "center", gap: 7 },
  categoryImage: { width: 66, height: 66, borderRadius: 12, backgroundColor: "#E5E7EB" },
  categoryTitle: { fontSize: 11, fontFamily: "Inter", fontWeight: "400", color: "#111827", textAlign: "center" },
  featuredCard: { borderRadius: 8, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7ebc1", marginRight: 0 },
  featuredImage: { height: 162, width: "100%", backgroundColor: "#E5E7EB" },
  discountBadge: { position: "absolute", top: 10, left: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: ACCENT },
  discountText: { color: "#FFFFFF", fontSize: 11, fontFamily: "Inter", fontWeight: "600" },
  featuredBody: { padding: 12 },
  featuredTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  featuredRestaurant: { marginTop: 4, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  featuredFooter: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  ratingPill: { height: 26, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#92400E" },
  priceRow: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 7 },
  oldPrice: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#9CA3AF", textDecorationLine: "line-through" },
  priceText: { fontSize: 14, fontFamily: "Inter", fontWeight: "800", color: ACCENT, fontVariant: ["tabular-nums"] },
  addToCartButton: { position: "absolute", bottom: 12, right: 12, backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4 },
  addToCartText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  restaurantList: { paddingHorizontal: 15, gap: 12 },
  nearbyRail: { paddingHorizontal: 12, gap: 12 },
  nearbyRestaurantCard: { borderRadius: 8, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 0.7, borderColor: "#E5E7EB", marginRight: 0 },
  nearbyRestaurantImage: { width: "100%", height: 132, backgroundColor: "#E5E7EB" },
  nearbyRestaurantBody: { padding: 12 },
  nearbyRestaurantName: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  nearbyRestaurantCuisine: { marginTop: 3, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  nearbyRestaurantMeta: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  timePill: { height: 26, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "#F3F4F6", flexDirection: "row", alignItems: "center", gap: 4 },
  timePillText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#4B5563" },
  restaurantCard: { minHeight: 112, borderRadius: 8, padding: 11, backgroundColor: "#FFFFFF", borderWidth: 0.2, borderColor: "#11182748", flexDirection: "row", gap: 12 },
  restaurantImage: { width: 92, height: 90, borderRadius: 8, backgroundColor: "#E5E7EB" },
  restaurantBody: { flex: 1, minWidth: 0, justifyContent: "center" },
  restaurantTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  restaurantName: { flex: 1, fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  restaurantCuisine: { marginTop: 4, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  restaurantMeta: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  metaText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  showcaseRail: { paddingHorizontal: 12, paddingBottom: 4 },
  showcaseAnimatedCard: { marginRight: 12 },
  showcaseCard: { height: 196, borderRadius: 8, overflow: "hidden", backgroundColor: "#111827" },
  showcaseImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  showcaseGradient: { ...StyleSheet.absoluteFillObject },
  showcaseBadge: { position: "absolute", top: 12, left: 12, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.92)" },
  showcaseBadgeText: { fontSize: 11, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  showcaseCopy: { position: "absolute", left: 16, right: 16, bottom: 16 },
  showcaseTitle: { fontSize: 16, lineHeight: 24, fontFamily: "Inter", fontWeight: "600", color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  showcaseSubtitle: { marginTop: 5, fontSize: 13, lineHeight: 18, fontFamily: "Inter", fontWeight: "500", color: "#F8FAFC", textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  carouselDots: { marginTop: 8, paddingHorizontal: 12, flexDirection: "row", gap: 6 },
  carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  carouselDotActive: { width: 18, backgroundColor: ACCENT },
  emptyCard: { width: 260, height: 164, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 0.6, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  infoCard: { minHeight: 86, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  infoTitle: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827" },
  infoText: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  storiesSection: { marginTop: 20, paddingHorizontal: 0 },
  storiesRail: { gap: 13, paddingHorizontal: 12 },
  storyItem: { alignItems: "center", width: 70 },
  storyRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: ACCENT, padding: 2, position: "relative" },
  storyImage: { width: "100%", height: "100%", borderRadius: 30 },
  liveDot: { position: "absolute", bottom: -2, right: -2, backgroundColor: "#EF4444", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  liveText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  storyName: { marginTop: 6, fontSize: 12, fontWeight: "500", color: "#374151", textAlign: "center" },
  reorderButton: { marginTop: 8, backgroundColor: "#FFF1ED", paddingVertical: 6, borderRadius: 20, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  reorderButtonText: { color: ACCENT, fontSize: 12, fontWeight: "600" },
  continueShoppingButton: { marginTop: 6, backgroundColor: "#F3F4F6", paddingVertical: 6, borderRadius: 18, alignItems: "center" },
  continueShoppingText: { color: "#4B5563", fontSize: 12, fontWeight: "500" },
  refreshSpinner: { alignSelf: "center", marginTop: 10, marginBottom: 5, width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  flyingCartItem: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5, zIndex: 1000 },
});
