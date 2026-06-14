import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { normalizeRating } from "@/backend/utils/ratings";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;
const ACCENT = "#FF6B35";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700&h=520&fit=crop";

type FavoriteRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  image: string;
  rating: number;
  deliveryTime: string;
  savedPostIds: string[];
};

function deliveryTime(index: number) {
  const start = 22 + (index % 4) * 4;
  return `${start}-${start + 12} min`;
}

function EmptyFavorites({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={44} color={ACCENT} />
      </View>
      <Text style={styles.emptyTitle}>No favorites yet</Text>
      <Text style={styles.emptyText}>Save restaurants you love and they will stay one tap away.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onBrowse}>
        <Text style={styles.primaryButtonText}>Add favorites</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const cardWidth = useMemo(() => (width - 40) / 2, [width]);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: favData, error: favError } = await db
        .from("favorites")
        .select("post_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (favError) throw favError;
      if (!favData?.length) {
        setFavorites([]);
        return;
      }

      const postIds = favData.map((item: any) => item.post_id).filter(Boolean);
      if (!postIds.length) {
        setFavorites([]);
        return;
      }

      const { data: posts, error: postsError } = await db
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          restaurants!inner(
            id,
            restaurant_name,
            cuisine_type,
            image_url,
            restaurant_rating
          )
        `,
        )
        .in("id", postIds)
        .eq("is_active", true);

      if (postsError) throw postsError;

      const grouped = new Map<string, FavoriteRestaurant>();
      (posts || []).forEach((post: any, index: number) => {
        const restaurant = Array.isArray(post.restaurants) ? post.restaurants[0] : post.restaurants;
        const id = post.restaurant_id || restaurant?.id;
        if (!id) return;

        const current = grouped.get(id);
        if (current) {
          current.savedPostIds.push(post.id);
          return;
        }

        grouped.set(id, {
          id,
          name: restaurant?.restaurant_name || "Restaurant",
          cuisine: restaurant?.cuisine_type || "Food",
          image: restaurant?.image_url || FALLBACK_IMAGE,
          rating: normalizeRating(restaurant?.restaurant_rating),
          deliveryTime: deliveryTime(index),
          savedPostIds: [post.id],
        });
      });

      setFavorites(Array.from(grouped.values()));
    } catch (error) {
      console.error("Favorites load failed:", error);
      Alert.alert("Favorites unavailable", "We could not load your saved restaurants.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, [fetchFavorites]);

  const removeFavorite = useCallback(
    (restaurant: FavoriteRestaurant) => {
      Alert.alert("Remove favorite", `Remove ${restaurant.name} from favorites?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (!restaurant.savedPostIds.length) return;

              const { error } = await db
                .from("favorites")
                .delete()
                .eq("user_id", user?.id)
                .in("post_id", restaurant.savedPostIds);

              if (error) throw error;
              setFavorites((items) => items.filter((item) => item.id !== restaurant.id));
            } catch (error) {
              console.error("Remove favorite failed:", error);
              Alert.alert("Remove failed", "Please try again.");
            }
          },
        },
      ]);
    },
    [user?.id],
  );

  const shareRestaurant = useCallback(async (restaurant: FavoriteRestaurant) => {
    await Share.share({
      message: `Check out ${restaurant.name} on Mataim.`,
    });
  }, []);

  const moveToWishlist = useCallback((restaurant: FavoriteRestaurant) => {
    Alert.alert("Wishlist", `${restaurant.name} was marked for your wishlist.`);
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={21} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={styles.iconButtonGhost} />
        </View>
        <EmptyFavorites onBrowse={() => router.push("/(auth)/signin" as any)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Favorites</Text>
          <Text style={styles.headerSubtitle}>{favorites.length} saved restaurants</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => setLayout((value) => (value === "grid" ? "list" : "grid"))}>
          <Ionicons name={layout === "grid" ? "list-outline" : "grid-outline"} size={21} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading favorites</Text>
        </View>
      ) : (
        <FlatList
          key={layout}
          data={favorites}
          numColumns={layout === "grid" ? 2 : 1}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
          contentContainerStyle={favorites.length ? styles.listContent : styles.emptyListContent}
          columnWrapperStyle={layout === "grid" ? styles.columnWrapper : undefined}
          ListEmptyComponent={<EmptyFavorites onBrowse={() => router.push("/(tabs)/search" as any)} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.favoriteCard, layout === "grid" ? { width: cardWidth } : styles.favoriteCardList]}
              onPress={() => router.push(`/menu/${item.id}` as any)}
              activeOpacity={0.88}
            >
              <Image source={{ uri: item.image }} style={[styles.favoriteImage, layout === "list" && styles.favoriteImageList]} />
              <TouchableOpacity style={styles.heartButton} onPress={() => removeFavorite(item)}>
                <Ionicons name="heart" size={18} color={ACCENT} />
              </TouchableOpacity>
              <View style={styles.favoriteBody}>
                <Text style={styles.favoriteName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.favoriteCuisine} numberOfLines={1}>{item.cuisine}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.ratingPill}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.metaText}>{item.deliveryTime}</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => moveToWishlist(item)}>
                    <Ionicons name="bookmark-outline" size={15} color="#111827" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => shareRestaurant(item)}>
                    <Ionicons name="share-outline" size={15} color="#111827" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { minHeight: 70, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconButtonGhost: { width: 42, height: 42 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerTitle: { fontSize: 19, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontFamily: "Inter", fontWeight: "600", color: "#6B7280" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#6B7280", letterSpacing: 0.15 },
  listContent: { paddingHorizontal: 12, paddingBottom: 120, gap: 12 },
  emptyListContent: { flexGrow: 1 },
  columnWrapper: { gap: 12 },
  favoriteCard: { marginBottom: 12, borderRadius: 4, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7ebb5", overflow: "hidden" },
  favoriteCardList: { width: "100%", flexDirection: "row", minHeight: 134 },
  favoriteImage: { width: "100%", height: 126, backgroundColor: "#E5E7EB" },
  favoriteImageList: { width: 122, height: "100%" },
  heartButton: { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: "rgba(0, 0, 0, 0.17)" },
  favoriteBody: { flex: 1, padding: 12 },
  favoriteName: { fontSize: 15, fontFamily: "Inter", fontWeight: "700", color: "#111827", letterSpacing: 0.2 },
  favoriteCuisine: { marginTop: 3, fontSize: 12, fontFamily: "Inter", fontWeight: "600", color: "#6B7280" },
  metaRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  ratingPill: { height: 25, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "#FFFBEB", flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter", fontWeight: "700", color: "#92400E" },
  metaText: { fontSize: 11, fontFamily: "Inter", fontWeight: "700", color: "#6B7280" },
  actionRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  actionButton: { width: 34, height: 34, borderRadius: 55, backgroundColor: "#f3f4f6c7", alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 18, fontSize: 19, fontFamily: "Inter", fontWeight: "700", color: "#111827", textAlign: "center", letterSpacing: 0.2 },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "600", color: "#6B7280", textAlign: "center" },
  primaryButton: { marginTop: 22, height: 50, paddingHorizontal: 22, borderRadius: 8, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter", fontWeight: "700" },
});
