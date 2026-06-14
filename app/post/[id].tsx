import { logger } from "@/backend/utils/logger";
// app/post/[id]
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { DELIVERY_MIN_FEE_UGX } from "@/backend/utils/deliveryPricing";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id, distance } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [region, setRegion] = useState<any>(null);
  const [estimatedDelivery, setEstimatedDelivery] =
    useState<string>("25-35 min");
  const [newComment, setNewComment] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<{ [key: string]: boolean }>(
    {},
  );
  // New state for real suggestions from posts table
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);

  // Memoized post ID
  const postId = useMemo(() => id as string, [id]);

  // Fetch suggestions from posts table
  const fetchSuggestions = useCallback(async () => {
    if (!post?.restaurant_id) return;

    try {
      // Fetch other posts from the same restaurant (excluding current post)
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          restaurants:restaurants!posts_restaurant_id_fkey (
            id,
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            delivery_fee,
            image_url
          )
        `,
        )
        .eq("restaurant_id", post.restaurant_id)
        .neq("id", postId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  }, [post?.restaurant_id, postId]);

  // Fetch deals from posts table (posts with discount)
  const fetchDeals = useCallback(async () => {
    try {
      // Fetch posts with discounts from any restaurant
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          restaurants:restaurants!posts_restaurant_id_fkey (
            id,
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            delivery_fee,
            image_url
          )
        `,
        )
        .gt("discount_percentage", 0)
        .neq("id", postId)
        .order("discount_percentage", { ascending: false })
        .limit(10);

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error("Error fetching deals:", error);
    }
  }, [postId]);

  // Optimized fetch function with all original features
  const fetchAllData = useCallback(async () => {
    if (!postId) return;

    try {
      setLoading(true);

      // Fetch the post first, then fetch restaurant separately.
      // This avoids Supabase relationship ambiguity after adding restaurants.owner_id.
      const { data: rawPostData, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) throw postError;

      let postData: any = rawPostData;

      if (rawPostData?.restaurant_id) {
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select(
            `
            *,
            users:users!restaurants_id_fkey (
              full_name,
              profile_image_url,
              email,
              phone
            )
          `,
          )
          .eq("id", rawPostData.restaurant_id)
          .maybeSingle();

        if (restaurantError) throw restaurantError;

        postData = {
          ...rawPostData,
          restaurants: restaurantData || null,
        };
      }

      // Check if user liked this post
      let userLiked = false;
      if (user?.id) {
        const { data: likeData } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        userLiked = !!likeData;
      }

      // Check if bookmarked
      let isBookmarked = false;
      if (user?.id && postData?.restaurant_id) {
        const { data: bookmarkData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("restaurant_id", postData.restaurant_id)
          .maybeSingle();
        isBookmarked = !!bookmarkData;
      }

      // Fetch comments with user data
      const { data: commentsData } = await supabase
        .from("post_comments")
        .select(
          `
        *,
        users (
          full_name,
          profile_image_url
        )
      `,
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Check which comments user liked
      const commentLikesMap: { [key: string]: boolean } = {};
      if (user?.id && commentsData) {
        const commentIds = commentsData.map((c) => c.id);
        const { data: userCommentLikes } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .in("comment_id", commentIds)
          .eq("user_id", user.id);

        if (userCommentLikes) {
          userCommentLikes.forEach((like) => {
            commentLikesMap[like.comment_id] = true;
          });
        }
      }

      // Increment view count - Use the correct function
      try {
        await supabase.rpc("increment_post_view_fast", {
          post_id_param: postId,
        });

        // Update the local post data
        postData.view_count = (postData.view_count || 0) + 1;
      } catch (e) {
        logger.debug("Error incrementing view:", e);
        // Fallback: manually update view count
        try {
          await supabase
            .from("posts")
            .update({
              view_count: (postData.view_count || 0) + 1,
            })
            .eq("id", postId);

          postData.view_count = (postData.view_count || 0) + 1;
        } catch (updateError) {
          logger.debug("Fallback view increment failed:", updateError);
        }
      }

      // Calculate delivery time
      if (distance) {
        const dist = parseFloat(distance.toString());
        if (dist < 1) setEstimatedDelivery("15-25 min");
        else if (dist < 3) setEstimatedDelivery("25-35 min");
        else if (dist < 5) setEstimatedDelivery("35-45 min");
        else if (dist < 10) setEstimatedDelivery("45-60 min");
        else setEstimatedDelivery("60+ min");
      }

      // Setup map region
      if (postData?.restaurants?.latitude && postData?.restaurants?.longitude) {
        setRegion({
          latitude: parseFloat(postData.restaurants.latitude),
          longitude: parseFloat(postData.restaurants.longitude),
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // Set all states
      setPost(postData);
      setLiked(userLiked);
      setBookmarked(isBookmarked);
      setComments(commentsData || []);
      setCommentLikes(commentLikesMap);
    } catch (error) {
      console.error("Error fetching post:", error);
      Alert.alert("Error", "Failed to load post details");
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id, distance]);

  // Initial load
  useEffect(() => {
    if (postId) {
      fetchAllData();
    }
  }, [postId, fetchAllData]);

  // Fetch suggestions and deals after post is loaded
  useEffect(() => {
    if (post) {
      fetchSuggestions();
      fetchDeals();
    }
  }, [post, fetchSuggestions, fetchDeals]);

  // Like handler - Optimistic update
  const handleLike = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to like posts");
      router.push("/(auth)/signin");
      return;
    }

    const newLiked = !liked;

    // Optimistic update
    setLiked(newLiked);
    setPost((prev: any) => ({
      ...prev,
      likes_count: newLiked
        ? (prev.likes_count || 0) + 1
        : Math.max(0, (prev.likes_count || 1) - 1),
    }));

    try {
      // Use the database function to toggle like and update count
      const { data, error } = await supabase.rpc("toggle_post_like", {
        post_id_param: postId,
        user_id_param: user.id,
      });

      if (error) throw error;

      // Update with actual count from database
      if (data) {
        setPost((prev: any) => ({
          ...prev,
          likes_count: data.likes_count,
        }));
      }
    } catch (error) {
      // Revert on error
      setLiked(!newLiked);
      setPost((prev: any) => ({
        ...prev,
        likes_count: !newLiked
          ? (prev.likes_count || 0) + 1
          : Math.max(0, (prev.likes_count || 1) - 1),
      }));
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update like");
    }
  }, [postId, user?.id, router, liked]);

  // Comment like handler - Optimistic update
  const handleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user?.id) {
        Alert.alert("Login Required", "Please login to like comments");
        router.push("/(auth)/signin");
        return;
      }

      const newLiked = !commentLikes[commentId];

      // Optimistic update
      setCommentLikes((prev) => ({
        ...prev,
        [commentId]: newLiked,
      }));

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
              ...comment,
              likes_count: newLiked
                ? (comment.likes_count || 0) + 1
                : Math.max(0, (comment.likes_count || 1) - 1),
            }
            : comment,
        ),
      );

      try {
        // Use the database function
        const { data, error } = await supabase.rpc("toggle_comment_like", {
          comment_id_param: commentId,
          user_id_param: user.id,
        });

        if (error) throw error;

        // Update with actual count from database
        if (data) {
          setComments((prev) =>
            prev.map((comment) =>
              comment.id === commentId
                ? {
                  ...comment,
                  likes_count: data.likes_count,
                }
                : comment,
            ),
          );
        }
      } catch (error) {
        // Revert on error
        setCommentLikes((prev) => ({
          ...prev,
          [commentId]: !newLiked,
        }));
        console.error("Error toggling comment like:", error);
        Alert.alert("Error", "Failed to update comment like");
      }
    },
    [user?.id, router, commentLikes],
  );

  // Add comment handler - Optimistic update
  const handleAddComment = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to comment");
      router.push("/(auth)/signin");
      return;
    }

    if (!newComment.trim()) {
      Alert.alert("Error", "Please enter a comment");
      return;
    }

    try {
      setCommenting(true);

      // Create optimistic comment
      const optimisticComment = {
        id: `temp_${Date.now()}`,
        post_id: postId,
        user_id: user.id,
        comment: newComment.trim(),
        created_at: new Date().toISOString(),
        likes_count: 0,
        users: {
          full_name: user.full_name || "User",
          profile_image_url: user.profile_image_url || null,
        },
      };

      // Update local state immediately
      setComments((prev) => [optimisticComment as any, ...prev]);
      setPost((prev: any) => ({
        ...prev,
        comments_count: (prev.comments_count || 0) + 1,
      }));

      const commentText = newComment.trim();
      setNewComment("");
      setShowAllComments(true);

      // Save in background
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          comment: commentText,
        })
        .select("*, users(full_name, profile_image_url)")
        .single();

      if (error) throw error;

      // Replace optimistic comment with real data
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === optimisticComment.id ? data : comment,
        ),
      );

      // IMPORTANT: Update the post's comments_count in the posts table
      await supabase
        .from("posts")
        .update({
          comments_count: (post.comments_count || 0) + 1,
        })
        .eq("id", postId);
    } catch (error) {
      // Remove optimistic comment on error
      setComments((prev) =>
        prev.filter((comment) => !comment.id?.startsWith("temp_")),
      );
      setPost((prev: any) => ({
        ...prev,
        comments_count: Math.max(0, (prev.comments_count || 1) - 1),
      }));
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    } finally {
      setCommenting(false);
    }
  }, [postId, user, newComment, router, post]);

  // Add to cart handler - Optimistic update
  const handleAddToCart = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to add items to cart");
      router.push("/(auth)/signin");
      return;
    }

    if (!post) return;

    try {
      setAddingToCart(true);

      // Check for existing cart - use user_id instead of customer_id
      const { data: existingCart, error: cartError } = await supabase
        .from("carts")
        .select("id, restaurant_id")
        .eq("user_id", user.id) // Changed from customer_id to user_id
        .eq("status", "active")
        .maybeSingle();

      let cartId = existingCart?.id;
      let cartRestaurantId = existingCart?.restaurant_id;

      // Check if cart already has items from a different restaurant
      if (
        cartId &&
        cartRestaurantId &&
        cartRestaurantId !== post.restaurant_id
      ) {
        Alert.alert(
          "Different Restaurant",
          "Your cart contains items from a different restaurant. Would you like to clear your cart and add this item?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear & Add",
              onPress: async () => {
                // Clear existing cart items
                await supabase
                  .from("cart_items")
                  .delete()
                  .eq("cart_id", cartId);

                // Update cart restaurant
                await supabase
                  .from("carts")
                  .update({ restaurant_id: post.restaurant_id })
                  .eq("id", cartId);

                // Add new item
                await addItemToCart(cartId);
              },
            },
          ],
        );
        return;
      }

      // With this:
      if (!cartId) {
        // First check if there's already an active cart for this restaurant
        const { data: existingCart } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", user.id)
          .eq("restaurant_id", post.restaurant_id)
          .eq("status", "active")
          .maybeSingle();

        if (existingCart) {
          cartId = existingCart.id;
        } else {
          // Create new cart only if none exists
          const { data: newCart, error: createError } = await supabase
            .from("carts")
            .insert({
              user_id: user.id,
              restaurant_id: post.restaurant_id,
              status: "active",
            })
            .select("id")
            .maybeSingle(); // Use maybeSingle() instead of single()

          if (createError) throw createError;
          cartId = newCart?.id;
        }
      }

      if (!cartId) throw new Error("Failed to get cart ID");

      // Add item to cart
      await addItemToCart(cartId);
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Failed to add item to cart");
    } finally {
      setAddingToCart(false);
    }

    // Helper function to add item to cart
    async function addItemToCart(cartId: string) {
      const price = post.discounted_price || post.original_price || 0;

      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("post_id", post.id)
        .maybeSingle();

      if (existingItem) {
        // Update quantity if item exists
        const { error } = await supabase
          .from("cart_items")
          .update({
            quantity: existingItem.quantity + quantity,
            total_price: price * (existingItem.quantity + quantity),
          })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        // Add new item
        const { error } = await supabase.from("cart_items").insert({
          cart_id: cartId,
          post_id: post.id,
          quantity: quantity,
          unit_price: price,
          total_price: price * quantity,
        });

        if (error) throw error;
      }

      Alert.alert(
        "Added to Cart",
        `${quantity} × ${post.title} has been added to your cart`,
        [
          { text: "Continue Shopping", style: "cancel" },
          { text: "View Cart", onPress: () => router.push("/cart") },
        ],
      );

      // Reset quantity after successful add
      setQuantity(1);
    }
  }, [post, user?.id, router, quantity]);

  // Memoized format date function
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diff / (1000 * 60));
      const diffHours = Math.floor(diff / (1000 * 60 * 60));
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  }, []);

  // Memoized displayed comments
  const displayedComments = useMemo(
    () => (showAllComments ? comments : comments.slice(0, 2)),
    [showAllComments, comments],
  );

  // Loading state - Keeping original design
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContent}>
          <View style={styles.loadingAnimation}>
            <Ionicons name="fast-food" size={40} color="#FF6B35" />
          </View>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - Keeping original design
  if (!post) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
          <Text style={styles.errorText}>Post not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header - Keeping original design */}
      <SafeAreaView style={styles.headerContainer} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {post.restaurants?.restaurant_name || "Restaurant"}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setBookmarked(!bookmarked)}
            >
              <Ionicons
                name={bookmarked ? "bookmark" : "bookmark-outline"}
                size={20}
                color={bookmarked ? "#FF6B35" : "#111827"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="share-outline" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image - Keeping all badges */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri:
                post.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop",
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay}>
            <View style={styles.postTypeBadge}>
              <Ionicons
                name={
                  post.post_type === "promotion"
                    ? "flash"
                    : post.post_type === "event"
                      ? "calendar"
                      : post.post_type === "announcement"
                        ? "megaphone"
                        : "restaurant"
                }
                size={12}
                color="#fff"
              />
              <Text style={styles.postTypeText}>
                {post.post_type === "promotion"
                  ? "Promotion"
                  : post.post_type === "event"
                    ? "Event"
                    : post.post_type === "announcement"
                      ? "Announcement"
                      : "Special Offer"}
              </Text>
            </View>
            {Number(post.discount_percentage || 0) > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  {Number(post.discount_percentage).toFixed(0)}% OFF
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Main Content - Keeping all original sections */}
        <View style={styles.mainContent}>
          {/* Title and Price - Original layout */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{post.title}</Text>
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>
                  {formatMoney(post.discounted_price || post.original_price || 0)}
                </Text>
              </View>
            </View>
            {post.description && (
              <Text style={styles.description}>{post.description}</Text>
            )}

            <View style={styles.quickInfo}>
              <View style={styles.quickInfoItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.quickInfoText}>{estimatedDelivery}</Text>
              </View>
              {distance && (
                <View style={styles.quickInfoItem}>
                  <Ionicons name="location-outline" size={14} color="#6B7280" />
                  <Text style={styles.quickInfoText}>{distance} away</Text>
                </View>
              )}
              <View style={styles.quickInfoItem}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.quickInfoText}>
                  {normalizeRating(post.restaurants?.restaurant_rating).toFixed(1)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.engagementButton, liked && styles.likedButton]}
                onPress={handleLike}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={14}
                  color={liked ? "#EF4444" : "#6B7280"}
                />
                <Text
                  style={[styles.engagementText, liked && styles.likedText]}
                >
                  {post.likes_count || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.engagementButton}>
                <Ionicons name="eye-outline" size={14} color="#6B7280" />
                <Text style={styles.engagementText}>
                  {post.view_count > 1000
                    ? `${(post.view_count / 1000).toFixed(1)}k`
                    : post.view_count || 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Restaurant Info - Original design */}
          {post.restaurants && (
            <View style={styles.restaurantSection}>
              <Text style={styles.sectionLabel}>About the Restaurant</Text>
              <TouchableOpacity
                style={styles.restaurantCard}
                onPress={() =>
                  router.push(
                    `(tabs)/profiles/restaurant-profile/${post.restaurant_id}` as any,
                  )
                }
              >
                <View style={styles.restaurantHeader}>
                  {post.restaurants?.image_url ? (
                    <Image
                      source={{ uri: post.restaurants.image_url }}
                      style={styles.restaurantAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.restaurantAvatarDefault}>
                      <Text style={styles.restaurantAvatarText}>
                        {post.restaurants?.restaurant_name?.charAt(0) || "R"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.restaurantInfo}>
                    <Text style={styles.restaurantName}>
                      {post.restaurants?.restaurant_name || "Restaurant"}
                    </Text>
                    <Text style={styles.restaurantCuisine}>
                      {post.restaurants?.cuisine_type || "Various Cuisine"}
                    </Text>
                    <View style={styles.restaurantRating}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.restaurantRatingText}>
                        {normalizeRating(post.restaurants?.restaurant_rating).toFixed(1)}
                        <Text style={styles.ratingCount}>
                          {" "}
                          ({post.restaurants?.total_reviews || 0})
                        </Text>
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
                <View style={styles.restaurantStats}>
                  <View style={styles.restaurantStat}>
                    <Ionicons name="fast-food" size={14} color="#6B7280" />
                    <Text style={styles.restaurantStatText}>
                      {post.restaurants?.total_orders?.toLocaleString() || "0"}{" "}
                      orders
                    </Text>
                  </View>
                  <View style={styles.restaurantStat}>
                    <Ionicons name="bicycle" size={14} color="#6B7280" />
                    <Text style={styles.restaurantStatText}>
                      From {formatMoney(DELIVERY_MIN_FEE_UGX)} delivery
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Real Suggestions from Posts Table - Replaces TEST_SUGGESTIONS */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.sectionLabel}>You Might Also Like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestionsScrollView}
              >
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={styles.suggestionCard}
                    onPress={() => {
                      router.push(
                        `/post/${suggestion.id}?distance=${distance || 0}`,
                      );
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          suggestion.image_url ||
                          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
                      }}
                      style={styles.suggestionImage}
                    />
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {suggestion.title}
                      </Text>
                      <Text
                        style={styles.suggestionRestaurant}
                        numberOfLines={1}
                      >
                        {suggestion.restaurants?.restaurant_name ||
                          "Restaurant"}
                      </Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.currentPrice}>
                          {formatMoney(
                            suggestion.discounted_price ||
                            suggestion.original_price ||
                            0,
                          )}
                        </Text>
                        {suggestion.original_price &&
                          suggestion.discounted_price && (
                            <Text style={styles.originalPrice}>
                              {formatMoney(suggestion.original_price)}
                            </Text>
                          )}
                      </View>
                      {Number(suggestion.discount_percentage || 0) > 0 && (
                        <View style={styles.suggestionDiscountBadge}>
                          <Text style={styles.suggestionDiscountText}>
                            {suggestion.discount_percentage}% OFF
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Real Deals from Posts Table - Replaces TEST_DEALS */}
          {deals.length > 0 && (
            <View style={styles.dealsSection}>
              <Text style={styles.sectionLabel}>Special Deals & Offers</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dealsScrollView}
              >
                {deals.map((deal) => (
                  <TouchableOpacity
                    key={deal.id}
                    style={styles.dealCard}
                    onPress={() => {
                      router.push(`/post/${deal.id}?distance=${distance || 0}`);
                    }}
                  >
                    <View style={styles.dealImageContainer}>
                      <Image
                        source={{
                          uri:
                            deal.image_url ||
                            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
                        }}
                        style={styles.dealImage}
                      />
                      {deal.post_type && (
                        <View style={styles.dealTag}>
                          <Text style={styles.dealTagText}>
                            {deal.post_type === "promotion"
                              ? "Promo"
                              : deal.post_type === "event"
                                ? "Event"
                                : "Deal"}
                          </Text>
                        </View>
                      )}
                      {Number(deal.discount_percentage || 0) > 0 && (
                        <View style={styles.dealDiscountBadge}>
                          <Text style={styles.dealDiscountText}>
                            {deal.discount_percentage}% OFF
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.dealInfo}>
                      <Text style={styles.dealTitle} numberOfLines={1}>
                        {deal.title}
                      </Text>
                      <Text style={styles.dealDescription} numberOfLines={2}>
                        {deal.description || "Special offer available now"}
                      </Text>
                      <Text style={styles.dealRestaurant} numberOfLines={1}>
                        {deal.restaurants?.restaurant_name || "Restaurant"}
                      </Text>
                      <View style={styles.dealPriceContainer}>
                        <Text style={styles.dealCurrentPrice}>
                          {formatMoney(
                            deal.discounted_price || deal.original_price || 0,
                          )}
                        </Text>
                        {deal.original_price && deal.discounted_price && (
                          <Text style={styles.dealOriginalPrice}>
                            {formatMoney(deal.original_price)}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity style={styles.dealButton}>
                        <Text style={styles.dealButtonText}>View Deal</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Location Map - Original design */}
          {region && post.restaurants?.address && (
            <View style={styles.locationSection}>
              <Text style={styles.sectionLabel}>Location</Text>
              <View style={styles.mapContainer}>
                <LazyMapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={region}
                  showsUserLocation={true}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                >
                  <LazyMarker
                    coordinate={{
                      latitude: region.latitude,
                      longitude: region.longitude,
                    }}
                  >
                    <View style={styles.mapMarker}>
                      <Ionicons name="restaurant" size={20} color="#FF6B35" />
                    </View>
                  </LazyMarker>
                </LazyMapView>
                <View style={styles.mapFooter}>
                  <View style={styles.mapAddressContainer}>
                    <Ionicons name="location" size={14} color="#6B7280" />
                    <Text style={styles.mapAddress} numberOfLines={2}>
                      {post.restaurants?.address}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.directionsButton}>
                    <Ionicons name="navigate" size={16} color="#FF6B35" />
                    <Text style={styles.directionsText}>Directions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Comments Section - Original design */}
          <View style={styles.commentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                Comments ({comments.length})
              </Text>
              {comments.length > 2 && !showAllComments && (
                <TouchableOpacity onPress={() => setShowAllComments(true)}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Add Comment - Original design */}
            <View style={styles.addCommentContainer}>
              {user?.profile_image_url ? (
                <Image
                  source={{ uri: user.profile_image_url }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.userAvatarDefault}>
                  <Ionicons name="person" size={16} color="#6B7280" />
                </View>
              )}
              <View style={styles.commentInputWrapper}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#9CA3AF"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                />
                {newComment.trim().length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.commentSubmitButton,
                      commenting && styles.commentSubmitButtonDisabled,
                    ]}
                    onPress={handleAddComment}
                    disabled={commenting}
                  >
                    <Ionicons
                      name={commenting ? "time-outline" : "send"}
                      size={16}
                      color={commenting ? "#9CA3AF" : "#FF6B35"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Comments List - Original design */}
            {displayedComments.length > 0 ? (
              <View style={styles.commentsList}>
                {displayedComments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    {comment.users?.profile_image_url ? (
                      <Image
                        source={{ uri: comment.users.profile_image_url }}
                        style={styles.commenterAvatar}
                      />
                    ) : (
                      <View style={styles.commenterAvatarDefault}>
                        <Text style={styles.commenterAvatarText}>
                          {comment.users?.full_name?.charAt(0) || "U"}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commenterName}>
                          {comment.users?.full_name}
                        </Text>
                        <Text style={styles.commentTime}>
                          {formatDate(comment.created_at)}
                        </Text>
                      </View>
                      <Text style={styles.commentText}>{comment.comment}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          style={styles.commentAction}
                          onPress={() => handleCommentLike(comment.id)}
                        >
                          <Ionicons
                            name={
                              commentLikes[comment.id]
                                ? "heart"
                                : "heart-outline"
                            }
                            size={12}
                            color={
                              commentLikes[comment.id] ? "#EF4444" : "#6B7280"
                            }
                          />
                          <Text style={styles.commentActionText}>
                            {comment.likes_count || 0}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.commentAction}>
                          <Text style={styles.commentActionText}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noComments}>
                <Ionicons name="chatbubble-outline" size={32} color="#D1D5DB" />
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSubtext}>
                  Be the first to comment on this post
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Action Bar - Original design */}
      <SafeAreaView style={styles.actionBarContainer} edges={["bottom"]}>
        <View style={styles.actionBar}>
          <View style={styles.actionBarLeft}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={26}
                color={liked ? "#EF4444" : "#6B7280"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.actionBarRight}>
            {/* Quantity Selector */}
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={16} color="#FF6B35" />
              </TouchableOpacity>
              <View style={styles.quantityDisplay}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={16} color="#FF6B35" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
              disabled={addingToCart}
            >
              <Ionicons
                name={addingToCart ? "hourglass-outline" : "cart-outline"}
                size={18}
                color="#fff"
              />
              <Text style={styles.addToCartText}>
                {addingToCart ? "Adding..." : "Add to Cart"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.orderButton}
              onPress={() => {
                if (!user?.id) {
                  Alert.alert("Login Required", "Please login to place an order.");
                  router.push("/(auth)/signin" as any);
                  return;
                }

                router.push(`/order-now/${post.restaurant_id}?postId=${post.id}` as any);
              }}
            >
              <Text style={styles.orderButtonText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// Keeping ALL original styles exactly as they were, with updated names for suggestion/deal sections
// app/post/[id].tsx - Update only the styles object (component remains the same)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, backgroundColor: "#fff" },
  loadingContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingAnimation: { marginBottom: 12 },
  loadingText: { fontSize: 12, color: "#6B7280", fontFamily: "Inter", fontWeight: "500" },
  errorContainer: { flex: 1, backgroundColor: "#fff" },
  errorContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorText: { marginTop: 8, fontSize: 14, color: "#374151", fontFamily: "AlanSans", fontWeight: "600", marginBottom: 16 },
  backButton: { backgroundColor: "#FF6B35", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  backButtonText: { color: "#FFFFFF", fontSize: 12, fontFamily: "AlanSans", fontWeight: "600" },
  headerContainer: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButtonHeader: { padding: 4 },
  headerTitle: { fontSize: 14, fontFamily: "AlanSans", fontWeight: "600", color: "#111827", flex: 1, textAlign: "center", marginHorizontal: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { padding: 6 },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  heroSection: { position: "relative", height: 240 },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", padding: 16 },
  postTypeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  postTypeText: { color: "#fff", fontSize: 10, fontFamily: "AlanSans", fontWeight: "600" },
  discountBadge: { backgroundColor: "#FF6B35", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  discountText: { color: "#fff", fontSize: 10, fontFamily: "AlanSans", fontWeight: "700" },
  mainContent: { padding: 15 },
  titleSection: { marginBottom: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title: { fontSize: 18, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", flex: 1, marginRight: 12, lineHeight: 22 },
  priceBadge: { backgroundColor: "#FF6B3510", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  priceText: { fontSize: 14, fontFamily: "AlanSans", fontWeight: "700", color: "#FF6B35" },
  description: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 12, fontFamily: "Inter", fontWeight: "400" },
  quickInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  quickInfoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  quickInfoText: { fontSize: 11, color: "#6B7280", fontFamily: "Inter", fontWeight: "500" },
  sectionLabel: { fontSize: 14.5, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 12, letterSpacing: 0.3, lineHeight: 20 },
  restaurantSection: { marginBottom: 20 },
  restaurantCard: { backgroundColor: "#fff", borderRadius: 8, padding: 12, borderWidth: 0.2, borderColor: "#6b72809c" },
  restaurantHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  restaurantAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  restaurantAvatarDefault: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FF6B35", justifyContent: "center", alignItems: "center", marginRight: 12 },
  restaurantAvatarText: { color: "#fff", fontSize: 18, fontFamily: "AlanSans", fontWeight: "700" },
  restaurantInfo: { flex: 1 },
  restaurantName: { fontSize: 15, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 2 },
  restaurantCuisine: { fontSize: 12, color: "#6B7280", marginBottom: 4, fontFamily: "Inter", fontWeight: "400" },
  restaurantRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  restaurantRatingText: { fontSize: 12, fontFamily: "AlanSans", fontWeight: "600", color: "#111827" },
  ratingCount: { color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  restaurantStats: { flexDirection: "row", gap: 12 },
  restaurantStat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  restaurantStatText: { fontSize: 11, color: "#6B7280", fontFamily: "Inter", fontWeight: "500" },
  engagementButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  likedButton: { backgroundColor: "#FEE2E2" },
  engagementText: { fontSize: 11, color: "#6B7280", fontFamily: "AlanSans", fontWeight: "600" },
  likedText: { color: "#EF4444" },
  commentsSection: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAllText: { fontSize: 13, color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "600" },
  addCommentContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  userAvatarDefault: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center", marginRight: 10 },
  commentInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 0.7, borderColor: "#888", paddingHorizontal: 12, paddingVertical: 8 },
  commentInput: { flex: 1, fontSize: 13, color: "#111827", maxHeight: 80, fontFamily: "Inter", fontWeight: "400" },
  commentSubmitButton: { padding: 4 },
  commentSubmitButtonDisabled: { opacity: 0.5 },
  commentsList: { gap: 12 },
  commentItem: { flexDirection: "row", gap: 10 },
  commenterAvatar: { width: 32, height: 32, borderRadius: 16 },
  commenterAvatarDefault: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center" },
  commenterAvatarText: { fontSize: 12, color: "#6B7280", fontFamily: "AlanSans", fontWeight: "600" },
  commentContent: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: "#888" },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  commenterName: { fontSize: 13, fontFamily: "AlanSans", fontWeight: "600", color: "#111827" },
  commentTime: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter", fontWeight: "400" },
  commentText: { fontSize: 13, color: "#374151", lineHeight: 18, marginBottom: 8, fontFamily: "Inter", fontWeight: "400" },
  commentActions: { flexDirection: "row", gap: 12 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentActionText: { fontSize: 11, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  noComments: { backgroundColor: "#fff", borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  noCommentsText: { fontSize: 14, fontFamily: "AlanSans", fontWeight: "600", color: "#374151", marginTop: 8, marginBottom: 4 },
  noCommentsSubtext: { fontSize: 12, color: "#9CA3AF", textAlign: "center", fontFamily: "Inter", fontWeight: "400" },
  suggestionsSection: { marginBottom: 20 },
  suggestionsScrollView: { marginHorizontal: -12 },
  suggestionCard: { width: 140, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7ebb6", overflow: "hidden", marginHorizontal: 4, position: "relative" },
  suggestionImage: { width: "100%", height: 90 },
  suggestionInfo: { padding: 10 },
  suggestionTitle: { fontSize: 12, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 4, lineHeight: 14 },
  suggestionRestaurant: { fontSize: 11, color: "#6B7280", marginBottom: 6, fontFamily: "Inter", fontWeight: "400" },
  priceContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  currentPrice: { fontSize: 12, fontFamily: "AlanSans", fontWeight: "700", color: "#FF6B35" },
  originalPrice: { fontSize: 11, color: "#9CA3AF", textDecorationLine: "line-through", fontFamily: "Inter", fontWeight: "400" },
  suggestionDiscountBadge: { position: "absolute", top: 4, right: 4, backgroundColor: "#FF6B35", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  suggestionDiscountText: { color: "#fff", fontSize: 8, fontFamily: "AlanSans", fontWeight: "700" },
  dealsSection: { marginBottom: 20 },
  dealsScrollView: { marginHorizontal: -12 },
  dealCard: { width: 180, backgroundColor: "#fff", borderRadius: 12, borderWidth: 0.2, borderColor: "#6b72808e", overflow: "hidden", marginHorizontal: 4 },
  dealImageContainer: { position: "relative", height: 100 },
  dealImage: { width: "100%", height: "100%" },
  dealTag: { position: "absolute", top: 8, left: 8, backgroundColor: "#FF6B35", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dealTagText: { color: "#fff", fontSize: 9, fontFamily: "AlanSans", fontWeight: "700" },
  dealDiscountBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#10B981", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dealDiscountText: { color: "#fff", fontSize: 9, fontFamily: "AlanSans", fontWeight: "700" },
  dealInfo: { padding: 10 },
  dealTitle: { fontSize: 13, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 4, lineHeight: 16 },
  dealDescription: { fontSize: 11, color: "#6B7280", marginBottom: 4, lineHeight: 14, fontFamily: "Inter", fontWeight: "400" },
  dealRestaurant: { fontSize: 10, color: "#9CA3AF", marginBottom: 6, fontFamily: "Inter", fontWeight: "400" },
  dealPriceContainer: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dealCurrentPrice: { fontSize: 14, fontFamily: "AlanSans", fontWeight: "700", color: "#FF6B35" },
  dealOriginalPrice: { fontSize: 11, color: "#9CA3AF", textDecorationLine: "line-through", fontFamily: "Inter", fontWeight: "400" },
  dealButton: { backgroundColor: "#FF6B3510", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
  dealButtonText: { fontSize: 11, color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "600" },
  locationSection: { marginBottom: 20 },
  mapContainer: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  map: { height: 140 },
  mapMarker: { backgroundColor: "#fff", padding: 6, borderRadius: 16, borderWidth: 2, borderColor: "#FF6B35" },
  mapFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  mapAddressContainer: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  mapAddress: { fontSize: 11, color: "#374151", flex: 1, lineHeight: 14, fontFamily: "Inter", fontWeight: "400" },
  directionsButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FF6B3510", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  directionsText: { fontSize: 11, color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "600" },
  actionBarContainer: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB", borderRadius: 25 },
  actionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 13, paddingLeft: -13 },
  actionBarLeft: { flexDirection: "row", alignItems: "center", gap: 0 },
  actionButton: { padding: 8, left: 22 },
  actionBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 4, gap: 4 },
  quantityButton: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 0.5, borderColor: "#e5e7ebe1" },
  quantityDisplay: { width: 32, justifyContent: "center", alignItems: "center" },
  quantityText: { fontSize: 12.8, fontFamily: "AlanSans", fontWeight: "700", color: "#111827" },
  addToCartButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 12.5, borderRadius: 8, gap: 6 },
  addToCartText: { color: "#fff", fontSize: 12.5, fontFamily: "AlanSans", fontWeight: "600" },
  orderButton: { backgroundColor: "#FF6B35", paddingHorizontal: 16, paddingVertical: 12.5, borderRadius: 8, minWidth: 100, alignItems: "center" },
  orderButtonText: { color: "#fff", fontSize: 12.5, fontFamily: "AlanSans", fontWeight: "700" },
});