import { logger } from "@/backend/utils/logger";
// app/orders-now/[restaurantId].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { calculateDeliveryFee } from "@/backend/utils/deliveryPricing";
import { normalizeRating } from "@/backend/utils/ratings";
import {
  DEFAULT_LOCATION_REGION,
  getSafeCurrentLocation,
  reverseAddress,
} from "@/backend/utils/location";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, LazyPolyline, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const db = supabase as any;

export default function OrderNowScreen() {
  const router = useRouter();
  const { restaurantId, postId, orderId } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Location states
  const [userLocation, setUserLocation] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [region, setRegion] = useState<any>(DEFAULT_LOCATION_REGION);

  // Address state
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Order tracking states
  const [trackingOrder, setTrackingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>("pending");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] =
    useState<string>("");
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

  // Performance refs
  const mapRef = useRef<MapView>(null);
  const isMounted = useRef(true);
  const orderSubscription = useRef<any>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (orderSubscription.current) {
        orderSubscription.current.unsubscribe();
      }
    };
  }, []);

  // Check if we have an orderId to track
  useEffect(() => {
    if (orderId) {
      setTrackingOrder(true);
      fetchOrderDetails();
      subscribeToOrderUpdates();
    } else {
      // Initialize safely. If GPS is unavailable, keep fallback map and let user tap.
      getCurrentLocation();
    }
    fetchRestaurantData();
  }, [orderId]);

  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      setLocationNotice(null);

      const result = await getSafeCurrentLocation();

      if (isMounted.current) {
        setRegion(result.region);
      }

      if (!result.point) {
        if (isMounted.current) {
          setSelectedAddress(null);
          setUserLocation(null);
          setLocationNotice(
            "GPS is unavailable. Tap the map to select your delivery location.",
          );
        }
        logger.debug("Location fallback:", result.error);
        return;
      }

      const userLoc = {
        latitude: result.point.latitude,
        longitude: result.point.longitude,
      };

      const addressObj = await reverseAddress(
        result.point.latitude,
        result.point.longitude,
      );

      if (isMounted.current) {
        setUserLocation(userLoc);
        setSelectedAddress(addressObj);
      }
    } catch (error) {
      logger.debug("Location load error:", error);
      if (isMounted.current) {
        setRegion(DEFAULT_LOCATION_REGION);
        setLocationNotice(
          "GPS is unavailable. Tap the map to select your delivery location.",
        );
      }
    } finally {
      if (isMounted.current) {
        setGettingLocation(false);
      }
    }
  };

  const fetchRestaurantData = async () => {
    if (!restaurantId) return;

    try {
      // Fetch restaurant
      const { data: restaurantData } = await db
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);

        if (restaurantData.latitude && restaurantData.longitude) {
          const restaurantLoc = {
            latitude: parseFloat(restaurantData.latitude),
            longitude: parseFloat(restaurantData.longitude),
          };
          setRestaurantLocation(restaurantLoc);

          // If user location is unavailable, center around the restaurant instead of blank map.
          if (!userLocation) {
            setRegion({
              latitude: restaurantLoc.latitude,
              longitude: restaurantLoc.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
          }
        }
      }

      // Fetch post if available
      if (postId) {
        const { data: postData } = await db
          .from("posts")
          .select("*")
          .eq("id", postId)
          .single();
        setPost(postData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      const { data: orderData } = await db
        .from("orders")
        .select(
          `
          *,
          restaurants!inner(*),
          delivery_users!inner(*, users!inner(full_name, profile_image_url, phone)),
          order_items(*)
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderData) {
        setOrderDetails(orderData);
        setOrderStatus(orderData.status);
        setEstimatedDeliveryTime(orderData.estimated_delivery_time);

        // Get driver location
        if (
          orderData.delivery_users?.current_location_lat &&
          orderData.delivery_users?.current_location_lng
        ) {
          const driverLoc = {
            latitude: parseFloat(orderData.delivery_users.current_location_lat),
            longitude: parseFloat(
              orderData.delivery_users.current_location_lng,
            ),
          };
          setDriverLocation(driverLoc);
        }

        // Setup map for tracking
        setupTrackingMap(orderData);
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
    }
  };

  const subscribeToOrderUpdates = () => {
    if (!orderId) return;

    orderSubscription.current = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updatedOrder = payload.new;
          setOrderStatus(updatedOrder.status);
          setOrderDetails(updatedOrder);

          // Add to order updates
          setOrderUpdates((prev) => [
            {
              timestamp: new Date().toISOString(),
              status: updatedOrder.status,
              message: `Order status updated to ${updatedOrder.status}`,
            },
            ...prev,
          ]);

          // Update driver location if available
          if (updatedOrder.driver_id) {
            fetchDriverLocation(updatedOrder.driver_id);
          }
        },
      )
      .subscribe();
  };

  const fetchDriverLocation = async (driverId: string) => {
    try {
      const { data: driverData } = await db
        .from("delivery_users")
        .select("current_location_lat, current_location_lng")
        .eq("id", driverId)
        .single();

      if (
        driverData?.current_location_lat &&
        driverData?.current_location_lng
      ) {
        const driverLoc = {
          latitude: parseFloat(driverData.current_location_lat),
          longitude: parseFloat(driverData.current_location_lng),
        };
        setDriverLocation(driverLoc);
        setupTrackingMap(orderDetails, driverLoc);
      }
    } catch (error) {
      console.error("Error fetching driver location:", error);
    }
  };

  const setupTrackingMap = (order: any, driverLoc: any = null) => {
    const locations = [];

    if (restaurantLocation) locations.push(restaurantLocation);
    if (driverLoc || driverLocation)
      locations.push(driverLoc || driverLocation);
    if (userLocation) locations.push(userLocation);

    // Try to get delivery address from order
    let deliveryLocation = null;
    if (order?.delivery_address) {
      try {
        const address =
          typeof order.delivery_address === "string"
            ? JSON.parse(order.delivery_address)
            : order.delivery_address;

        if (address.latitude && address.longitude) {
          deliveryLocation = {
            latitude: parseFloat(address.latitude),
            longitude: parseFloat(address.longitude),
          };
          locations.push(deliveryLocation);
        }
      } catch (error) {
        console.error("Error parsing delivery address:", error);
      }
    }

    if (locations.length > 0) {
      // Calculate bounds
      let minLat = locations[0].latitude;
      let maxLat = locations[0].latitude;
      let minLng = locations[0].longitude;
      let maxLng = locations[0].longitude;

      locations.forEach((loc) => {
        minLat = Math.min(minLat, loc.latitude);
        maxLat = Math.max(maxLat, loc.latitude);
        minLng = Math.min(minLng, loc.longitude);
        maxLng = Math.max(maxLng, loc.longitude);
      });

      setRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
      });

      // Set route coordinates (restaurant -> driver -> delivery address)
      if (restaurantLocation && deliveryLocation) {
        const route = [restaurantLocation];
        if (driverLoc || driverLocation) {
          route.push(driverLoc || driverLocation);
        }
        route.push(deliveryLocation);
        setRouteCoordinates(route);
      }
    }
  };

  const handleMapPress = async (event: any) => {
    if (trackingOrder) return; // Don't allow location change when tracking

    const { coordinate } = event.nativeEvent;

    try {
      const addressObj = await reverseAddress(
        coordinate.latitude,
        coordinate.longitude,
      );

      setSelectedAddress({
        ...addressObj,
        label: "Selected Location",
      });
      setUserLocation(coordinate);
      setLocationNotice(null);

      Alert.alert(
        "Location Updated",
        "Your delivery location has been updated.",
      );
    } catch (error) {
      console.error("Error getting address:", error);

      setSelectedAddress({
        label: "Selected Location",
        address_line1: "Selected location",
        city: "Kampala",
        country: "Uganda",
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        is_temporary: true,
      });
      setUserLocation(coordinate);
      setLocationNotice(null);
    }
  };

  const handleOrderNow = () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to place an order.");
      router.push("/(auth)/signin");
      return;
    }

    if (!selectedAddress) {
      Alert.alert(
        "Location Required",
        "GPS is unavailable. Tap on the map to set your delivery location.",
      );
      return;
    }

    const deliveryFee = calculateDeliveryFee({
      restaurant: restaurantLocation,
      address: selectedAddress,
    });

    // Navigate to Create Order screen with all data
    router.push({
      pathname: "/orders/create",
      params: {
        restaurantId: restaurantId as string,
        postId: postId as string,
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

  const handleTrackOrder = () => {
    if (orderId) {
      router.push(`/(tabs)/orders/${orderId}` as any);
    }
  };

  const handleRefreshLocation = async () => {
    await getCurrentLocation();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "#10B981";
      case "out_for_delivery":
        return "#3B82F6";
      case "ready":
        return "#8B5CF6";
      case "preparing":
        return "#F59E0B";
      case "confirmed":
        return "#3B82F6";
      case "cancelled":
        return "#EF4444";
      case "pending":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "time-outline";
      case "confirmed":
        return "checkmark-circle-outline";
      case "preparing":
        return "restaurant-outline";
      case "ready":
        return "fast-food-outline";
      case "out_for_delivery":
        return "bicycle-outline";
      case "delivered":
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "Order Placed";
      case "confirmed":
        return "Order Confirmed";
      case "preparing":
        return "Preparing Your Order";
      case "ready":
        return "Ready for Pickup";
      case "out_for_delivery":
        return "On the Way";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {trackingOrder ? "Order Tracking" : "Set Delivery Location"}
        </Text>
        <TouchableOpacity
          onPress={handleRefreshLocation}
          disabled={gettingLocation || trackingOrder}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={gettingLocation || trackingOrder ? "#9CA3AF" : "#FF6B35"}
          />
        </TouchableOpacity>
      </View>

      {/* Order Status Bar (when tracking) */}
      {trackingOrder && orderDetails && (
        <View style={styles.statusBar}>
          <View style={styles.statusContent}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: getStatusColor(orderStatus) + "20" },
              ]}
            >
              <Ionicons
                name={getStatusIcon(orderStatus)}
                size={20}
                color={getStatusColor(orderStatus)}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {getStatusText(orderStatus)}
              </Text>
              {estimatedDeliveryTime && (
                <Text style={styles.statusSubtitle}>
                  Estimated delivery: {formatTime(estimatedDeliveryTime)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.viewOrderButton}
              onPress={handleTrackOrder}
            >
              <Text style={styles.viewOrderText}>View Order</Text>
              <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map Section */}
      <View style={styles.mapContainer}>
        {region && (
          <LazyMapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            onPress={trackingOrder ? undefined : handleMapPress}
            showsUserLocation={!!userLocation}
            showsMyLocationButton={false}
          >
            {/* User Location Marker */}
            {userLocation && (
              <LazyMarker coordinate={userLocation}>
                <View style={styles.userMarker}>
                  <Ionicons name="location" size={24} color="#FF6B35" />
                </View>
              </LazyMarker>
            )}

            {/* Restaurant Marker */}
            {restaurantLocation && (
              <LazyMarker coordinate={restaurantLocation}>
                <View style={styles.restaurantMarker}>
                  <Ionicons name="restaurant" size={20} color="#fff" />
                </View>
              </LazyMarker>
            )}

            {/* Driver Marker (when tracking) */}
            {trackingOrder && driverLocation && (
              <LazyMarker coordinate={driverLocation}>
                <View style={styles.driverMarker}>
                  <Ionicons name="bicycle" size={18} color="#fff" />
                </View>
              </LazyMarker>
            )}

            {/* Route Line (when tracking) */}
            {trackingOrder && routeCoordinates.length > 1 && (
              <LazyPolyline
                coordinates={routeCoordinates}
                strokeColor="#3B82F6"
                strokeWidth={3}
              />
            )}
          </LazyMapView>
        )}

        <TouchableOpacity
          style={[
            styles.recenterButton,
            gettingLocation && styles.recenterButtonDisabled,
          ]}
          onPress={getCurrentLocation}
          activeOpacity={0.8}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <Ionicons name="locate-outline" size={22} color="#111827" />
          )}
        </TouchableOpacity>

        {!trackingOrder && (
          <View style={styles.mapDeliveryFeePill}>
            <Ionicons name="bicycle-outline" size={16} color="#FF6B35" />
            <View style={styles.mapDeliveryFeeInfo}>
              <Text style={styles.mapDeliveryFeeLabel}>Delivery fee</Text>
              <Text style={styles.mapDeliveryFeeValue}>
                {selectedAddress
                  ? formatUGX(calculateDeliveryFee({
                    restaurant: restaurantLocation,
                    address: selectedAddress,
                  }))
                  : "Set delivery location"}
              </Text>
            </View>
          </View>
        )}

        {/* Address Info Overlay */}
        <View style={styles.addressOverlay}>
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons
                name={trackingOrder ? "bicycle" : "location"}
                size={18}
                color="#FF6B35"
              />
              <Text style={styles.addressTitle}>
                {trackingOrder ? "Order Tracking" : "Delivery Address"}
              </Text>
            </View>

            {gettingLocation ? (
              <View style={styles.loadingAddress}>
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text style={styles.loadingAddressText}>
                  Getting your location...
                </Text>
              </View>
            ) : trackingOrder && orderDetails ? (
              <View>
                <Text style={styles.trackingNumber}>
                  Order #{orderDetails.order_number}
                </Text>
                <View style={styles.trackingInfo}>
                  <View style={styles.trackingItem}>
                    <Ionicons name="restaurant" size={14} color="#6B7280" />
                    <Text style={styles.trackingText}>
                      {restaurant?.restaurant_name}
                    </Text>
                  </View>
                  {orderDetails.delivery_users?.users && (
                    <View style={styles.trackingItem}>
                      <Ionicons name="person" size={14} color="#6B7280" />
                      <Text style={styles.trackingText}>
                        Driver: {orderDetails.delivery_users.users.full_name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : selectedAddress ? (
              <View>
                <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {selectedAddress.address_line1}
                  </Text>
                  <Text style={styles.addressCity}>
                    {selectedAddress.city}, {selectedAddress.country || "Uganda"}
                  </Text>
                </View>
                <Text style={styles.addressHint}>
                  📍 Tap anywhere on the map to change location
                </Text>
              </View>
            ) : (
              <Text style={styles.noAddressText}>
                {locationNotice ||
                  "GPS is unavailable. Tap on the map to set your delivery location."}
              </Text>
            )}
          </View>
        </View>

        {/* Map Legend (when tracking) */}
        {trackingOrder && (
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#FF6B35" }]}
              />
              <Text style={styles.legendText}>Restaurant</Text>
            </View>
            {driverLocation && (
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#3B82F6" }]}
                />
                <Text style={styles.legendText}>Driver</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#10B981" }]}
              />
              <Text style={styles.legendText}>You</Text>
            </View>
          </View>
        )}
      </View>

      {/* Restaurant & Order Info */}
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <View style={styles.restaurantInfo}>
            <Image
              source={{
                uri: restaurant?.image_url || "https://via.placeholder.com/40",
              }}
              style={styles.restaurantImage}
            />
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {restaurant?.restaurant_name}
              </Text>
              <Text style={styles.restaurantCuisine} numberOfLines={1}>
                {restaurant?.cuisine_type}
              </Text>
              <Text style={styles.restaurantRating}>
                ⭐ {normalizeRating(restaurant?.restaurant_rating).toFixed(1)}
              </Text>
            </View>
          </View>

          {post && !trackingOrder && (
            <View style={styles.ordercontent}>
              <Image
                source={{ uri: post.image_url }}
                style={styles.postImage}
              />
              <View style={styles.orderInfo}>
                <Text style={styles.orderTitle} numberOfLines={1}>
                  {post.title}
                </Text>
                <View style={styles.orderMetaRow}>
                  {post.discounted_price ? (
                    <>
                      <Text style={styles.discountedPrice} numberOfLines={1}>
                        {formatUGX(post.discounted_price)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.price} numberOfLines={1}>
                      {formatUGX(post.original_price || 49)}
                    </Text>
                  )}

                </View>
              </View>
            </View>
          )}
        </View>

        {/* Order Updates (when tracking) */}
        {trackingOrder && orderUpdates.length > 0 && (
          <View style={styles.updatesSection}>
            <Text style={styles.updatesTitle}>Recent Updates</Text>
            <View style={styles.updatesList}>
              {orderUpdates.slice(0, 3).map((update, index) => (
                <View key={index} style={styles.updateItem}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.updateText}>{update.message}</Text>
                  <Text style={styles.updateTime}>
                    {formatTime(update.timestamp)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Button */}
        {trackingOrder ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.trackButton]}
            onPress={handleTrackOrder}
          >
            <Ionicons name="list" size={18} color="white" />
            <Text style={styles.actionButtonText}>View Full Order Details</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              (!selectedAddress || gettingLocation) &&
              styles.actionButtonDisabled,
            ]}
            onPress={handleOrderNow}
            activeOpacity={0.8}
            disabled={!selectedAddress || gettingLocation}
          >
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Continue to Order</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// app/orders/[restaurantId].tsx - Update only the styles object

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
  statusBar: { backgroundColor: "#FF6B3510", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#FF6B3520" },
  statusContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  statusInfo: { flex: 1, marginLeft: 12 },
  statusTitle: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#111827", marginBottom: 2 },
  statusSubtitle: { fontSize: 12, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  viewOrderButton: { flexDirection: "row", alignItems: "center" },
  viewOrderText: { fontSize: 12, color: "#3B82F6", fontFamily: "Inter", fontWeight: "600" },
  mapContainer: { flex: 1, backgroundColor: "#f3f4f6", position: "relative" },
  map: { width: "100%", height: "100%" },
  recenterButton: { position: "absolute", right: 16, bottom: 16, zIndex: 5, width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 5 },
  recenterButtonDisabled: { opacity: 0.65 },
  mapDeliveryFeePill: { position: "absolute", left: 16, bottom: 16, zIndex: 5, minHeight: 44, maxWidth: SCREEN_WIDTH - 92, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 1 },
  mapDeliveryFeeInfo: { flexDirection: "column", alignItems: "flex-start", gap: 2 },
  mapDeliveryFeeLabel: { fontSize: 10, color: "#6B7280", fontFamily: "Inter", fontWeight: "500", lineHeight: 12 },
  mapDeliveryFeeValue: { fontSize: 12.4, color: "#111827", fontFamily: "Inter", fontWeight: "700", lineHeight: 16, letterSpacing: 0.25 },
  userMarker: { backgroundColor: "#fff", padding: 8, borderRadius: 20, borderWidth: 2, borderColor: "#FF6B35", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  restaurantMarker: { backgroundColor: "#10B981", padding: 8, borderRadius: 16, borderWidth: 2, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  driverMarker: { backgroundColor: "#3B82F6", padding: 8, borderRadius: 16, borderWidth: 2, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  addressOverlay: { position: "absolute", top: 12, left: 12, right: 12 },
  addressCard: { backgroundColor: "rgba(0, 0, 0, 0.85)", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addressHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  addressTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "700", color: "#fff" },
  loadingAddress: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  loadingAddressText: { fontSize: 14, color: "#fff", fontFamily: "Inter", fontWeight: "400" },
  trackingNumber: { fontSize: 15, fontFamily: "Inter", fontWeight: "700", color: "#FF6B35", marginBottom: 8 },
  trackingInfo: { gap: 6 },
  trackingItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trackingText: { fontSize: 13, color: "#fff", fontFamily: "Inter", fontWeight: "400" },
  addressLabel: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#FF6B35", marginBottom: 4, lineHeight: 20, letterSpacing: 0.5 },
  addressText: { fontSize: 14, color: "#fff", marginBottom: 2, lineHeight: 20, fontFamily: "Inter", fontWeight: "400" },
  addressCity: { fontSize: 13, color: "#aaa", marginBottom: 8, fontFamily: "Inter", fontWeight: "400" },
  addressHint: { fontSize: 11, color: "#9CA3AF", marginBottom: 4, fontFamily: "Inter", fontWeight: "400" },
  noAddressText: { fontSize: 14, color: "#fff", textAlign: "center", paddingVertical: 12, fontFamily: "Inter", fontWeight: "400" },
  mapLegend: { position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "rgba(0, 0, 0, 0.85)", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-around" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#fff", fontFamily: "Inter", fontWeight: "400" },
  infoContainer: { backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 0, backgroundColor: "#fff", borderWidth: 0.8, borderColor: "#e5e7eb5a", borderRadius: 8, padding: 8, marginBottom: 12 },
  restaurantInfo: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
  restaurantImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#F3F4F6", marginRight: 10 },
  restaurantDetails: { flex: 1, minWidth: 0 },
  restaurantName: { fontSize: 15, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 2 },
  restaurantCuisine: { fontSize: 12, color: "#6B7280", marginBottom: 2, fontFamily: "Inter", fontWeight: "400" },
  restaurantRating: { fontSize: 12, color: "#FF6B35", fontFamily: "Inter", fontWeight: "600" },
  orderInfo: { flex: 1, minWidth: 0 },
  orderTitle: { fontSize: 14, fontFamily: "AlanSans", fontWeight: "700", color: "#111827", marginBottom: 6 },
  priceSection: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  orderMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  price: { fontSize: 12, fontFamily: "Inter", fontWeight: "700", color: "#FF6B35" },
  originalPrice: { fontSize: 12, color: "#9CA3AF", textDecorationLine: "line-through", fontFamily: "Inter", fontWeight: "400" },
  discountedPrice: { fontSize: 12, fontFamily: "Inter", fontWeight: "700", color: "#FF6B35" },
  metaDot: { fontSize: 12, color: "#9CA3AF", fontFamily: "Inter", fontWeight: "600" },
  deliveryFee: { flexShrink: 1, fontSize: 12, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  ordercontent: { flex: 1.2, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  postImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: "#F3F4F6" },
  updatesSection: { marginTop: 12, marginBottom: 16 },
  updatesTitle: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#111827", marginBottom: 8 },
  updatesList: { backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12 },
  updateItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  updateText: { fontSize: 12, color: "#4B5563", flex: 1, fontFamily: "Inter", fontWeight: "400" },
  updateTime: { fontSize: 11, color: "#9CA3AF", fontFamily: "Inter", fontWeight: "400" },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF6B35", paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  actionButtonDisabled: { backgroundColor: "#FF6B3580" },
  actionButtonText: { color: "#fff", fontSize: 15.5, fontFamily: "Inter", fontWeight: "700", letterSpacing: 0.5 },
  trackButton: { backgroundColor: "#3B82F6" },
});
