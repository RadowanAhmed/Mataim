// customer
// app/%28tabs%29/notifications/user_notifacations.tsx
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import {
  normalizeNotificationScreen,
  notificationOrderDetailRouteForUserType,
  notificationOrderIdFromData,
} from "@/backend/utils/notificationRoutes";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Add this at the top with other imports
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { GuestProfileBanner } from "../../components/GuestProfileBanner";

interface Notification {
  id: string;
  title: string;
  body: string;
  type:
  | "security"
  | "order"
  | "delivery"
  | "promotional"
  | "info"
  | "system"
  | "message";
  data: any;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

const db = supabase as any;

const NOTIFICATION_TYPES = {
  security: {
    icon: "shield-checkmark",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    name: "Security",
  },
  order: {
    icon: "fast-food",
    color: "#10B981",
    bgColor: "#ECFDF5",
    name: "Order",
  },
  delivery: {
    icon: "bicycle",
    color: "#10B981",
    bgColor: "#ECFDF5",
    name: "Delivery",
  },
  promotional: {
    icon: "megaphone",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    name: "Promotion",
  },
  info: {
    icon: "information-circle",
    color: "#FF6B35",
    bgColor: "#FFF7ED",
    name: "Information",
  },
  system: {
    icon: "settings",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    name: "System",
  },
  message: {
    // ADD THIS
    icon: "chatbubble-ellipses",
    color: "#6B7280",
    bgColor: "#F5F3FF",
    name: "Message",
  },
};

export default function UserNotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openOrderId?: string }>();
  const { user } = useAuth();
  const { markAsRead, clearBadgeCount } = useNotification();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const openedOrderParamRef = useRef<string | null>(null);
  // Inside the component, add:
  const { checkGuestAction, isGuest } = useGuestAction();

  const openOrderId = Array.isArray(params.openOrderId)
    ? params.openOrderId[0]
    : params.openOrderId;

  const parseNotificationData = (data: any) => {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
    return data || {};
  };

  const getNotificationImageFromData = (notificationData: any) => {
    const senderImage =
      notificationData?.sender_image_url ||
      notificationData?.sender_image ||
      notificationData?.senderImage ||
      notificationData?.senderImageUrl ||
      notificationData?.sender?.image_url ||
      notificationData?.sender?.image ||
      notificationData?.sender?.avatar;

    const restaurantImage =
      notificationData?.restaurant_image ||
      notificationData?.restaurant_image_url ||
      notificationData?.restaurantImage ||
      notificationData?.restaurantImageUrl ||
      notificationData?.restaurant?.image_url ||
      notificationData?.restaurant?.image;

    const orderImage =
      notificationData?.order_image ||
      notificationData?.order_image_url ||
      notificationData?.orderImage ||
      notificationData?.orderImageUrl ||
      notificationData?.order?.image_url ||
      notificationData?.order?.image ||
      notificationData?.image_url ||
      notificationData?.image;

    return restaurantImage || orderImage || senderImage;
  };

  useEffect(() => {
    if (!openOrderId || openedOrderParamRef.current === openOrderId) return;

    openedOrderParamRef.current = openOrderId;
    const timer = setTimeout(() => {
      router.push(notificationOrderDetailRouteForUserType("customer", openOrderId) as any);
    }, 0);

    return () => clearTimeout(timer);
  }, [openOrderId, router]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (activeFilter === "unread") {
        query = query.eq("read", false);
      } else if (activeFilter === "type" && selectedType) {
        query = query.eq("type", selectedType);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enhancedNotifications = (data || []).map((notification) => ({
        ...notification,
        data: parseNotificationData(notification.data),
      }));

      // --- Enhance order / delivery images using the orders table (restaurant / item images) ---
      const orderNotificationsToEnhance = enhancedNotifications.filter(
        (notification) =>
          (notification.type === "order" || notification.type === "delivery") &&
          !getNotificationImageFromData(notification.data) &&
          (notification.data?.order_id || notification.data?.orderId),
      );

      if (orderNotificationsToEnhance.length > 0) {
        const orderIds = Array.from(
          new Set(
            orderNotificationsToEnhance
              .map((n) => n.data?.order_id || n.data?.orderId)
              .filter(Boolean),
          ),
        );

        // Use left joins so we always get the restaurant image as a reliable fallback
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(
            `
          id,
          restaurants!left(image_url),
          order_items(
            item_image_url,
            posts!left(image_url),
            menu_items!left(image_url)
          )
        `,
          )
          .in("id", orderIds);

        if (!ordersError && Array.isArray(orders)) {
          const orderImageMap = new Map<string, string>();

          orders.forEach((order: any) => {
            const item = (order.order_items || [])[0] || {};
            const imageUrl =
              item.item_image_url ||
              item.posts?.image_url ||
              item.menu_items?.image_url ||
              order.restaurants?.image_url;   // reliable restaurant fallback

            if (imageUrl) {
              orderImageMap.set(order.id, imageUrl);
            }
          });

          if (orderImageMap.size > 0) {
            for (const notification of enhancedNotifications) {
              const orderId = notification.data?.order_id || notification.data?.orderId;
              const fallbackImage = orderId ? orderImageMap.get(orderId) : undefined;
              if (fallbackImage && !getNotificationImageFromData(notification.data)) {
                notification.data = {
                  ...notification.data,
                  order_image: fallbackImage,
                  order_image_url: fallbackImage,
                  restaurant_image: fallbackImage,
                  restaurant_image_url: fallbackImage,
                };
              }
            }
          }
        }
      }

      // --- NEW: Fetch missing sender / driver images ---
      const senderIds = new Set<string>();
      const driverIds = new Set<string>();

      enhancedNotifications.forEach((n) => {
        if (n.type === "message" && n.data?.sender_id && !getNotificationImageFromData(n.data)) {
          senderIds.add(n.data.sender_id);
        }
        if (n.type === "delivery" && n.data?.driver_id && !getNotificationImageFromData(n.data)) {
          driverIds.add(n.data.driver_id);
        }
      });

      // Fetch sender images from users table
      if (senderIds.size > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, profile_image_url")
          .in("id", Array.from(senderIds));

        if (Array.isArray(users)) {
          const userImageMap = new Map(users.map((u: any) => [u.id, u.profile_image_url]));
          enhancedNotifications.forEach((n) => {
            if (n.type === "message" && n.data?.sender_id && userImageMap.has(n.data.sender_id)) {
              const img = userImageMap.get(n.data.sender_id);
              if (img) {
                n.data = {
                  ...n.data,
                  sender_image_url: img,
                };
              }
            }
          });
        }
      }

      // Fetch driver images for delivery notifications
      if (driverIds.size > 0) {
        const { data: driverUsers } = await supabase
          .from("users")
          .select("id, profile_image_url")
          .in("id", Array.from(driverIds));

        if (Array.isArray(driverUsers)) {
          const driverImageMap = new Map(driverUsers.map((u: any) => [u.id, u.profile_image_url]));
          enhancedNotifications.forEach((n) => {
            if (n.type === "delivery" && n.data?.driver_id && driverImageMap.has(n.data.driver_id)) {
              const img = driverImageMap.get(n.data.driver_id);
              if (img) {
                n.data = {
                  ...n.data,
                  driver_profile_image_url: img,
                };
              }
            }
          });
        }
      }

      // Fetch driver images for order notifications (driver assigned)
      const orderDriverIds = new Set<string>();
      enhancedNotifications.forEach((n) => {
        if (n.type === "order" && n.data?.driver_id && !getNotificationImageFromData(n.data)) {
          orderDriverIds.add(n.data.driver_id);
        }
      });
      if (orderDriverIds.size > 0) {
        const { data: orderDriverUsers } = await supabase
          .from("users")
          .select("id, profile_image_url")
          .in("id", Array.from(orderDriverIds));

        if (Array.isArray(orderDriverUsers)) {
          const driverImageMap = new Map(orderDriverUsers.map((u: any) => [u.id, u.profile_image_url]));
          enhancedNotifications.forEach((n) => {
            if (n.type === "order" && n.data?.driver_id && driverImageMap.has(n.data.driver_id)) {
              const img = driverImageMap.get(n.data.driver_id);
              if (img) {
                n.data = {
                  ...n.data,
                  driver_profile_image_url: img,
                };
              }
            }
          });
        }
      }

      setNotifications(enhancedNotifications || []);

      if (activeFilter === "all") {
        clearBadgeCount();
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, activeFilter, selectedType, clearBadgeCount]);


  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );

      // Use the correct method
      const { error } = await db
        .from("user_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      // If using NotificationService directly:
      await NotificationService.markNotificationAsRead(
        notificationId,
        "customer",
      );

      // Or if you want to use the context:
      if (markAsRead) {
        await markAsRead(notificationId);
      }
    } catch (error) {
      console.error("Error marking as read:", error);
      fetchNotifications();
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await db
                .from("user_notifications")
                .delete()
                .eq("id", notificationId);

              if (error) throw error;

              setNotifications((prev) =>
                prev.filter((n) => n.id !== notificationId),
              );
            } catch (error) {
              console.error("Error deleting notification:", error);
              Alert.alert("Error", "Failed to delete notification");
            }
          },
        },
      ],
    );
  };

  // Update handleNotificationPress
  const handleNotificationPress = (notification: Notification) => {
    checkGuestAction("canViewNotifications", () => {
      if (!notification.read) {
        handleMarkAsRead(notification.id);
      }

      // Handle message notifications
      if (notification.type === "message" && notification.data?.conversation_id) {
        router.push(`/(tabs)/messages/${notification.data.conversation_id}` as any);
        return;
      }

      const orderId = notificationOrderIdFromData(notification.data);

      if (orderId) {
        router.push(notificationOrderDetailRouteForUserType("customer", orderId) as any);
      } else if (notification.data?.screen) {
        const screen = normalizeNotificationScreen(notification.data.screen, "customer");
        if (screen) router.push(screen as any);
      } else if (notification.data?.post_id) {
        router.push(`/post/${notification.data.post_id}` as any);
      }
    });
  };

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await db
        .from("user_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      clearBadgeCount();
      Alert.alert("Success", "All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark all notifications as read");
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.read;
    if (activeFilter === "type" && selectedType)
      return notification.type === selectedType;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const typeCounts = notifications.reduce((acc: any, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  const renderNotification = ({ item }: { item: Notification }) => {
    const notificationType =
      NOTIFICATION_TYPES[item.type as keyof typeof NOTIFICATION_TYPES] ||
      NOTIFICATION_TYPES.info;

    const notificationData =
      typeof item.data === "string"
        ? (() => {
          try {
            return JSON.parse(item.data);
          } catch {
            return {};
          }
        })()
        : item.data || {};

    const senderImage =
      notificationData?.sender_image_url ||
      notificationData?.sender_image ||
      notificationData?.senderImage ||
      notificationData?.senderImageUrl ||
      notificationData?.sender?.image_url ||
      notificationData?.sender?.image ||
      notificationData?.sender?.avatar;
    const restaurantImage =
      notificationData?.restaurant_image ||
      notificationData?.restaurant_image_url ||
      notificationData?.restaurantImage ||
      notificationData?.restaurantImageUrl ||
      notificationData?.restaurant?.image_url ||
      notificationData?.restaurant?.image;
    const orderImage =
      notificationData?.order_image ||
      notificationData?.order_image_url ||
      notificationData?.orderImage ||
      notificationData?.orderImageUrl ||
      notificationData?.order?.image_url ||
      notificationData?.order?.image ||
      notificationData?.image_url ||
      notificationData?.image;
    const driverImage =
      notificationData?.driver_profile_image_url ||
      notificationData?.driver_profile_image ||
      notificationData?.driverProfileImageUrl ||
      notificationData?.driverProfileImage ||
      notificationData?.driver?.image_url ||
      notificationData?.driver?.image ||
      notificationData?.driver?.avatar;
    const message = notificationData?.message;
    const conversationId =
      notificationData?.conversation_id || notificationData?.conversationId;
    const notificationImage =
      (item.type === "order" || item.type === "delivery") ? orderImage || restaurantImage || senderImage || driverImage : senderImage;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard,
          (item.type === "order" || item.type === "delivery") && styles.orderCard,
          item.type === "message" && styles.messageCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Left side: Sender Image or Icon */}
        <View style={styles.leftContainer}>
          {notificationImage ? (
            <View style={styles.senderImageContainer}>
              <Image
                source={{ uri: notificationImage }}
                style={styles.senderImage}
                resizeMode="cover"
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          ) : (
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: notificationType.bgColor },
              ]}
            >
              <Ionicons
                name={notificationType.icon as any}
                size={20}
                color={notificationType.color}
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          )}
        </View>

        {/* Right side: Content */}
        <View style={styles.rightContainer}>
          <View style={styles.notificationHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.notificationTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.created_at)}
            </Text>
          </View>

          {!!item.body && (
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
          )}

          {/* Message preview for message notifications */}
          {item.type === "message" && message && (
            <View style={styles.messagePreviewContainer}>
              <View style={styles.messageBubble}>
                <Text style={styles.messagePreview} numberOfLines={2}>
                  {message}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.notificationFooter}>
            <View style={styles.typeBadge}>
              <View
                style={[
                  styles.typeBadgeDot,
                  { backgroundColor: notificationType.color },
                ]}
              />
              <Text style={styles.typeBadgeText}>{notificationType.name}</Text>
            </View>

            <View style={styles.notificationActions}>
              {item.type === "message" && conversationId ? (
                <TouchableOpacity
                  style={styles.replyButton}
                  onPress={() => {
                    if (!item.read) {
                      handleMarkAsRead(item.id);
                    }
                    router.push(`/(tabs)/messages/${conversationId}` as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-redo" size={13.5} color="#FF6B35" />
                  <Text style={styles.replyText}>Reply</Text>
                </TouchableOpacity>
              ) : notificationData?.driver_phone && notificationData?.driver_profile_image_url && item.type === "delivery" ? (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={async () => {
                    const phoneNumber = `${notificationData.driver_country_code || ""}${notificationData.driver_phone}`;
                    const url = `tel:${phoneNumber}`;

                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert("Unable to place call", "Your device cannot make phone calls.");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={13.5} color="#FFFFFF" />
                  <Text style={styles.callText}>Call driver</Text>
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={23} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>Inbox</Text>
          <Text style={styles.headerTitle}>Your notifications</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.messageHeaderButton}
            onPress={() => router.push("/(tabs)/messages" as any)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#FF6B35" />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isGuest && <GuestProfileBanner />}

      <View style={styles.statsContainer}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Unread</Text>
          <Text style={styles.summaryNumber}>{unreadCount}</Text>
          <Text style={styles.summaryCaption}>
            {unreadCount > 0 ? "New activity" : "All caught up"}
          </Text>
        </View>
        <View style={styles.summarySide}>
          <Text style={styles.summarySideValue}>{notifications.length}</Text>
          <Text style={styles.summarySideLabel}>Total</Text>
        </View>
        {typeCounts.order > 0 && (
          <View style={styles.summarySide}>
            <Text style={styles.summarySideValue}>{typeCounts.order}</Text>
            <Text style={styles.summarySideLabel}>Orders</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {[
            "all",
            "unread",
            "order",
            "message",
            "promotional",
            "security",
            "info",
            "system",
          ].map((filter) => {
            const typeConfig =
              NOTIFICATION_TYPES[filter as keyof typeof NOTIFICATION_TYPES];
            const isActive =
              (activeFilter === "type" && selectedType === filter) ||
              activeFilter === filter;

            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  isActive && styles.filterTabActive,
                ]}
                onPress={() => {
                  if (filter === "all" || filter === "unread") {
                    setActiveFilter(filter);
                    setSelectedType(null);
                  } else {
                    setActiveFilter("type");
                    setSelectedType(filter);
                  }
                }}
                activeOpacity={0.7}
              >
                {typeConfig && (
                  <Ionicons
                    name={typeConfig.icon as any}
                    size={14}
                    color={isActive ? "#FFFFFF" : typeConfig.color}
                  />
                )}
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                  ]}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "unread"
                      ? "Unread"
                      : typeConfig?.name || filter}
                </Text>
                {(
                  (filter === "all" && notifications.length > 0) ||
                  (filter === "unread" && unreadCount > 0) ||
                  (typeConfig && typeCounts[filter] > 0)
                ) && (
                    <View style={styles.filterCount}>
                      <Text style={styles.filterCountText}>
                        {filter === "all"
                          ? notifications.length
                          : filter === "unread"
                            ? unreadCount
                            : typeCounts[filter]}
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={56}
              color="#D1D5DB"
            />
            <Text style={styles.emptyStateTitle}>
              {isGuest
                ? "Guest Mode"
                : activeFilter === "unread"
                  ? "No unread"
                  : activeFilter === "type"
                    ? `No ${selectedType}s`
                    : "No notifications"}
            </Text>
            <Text style={styles.emptyStateText}>
              {isGuest
                ? "Sign in to receive notifications"
                : activeFilter === "unread"
                  ? "You're all caught up!"
                  : "New notifications will appear here."}
            </Text>
            {isGuest && (
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push("/(auth)/signin")}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={[
          styles.listContainer,
          filteredNotifications.length === 0 && styles.emptyListContainer,
        ]}
      />
      <View style={{ height: 32 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFBFC",
    marginBottom: -55,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Inter",
  },
  // Header - Clean and minimal
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  headerEyebrow: {
    color: "#FF6B35",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter",
    marginTop: 2,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  messageHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFF5F0",
    borderWidth: 0.8,
    borderColor: "#f5e6dcbe",
    justifyContent: "center",
    alignItems: "center",
  },
  markAllButton: {
    backgroundColor: "#FF6B35",
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  // Stats Container - Restored dark card design
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    marginTop: 8,
    marginHorizontal: 14,
    borderRadius: 8,
    gap: 14,
  },
  summaryMain: {
    flex: 1,
  },
  summaryLabel: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryNumber: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 34,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryCaption: {
    color: "#9CA3AF",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  summarySide: {
    minWidth: 58,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  summarySideValue: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "800",
  },
  summarySideLabel: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },

  // Filter Tabs - Minimal and clean
  filtersContainer: {
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.9,
    borderBottomColor: "#F0F0F0",
  },
  filtersContent: {
    paddingHorizontal: 13,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 0.8,
    borderColor: "#eeeeeebd",
  },
  filterTabActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    fontFamily: "Inter",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  filterCount: {
    backgroundColor: "#ffffffee",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.8,
    minWidth: 22,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111827de",
    textAlign: "center",
  },

  // List Container
  listContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flex: 1,
  },

  // Notification Card - Clean and minimal
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#4e4e4eee",
    alignItems: "flex-start",
  },
  unreadCard: {
    backgroundColor: "#FFF9F6",
    borderColor: "#ffe8dcc8",
  },
  orderCard: {
    borderColor: "#f0f0f0e5",
  },
  messageCard: {
    borderColor: "#f0f0f0f0",
    top: 2,
  },

  // Left Container - Icon or Avatar
  leftContainer: {
    marginRight: 12,
    position: "relative",
  },
  iconContainer: {
    width: 53,
    height: 53,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  senderImageContainer: {
    position: "relative",
  },
  senderImage: {
    width: 53,
    height: 53,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  unreadDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  // Right Container - Content
  rightContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 19,
    fontFamily: "Inter",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    fontFamily: "Inter",
    minWidth: 50,
    textAlign: "right",
  },

  // Notification Body
  notificationBody: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 3,
    fontFamily: "Inter",
  },

  // Message Preview - Clean bubble
  messagePreviewContainer: {
    marginVertical: 8,
  },
  messageBubble: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  messagePreview: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    fontFamily: "Inter",
  },

  // Notification Footer
  notificationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 11.8,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Inter",
  },

  // Actions
  notificationActions: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#FF6B35",
    borderRadius: 16,
    gap: 6,
  },
  callText: {
    fontSize: 11.8,
    color: "#FFFFFF",
    fontWeight: "700",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#FFF5F0",
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: "#ffe8dcc9",
    gap: 4,
  },
  replyText: {
    fontSize: 11.8,
    color: "#FF6B35",
    fontWeight: "700",
    fontFamily: "Inter",
    letterSpacing: 0.2,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    maxWidth: 220,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  signInButton: {
    marginTop: 18,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter",
  },

  // Additional utility styles
  postImage: {
    width: 53,
    height: 53,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
  },
});
