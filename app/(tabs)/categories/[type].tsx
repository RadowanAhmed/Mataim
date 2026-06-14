// app/(tabs)/category/[type].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX, toUGX } from "@/backend/utils/currency";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=320&h=320&fit=crop";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function normalizeCategoryParam(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const slug = decodeURIComponent(String(raw || ""))
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

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDeliveryFee(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Delivery at checkout";
  }

  const amount = toUGX(value as number | string | null);
  if (amount <= 0) return "Free";
  return `${formatUGX(amount)} delivery`;
}

function createGenericCategoryConfig(categoryKey: string): CategoryConfig {
  const title = titleFromSlug(categoryKey) || "Category";
  const spacedTerm = categoryKey.replace(/-/g, " ");
  const filters = [
    `title.ilike.%${categoryKey}%`,
    `description.ilike.%${categoryKey}%`,
    `title.ilike.%${spacedTerm}%`,
    `description.ilike.%${spacedTerm}%`,
  ].join(",");

  return {
    title,
    icon: "*",
    subtitle: `Fresh ${title.toLowerCase()} picks from nearby restaurants`,
    color: "#FF6B35",
    query: (query: any) => query.or(filters),
  };
}

// -------------------------------------------------------
// Category configs
// -------------------------------------------------------
const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  "hot-deals": {
    title: "Hot Deals",
    icon: "🔥",
    subtitle: "Best discounts available now",
    color: "#FF6B35",
    query: (query: any) =>
      query
        .eq("post_type", "promotion")
        .gt("discount_percentage", 0)
        .order("discount_percentage", { ascending: false }),
  },
  events: {
    title: "Events Near You",
    icon: "📅",
    subtitle: "Food festivals, tastings & more",
    color: "#8B5CF6",
    query: (query: any) =>
      query.eq("post_type", "event").order("created_at", { ascending: false }),
  },
  trending: {
    title: "Trending Now",
    icon: "📈",
    subtitle: "Most viewed this week",
    color: "#3B82F6",
    query: (query: any) => query.order("view_count", { ascending: false }),
  },
  popular: {
    title: "Popular This Week",
    icon: "❤️",
    subtitle: "Most liked by our community",
    color: "#EF4444",
    query: (query: any) => query.order("likes_count", { ascending: false }),
  },
  pizza: {
    title: "Pizza Specials",
    icon: "🍕",
    subtitle: "Delicious pizzas from top restaurants",
    color: "#FF6B35",
    query: (query: any) =>
      query.or("title.ilike.%pizza%,description.ilike.%pizza%"),
  },
  burgers: {
    title: "Burgers",
    icon: "B",
    subtitle: "Juicy burgers, fries, and fast favorites",
    color: "#F97316",
    query: (query: any) =>
      query.or(
        "title.ilike.%burger%,title.ilike.%burgers%,description.ilike.%burger%,description.ilike.%burgers%,description.ilike.%fries%"
      ),
  },
  chicken: {
    title: "Fried Chicken",
    icon: "🍗",
    subtitle: "Crispy, juicy, and delicious",
    color: "#F59E0B",
    query: (query: any) =>
      query.or(
        "title.ilike.%chicken%,title.ilike.%kfc%,description.ilike.%fried%,description.ilike.%chicken%"
      ),
  },
  drinks: {
    title: "Refreshing Drinks",
    icon: "🥤",
    subtitle: "Beverages to quench your thirst",
    color: "#10B981",
    query: (query: any) =>
      query.or(
        "title.ilike.%drink%,title.ilike.%juice%,title.ilike.%soda%,title.ilike.%coffee%,title.ilike.%tea%,title.ilike.%mocktail%"
      ),
  },
  desserts: {
    title: "Sweet Treats",
    icon: "🍰",
    subtitle: "Desserts & sweets",
    color: "#EC4899",
    query: (query: any) =>
      query.or(
        "title.ilike.%dessert%,title.ilike.%cake%,title.ilike.%ice cream%,title.ilike.%chocolate%,title.ilike.%sweet%"
      ),
  },
  vegan: {
    title: "Vegan & Vegetarian",
    icon: "🥗",
    subtitle: "Plant-based delicious options",
    color: "#10B981",
    query: (query: any) => query.overlaps("tags", ["Vegan", "Vegetarian"]),
  },
  halal: {
    title: "Halal Certified",
    icon: "🕌",
    subtitle: "Halal certified restaurants",
    color: "#7C3AED",
    query: (query: any) => query.contains("tags", ["Halal"]),
  },
  breakfast: {
    title: "Breakfast Specials",
    icon: "☀️",
    subtitle: "Start your day right",
    color: "#F59E0B",
    query: (query: any) => query.overlaps("tags", ["Breakfast", "Morning"]),
  },
  lunch: {
    title: "Lunch Deals",
    icon: "🍱",
    subtitle: "Perfect midday meals",
    color: "#10B981",
    query: (query: any) => query.overlaps("tags", ["Lunch", "Lunch Special"]),
  },
  dinner: {
    title: "Dinner Specials",
    icon: "🌙",
    subtitle: "Evening favorites",
    color: "#8B5CF6",
    query: (query: any) =>
      query.overlaps("tags", ["Dinner", "Dinner Special"]),
  },
  "limited-time": {
    title: "Limited Time Offers",
    icon: "⏳",
    subtitle: "Ending soon - grab them quick!",
    color: "#F59E0B",
    query: (query: any) => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      return query
        .not("available_until", "is", null)
        .lte("available_until", sevenDaysFromNow.toISOString())
        .order("available_until", { ascending: true });
    },
  },
};

const URL_TO_CONFIG: Record<string, string> = {
  "hot-deals": "hot-deals",
  events: "events",
  trending: "trending",
  popular: "popular",
  pizza: "pizza",
  pizzas: "pizza",
  burger: "burgers",
  burgers: "burgers",
  chicken: "chicken",
  beverage: "drinks",
  beverages: "drinks",
  drink: "drinks",
  drinks: "drinks",
  dessert: "desserts",
  desserts: "desserts",
  sweet: "desserts",
  sweets: "desserts",
  vegan: "vegan",
  halal: "halal",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  "limited-time": "limited-time",
};

interface CategoryConfig {
  title: string;
  icon: string;
  subtitle: string;
  color: string;
  query: (query: any) => any;
}

interface TransformedPost {
  id: string;
  title: string;
  description: string;
  image_url: string;
  discount_percentage: number;
  original_price: number;
  discounted_price: number;
  restaurant_name: string;
  restaurant_image_url: string;
  restaurant_rating: number;
  delivery_fee: number | string;
  likes_count: number;
  comments_count: number;
  post_type: string;
  available_until?: string | null;
  created_at?: string | null;
  distanceText?: string;
}

// -------------------------------------------------------
// Popular suggestions for empty state
// -------------------------------------------------------
const POPULAR_SUGGESTIONS = [
  { label: "Pizza", type: "pizza" },
  { label: "Burgers", type: "burgers" },
  { label: "Chicken", type: "chicken" },
  { label: "Drinks", type: "drinks" },
  { label: "Desserts", type: "desserts" },
  { label: "Healthy", type: "vegan" },
];

type FilterKey = "all" | "deals" | "top" | "liked";

// -------------------------------------------------------
// Skeleton Screen (unchanged)
// -------------------------------------------------------
const SkeletonScreen = ({ color }: { color: string }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  const SkeletonBlock = ({ width, height, borderRadius, style }: any) => (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius || 8,
          backgroundColor: "#E5E7EB",
          opacity,
        },
        style,
      ]}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.headerRow, { borderBottomColor: color + "20" }]}>
        <SkeletonBlock width={40} height={40} borderRadius={24} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <SkeletonBlock width="60%" height={16} borderRadius={6} />
          <SkeletonBlock width="80%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <SkeletonBlock width={40} height={40} borderRadius={24} />
      </View>
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <SkeletonBlock width={40} height={16} borderRadius={4} />
          <SkeletonBlock width={30} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.stat}>
          <SkeletonBlock width={40} height={16} borderRadius={4} />
          <SkeletonBlock width={30} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.stat}>
          <SkeletonBlock width={40} height={16} borderRadius={4} />
          <SkeletonBlock width={30} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      </View>
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={(item) => item.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <View style={styles.postCard}>
            <SkeletonBlock width="100%" height={164} borderRadius={8} />
            <View style={styles.postContent}>
              <SkeletonBlock width="70%" height={14} borderRadius={4} />
              <SkeletonBlock width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonBlock width="100%" height={16} borderRadius={4} style={{ marginTop: 10 }} />
              <SkeletonBlock width="100%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                <SkeletonBlock width={60} height={18} borderRadius={8} />
                <SkeletonBlock width={80} height={14} borderRadius={4} />
              </View>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

// -------------------------------------------------------
// Post Card Component (unchanged)
// -------------------------------------------------------
const PostCard = ({
  item,
  isLiked,
  isFavorited,
  accentColor,
  onToggleFavorite,
  onLikePost,
  router,
}: {
  item: TransformedPost;
  isLiked: boolean;
  isFavorited: boolean;
  accentColor: string;
  onToggleFavorite: (id: string) => void;
  onLikePost: (id: string) => void;
  router: any;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 200,
      bounciness: 10,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 200,
      bounciness: 10,
    }).start();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return `${Math.floor(diffMins / 1440)}d ago`;
    } catch {
      return "";
    }
  };

  const getTimeRemaining = (availableUntil: string) => {
    if (!availableUntil) return null;
    try {
      const endDate = new Date(availableUntil);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours <= 0) return "Ended";
      if (diffHours < 24) return `${diffHours}h left`;
      return `${Math.floor(diffHours / 24)}d left`;
    } catch {
      return null;
    }
  };

  const timeRemaining = getTimeRemaining(item.available_until || "");
  const formattedDate = formatDate(item.created_at || "");
  const visibleLikeCount = Math.max(Number(item.likes_count) || 0, isLiked ? 1 : 0);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={styles.postCard}
        onPress={() => router.push(`/post/${item.id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={styles.postImageContainer}>
          <Image source={{ uri: item.image_url }} style={styles.postImage} />
          {item.discount_percentage > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                {item.discount_percentage}% OFF
              </Text>
            </View>
          )}
          {item.post_type === "event" && (
            <View style={[styles.typeBadge, { backgroundColor: "#8B5CF6" }]}>
              <Text style={styles.typeBadgeText}>EVENT</Text>
            </View>
          )}
          {item.post_type === "promotion" && (
            <View style={[styles.typeBadge, { backgroundColor: "#FF6B35" }]}>
              <Text style={styles.typeBadgeText}>DEAL</Text>
            </View>
          )}
          <View style={styles.distanceBadge}>
            <Ionicons name="location" size={10} color="#FFFFFF" />
            <Text style={styles.distanceBadgeText}>{item.distanceText}</Text>
          </View>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={18}
              color={isFavorited ? "#FF6B35" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.postContent}>
          <View style={styles.restaurantHeader}>
            <View style={styles.restaurantIdentity}>
              <Image
                source={{ uri: item.restaurant_image_url || FALLBACK_RESTAURANT_IMAGE }}
                style={styles.restaurantAvatar}
              />
              <Text style={styles.restaurantName} numberOfLines={1}>
                {item.restaurant_name}
              </Text>
            </View>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>
                {item.restaurant_rating.toFixed(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.postTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.postDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.priceRow}>
            {item.discounted_price ? (
              <View style={styles.priceContainer}>
                <Text style={styles.originalPrice}>
                  {formatUGX(item.original_price)}
                </Text>
                <Text style={styles.discountedPrice}>
                  {formatUGX(item.discounted_price)}
                </Text>
              </View>
            ) : (
              <Text style={styles.price}>{formatUGX(item.original_price)}</Text>
            )}
            {item.delivery_fee === "Free" ? (
              <View style={styles.freeDeliveryBadge}>
                <Text style={styles.freeDeliveryText}>Free Delivery</Text>
              </View>
            ) : (
              <Text style={styles.deliveryFee}>{item.delivery_fee}</Text>
            )}
          </View>

          <View style={styles.postFooter}>
            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={(e) => {
                  e.stopPropagation();
                  onLikePost(item.id);
                }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={14}
                  color={isLiked ? "#EF4444" : "#6B7280"}
                />
                <Text style={[styles.statText, isLiked && styles.likedText]}>
                  {visibleLikeCount}
                </Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
                <Text style={styles.statText}>{item.comments_count}</Text>
              </View>
            </View>
            <View style={styles.timeContainer}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.timeText}>
                {timeRemaining || formattedDate}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------
export default function CategoryViewScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [posts, setPosts] = useState<TransformedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");

  // Parallax header animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_MAX_HEIGHT = 120;
  const HEADER_MIN_HEIGHT = 0;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Refresh spin animation
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const refreshSpinInterpolate = refreshSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const categoryKey = useMemo(() => normalizeCategoryParam(type), [type]);
  const categoryConfig = useMemo<CategoryConfig | null>(() => {
    if (!categoryKey) return null;
    const mappedKey = URL_TO_CONFIG[categoryKey] || categoryKey;
    return (
      CATEGORY_CONFIGS[mappedKey] || createGenericCategoryConfig(categoryKey)
    );
  }, [categoryKey]);

  const accentColor = categoryConfig?.color || "#FF6B35";

  const fetchLikedPosts = useCallback(async () => {
    if (!user?.id) {
      setLikedPosts(new Set());
      return;
    }
    try {
      const { data } = await db
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id);
      if (data) {
        setLikedPosts(new Set((data as any[]).map((like) => like.post_id)));
      }
    } catch (error) {
      console.error("Error fetching liked posts:", error);
    }
  }, [user?.id]);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites(new Set());
      return;
    }
    try {
      const { data } = await db
        .from("favorites")
        .select("post_id")
        .eq("user_id", user.id);
      if (data) {
        setFavorites(
          new Set((data as any[]).map((favorite) => favorite.post_id))
        );
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  }, [user?.id]);

  const fetchCartCount = useCallback(async () => {
    if (!user?.id) {
      setCartCount(0);
      return;
    }
    try {
      const { data: activeCart } = await db
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!activeCart?.id) {
        setCartCount(0);
        return;
      }
      const { count } = await db
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("cart_id", activeCart.id);
      setCartCount(count || 0);
    } catch (error) {
      console.error("Error fetching cart count:", error);
      setCartCount(0);
    }
  }, [user?.id]);

  const fetchPosts = useCallback(
    async (pageNum: number = 1, reset: boolean = false) => {
      if (!categoryConfig) {
        setLoading(false);
        return;
      }
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        const from = (pageNum - 1) * 10;
        const to = from + 9;
        let query = db
          .from("posts")
          .select(
            `
            id, title, description, image_url, post_type,
            discount_percentage, original_price, discounted_price,
            available_until, likes_count, comments_count, view_count, tags,
            restaurants!inner (
              restaurant_name, cuisine_type, restaurant_rating,
              delivery_fee, min_order_amount, image_url
            )
          `
          )
          .eq("is_active", true);
        query = categoryConfig.query(query);
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;

        const postRows = data || [];
        const postIds = postRows.map((post: any) => post.id).filter(Boolean);
        const liveLikeCounts = new Map<string, number>();

        if (postIds.length) {
          const { data: likeRows } = await db
            .from("post_likes")
            .select("post_id")
            .in("post_id", postIds);

          (likeRows || []).forEach((like: any) => {
            if (!like?.post_id) return;
            liveLikeCounts.set(
              like.post_id,
              (liveLikeCounts.get(like.post_id) || 0) + 1
            );
          });
        }

        const transformedPosts = postRows.map(
          (post: any, index: number) => {
            const restaurant = firstRelation<any>(post.restaurants);
            const storedLikeCount = Number(post.likes_count) || 0;
            const liveLikeCount = liveLikeCounts.get(post.id) || 0;
            return {
              id: post.id,
              title: post.title,
              description: post.description,
              image_url:
                post.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
              discount_percentage: post.discount_percentage,
              original_price: post.original_price,
              discounted_price: post.discounted_price,
              restaurant_name:
                restaurant?.restaurant_name || "Restaurant",
              restaurant_image_url:
                restaurant?.image_url || FALLBACK_RESTAURANT_IMAGE,
              restaurant_rating: normalizeRating(
                restaurant?.restaurant_rating
              ),
              delivery_fee: formatDeliveryFee(restaurant?.delivery_fee),
              likes_count: Math.max(storedLikeCount, liveLikeCount),
              comments_count: post.comments_count || 0,
              post_type: post.post_type,
              available_until: post.available_until,
              created_at: post.created_at,
              distanceText: `${(((post.id?.charCodeAt(0) || index) % 30) + 5) / 10
                }km`,
            };
          }
        );
        setPosts((prev) =>
          reset ? transformedPosts : [...prev, ...transformedPosts]
        );
        setHasMore((data?.length || 0) === 10);
        setPage(pageNum);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        if (reset) {
          refreshSpin.stopAnimation();
          refreshSpin.setValue(0);
          setRefreshing(false);
        }
      }
    },
    [categoryConfig, refreshSpin]
  );

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setLoadingMore(false);
    setSelectedFilter("all");
    if (!categoryConfig) {
      setLoading(false);
      router.back();
      return;
    }
    fetchPosts(1, true);
    fetchLikedPosts();
    fetchFavorites();
    fetchCartCount();
  }, [categoryConfig, fetchCartCount, fetchFavorites, fetchLikedPosts, fetchPosts, router]);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  const filterOptions = useMemo(
    () => [
      {
        key: "all" as const,
        label: "All",
        icon: "grid-outline",
        count: posts.length,
      },
      {
        key: "deals" as const,
        label: "Deals",
        icon: "pricetag-outline",
        count: posts.filter((post) => post.discount_percentage > 0).length,
      },
      {
        key: "top" as const,
        label: "Top",
        icon: "star-outline",
        count: posts.filter((post) => post.restaurant_rating >= 4.5).length,
      },
      {
        key: "liked" as const,
        label: "Liked",
        icon: "heart-outline",
        count: posts.filter((post) => likedPosts.has(post.id)).length,
      },
    ],
    [likedPosts, posts]
  );

  const filteredPosts = useMemo(() => {
    switch (selectedFilter) {
      case "deals":
        return posts.filter((post) => post.discount_percentage > 0);
      case "top":
        return posts.filter((post) => post.restaurant_rating >= 4.5);
      case "liked":
        return posts.filter((post) => likedPosts.has(post.id));
      default:
        return posts;
    }
  }, [likedPosts, posts, selectedFilter]);
  const activeFilterLabel =
    filterOptions.find((option) => option.key === selectedFilter)?.label || "All";

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
    fetchPosts(1, true);
    fetchLikedPosts();
    fetchFavorites();
    fetchCartCount();
  }, [fetchPosts, fetchLikedPosts, fetchFavorites, fetchCartCount, refreshSpin]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      fetchPosts(page + 1, false);
    }
  }, [hasMore, loadingMore, page, fetchPosts]);

  const handleLikePost = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const isCurrentlyLiked = likedPosts.has(postId);
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              return {
                ...post,
                likes_count: Math.max(
                  0,
                  post.likes_count + (isCurrentlyLiked ? -1 : 1)
                ),
              };
            }
            return post;
          })
        );
        setLikedPosts((prev) => {
          const newSet = new Set(prev);
          if (isCurrentlyLiked) {
            newSet.delete(postId);
          } else {
            newSet.add(postId);
          }
          return newSet;
        });
        if (isCurrentlyLiked) {
          await db
            .from("post_likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);
        } else {
          await db.from("post_likes").insert({
            post_id: postId,
            user_id: user.id,
          });
        }

        const { data: confirmedCount } = await db.rpc("get_post_likes_count", {
          post_id_param: postId,
        });
        const numericCount = Number(confirmedCount);
        if (Number.isFinite(numericCount)) {
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? { ...post, likes_count: Math.max(0, numericCount) }
                : post
            )
          );
          await db
            .from("posts")
            .update({ likes_count: Math.max(0, numericCount) })
            .eq("id", postId);
        }
      } catch (error) {
        console.error("Error liking post:", error);
      }
    },
    [user?.id, likedPosts, router]
  );

  const toggleFavorite = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const isFavorite = favorites.has(postId);
        if (isFavorite) {
          await db
            .from("favorites")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);
          setFavorites((prev) => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
        } else {
          await db.from("favorites").insert({
            post_id: postId,
            user_id: user.id,
          });
          setFavorites((prev) => new Set(prev).add(postId));
        }
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    },
    [user?.id, favorites, router]
  );

  if (loading) {
    return <SkeletonScreen color={accentColor} />;
  }

  if (!categoryConfig) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Category Not Found</Text>
          <Text style={styles.errorText}>
            The requested category does not exist
          </Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Animated Header with Gradient */}
      <Animated.View style={[styles.headerContainer, { height: headerHeight, opacity: headerOpacity }]}>
        <LinearGradient
          colors={["#FFFFFF", accentColor + "15"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {categoryConfig.title}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {categoryConfig.subtitle}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.headerCartButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/cart" as any);
              }}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Open cart"
            >
              <Ionicons name="basket-outline" size={21} color="#111827" />
              {cartCount > 0 && (
                <View
                  style={[
                    styles.headerCartBadge,
                    { backgroundColor: accentColor },
                  ]}
                >
                  <Text style={styles.headerCartBadgeText}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Filter Bar */}
          <View style={styles.statsBar}>
            {filterOptions.map((option) => {
              const isActive = selectedFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterChip,
                    isActive && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                  onPress={() => setSelectedFilter(option.key)}
                  activeOpacity={0.86}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={14}
                    color={isActive ? "#FFFFFF" : accentColor}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterChipCount,
                      isActive && styles.filterChipCountActive,
                    ]}
                  >
                    {option.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Posts List */}
      <FlatList
        data={filteredPosts}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            isLiked={likedPosts.has(item.id)}
            isFavorited={favorites.has(item.id)}
            accentColor={accentColor}
            onToggleFavorite={toggleFavorite}
            onLikePost={handleLikePost}
            router={router}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[accentColor]}
            tintColor={accentColor}
            progressViewOffset={HEADER_MAX_HEIGHT + 10}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          refreshing ? (
            <Animated.View
              style={[
                styles.refreshSpinner,
                { transform: [{ rotate: refreshSpinInterpolate }] },
              ]}
            >
              <Ionicons name="restaurant-outline" size={28} color={accentColor} />
            </Animated.View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={accentColor} />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.endMessage}>{"You've reached the end"}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color={accentColor + "60"} />
            <Text style={styles.emptyTitle}>
              {posts.length ? `No ${activeFilterLabel.toLowerCase()} items` : "Nothing here yet"}
            </Text>
            <Text style={styles.emptyText}>
              {posts.length
                ? "Try another filter or refresh for the latest picks."
                : `There are no ${categoryConfig.title.toLowerCase()} right now.`}
              {"\n"}
              You might also like:
            </Text>
            <View style={styles.emptySuggestionsRow}>
              {POPULAR_SUGGESTIONS.map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={styles.emptySuggestionChip}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/categories/[type]",
                      params: { type: item.type },
                    } as any)
                  }
                >
                  <Text style={styles.emptySuggestionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />
      <View style={{ height: 30 }} />
    </SafeAreaView>
  );
}

// -------------------------------------------------------
// Styles (updated with new additions)
// -------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerContainer: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.8,
    borderBottomColor: "#F3F4F6",
  },
  headerGradient: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minWidth: 0,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerIcon: { fontSize: 20 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 0,
    letterSpacing: 0.15,
    fontFamily: "Inter",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  headerCartButton: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#ffffff67",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.65)",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    borderTopWidth: 0.8,
    borderTopColor: "#eef2f7c2",
  },
  filterChip: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#e9f0ffc2",
    borderRadius: 16,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#374151",
    fontFamily: "Inter",
    letterSpacing: 0.1,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterChipCount: {
    minWidth: 20,
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter",
  },
  filterChipCountActive: {
    color: "#FFFFFF",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(248,250,252,0.7)",
    borderWidth: 0.8,
    borderColor: "#eef2f7b1",
    borderRadius: 8,
    paddingVertical: 6,
  },
  statValue: {
    fontSize: 15.4,
    fontWeight: "500",
    marginBottom: 2,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#6B7280",
    fontFamily: "Inter",
  },
  listContent: {
    padding: 12,
    paddingTop: 10,
    paddingBottom: 28,
  },
  postCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "#00000014",
  },
  postImageContainer: {
    position: "relative",
    height: 164,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#ff6b35eb",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  typeBadge: {
    position: "absolute",
    top: 10,
    right: 48,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  distanceBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  distanceBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 34,
    height: 34,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  postContent: {
    padding: 12,
  },
  restaurantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  restaurantIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginRight: 8,
  },
  restaurantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 0.6,
    borderColor: "#e9f0ffc2",
  },
  restaurantName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1b1b1b",
    flex: 1,
    letterSpacing: 0.2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    gap: 4,
  },
  ratingText: {
    fontSize: 11.5,
    color: "#92400E",
    fontWeight: "700",
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    letterSpacing: 0.15,
  },
  postDescription: {
    fontSize: 13.2,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  originalPrice: {
    fontSize: 14.5,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  discountedPrice: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#FF6B35",
  },
  price: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#111827",
  },
  freeDeliveryBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  freeDeliveryText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#10B981",
  },
  deliveryFee: {
    fontSize: 12.5,
    color: "#6B7280",
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 0.6,
    borderTopColor: "#00000014",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12.5,
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
  },
  likedText: { color: "#EF4444" },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 12.5,
    color: "#9CA3AF",
    letterSpacing: 0.2,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endMessage: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    paddingVertical: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  emptySuggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  emptySuggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  emptySuggestionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
    fontFamily: "Inter",
  },
  browseButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  browseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F8FAFC",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  refreshSpinner: {
    alignSelf: "center",
    marginVertical: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
