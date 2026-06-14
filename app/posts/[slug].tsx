// app/posts/[slug].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatUGX } from "@/backend/utils/currency";
import { DELIVERY_MIN_FEE_UGX } from "@/backend/utils/deliveryPricing";

function money(value: unknown) {
  const amount = Number(value || 0);
  return amount > 0 ? formatUGX(amount) : "Ask restaurant";
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [liked, setLiked] = useState(false);
  const [favorite, setFavorite] = useState(false);

  const postId = String(slug || "");

  const loadPost = useCallback(async () => {
    if (!postId) return;
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          restaurants:restaurants!posts_restaurant_id_fkey(
            id,
            restaurant_name,
            cuisine_type,
            image_url,
            restaurant_rating,
            delivery_fee,
            min_order_amount,
            address,
            latitude,
            longitude,
            opening_hours
          )
        `,
        )
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      setPost(data);

      if (user?.id && data?.id) {
        await supabase.from("post_views").upsert(
          {
            post_id: data.id,
            user_id: user.id,
            view_date: new Date().toISOString().slice(0, 10),
          },
          { onConflict: "post_id,user_id,view_date" },
        );

        const [{ data: likeData }, { data: favData }] = await Promise.all([
          supabase.from("post_likes").select("id").eq("post_id", data.id).eq("user_id", user.id).maybeSingle(),
          supabase.from("favorites").select("id").eq("post_id", data.id).eq("user_id", user.id).maybeSingle(),
        ]);
        setLiked(Boolean(likeData));
        setFavorite(Boolean(favData));
      }
    } catch (error) {
      console.error("Post detail error:", error);
      Alert.alert("Error", "Could not load this post.");
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const toggleLike = async () => {
    if (!user?.id || !post?.id) {
      Alert.alert("Login required", "Please sign in to like posts.");
      return;
    }
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      await supabase.from("posts").update({ likes_count: Math.max(Number(post.likes_count || 1) - 1, 0) }).eq("id", post.id);
      setLiked(false);
      setPost((current: any) => ({ ...current, likes_count: Math.max(Number(current.likes_count || 1) - 1, 0) }));
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      await supabase.from("posts").update({ likes_count: Number(post.likes_count || 0) + 1 }).eq("id", post.id);
      setLiked(true);
      setPost((current: any) => ({ ...current, likes_count: Number(current.likes_count || 0) + 1 }));
    }
  };

  const toggleFavorite = async () => {
    if (!user?.id || !post?.id) {
      Alert.alert("Login required", "Please sign in to save favorites.");
      return;
    }
    if (favorite) {
      await supabase.from("favorites").delete().eq("post_id", post.id).eq("user_id", user.id);
      setFavorite(false);
    } else {
      await supabase.from("favorites").insert({ post_id: post.id, user_id: user.id });
      setFavorite(true);
    }
  };

  const orderNow = () => {
    if (!post?.restaurant_id) return;
    router.push({
      pathname: "/post/[restaurantId]",
      params: { restaurantId: post.restaurant_id, postId: post.id },
    } as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="fast-food-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Post not found</Text>
        <TouchableOpacity style={styles.smallButton} onPress={() => router.back()}>
          <Text style={styles.smallButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const restaurant = post.restaurants;
  const price = post.discounted_price || post.original_price || 0;
  const hasDiscount = Number(post.discount_percentage || 0) > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: post.image_url || restaurant?.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=700&fit=crop" }}
            style={styles.heroImage}
          />
          <View style={styles.imageOverlay} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <Ionicons name={favorite ? "bookmark" : "bookmark-outline"} size={22} color={favorite ? "#FF6B35" : "#FFFFFF"} />
          </TouchableOpacity>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{Number(post.discount_percentage).toFixed(0)}% OFF</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.restaurantCard}>
            <Image source={{ uri: restaurant?.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=300&fit=crop" }} style={styles.restaurantImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName}>{restaurant?.restaurant_name || "Restaurant"}</Text>
              <Text style={styles.restaurantMeta}>{restaurant?.cuisine_type || "Food"} • ⭐ {Number(restaurant?.restaurant_rating || 0).toFixed(1)}</Text>
              <Text style={styles.restaurantAddress} numberOfLines={1}>{restaurant?.address || "Address unavailable"}</Text>
            </View>
          </View>

          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.description}>{post.description || "Fresh food and special offers from this restaurant."}</Text>

          <View style={styles.statsRow}>
            <TouchableOpacity style={[styles.statPill, liked && styles.statPillActive]} onPress={toggleLike}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={17} color={liked ? "#FFFFFF" : "#FF6B35"} />
              <Text style={[styles.statText, liked && styles.statTextActive]}>{post.likes_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.statPill}>
              <Ionicons name="chatbubble-outline" size={17} color="#FF6B35" />
              <Text style={styles.statText}>{post.comments_count || 0}</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="eye-outline" size={17} color="#FF6B35" />
              <Text style={styles.statText}>{post.view_count || 0}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Delivery</Text>
              <Text style={styles.infoValue}>From {formatUGX(DELIVERY_MIN_FEE_UGX)}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Minimum</Text>
              <Text style={styles.infoValue}>{money(restaurant?.min_order_amount || 0)}</Text>
            </View>
          </View>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Price</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(price)}</Text>
                {hasDiscount && <Text style={styles.originalPrice}>{money(post.original_price)}</Text>}
              </View>
            </View>
            <TouchableOpacity style={styles.orderButton} onPress={orderNow}>
              <Text style={styles.orderButtonText}>Order now</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontFamily: "AlanSans", fontWeight: "900", color: "#111827" },
  smallButton: { marginTop: 16, backgroundColor: "#FF6B35", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16 },
  smallButtonText: { color: "#FFFFFF", fontFamily: "AlanSans", fontWeight: "900" },
  scroll: { flex: 1 },
  imageWrap: { height: 330, backgroundColor: "#111827" },
  heroImage: { width: "100%", height: "100%" },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  backButton: { position: "absolute", top: 18, left: 16, width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  favoriteButton: { position: "absolute", top: 18, right: 16, width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  discountBadge: { position: "absolute", bottom: 18, left: 16, backgroundColor: "#FF6B35", paddingHorizontal: 12, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  discountText: { color: "#FFFFFF", fontFamily: "AlanSans", fontWeight: "900" },
  content: { marginTop: -28, backgroundColor: "#F7F7F7", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 16, paddingBottom: 40 },
  restaurantCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 14, borderWidth: 1, borderColor: "#F3F4F6" },
  restaurantImage: { width: 60, height: 60, borderRadius: 18, backgroundColor: "#F3F4F6" },
  restaurantName: { color: "#111827", fontSize: 16, fontFamily: "AlanSans", fontWeight: "900" },
  restaurantMeta: { marginTop: 3, color: "#6B7280", fontFamily: "AlanSans", fontWeight: "700", fontSize: 12 },
  restaurantAddress: { marginTop: 3, color: "#9CA3AF", fontSize: 12, fontFamily: "Inter", fontWeight: "400" },
  title: { marginTop: 18, color: "#111827", fontSize: 27, fontFamily: "AlanSans", fontWeight: "900", lineHeight: 33 },
  description: { marginTop: 8, color: "#6B7280", fontSize: 15, lineHeight: 22, fontFamily: "Inter", fontWeight: "500" },
  statsRow: { marginTop: 16, flexDirection: "row", gap: 10 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, height: 38, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F3F4F6" },
  statPillActive: { backgroundColor: "#FF6B35", borderColor: "#FF6B35" },
  statText: { color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "900" },
  statTextActive: { color: "#FFFFFF" },
  infoGrid: { marginTop: 16, flexDirection: "row", gap: 12 },
  infoBox: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "#F3F4F6" },
  infoLabel: { color: "#9CA3AF", fontFamily: "AlanSans", fontWeight: "800", fontSize: 12 },
  infoValue: { marginTop: 6, color: "#111827", fontFamily: "AlanSans", fontWeight: "900", fontSize: 17 },
  priceCard: { marginTop: 16, backgroundColor: "#111827", borderRadius: 26, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  priceLabel: { color: "#D1D5DB", fontFamily: "AlanSans", fontWeight: "800", fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  price: { color: "#FFFFFF", fontFamily: "AlanSans", fontWeight: "900", fontSize: 22 },
  originalPrice: { color: "#9CA3AF", fontFamily: "AlanSans", fontWeight: "800", textDecorationLine: "line-through" },
  orderButton: { height: 50, borderRadius: 18, backgroundColor: "#FF6B35", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  orderButtonText: { color: "#FFFFFF", fontFamily: "AlanSans", fontWeight: "900" },
});
