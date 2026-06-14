// app/(driver)/live-track/[orderId].tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { parsePoint } from "@/backend/utils/deliveryPricing";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  useLocalSearchParams,
  useRouter
} from "expo-router";
import React,
{
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, LazyPolyline, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

const formatAddress = (value: any) => {
  if (!value) return "Delivery address unavailable";
  if (typeof value === "string") return value;
  return [value.address_line1, value.address_line2, value.city, value.state, value.country].filter(Boolean).join(", ") || "Delivery address unavailable";
};

export default function DriverLiveTrackScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const mapRef = useRef<MapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !user?.id) return;
    const { data } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        delivery_address,
        driver_location_lat,
        driver_location_lng,
        restaurants:restaurants!orders_restaurant_id_fkey(
          restaurant_name,
          address,
          latitude,
          longitude
        ),
        customers:users!orders_customer_id_fkey(full_name, phone)
      `)
      .eq("id", orderId)
      .maybeSingle();
    setOrder(data || null);
  }, [orderId, user?.id]);

  const updateDriverLocation = useCallback(async () => {
    if (!user?.id || !orderId) return;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required for live tracking.");
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) throw new Error("Turn on device location services to use live tracking.");
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 45_000, requiredAccuracy: 100 });
      const position = lastKnown || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setDriverLocation(coords);
      await db
        .from("orders")
        .update({
          driver_location_lat: String(coords.latitude),
          driver_location_lng: String(coords.longitude),
          driver_location_updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("driver_id", user.id);
      await db.from("location_history").insert({
        order_id: orderId,
        driver_id: user.id,
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
      });
      setLocationMessage(null);
    } catch (error: any) {
      const message = error?.message || "Current location is unavailable.";
      setLocationMessage(message);
    }
  }, [orderId, user?.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchOrder();
      await updateDriverLocation();
      setLoading(false);
    };
    load();
    const interval = setInterval(updateDriverLocation, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrder, updateDriverLocation]);

  const restaurantLat = Number(order?.restaurants?.latitude);
  const restaurantLng = Number(order?.restaurants?.longitude);
  const hasRestaurantCoords = Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng);
  const deliveryPoint = useMemo(() => parsePoint(order?.delivery_address), [order?.delivery_address]);
  const customerLat = Number(deliveryPoint?.latitude);
  const customerLng = Number(deliveryPoint?.longitude);
  const hasCustomerCoords = Number.isFinite(customerLat) && Number.isFinite(customerLng);
  const customerPoint = useMemo(
    () => (hasCustomerCoords ? { latitude: customerLat, longitude: customerLng } : null),
    [customerLat, customerLng, hasCustomerCoords],
  );
  const restaurantPoint = useMemo(
    () => (hasRestaurantCoords ? { latitude: restaurantLat, longitude: restaurantLng } : null),
    [hasRestaurantCoords, restaurantLat, restaurantLng],
  );
  const routeLine =
    order?.status === "out_for_delivery" && driverLocation && customerPoint
      ? [driverLocation, customerPoint]
      : driverLocation && restaurantPoint
        ? [driverLocation, restaurantPoint]
        : [];
  const center = driverLocation || restaurantPoint || { latitude: 0.3476, longitude: 32.5825 };

  useEffect(() => {
    const points =
      order?.status === "out_for_delivery"
        ? [driverLocation, customerPoint].filter(Boolean)
        : [driverLocation, restaurantPoint].filter(Boolean);
    if (!mapRef.current || points.length < 2) return;
    mapRef.current.fitToCoordinates(points as { latitude: number; longitude: number }[], {
      edgePadding: { top: 80, right: 48, bottom: 260, left: 48 },
      animated: true,
    });
  }, [customerPoint, driverLocation, order?.status, restaurantPoint]);

  const openDirections = () => {
    const target = order?.status === "out_for_delivery" ? customerPoint : restaurantPoint;
    if (!target) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#FF6B35" size="large" />
        <Text style={styles.loadingText}>Opening live tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrDriverFallback(router, `/(driver)/orders/${orderId}`, navigation)}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <Text style={styles.headerSubtitle}>Order #{order?.order_number || "--"}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={updateDriverLocation}>
          <Ionicons name="refresh" size={18} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      <LazyMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        showsUserLocation
        showsMyLocationButton
      >
        {driverLocation && <LazyMarker coordinate={driverLocation} title="Your location" pinColor="#FF6B35" />}
        {hasRestaurantCoords && order?.status !== "out_for_delivery" && <LazyMarker coordinate={{ latitude: restaurantLat, longitude: restaurantLng }} title={order?.restaurants?.restaurant_name || "Restaurant"} pinColor="#10B981" />}
        {hasCustomerCoords && <LazyMarker coordinate={{ latitude: customerLat, longitude: customerLng }} title={order?.customers?.full_name || "Customer"} pinColor="#3B82F6" />}
        {routeLine.length > 1 && <LazyPolyline coordinates={routeLine} strokeColor="#111827" strokeWidth={4} />}
      </LazyMapView>

      <View style={styles.bottomCard}>
        <View style={styles.cardHandle} />
        <Text style={styles.cardTitle}>{order?.status === "out_for_delivery" ? "Delivering to customer" : "Go to pickup"}</Text>
        <View style={styles.infoRow}>
          <Ionicons name="restaurant-outline" size={17} color="#FF6B35" />
          <Text style={styles.infoText}>{order?.restaurants?.restaurant_name || "Restaurant"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={17} color="#6B7280" />
          <Text style={styles.infoText} numberOfLines={2}>{formatAddress(order?.delivery_address)}</Text>
        </View>
        {locationMessage ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color="#FF6B35" />
            <Text style={styles.warningText}>{locationMessage}</Text>
          </View>
        ) : null}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={updateDriverLocation}>
            <Text style={styles.primaryButtonText}>Update Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={openDirections}>
            <Text style={styles.secondaryButtonText}>Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 10, color: "#6B7280", fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  map: { flex: 1 },
  bottomCard: { backgroundColor: "#FFFFFF", padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: "#E5E7EB" },
  cardHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, color: "#111827", fontWeight: "700", marginBottom: 12, fontFamily: "Inter" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  infoText: { flex: 1, color: "#374151", fontSize: 13, lineHeight: 18, fontWeight: "500", fontFamily: "Inter" },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10, marginTop: 4 },
  warningText: { flex: 1, color: "#9A3412", fontSize: 12, lineHeight: 17, fontWeight: "500", fontFamily: "Inter" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryButton: { flex: 1, backgroundColor: "#FF6B35", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", fontFamily: "Inter" },
  secondaryButton: { width: 92, backgroundColor: "#FFF1EB", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#FED7AA" },
  secondaryButtonText: { color: "#FF6B35", fontSize: 13, fontWeight: "700", fontFamily: "Inter" },
});
