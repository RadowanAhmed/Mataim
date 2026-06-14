// app/categories/index.tsx
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

// Category images mapping
const CATEGORY_IMAGES: { [key: string]: string } = {
  Arabic:
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop",
  Indian:
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
  Italian:
    "https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=400&h=300&fit=crop",
  Pizza:
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop",
  Burgers:
    "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop",
  Sushi:
    "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=300&fit=crop",
  Chinese:
    "https://images.unsplash.com/photo-1525755662777-989b66e3895c?w=400&h=300&fit=crop",
  Desserts:
    "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  Seafood:
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop",
  Mexican:
    "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",
  Thai: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&h=300&fit=crop",
  Japanese:
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop",
  Korean:
    "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop",
  Vietnamese:
    "https://images.unsplash.com/photo-1582878826629-39b7ad3e4f5c?w=400&h=300&fit=crop",
  Lebanese:
    "https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=400&h=300&fit=crop",
  Turkish:
    "https://images.unsplash.com/photo-1544148103-077e404be65a?w=400&h=300&fit=crop",
};

// Category icons mapping
const CATEGORY_ICONS: { [key: string]: string } = {
  Arabic: "🥘",
  Indian: "🍛",
  Italian: "🍝",
  Pizza: "🍕",
  Burgers: "🍔",
  Sushi: "🍣",
  Chinese: "🥡",
  Desserts: "🍰",
  Seafood: "🦞",
  Mexican: "🌮",
  Thai: "🍜",
  Japanese: "🍱",
  Korean: "🥘",
  Vietnamese: "🍲",
  Lebanese: "🥙",
  Turkish: "🥘",
};

interface Category {
  id: string;
  name: string;
  count: number;
  image: string;
  icon: string;
  description: string;
}

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

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);

      // Fetch distinct cuisine types from restaurants
      const { data: restaurantData, error: restaurantError } = await db
        .from("restaurants")
        .select("cuisine_type")
        .eq("restaurant_status", "active")
        .not("cuisine_type", "is", null);

      if (restaurantError) throw restaurantError;

      // Process cuisine types and get counts
      const cuisineMap = new Map<string, number>();

      (restaurantData || []).forEach((item: any) => {
        if (item.cuisine_type) {
          const cuisines = item.cuisine_type.split(" • ");
          cuisines.forEach((cuisine: string) => {
            const trimmed = cuisine.trim();
            cuisineMap.set(trimmed, (cuisineMap.get(trimmed) || 0) + 1);
          });
        }
      });

      // Get post counts per cuisine
      const categoriesList: Category[] = [];

      for (const [cuisine, restaurantCount] of cuisineMap.entries()) {
        // Count posts with this cuisine tag
        const { count: postCount, error: postError } = await db
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .overlaps("tags", [cuisine]);

        if (postError) continue;

        // Count deals with this cuisine
        const { count: dealCount, error: dealError } = await db
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("post_type", "promotion")
          .gt("discount_percentage", 0)
          .overlaps("tags", [cuisine]);

        if (dealError) continue;

        categoriesList.push({
          id: cuisine.toLowerCase().replace(/\s+/g, "-"),
          name: cuisine,
          count: restaurantCount + (postCount || 0) + (dealCount || 0),
          image:
            CATEGORY_IMAGES[cuisine] ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
          icon: CATEGORY_ICONS[cuisine] || "🍽️",
          description: getCategoryDescription(cuisine),
        });
      }

      // Sort by name
      categoriesList.sort((a, b) => a.name.localeCompare(b.name));

      setCategories(categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getCategoryDescription = (cuisine: string): string => {
    const descriptions: { [key: string]: string } = {
      Arabic: "Traditional Middle Eastern cuisine with rich flavors",
      Indian: "Spicy and aromatic dishes from across India",
      Italian: "Authentic pasta, pizza, and Italian specialties",
      Pizza: "Fresh baked pizzas with various toppings",
      Burgers: "Juicy burgers with premium ingredients",
      Sushi: "Fresh sushi and Japanese delicacies",
      Chinese: "Classic Chinese dishes and dim sum",
      Desserts: "Sweet treats and decadent desserts",
      Seafood: "Fresh seafood and ocean delicacies",
      Mexican: "Bold and spicy Mexican favorites",
      Thai: "Aromatic Thai curries and noodles",
      Japanese: "Traditional Japanese cuisine and sushi",
      Korean: "Flavorful Korean BBQ and dishes",
      Vietnamese: "Fresh Vietnamese pho and rolls",
      Lebanese: "Authentic Lebanese mezze and grills",
      Turkish: "Rich Turkish kebabs and baklava",
    };
    return descriptions[cuisine] || `Explore delicious ${cuisine} cuisine`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/categories/[type]",
          params: { type: categoryRouteKey(item.id || item.name) },
        } as any)
      }
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image }} style={styles.categoryImage} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.categoryGradient}
      >
        <View style={styles.categoryContent}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.count}+</Text>
            </View>
          </View>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.categoryFooter}>
            <Text style={styles.exploreText}>Explore →</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <View>
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSubtitle}>Explore cuisines near you</Text>
      </View>
      <TouchableOpacity style={styles.searchButton}>
        <Ionicons name="search" size={24} color="#111827" />
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.content}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Categories Found</Text>
            <Text style={styles.emptyText}>
              Check back later for new cuisines
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  searchButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryCard: {
    width: "48%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  categoryGradient: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
  },
  categoryContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  categoryIcon: {
    fontSize: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  countBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  categoryName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryDescription: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 14,
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  categoryFooter: {
    alignItems: "flex-end",
  },
  exploreText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
