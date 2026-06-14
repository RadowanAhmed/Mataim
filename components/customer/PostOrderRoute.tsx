// component/customer/PostOrderRoute.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { calculateDeliveryDistanceKm, calculateDeliveryFee } from "@/backend/utils/deliveryPricing";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, LazyPolyline, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";

type Coordinate = { latitude: number; longitude: number };

const { width } = Dimensions.get("window");

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown) {
  return formatUGX(value as any);
}

function buildAddressText(address: any) {
  if (!address) return "Selected delivery location";
  if (typeof address === "string") return address;
  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Selected delivery location";
}

function getRestaurantCoords(restaurant: any): Coordinate | null {
  const latitude = toNumber(restaurant?.latitude);
  const longitude = toNumber(restaurant?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

async function reverseAddress(coordinate: Coordinate) {
  try {
    const result = await Location.reverseGeocodeAsync(coordinate);
    const first = result?.[0];
    if (!first) {
      return {
        label: "Selected Location",
        address_line1: "Selected Location",
        city: "Kampala",
        country: "Uganda",
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };
    }

    return {
      label: "Selected Location",
      address_line1:
        `${first.street || first.name || ""} ${first.streetNumber || ""}`.trim() ||
        "Selected Location",
      address_line2: first.district || "",
      city: first.city || first.region || "Kampala",
      state: first.region || "",
      country: first.country || "Uganda",
      postal_code: first.postalCode || "",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      is_temporary: true,
    };
  } catch {
    return {
      label: "Selected Location",
      address_line1: "Selected Location",
      city: "Kampala",
      country: "Uganda",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      is_temporary: true,
    };
  }
}

export default function PostOrderRoute() {
  const params = useLocalSearchParams<{
    restaurantId?: string;
    orderId?: string;
    postId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const mapRef = useRef<any | null>(null);

  const restaurantId = useMemo(
    () => String(params.restaurantId || params.orderId || ""),
    [params.restaurantId, params.orderId],
  );
  const postId = params.postId ? String(params.postId) : "";

  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  const restaurantCoords = useMemo(() => getRestaurantCoords(restaurant), [restaurant]);
  const routeLine = useMemo(() => {
    if (!restaurantCoords || !userLocation) return [];
    return [restaurantCoords, userLocation];
  }, [restaurantCoords, userLocation]);
  const deliveryPreview = useMemo(() => {
    const deliveryFee = calculateDeliveryFee({
      restaurant: restaurantCoords,
      address: selectedAddress,
    });
    const distanceKm = calculateDeliveryDistanceKm({
      restaurant: restaurantCoords,
      address: selectedAddress,
    });

    return { deliveryFee, distanceKm };
  }, [restaurantCoords, selectedAddress]);

  const loadData = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      if (postId) {
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .maybeSingle();
        if (postError) throw postError;
        setPost(postData);

        if (user?.id && postData?.id) {
          await supabase.from("post_views").upsert(
            {
              post_id: postData.id,
              user_id: user.id,
              view_date: new Date().toISOString().slice(0, 10),
            },
            { onConflict: "post_id,user_id,view_date" },
          );
        }
      }
    } catch (error) {
      console.error("Error loading post order route:", error);
      Alert.alert("Error", "Failed to load restaurant information.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, postId, user?.id]);

  const getCurrentLocation = useCallback(async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Please allow location access or tap the map to choose your delivery address.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coordinate);
      setSelectedAddress(await reverseAddress(coordinate));

      setTimeout(() => {
        if (mapRef.current && restaurantCoords) {
          mapRef.current.fitToCoordinates([coordinate, restaurantCoords], {
            edgePadding: { top: 90, right: 60, bottom: 120, left: 60 },
            animated: true,
          });
        }
      }, 350);
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Location error", "Could not get your current location.");
    } finally {
      setGettingLocation(false);
    }
  }, [restaurantCoords]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading) getCurrentLocation();
  }, [loading, getCurrentLocation]);

  const handleMapPress = async (event: any) => {
    const coordinate = event.nativeEvent.coordinate as Coordinate;
    setUserLocation(coordinate);
    setSelectedAddress(await reverseAddress(coordinate));
  };

  const startCheckout = () => {
    if (!user?.id) {
      Alert.alert("Login required", "Please sign in before placing your order.");
      router.push("/(auth)/signin" as any);
      return;
    }

    if (!restaurantId) {
      Alert.alert("Restaurant missing", "Please choose a restaurant first.");
      return;
    }

    if (!selectedAddress) {
      Alert.alert("Delivery address missing", "Tap the map or use your current location.");
      return;
    }

    const deliveryFee = calculateDeliveryFee({
      restaurant: restaurantCoords,
      address: selectedAddress,
    });

    router.push({
      pathname: "/orders/create",
      params: {
        restaurantId,
        postId,
        addressData: JSON.stringify(selectedAddress),
        restaurantName: restaurant?.restaurant_name || "",
        restaurantImage: restaurant?.image_url || "",
        postTitle: post?.title || "",
        postDescription: post?.description || "",
        postImage: post?.image_url || "",
        postPrice: String(post?.discounted_price || post?.original_price || 0),
        deliveryFee: String(deliveryFee),
      },
    } as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Preparing your order...</Text>
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
        <View style={styles.heroText}>
          <Text style={styles.heroKicker}>Delivery address</Text>
          <Text style={styles.heroTitle}>Confirm your drop-off</Text>
          <Text style={styles.heroSubtitle}>
            Tap the map to change location before checkout.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.mapCard}>
          {userLocation ? (
            <LazyMapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onPress={handleMapPress}
            >
              {restaurantCoords && (
                <LazyMarker coordinate={restaurantCoords} title={restaurant?.restaurant_name || "Restaurant"}>
                  <View style={styles.restaurantMarker}>
                    <Ionicons name="restaurant" size={18} color="#FFFFFF" />
                  </View>
                </LazyMarker>
              )}
              <LazyMarker coordinate={userLocation} title="Delivery location">
                <View style={styles.customerMarker}>
                  <Ionicons name="home" size={18} color="#FFFFFF" />
                </View>
              </LazyMarker>
              {routeLine.length === 2 && (
                <LazyPolyline coordinates={routeLine} strokeColor="#FF6B35" strokeWidth={4} />
              )}
            </LazyMapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator color="#FF6B35" />
              <Text style={styles.mapPlaceholderText}>Loading map...</Text>
            </View>
          )}

          <TouchableOpacity style={styles.locateButton} onPress={getCurrentLocation} disabled={gettingLocation}>
            {gettingLocation ? (
              <ActivityIndicator color="#111827" size="small" />
            ) : (
              <Ionicons name="locate" size={20} color="#111827" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.restaurantRow}>
            <Image
              source={{ uri: restaurant?.image_url || post?.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop" }}
              style={styles.restaurantImage}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName}>{restaurant?.restaurant_name || "Restaurant"}</Text>
              <Text style={styles.restaurantMeta} numberOfLines={1}>
                {restaurant?.cuisine_type || "Food"} • ⭐ {Number(restaurant?.restaurant_rating || 0).toFixed(1)}
              </Text>
              <Text style={styles.restaurantAddress} numberOfLines={2}>
                {restaurant?.address || "Restaurant address unavailable"}
              </Text>
            </View>
          </View>

          {post && (
            <View style={styles.postCard}>
              <Image
                source={{ uri: post.image_url || restaurant?.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop" }}
                style={styles.postImage}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.postDescription} numberOfLines={2}>{post.description || "Fresh from this restaurant."}</Text>
                <Text style={styles.postPrice}>
                  {formatMoney(post.discounted_price || post.original_price || 0)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.addressCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={18} color="#FF6B35" />
            <Text style={styles.sectionTitle}>Drop-off address</Text>
          </View>
          <Text style={styles.addressLabel}>{selectedAddress?.label || "Choose address"}</Text>
          <Text style={styles.addressText}>{buildAddressText(selectedAddress)}</Text>
          <View style={styles.deliveryPreviewRow}>
            <Text style={styles.deliveryPreviewLabel}>
              Delivery{deliveryPreview.distanceKm ? ` (${deliveryPreview.distanceKm.toFixed(1)} km)` : ""}
            </Text>
            <Text style={styles.deliveryPreviewValue}>{formatMoney(deliveryPreview.deliveryFee)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.checkoutButton} onPress={startCheckout} activeOpacity={0.9}>
          <Text style={styles.checkoutText}>Continue to checkout</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  loadingText: { marginTop: 12, color: "#6B7280", fontWeight: "600" },
  hero: {
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1 },
  heroKicker: { color: "#FFB59D", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 4 },
  heroSubtitle: { color: "#D1D5DB", marginTop: 4, fontSize: 13 },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 36 },
  mapCard: {
    height: Math.min(360, width * 0.92),
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapPlaceholderText: { marginTop: 8, color: "#6B7280", fontWeight: "600" },
  restaurantMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FF6B35", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" },
  customerMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" },
  locateButton: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  infoCard: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
  restaurantRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  restaurantImage: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#F3F4F6" },
  restaurantName: { fontSize: 18, fontWeight: "800", color: "#111827" },
  restaurantMeta: { marginTop: 3, fontSize: 13, color: "#6B7280", fontWeight: "700" },
  restaurantAddress: { marginTop: 3, fontSize: 12, color: "#9CA3AF" },
  postCard: { marginTop: 16, padding: 12, borderRadius: 20, backgroundColor: "#FFF7ED", flexDirection: "row", gap: 12, alignItems: "center" },
  postImage: { width: 74, height: 74, borderRadius: 18, backgroundColor: "#F3F4F6" },
  postTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  postDescription: { marginTop: 3, fontSize: 12, color: "#6B7280" },
  postPrice: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#FF6B35" },
  addressCard: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  addressLabel: { fontSize: 15, fontWeight: "800", color: "#111827" },
  addressText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#6B7280" },
  deliveryPreviewRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  deliveryPreviewLabel: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  deliveryPreviewValue: { fontSize: 14, fontWeight: "900", color: "#111827" },
  checkoutButton: { marginTop: 18, height: 58, borderRadius: 20, backgroundColor: "#FF6B35", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  checkoutText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
