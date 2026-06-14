import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, LazyPolyline, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatUGX } from "@/backend/utils/currency";

export default function CustomerNotificationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>("");

  useEffect(() => {
    fetchNotificationDetails();
    getUserLocation();
  }, [id]);

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const fetchNotificationDetails = async () => {
    try {
      setLoading(true);

      // Fetch notification
      const { data: notificationData, error: notifError } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("id", id)
        .single();

      if (notifError) throw notifError;
      setNotification(notificationData);

      // Mark as read
      if (!notificationData.read) {
        await supabase
          .from("user_notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("id", id);
      }

      // If notification has order_id, fetch order details
      if (notificationData.data?.order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select(
            `
            *,
            restaurants!inner(
              *,
              users!inner(full_name, phone, profile_image_url)
            ),
            delivery_users!inner(
              *,
              users!inner(full_name, phone, profile_image_url)
            ),
            order_items(
              *,
              posts!inner(title, image_url, description),
              menu_items!inner(name, image_url, description)
            )
          `,
          )
          .eq("id", notificationData.data.order_id)
          .single();

        if (orderData) {
          setOrderDetails(orderData);

          // Get restaurant location
          if (
            orderData.restaurants?.latitude &&
            orderData.restaurants?.longitude
          ) {
            const restLocation = {
              latitude: parseFloat(orderData.restaurants.latitude),
              longitude: parseFloat(orderData.restaurants.longitude),
              title: orderData.restaurants.restaurant_name,
            };
            setRestaurantLocation(restLocation);
          }

          // Get driver location
          if (
            orderData.delivery_users?.current_location_lat &&
            orderData.delivery_users?.current_location_lng
          ) {
            const driverLoc = {
              latitude: parseFloat(
                orderData.delivery_users.current_location_lat,
              ),
              longitude: parseFloat(
                orderData.delivery_users.current_location_lng,
              ),
              title: orderData.delivery_users.users?.full_name,
            };
            setDriverLocation(driverLoc);
          }

          // Setup map region and route
          setupMapRegion(orderData);

          // Calculate estimated delivery time
          calculateEstimatedTime(orderData);
        }
      }
    } catch (error) {
      console.error("Error fetching notification:", error);
      Alert.alert("Error", "Failed to load notification details");
    } finally {
      setLoading(false);
    }
  };

  const setupMapRegion = (orderData: any) => {
    const locations = [];

    if (restaurantLocation) locations.push(restaurantLocation);
    if (driverLocation) locations.push(driverLocation);
    if (userLocation) locations.push(userLocation);

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

      setMapRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
      });

      // Set route coordinates (restaurant -> driver -> user)
      if (restaurantLocation && userLocation) {
        setRouteCoordinates([restaurantLocation, userLocation]);
      }
    }
  };

  const calculateEstimatedTime = (orderData: any) => {
    if (!orderData.estimated_delivery_time) {
      // Calculate based on status
      const now = new Date();
      let estimated = new Date();

      switch (orderData.status) {
        case "pending":
          estimated.setMinutes(estimated.getMinutes() + 40);
          break;
        case "confirmed":
          estimated.setMinutes(estimated.getMinutes() + 35);
          break;
        case "preparing":
          estimated.setMinutes(estimated.getMinutes() + 25);
          break;
        case "ready":
          estimated.setMinutes(estimated.getMinutes() + 20);
          break;
        case "out_for_delivery":
          estimated.setMinutes(estimated.getMinutes() + 15);
          break;
        default:
          estimated.setMinutes(estimated.getMinutes() + 30);
      }

      setEstimatedTime(
        estimated.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } else {
      setEstimatedTime(
        new Date(orderData.estimated_delivery_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  };

  const getOrderStatusIcon = (status: string) => {
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

  const getStatusDescription = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "Restaurant is reviewing your order";
      case "confirmed":
        return "Restaurant has accepted your order";
      case "preparing":
        return "Chef is preparing your food";
      case "ready":
        return "Your order is ready for pickup";
      case "out_for_delivery":
        return "Driver is on the way to you";
      case "delivered":
        return "Order has been delivered";
      case "cancelled":
        return "Order has been cancelled";
      default:
        return "Processing your order";
    }
  };

  const handleTrackOrder = () => {
    if (orderDetails?.id) {
      router.push({
        pathname: "/orders/track",
        params: {
          orderId: orderDetails.id,
          restaurantId: orderDetails.restaurant_id,
          restaurantName: orderDetails.restaurants?.restaurant_name,
          restaurantLat: orderDetails.restaurants?.latitude,
          restaurantLng: orderDetails.restaurants?.longitude,
          orderStatus: orderDetails.status,
        },
      });
    }
  };

  const handleViewRestaurant = () => {
    if (orderDetails?.restaurant_id) {
      router.push(`/restaurant/${orderDetails.restaurant_id}`);
    }
  };

  const handleContactDriver = () => {
    if (orderDetails?.delivery_users?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.delivery_users.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handleContactRestaurant = () => {
    if (orderDetails?.restaurants?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.restaurants.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handleReorder = async () => {
    if (!orderDetails) return;

    Alert.alert("Reorder", "Would you like to reorder the same items?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reorder",
        onPress: async () => {
          try {
            // Create new cart with same items
            const cartItems = orderDetails.order_items.map((item: any) => ({
              post_id: item.post_id,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              special_instructions: item.special_instructions,
            }));

            const { data: cartData, error: cartError } = await supabase
              .from("carts")
              .upsert({
                user_id: user?.id,
                restaurant_id: orderDetails.restaurant_id,
                items: cartItems,
                subtotal: orderDetails.total_amount,
                total_items: orderDetails.order_items.length,
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (cartError) throw cartError;

            Alert.alert("Success", "Items added to cart!");
            router.push(`/restaurant/${orderDetails.restaurant_id}`);
          } catch (error) {
            console.error("Reorder error:", error);
            Alert.alert("Error", "Failed to reorder items");
          }
        },
      },
    ]);
  };

  const handleRateOrder = () => {
    if (orderDetails?.id) {
      router.push({
        pathname: "/orders/rate",
        params: { orderId: orderDetails.id },
      });
    }
  };

  const handleReportIssue = () => {
    Alert.alert("Report Issue", "Please describe the issue with your order", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Missing Items",
        onPress: () => handleSubmitIssue("Missing Items"),
      },
      {
        text: "Wrong Order",
        onPress: () => handleSubmitIssue("Wrong Order"),
      },
      {
        text: "Quality Issue",
        onPress: () => handleSubmitIssue("Quality Issue"),
      },
      {
        text: "Other",
        onPress: () => promptForIssueDetails(),
      },
    ]);
  };

  const handleSubmitIssue = async (issueType: string) => {
    try {
      const { error } = await supabase.from("order_issues").insert({
        order_id: orderDetails.id,
        user_id: user?.id,
        issue_type: issueType,
        description: issueType,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      Alert.alert(
        "Success",
        "Issue reported successfully. Our team will contact you shortly.",
      );
    } catch (error) {
      console.error("Issue report error:", error);
      Alert.alert("Error", "Failed to report issue");
    }
  };

  const promptForIssueDetails = () => {
    Alert.prompt(
      "Describe Issue",
      "Please describe the issue in detail:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async (description) => {
            if (description) {
              await handleSubmitIssue(`Other: ${description}`);
            }
          },
        },
      ],
      "plain-text",
    );
  };

  if (loading) {
    return (
      <SafeAreaView>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notification Alert */}
        <View style={styles.notificationAlert}>
          <View style={styles.notificationHeader}>
            <Ionicons name="notifications" size={24} color="#FF6B35" />
            <View style={styles.notificationTitleContainer}>
              <Text style={styles.notificationTitle}>
                {notification?.title}
              </Text>
              <Text style={styles.notificationTime}>
                {new Date(notification?.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
          <Text style={styles.notificationBody}>{notification?.body}</Text>
        </View>

        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIconContainer,
                {
                  backgroundColor: getStatusColor(orderDetails?.status) + "20",
                },
              ]}
            >
              <Ionicons
                name={getOrderStatusIcon(orderDetails?.status)}
                size={24}
                color={getStatusColor(orderDetails?.status)}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {orderDetails?.status?.replace(/_/g, " ").toUpperCase()}
              </Text>
              <Text style={styles.statusDescription}>
                {getStatusDescription(orderDetails?.status)}
              </Text>
            </View>
          </View>

          {estimatedTime && (
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.etaText}>
                Estimated delivery: {estimatedTime}
              </Text>
            </View>
          )}

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            {["confirmed", "preparing", "ready", "delivered"].map(
              (step, index) => {
                const isActive =
                  ["confirmed", "preparing", "ready", "delivered"].indexOf(
                    orderDetails?.status,
                  ) >= index;
                const isCurrent = orderDetails?.status === step;

                return (
                  <View key={step} style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressDot,
                        isActive && styles.activeDot,
                        isCurrent && styles.currentDot,
                      ]}
                    >
                      {isActive && !isCurrent ? (
                        <Ionicons name="checkmark" size={12} color="white" />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.progressLabel,
                        isActive && styles.activeLabel,
                      ]}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </Text>
                    {index < 3 && (
                      <View
                        style={[
                          styles.progressLine,
                          isActive && styles.activeLine,
                        ]}
                      />
                    )}
                  </View>
                );
              },
            )}
          </View>
        </View>

        {/* Order Summary */}
        {orderDetails && (
          <View style={styles.orderSummary}>
            <Text style={styles.sectionTitle}>Order Summary</Text>

            <View style={styles.summaryCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNumber}>
                    #{orderDetails.order_number}
                  </Text>
                  <Text style={styles.orderTime}>
                    {new Date(orderDetails.created_at).toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.amountBadge,
                    {
                      backgroundColor:
                        getStatusColor(orderDetails.status) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.amountText,
                      { color: getStatusColor(orderDetails.status) },
                    ]}
                  >
                    {formatUGX(orderDetails.final_amount)}
                  </Text>
                </View>
              </View>

              {/* Items List */}
              <View style={styles.itemsSection}>
                {orderDetails.order_items?.map((item: any, index: number) => (
                  <View key={index} style={styles.orderItem}>
                    <Image
                      source={{
                        uri:
                          item.posts?.image_url ||
                          item.menu_items?.image_url ||
                          "https://via.placeholder.com/50",
                      }}
                      style={styles.itemImage}
                    />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>
                        {item.posts?.title || item.menu_items?.name}
                      </Text>
                      {item.special_instructions && (
                        <Text style={styles.itemInstructions}>
                          Note: {item.special_instructions}
                        </Text>
                      )}
                      <Text style={styles.itemQuantity}>
                        Qty: {item.quantity} × {formatUGX(item.unit_price)}
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>
                      {formatUGX((item.unit_price * item.quantity))}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Price Breakdown */}
              <View style={styles.priceBreakdown}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Subtotal</Text>
                  <Text style={styles.priceValue}>
                    {formatUGX(orderDetails.total_amount)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Fee</Text>
                  <Text style={styles.priceValue}>
                    {formatUGX(orderDetails.delivery_fee)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Tax</Text>
                  <Text style={styles.priceValue}>
                    {formatUGX(orderDetails.tax_amount)}
                  </Text>
                </View>
                <View style={[styles.priceRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {formatUGX(orderDetails.final_amount)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Restaurant & Driver Info */}
        {orderDetails && (
          <View style={styles.contactsSection}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            {/* Restaurant Card */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={handleViewRestaurant}
            >
              <Image
                source={{
                  uri:
                    orderDetails.restaurants?.users?.profile_image_url ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.contactImage}
              />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>
                  {orderDetails.restaurants?.restaurant_name}
                </Text>
                <Text style={styles.contactType}>Restaurant</Text>
                <Text style={styles.contactAddress}>
                  {orderDetails.restaurants?.address}
                </Text>
                <Text style={styles.contactPhone}>
                  📞 {orderDetails.restaurants?.users?.phone}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleContactRestaurant}
              >
                <Ionicons name="call" size={18} color="#3B82F6" />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Driver Card */}
            {orderDetails.delivery_users && (
              <View style={styles.contactCard}>
                <Image
                  source={{
                    uri:
                      orderDetails.delivery_users?.users?.profile_image_url ||
                      "https://via.placeholder.com/50",
                  }}
                  style={styles.contactImage}
                />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>
                    {orderDetails.delivery_users?.users?.full_name}
                  </Text>
                  <Text style={styles.contactType}>Delivery Partner</Text>
                  <View style={styles.driverStats}>
                    <Text style={styles.driverRating}>
                      ⭐ {orderDetails.delivery_users?.rating?.toFixed(1)}
                    </Text>
                    <Text style={styles.driverDeliveries}>
                      📦 {orderDetails.delivery_users?.total_deliveries}{" "}
                      deliveries
                    </Text>
                  </View>
                  <Text style={styles.contactVehicle}>
                    {orderDetails.delivery_users?.vehicle_type}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleContactDriver}
                >
                  <Ionicons name="call" size={18} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Map Section */}
        {(restaurantLocation || driverLocation) && (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Ionicons name="map" size={20} color="#FF6B35" />
              <Text style={styles.mapTitle}>Delivery Tracking</Text>
              <TouchableOpacity onPress={() => setShowMap(!showMap)}>
                <Ionicons
                  name={showMap ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {showMap && mapRegion && (
              <>
                <LazyMapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  {/* Restaurant Marker */}
                  {restaurantLocation && (
                    <LazyMarker coordinate={restaurantLocation}>
                      <View style={styles.restaurantMarker}>
                        <Ionicons name="restaurant" size={24} color="#FF6B35" />
                      </View>
                    </LazyMarker>
                  )}

                  {/* Driver Marker */}
                  {driverLocation && (
                    <LazyMarker coordinate={driverLocation}>
                      <View style={styles.driverMarker}>
                        <Ionicons name="bicycle" size={20} color="#3B82F6" />
                      </View>
                    </LazyMarker>
                  )}

                  {/* User Marker */}
                  {userLocation && (
                    <LazyMarker coordinate={userLocation}>
                      <View style={styles.userMarker}>
                        <Ionicons name="person" size={20} color="#10B981" />
                      </View>
                    </LazyMarker>
                  )}

                  {/* Route Line */}
                  {routeCoordinates.length > 1 && (
                    <LazyPolyline
                      coordinates={routeCoordinates}
                      strokeColor="#3B82F6"
                      strokeWidth={3}
                    />
                  )}
                </LazyMapView>

                <View style={styles.mapLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendIcon,
                        { backgroundColor: "#FF6B35" },
                      ]}
                    />
                    <Text style={styles.legendText}>Restaurant</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendIcon,
                        { backgroundColor: "#3B82F6" },
                      ]}
                    />
                    <Text style={styles.legendText}>Driver</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendIcon,
                        { backgroundColor: "#10B981" },
                      ]}
                    />
                    <Text style={styles.legendText}>You</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Delivery Instructions */}
        {orderDetails?.special_instructions && (
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionTitle}>Your Instructions</Text>
            <View style={styles.instructionsCard}>
              <Ionicons name="document-text" size={20} color="#6B7280" />
              <Text style={styles.instructionsText}>
                {orderDetails.special_instructions}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Information */}
        {orderDetails && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.paymentCard}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Method</Text>
                <Text style={styles.paymentValue}>
                  {orderDetails.payment_method?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Status</Text>
                <View
                  style={[
                    styles.paymentStatusBadge,
                    {
                      backgroundColor:
                        orderDetails.payment_status === "completed"
                          ? "#10B98120"
                          : "#F59E0B20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentStatusText,
                      {
                        color:
                          orderDetails.payment_status === "completed"
                            ? "#10B981"
                            : "#F59E0B",
                      },
                    ]}
                  >
                    {orderDetails.payment_status?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {orderDetails?.status === "delivered" ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.reorderButton]}
              onPress={handleReorder}
            >
              <Ionicons name="repeat" size={20} color="#FF6B35" />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rateButton]}
              onPress={handleRateOrder}
            >
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.rateButtonText}>Rate Order</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.trackButton]}
            onPress={handleTrackOrder}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.trackButtonText}>Live Track Order</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={() =>
            Alert.alert(
              "Contact Support",
              "Call: +971 1234 56789\nEmail: support@mataim.com\nWhatsApp: +971 1234 56789",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Call Now",
                  onPress: () => Linking.openURL("tel:+971123456789"),
                },
              ],
            )
          }
        >
          <Ionicons name="headset" size={20} color="#3B82F6" />
          <Text style={styles.supportButtonText}>Contact Support</Text>
        </TouchableOpacity>

        {orderDetails?.status === "delivered" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.issueButton]}
            onPress={handleReportIssue}
          >
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.issueButtonText}>Report Issue</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Add your styles here
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: { flex: 1, padding: 16 },
  notificationAlert: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  notificationTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
  },
  notificationTime: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
  },
  notificationBody: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusInfo: { flex: 1 },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: "#6B7280",
  },
  etaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  etaText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  activeDot: {
    backgroundColor: "#10B981",
  },
  currentDot: {
    backgroundColor: "#3B82F6",
    borderWidth: 3,
    borderColor: "#93C5FD",
  },
  progressLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
  activeLabel: {
    color: "#374151",
    fontWeight: "500",
  },
  progressLine: {
    height: 2,
    backgroundColor: "#E5E7EB",
    position: "absolute",
    top: 11,
    left: "50%",
    right: "-50%",
    zIndex: -1,
  },
  activeLine: {
    backgroundColor: "#10B981",
  },
  orderSummary: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  orderTime: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  amountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemsSection: { marginBottom: 16 },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  itemInstructions: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  priceBreakdown: { marginTop: 16 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  contactsSection: { marginBottom: 16 },
  contactCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  contactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  contactType: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  contactAddress: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    color: "#3B82F6",
  },
  contactVehicle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  driverStats: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  driverRating: {
    fontSize: 12,
    color: "#F59E0B",
    marginRight: 12,
  },
  driverDeliveries: {
    fontSize: 12,
    color: "#6B7280",
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  mapSection: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginLeft: 8,
  },
  map: {
    width: "100%",
    height: 250,
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
  },
  restaurantMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  driverMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  userMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  instructionsSection: { marginBottom: 16 },
  instructionsCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  instructionsText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
    marginLeft: 12,
    lineHeight: 20,
  },
  paymentSection: { marginBottom: 16 },
  paymentCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  paymentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtons: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    minWidth: "48%",
  },
  trackButton: {
    backgroundColor: "#3B82F6",
    flex: 2,
  },
  trackButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  reorderButton: {
    backgroundColor: "#FF6B3510",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  reorderButtonText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  rateButton: {
    backgroundColor: "#F59E0B10",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  rateButtonText: {
    color: "#F59E0B",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  supportButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  supportButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  issueButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  issueButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});
