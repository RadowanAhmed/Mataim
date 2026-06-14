import { logger } from "@/backend/utils/logger";
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import NotificationBell from "@/app/components/NotificationBell";
import {
  useAuth,
} from "@/backend/AuthContext";
import { useLocation } from "@/backend/LocationContext";
import {
  getDeliveryPoint,
  getRestaurantPoint,
  ReadyOrder,
  useReadyOrdersLive,
} from "@/backend/hooks/useReadyOrdersLive";
import { DriverAppService } from "@/backend/services/driverAppService";
import { formatMoney } from "@/backend/utils/currency";
import { resolveDriverDeliveryPay } from "@/backend/utils/driverPay";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React,
{
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { LazyMapView, LazyMarker, LazyPolyline, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import { SafeAreaView } from "react-native-safe-area-context";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import LottieView from "lottie-react-native";
import { animations } from "@/constent/animations";

const DEFAULT_REGION = {
  latitude: 0.3476,
  longitude: 32.5825,
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

function getDeliveryAddress(address: any) {
  if (!address) return "Drop-off address unavailable";

  if (typeof address === "string") {
    try {
      return getDeliveryAddress(JSON.parse(address));
    } catch {
      return address;
    }
  }

  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.country,
  ].filter(Boolean);

  return (
    parts.length
      ? parts.join(", ")
      : address.formatted_address || "Drop-off address unavailable"
  );
}

function isCurrentOrder(order?: ReadyOrder | null) {
  if (!order?.id) return false;
  return Boolean(order.driver_id);
}

export default function DriverExploreScreen() {
  const router = useRouter();
  const mapRef = useRef<any | null>(null);
  const { user } = useAuth() as any;
  const { startTracking, stopTracking } = useLocation();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [skippedOrders, setSkippedOrders] = useState<Record<string, number>>({});
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [statusMessageIndex, setStatusMessageIndex] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const locationPulse = useRef(new Animated.Value(0)).current;
  const [buttonWidth, setButtonWidth] = useState(0);
  const swipeableRef = useRef<ReanimatedSwipeable>(null);
  const statusSwipeableRef = useRef<ReanimatedSwipeable>(null);

  const {
    readyOrders,
    currentOrder,
    hasCurrentOrder,
    driverLocation,
    driverOnline,
    loading,
    notice,
    refresh,
    acceptOrder,
  } = useReadyOrdersLive({
    enableLocation: true,
    pollMs: 10_000,
  });

  const availableOrders = useMemo(() => {
    if (currentOrder) return [];

    const now = Date.now();

    return readyOrders
      .filter((order) => {
        const skippedUntil = skippedOrders[order.id] || 0;
        return skippedUntil <= now;
      })
      .sort((a, b) => {
        const rankA = Number(a.offerRank ?? 9999);
        const rankB = Number(b.offerRank ?? 9999);

        if (rankA !== rankB) return rankA - rankB;

        const distanceA = Number(a.distance ?? 9999);
        const distanceB = Number(b.distance ?? 9999);

        if (distanceA !== distanceB) return distanceA - distanceB;

        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      });
  }, [currentOrder, readyOrders, skippedOrders]);

  const visibleOrders = useMemo(() => {
    if (currentOrder) return [currentOrder];
    return availableOrders;
  }, [availableOrders, currentOrder]);

  const selectedOrder = useMemo(() => {
    if (currentOrder) return currentOrder;

    if (selectedOrderId) {
      return (
        availableOrders.find((order) => order.id === selectedOrderId) ||
        availableOrders[0] ||
        null
      );
    }

    return availableOrders[0] || null;
  }, [availableOrders, currentOrder, selectedOrderId]);

  const searchMessages = useMemo(
    () => [
      "Finding trips near you",
      "You're online and ready",
      "Checking nearby restaurants",
      "Waiting for a delivery offer",
    ],
    [],
  );

  useEffect(() => {
    if (currentOrder) {
      setSkippedOrders({});
      return;
    }

    const now = Date.now();
    const readyIds = new Set(readyOrders.map((order) => order.id));

    setSkippedOrders((current) => {
      const next: Record<string, number> = {};
      let changed = false;

      Object.entries(current).forEach(([orderId, skippedUntil]) => {
        if (readyIds.has(orderId) && skippedUntil > now) {
          next[orderId] = skippedUntil;
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [currentOrder, readyOrders]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(locationPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(locationPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [locationPulse]);

  useEffect(() => {
    if (selectedOrder || loading) return;

    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(statusOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(statusOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      setStatusMessageIndex((index) => (index + 1) % searchMessages.length);
    }, 2400);

    return () => clearInterval(timer);
  }, [loading, searchMessages.length, selectedOrder, statusOpacity]);

  useEffect(() => {
    if (currentOrder) return;

    if (selectedOrderId && !availableOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(availableOrders[0]?.id || null);
    }

    if (!selectedOrderId && availableOrders.length > 0) {
      setSelectedOrderId(availableOrders[0].id);
    }
  }, [availableOrders, currentOrder, selectedOrderId]);

  useEffect(() => {
    if (!user?.id || !currentOrder?.id) {
      stopTracking();
      return;
    }

    startTracking(user.id, currentOrder.id).catch((error) => {
      logger.debug("Explore live tracking could not start:", error);
    });

    return () => stopTracking();
  }, [currentOrder?.id, startTracking, stopTracking, user?.id]);

  const selectedRestaurantPoint = useMemo(() => {
    return selectedOrder ? getRestaurantPoint(selectedOrder) : null;
  }, [selectedOrder]);

  const selectedDeliveryPoint = useMemo(() => {
    return selectedOrder ? getDeliveryPoint(selectedOrder) : null;
  }, [selectedOrder]);

  const routeLine = useMemo(() => {
    if (!selectedOrder) return [];

    if (driverLocation && selectedRestaurantPoint && !hasCurrentOrder) {
      return selectedDeliveryPoint
        ? [driverLocation, selectedRestaurantPoint, selectedDeliveryPoint]
        : [driverLocation, selectedRestaurantPoint];
    }

    if (driverLocation && selectedRestaurantPoint && hasCurrentOrder) {
      if (selectedOrder.status === "ready") {
        return [driverLocation, selectedRestaurantPoint];
      }

      if (selectedOrder.status === "out_for_delivery" && selectedDeliveryPoint) {
        return [driverLocation, selectedDeliveryPoint];
      }
    }

    return [];
  }, [
    driverLocation,
    hasCurrentOrder,
    selectedDeliveryPoint,
    selectedOrder,
    selectedRestaurantPoint,
  ]);

  useEffect(() => {
    const points = visibleOrders
      .filter((order) => !(hasCurrentOrder && order.status === "out_for_delivery"))
      .map(getRestaurantPoint)
      .filter(Boolean) as any[];

    if (selectedDeliveryPoint) {
      points.push(selectedDeliveryPoint);
    }

    const markers = [driverLocation, ...points].filter(Boolean) as any[];

    if (!mapRef.current || markers.length === 0) return;

    const timer = setTimeout(() => {
      if (markers.length === 1) {
        mapRef.current?.animateToRegion(
          {
            ...markers[0],
            latitudeDelta: 0.045,
            longitudeDelta: 0.045,
          },
          350,
        );
        return;
      }

      mapRef.current?.fitToCoordinates(markers, {
        edgePadding: {
          top: 110,
          right: 55,
          bottom: selectedOrder ? 245 : 100,
          left: 55,
        },
        animated: true,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    driverLocation,
    hasCurrentOrder,
    selectedDeliveryPoint,
    selectedOrder,
    visibleOrders,
  ]);

  const focusOrder = (order: ReadyOrder) => {
    setSelectedOrderId(order.id);

    const point = getRestaurantPoint(order);

    if (point) {
      mapRef.current?.animateToRegion(
        {
          ...point,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        350,
      );
    }
  };

  const handleGoBack = () => {
    goBackOrDriverFallback(router, "/(driver)/dashboard", navigation);
  };

  const handleSkipOrder = (order: ReadyOrder) => {
    if (hasCurrentOrder || !order?.id || skippingId) return;

    setSkippingId(order.id);
    setLocalNotice("Finding the next best offer...");

    const cooldownMs = 20 * 60 * 1000;
    const now = Date.now();
    const skippedUntil = now + cooldownMs;

    const nextOrders = readyOrders
      .filter((item) => item.id !== order.id)
      .filter((item) => (skippedOrders[item.id] || 0) <= now)
      .sort((a, b) => {
        const rankA = Number(a.offerRank ?? 9999);
        const rankB = Number(b.offerRank ?? 9999);
        if (rankA !== rankB) return rankA - rankB;

        const distanceA = Number(a.distance ?? 9999);
        const distanceB = Number(b.distance ?? 9999);
        return distanceA - distanceB;
      });

    setSkippedOrders((current) => ({
      ...current,
      [order.id]: skippedUntil,
    }));

    swipeableRef.current?.close();

    setTimeout(() => {
      const nextOrder = nextOrders[0];

      setSelectedOrderId(nextOrder?.id || null);
      setLocalNotice(
        nextOrder
          ? null
          : "You're online. Scanning your city for more offers.",
      );
      setSkippingId(null);

      refresh({ silent: true, force: true });
    }, 950);
  };

  const handleAccept = async (order: ReadyOrder) => {
    try {
      setAcceptingId(order.id);
      setLocalNotice(null);

      const accepted = await acceptOrder(order.id);
      setSelectedOrderId(accepted?.id || order.id);
      setLocalNotice("Accepted. Head to the pickup point.");
      await refresh({ silent: true, force: true });
    } catch (error: any) {
      console.error("Error accepting map order:", error);
      setLocalNotice(
        error?.message || "This order may already be taken. Try another one.",
      );
      refresh({ silent: true, force: true });
    } finally {
      setAcceptingId(null);
      swipeableRef.current?.close();
    }
  };

  const handleUpdateStatus = async (
    order: ReadyOrder,
    status: "out_for_delivery" | "delivered",
  ) => {
    if (!user?.id || !order?.id || updatingStatus) return;

    try {
      setUpdatingStatus(status);
      const result = await DriverAppService.updateOrderStatus(
        order.id,
        user.id,
        status,
        driverLocation || undefined,
      );

      if (!result.success) {
        throw new Error(result.message || "Could not update this delivery.");
      }

      setLocalNotice(
        status === "out_for_delivery"
          ? "Pickup confirmed. Route updated to the customer."
          : "Delivery completed. Nice work.",
      );
      if (status === "delivered") stopTracking();
      await refresh({ silent: false, force: true });
    } catch (error: any) {
      Alert.alert("Update failed", error?.message || "Try again in a moment.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCancelDelivery = (order: ReadyOrder) => {
    if (!user?.id || !order?.id || updatingStatus) return;

    Alert.alert(
      "Cancel delivery",
      "Cancel this delivery and return to available offers?",
      [
        { text: "Keep delivery", style: "cancel" },
        {
          text: "Cancel delivery",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingStatus("cancelled");
              const result = await DriverAppService.cancelActiveOrder(order.id, user.id);
              if (!result.success) throw new Error(result.message || "Could not cancel this delivery.");
              stopTracking();
              setLocalNotice("Delivery cancelled. Looking for another city offer.");
              await refresh({ silent: false, force: true });
            } catch (error: any) {
              Alert.alert("Cancel failed", error?.message || "Try again in a moment.");
            } finally {
              setUpdatingStatus(null);
            }
          },
        },
      ],
    );
  };

  const openDirections = (order: ReadyOrder) => {
    const point =
      hasCurrentOrder && order.status === "out_for_delivery"
        ? getDeliveryPoint(order) || getRestaurantPoint(order)
        : getRestaurantPoint(order);

    if (!point) return;

    const url = Platform.select({
      ios: `maps://app?daddr=${point.latitude},${point.longitude}`,
      android: `google.navigation:q=${point.latitude},${point.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`,
    });

    Linking.openURL(url as string);
  };

  const region = driverLocation
    ? {
      ...driverLocation,
      latitudeDelta: 0.055,
      longitudeDelta: 0.055,
    }
    : DEFAULT_REGION;

  // Swipe action renderers
  const renderAcceptAction = () => (
    <View style={[styles.acceptActionContainer, { width: buttonWidth }]}>
      <Ionicons name="checkmark-circle" size={28} color="#fff" />
      <Text style={styles.swipeActionText}>Accept</Text>
    </View>
  );

  const renderSkipAction = () => (
    <View style={[styles.skipActionContainer, { width: buttonWidth }]}>
      <Ionicons name="close-circle" size={28} color="#fff" />
      <Text style={styles.swipeActionText}>Skip</Text>
    </View>
  );

  const renderConfirmAction = (label: string) => (
    <View style={[styles.confirmActionContainer, { width: buttonWidth }]}>
      <Ionicons name="checkmark-circle" size={28} color="#fff" />
      <Text style={styles.swipeActionText}>{label}</Text>
    </View>
  );

  if (!user || user.user_type !== "driver") {
    return (
      <SafeAreaView style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>Driver account required</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <LazyMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        loadingEnabled
      >
        {routeLine.length > 1 && (
          <LazyPolyline
            coordinates={routeLine}
            strokeColor={hasCurrentOrder ? "#111827" : "#FF6B35"}
            strokeWidth={4}
          />
        )}

        {driverLocation && (
          <LazyMarker coordinate={driverLocation} title="You">
            <View style={styles.driverMarkerWrap}>
              <LottieView
                source={animations.locationpulse}
                autoPlay
                loop
                style={styles.driverLottie}
                resizeMode="contain"
              />
            </View>
          </LazyMarker>
        )}
        {visibleOrders.map((order) => {
          if (hasCurrentOrder && order.status === "out_for_delivery") return null;

          const point = getRestaurantPoint(order);
          if (!point) return null;

          const active = selectedOrder?.id === order.id;

          return (
            <LazyMarker
              key={order.id}
              coordinate={point}
              title={order.restaurants?.restaurant_name || "Restaurant"}
              description={`${formatMoney(resolveDriverDeliveryPay(order))} - ${order.distance ?? "--"
                } km`}
              onPress={() => focusOrder(order)}
            >
              <View
                style={[styles.orderMarker, active && styles.orderMarkerActive]}
              >
                <Ionicons name="restaurant" size={17} color="#fff" />
              </View>
            </LazyMarker>
          );
        })}

        {selectedDeliveryPoint && (
          <LazyMarker
            coordinate={selectedDeliveryPoint}
            title="Drop-off"
            description={getDeliveryAddress(selectedOrder?.delivery_address)}
          >
            <View style={styles.dropoffMarker}>
              <Ionicons name="home" size={18} color="#fff" />
            </View>
          </LazyMarker>
        )}
      </LazyMapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={handleGoBack}
          >
            <Ionicons name="arrow-back" size={21} color="#111827" />
          </TouchableOpacity>

          <NotificationBell tintColor="#111827" showQuickView />
        </View>
      </SafeAreaView>

      {selectedOrder && (
        <View style={styles.orderSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.mainRow}>
            {selectedOrder.restaurants?.image_url ? (
              <Image
                source={{ uri: selectedOrder.restaurants.image_url }}
                style={styles.restaurantImage}
              />
            ) : (
              <View style={styles.restaurantImageFallback}>
                <Ionicons name="restaurant" size={24} color="#FF6B35" />
              </View>
            )}

            <View style={styles.orderInfo}>
              <Text style={styles.fare}>
                {formatMoney(resolveDriverDeliveryPay(selectedOrder))}
              </Text>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {selectedOrder.restaurants?.restaurant_name || "Restaurant"}
              </Text>
              <Text style={styles.restaurantAddress} numberOfLines={1}>
                {selectedOrder.restaurants?.address || "Restaurant location"}
              </Text>
            </View>
            {/* Distance + Directions Row */}
            <View style={styles.distanceDirectionRow}>
              <TouchableOpacity
                style={styles.directionButtonSmall}
                onPress={() => openDirections(selectedOrder)}
              >
                <Ionicons name="navigate" size={18} color="#111827" />
              </TouchableOpacity>
              <View style={styles.distanceBoxSmall}>
                <Text style={styles.distanceTextSmall}>
                  {selectedOrder.distance ?? "--"}
                </Text>
                <Text style={styles.distanceLabelSmall}>km</Text>
              </View>
            </View>
          </View>

          <View style={styles.compactRoute}>
            <View style={styles.routeStop}>
              <View style={styles.pickupDot} />
              <Text style={styles.routeText} numberOfLines={1}>
                {selectedOrder.restaurants?.restaurant_name || "Pickup"}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
            <View style={styles.routeStop}>
              <View style={styles.dropoffDot} />
              <Text style={styles.routeText} numberOfLines={1}>
                {getDeliveryAddress(selectedOrder.delivery_address)}
              </Text>
            </View>
          </View>

          <View style={styles.metricsStrip}>
            <Text style={styles.metricText}>{selectedOrder.minutes ?? "--"} min</Text>
            <Text style={styles.metricDivider}>-</Text>
            <Text style={styles.metricText}>
              {selectedOrder.tripDistance ?? selectedOrder.distance ?? "--"} km trip
            </Text>
            <Text style={styles.metricDivider}>-</Text>
            <Text style={styles.metricText}>
              {selectedOrder.valueScore ? `${selectedOrder.valueScore}k/km` : "smart match"}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            {hasCurrentOrder || isCurrentOrder(selectedOrder) ? (
              <>
                <TouchableOpacity
                  style={styles.cancelDeliveryButton}
                  onPress={() => handleCancelDelivery(selectedOrder)}
                  disabled={updatingStatus === "cancelled"}
                  activeOpacity={0.85}
                >
                  {updatingStatus === "cancelled" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="close" size={22} color="#fff" />
                  )}
                </TouchableOpacity>

                {selectedOrder.status === "ready" ? (
                  <TouchableOpacity
                    style={[styles.acceptButtonBlack, { flex: 1, backgroundColor: "#22D3EE" }]}
                    onPress={() => handleUpdateStatus(selectedOrder, "out_for_delivery")}
                    disabled={Boolean(updatingStatus)}
                    activeOpacity={0.9}
                  >
                    {updatingStatus === "out_for_delivery" ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={[styles.acceptTextWhite, { color: "#000" }]}>
                        Picked Up
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.acceptButtonBlack, { flex: 1, backgroundColor: "#10B981" }]}
                    onPress={() => handleUpdateStatus(selectedOrder, "delivered")}
                    disabled={Boolean(updatingStatus)}
                    activeOpacity={0.9}
                  >
                    {updatingStatus === "delivered" ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={[styles.acceptTextWhite, { color: "#000" }]}>
                        Delivered
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Full-width swipeable accept button with 40% threshold
              <View
                style={{ flex: 1 }}
                onLayout={(e) => {
                  const width = e.nativeEvent.layout.width;
                  if (width > 0) setButtonWidth(width);
                }}
              >
                <ReanimatedSwipeable
                  ref={swipeableRef}
                  containerStyle={styles.swipeableContainer}
                  friction={2}
                  leftThreshold={buttonWidth > 0 ? buttonWidth * 0.4 : 60}
                  rightThreshold={buttonWidth > 0 ? buttonWidth * 0.4 : 60}
                  renderLeftActions={renderAcceptAction}
                  renderRightActions={renderSkipAction}
                  onSwipeableOpen={(direction) => {
                    if (direction === "right") {
                      handleAccept(selectedOrder);
                    } else if (direction === "left") {
                      handleSkipOrder(selectedOrder);
                    }
                  }}
                >
                  <TouchableOpacity
                    style={styles.acceptButtonBlack}
                    onPress={() => handleAccept(selectedOrder)}
                    disabled={acceptingId === selectedOrder.id}
                    activeOpacity={0.9}
                  >
                    {acceptingId === selectedOrder.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.acceptTextWhite}>Accept and go</Text>
                    )}
                  </TouchableOpacity>
                </ReanimatedSwipeable>
              </View>
            )}
          </View>

          {!hasCurrentOrder && availableOrders.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.orderRail}
              contentContainerStyle={styles.orderRailContent}
            >
              {availableOrders.slice(0, 12).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.railItem,
                    selectedOrder.id === item.id && styles.railItemActive,
                  ]}
                  onPress={() => focusOrder(item)}
                >
                  <Text style={styles.railFare}>
                    {formatMoney(resolveDriverDeliveryPay(item))}
                  </Text>
                  <Text style={styles.railDistance}>
                    {item.distance ?? "--"} km
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {!selectedOrder && !hasCurrentOrder && (
        <View style={styles.searchLine}>
          <View style={styles.searchLineIcon}>
            {loading ? (
              <ActivityIndicator color="#FF6B35" size="small" />
            ) : (
              <Ionicons name="radio" size={20} color="#22D3EE" />
            )}
          </View>

          <View style={styles.searchLineTextWrap}>
            <Animated.Text
              style={[styles.searchLineTitle, { opacity: statusOpacity }]}
              numberOfLines={1}
            >
              {!driverOnline
                ? "You are offline"
                : loading
                  ? "Matching nearby offers"
                  : searchMessages[statusMessageIndex]}
            </Animated.Text>
            <Text style={styles.searchLineSubtitle} numberOfLines={1}>
              {localNotice || notice || "Scanning by pickup distance, trip time, and pay."}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  driverMarkerWrap: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    padding: 0,
    paddingBottom: -40,
  },
  driverLottie: {
    width: 48,
    height: 48,
    resizeMode: "contain",
    right: 28,
    top: 2,
    position: "absolute",
  },
  driverPulse: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#22D3EE",
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#111827",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  orderMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  orderMarkerActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000000",
    borderColor: "#FF6B35",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  dropoffMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#10B981",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  orderSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14.8,
    paddingBottom: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 3,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#D1D5DB",
    marginBottom: 12,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  restaurantImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  restaurantImageFallback: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  orderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fare: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Inter",
  },
  restaurantName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: "Inter",
  },
  restaurantAddress: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
    fontFamily: "Inter",
  },
  distanceDirectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 10,
    gap: 10,
    position: "absolute",
    right: 4,
    top: 2,
  },
  directionButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  distanceBoxSmall: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  distanceTextSmall: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: "Inter",
  },
  distanceLabelSmall: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  compactRoute: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  routeStop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6B35",
    marginRight: 8,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
    marginRight: 8,
  },
  routeText: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  metricsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  metricText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  metricDivider: {
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  swipeableContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  acceptButtonBlack: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptTextWhite: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  acceptActionContainer: {
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  skipActionContainer: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  confirmActionContainer: {
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: "Inter",
  },
  cancelDeliveryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  directionButton: {
    width: 48,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#22D3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  deliverButton: {
    backgroundColor: "#10B981",
  },
  acceptText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  orderRail: {
    marginTop: 14,
  },
  orderRailContent: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 8,
  },
  railItem: {
    minWidth: 78,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  railItemActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FF6B35",
  },
  railFare: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Inter",
  },
  railDistance: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    fontFamily: "Inter",
  },
  searchLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 100,
    borderRadius: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 0,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -8 },
    elevation: 6,
  },
  searchLineIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16, // keep icon away from edge
    marginRight: 10,
    marginBottom: 8,
  },
  searchLineTextWrap: {
    flex: 1,
    marginRight: 20, // keep text away from edge
    marginBottom: 8,
  },
  searchLineTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter",
    letterSpacing: 0.3,
  },
  searchLineSubtitle: {
    color: "#6B7280",
    fontSize: 12.3,
    fontWeight: "500",
    marginTop: 2,
    fontFamily: "Inter",
    letterSpacing: 0.1,
  },
  emptyScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter",
  },
});