// app/posts/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatUGX, toUGX } from "@/backend/utils/currency";

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return amount > 0 ? formatUGX(amount) : "View deal";
}

function getPostPrice(post: any) {
  return post.discounted_price || post.original_price || 0;
}

export default function PostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const types = [
    { id: "all", label: "All" },
    { id: "food", label: "Food" },
    { id: "promotion", label: "Deals" },
    { id: "event", label: "Events" },
    { id: "announcement", label: "News" },
  ];

  const loadPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          description,
          image_url,
          post_type,
          discount_percentage,
          original_price,
          discounted_price,
          likes_count,
          comments_count,
          view_count,
          tags,
          created_at,
          available_until,
          restaurants:restaurants!posts_restaurant_id_fkey(
            id,
            restaurant_name,
            cuisine_type,
            image_url,
            restaurant_rating,
            delivery_fee,
            min_order_amount,
            address
          )
        `,
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Load posts error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return posts.filter((post) => {
      const typeMatch = selectedType === "all" || post.post_type === selectedType;
      const textMatch =
        !text ||
        post.title?.toLowerCase().includes(text) ||
        post.description?.toLowerCase().includes(text) ||
        post.restaurants?.restaurant_name?.toLowerCase().includes(text) ||
        post.restaurants?.cuisine_type?.toLowerCase().includes(text);
      return typeMatch && textMatch;
    });
  }, [posts, search, selectedType]);

  const renderPost = ({ item }: { item: any }) => {
    const price = getPostPrice(item);
    const hasDiscount = Number(item.discount_percentage || 0) > 0;

    return (
      <TouchableOpacity style={styles.postCard} onPress={() => router.push(`/posts/${item.id}` as any)} activeOpacity={0.88}>
        <Image
          source={{ uri: item.image_url || item.restaurants?.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop" }}
          style={styles.postImage}
        />
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{Number(item.discount_percentage).toFixed(0)}% OFF</Text>
          </View>
        )}
        <View style={styles.postContent}>
          <View style={styles.restaurantRow}>
            <Image
              source={{ uri: item.restaurants?.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=300&fit=crop" }}
              style={styles.restaurantAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurants?.restaurant_name || "Restaurant"}</Text>
              <Text style={styles.restaurantMeta} numberOfLines={1}>
                {item.restaurants?.cuisine_type || "Food"} • ⭐ {Number(item.restaurants?.restaurant_rating || 0).toFixed(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.postDescription} numberOfLines={2}>{item.description || "Fresh food and special offers from this restaurant."}</Text>

          <View style={styles.postFooter}>
            <View>
              <Text style={styles.price}>{formatMoney(price)}</Text>
              {hasDiscount && <Text style={styles.originalPrice}>{formatMoney(item.original_price)}</Text>}
            </View>
            <View style={styles.statsPill}>
              <Ionicons name="heart" size={13} color="#FF6B35" />
              <Text style={styles.statsText}>{item.likes_count || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>Mataim feed</Text>
          <Text style={styles.heroTitle}>Food posts & deals</Text>
          <Text style={styles.heroSubtitle}>Discover fresh offers near you.</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search food, restaurants, cuisine..."
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.typesRow}>
        {types.map((type) => (
          <TouchableOpacity
            key={type.id}
            onPress={() => setSelectedType(type.id)}
            style={[styles.typeChip, selectedType === type.id && styles.typeChipActive]}
          >
            <Text style={[styles.typeText, selectedType === type.id && styles.typeTextActive]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="fast-food-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No posts found</Text>
            <Text style={styles.emptyText}>Try another search or category.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  loadingText: { marginTop: 12, color: "#6B7280", fontFamily: "AlanSans", fontWeight: "700" },
  hero: { backgroundColor: "#111827", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroKicker: { color: "#FFB59D", fontSize: 12, fontFamily: "AlanSans", fontWeight: "900", textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontFamily: "AlanSans", fontWeight: "900", marginTop: 3 },
  heroSubtitle: { color: "#D1D5DB", fontFamily: "AlanSans", fontWeight: "700", marginTop: 3 },
  searchWrap: { margin: 16, marginBottom: 10, height: 52, borderRadius: 18, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: "#F3F4F6" },
  searchInput: { flex: 1, color: "#111827", fontFamily: "AlanSans", fontWeight: "600" },
  typesRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  typeChip: { paddingHorizontal: 13, height: 36, borderRadius: 999, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F3F4F6" },
  typeChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  typeText: { color: "#6B7280", fontFamily: "AlanSans", fontWeight: "900", fontSize: 12 },
  typeTextActive: { color: "#FFFFFF" },
  listContent: { padding: 16, paddingTop: 6, paddingBottom: 40 },
  postCard: { marginBottom: 16, backgroundColor: "#FFFFFF", borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: "#F3F4F6", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  postImage: { width: "100%", height: 190, backgroundColor: "#F3F4F6" },
  discountBadge: { position: "absolute", top: 14, left: 14, backgroundColor: "#FF6B35", paddingHorizontal: 10, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  discountText: { color: "#FFFFFF", fontFamily: "AlanSans", fontWeight: "900", fontSize: 12 },
  postContent: { padding: 14 },
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  restaurantAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#F3F4F6" },
  restaurantName: { color: "#111827", fontFamily: "AlanSans", fontWeight: "900", fontSize: 14 },
  restaurantMeta: { color: "#6B7280", fontFamily: "AlanSans", fontWeight: "700", fontSize: 12, marginTop: 2 },
  postTitle: { color: "#111827", fontFamily: "AlanSans", fontWeight: "900", fontSize: 18 },
  postDescription: { marginTop: 5, color: "#6B7280", lineHeight: 19, fontFamily: "Inter", fontWeight: "500" },
  postFooter: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "900", fontSize: 18 },
  originalPrice: { color: "#9CA3AF", fontFamily: "AlanSans", fontWeight: "700", textDecorationLine: "line-through", marginTop: 2 },
  statsPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 32, borderRadius: 999, backgroundColor: "#FFF7ED" },
  statsText: { color: "#FF6B35", fontFamily: "AlanSans", fontWeight: "900", fontSize: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 90, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, color: "#111827", fontSize: 18, fontFamily: "AlanSans", fontWeight: "900" },
  emptyText: { marginTop: 6, color: "#6B7280", fontFamily: "AlanSans", fontWeight: "700", textAlign: "center" },
});