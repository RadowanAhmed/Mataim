// app/(driver)/notifications/driver_notifications.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import {
  notificationOrderDetailRouteForUserType,
  notificationOrderIdFromData,
} from "@/backend/utils/notificationRoutes";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter
} from "expo-router";
import React,
{
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

function formatTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getIcon(type?: string, data?: any) {
  // If the notification data indicates the order was delivered, show earning icon
  if (data?.status === "delivered" || type === "earning") {
    return "cash";
  }

  switch (type) {
    case "order":
    case "assignment":
      return "bicycle";
    case "rating":
      return "star";
    case "message":
      return "chatbubble-ellipses";
    case "delivery":
      return "navigate";
    default:
      return "notifications";
  }
}

function getColor(type?: string) {
  switch (type) {
    case "order":
    case "assignment":
      return "#FF6B35";
    case "earning":
      return "#10B981";
    case "rating":
      return "#F59E0B";
    case "message":
      return "#3B82F6";
    case "delivery":
      return "#8B5CF6";
    default:
      return "#6B7280";
  }
}

function parseNotificationData(data: any) {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data;
}

function getNotificationImage(
  notificationData: any,
  notificationType?: string,
  cache?: { restaurantImg?: string; customerImg?: string }
) {
  // If we have a cache, use it
  if (cache) {
    return cache.restaurantImg || cache.customerImg || undefined;
  }

  if (!notificationData) return undefined;

  // For messages: show sender image from data
  if (notificationType === "message") {
    return (
      notificationData?.customer_profile_image_url ||
      notificationData?.customer_image_url ||
      notificationData?.sender_image_url ||
      notificationData?.sender_image ||
      notificationData?.senderImageUrl ||
      notificationData?.senderImage ||
      notificationData?.sender?.image_url ||
      notificationData?.sender?.image ||
      notificationData?.customer?.image_url ||
      notificationData?.customer?.image ||
      notificationData?.profile_image_url
    );
  }

  // For orders/deliveries/assignments: show restaurant/order image
  if (notificationType === "order" || notificationType === "delivery" || notificationType === "assignment") {
    return (
      notificationData?.restaurant_image ||
      notificationData?.restaurant_image_url ||
      notificationData?.order_image ||
      notificationData?.order_image_url ||
      notificationData?.restaurantImage ||
      notificationData?.restaurantImageUrl ||
      notificationData?.orderImage ||
      notificationData?.orderImageUrl ||
      notificationData?.restaurant?.image_url ||
      notificationData?.restaurant?.image ||
      notificationData?.order?.image_url ||
      notificationData?.order?.image
    );
  }

  return undefined;
}

export default function DriverInboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openOrderId?: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setInbox] = useState<any[]>([]);
  const openedOrderParamRef = useRef<string | null>(null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  const [imageCache, setImageCache] = useState<Record<string, { restaurantImg?: string; customerImg?: string }>>({});

  useEffect(() => {
    const fetchMissingImages = async () => {
      const orderIdsToFetch = new Set<string>();
      const messageSenderIds = new Set<string>();

      notifications.forEach((n) => {
        const data = parseNotificationData(n.data);
        const existingImg = getNotificationImage(data, n.type);

        if (n.type === "message" && !existingImg && data.sender_id) {
          // We need to fetch the sender's profile image from users table
          if (!imageCache[`msg_${data.sender_id}`]) {
            messageSenderIds.add(data.sender_id);
          }
        }

        if (data.order_id && !imageCache[data.order_id]) {
          if (!existingImg) {
            orderIdsToFetch.add(data.order_id);
          }
        }
      });

      const updates: Record<string, { restaurantImg?: string; customerImg?: string }> = {};

      // Fetch order images
      if (orderIdsToFetch.size > 0) {
        const batch = await Promise.all(
          Array.from(orderIdsToFetch).map(async (oid) => {
            const { data } = await db
              .from("orders")
              .select("restaurants!orders_restaurant_id_fkey(image_url), users!orders_customer_id_fkey(profile_image_url)")
              .eq("id", oid)
              .maybeSingle();
            return { oid, data };
          })
        );
        batch.forEach(({ oid, data }) => {
          if (data) {
            updates[oid] = {
              restaurantImg: data.restaurants?.image_url || undefined,
              customerImg: data.users?.profile_image_url || undefined,
            };
          }
        });
      }

      // Fetch message sender images
      if (messageSenderIds.size > 0) {
        const batch = await Promise.all(
          Array.from(messageSenderIds).map(async (senderId) => {
            const { data } = await db
              .from("users")
              .select("profile_image_url")
              .eq("id", senderId)
              .maybeSingle();
            return { senderId, data };
          })
        );
        batch.forEach(({ senderId, data }) => {
          if (data?.profile_image_url) {
            updates[`msg_${senderId}`] = { customerImg: data.profile_image_url };
          }
        });
      }

      if (Object.keys(updates).length > 0) {
        setImageCache((prev) => ({ ...prev, ...updates }));
      }
    };

    if (notifications.length > 0) {
      fetchMissingImages();
    }
  }, [notifications]);



  const openOrderId = Array.isArray(params.openOrderId)
    ? params.openOrderId[0]
    : params.openOrderId;

  useEffect(() => {
    if (!openOrderId || openedOrderParamRef.current === openOrderId) return;

    openedOrderParamRef.current = openOrderId;
    const timer = setTimeout(() => {
      router.push(notificationOrderDetailRouteForUserType("driver", openOrderId) as any);
    }, 0);

    return () => clearTimeout(timer);
  }, [openOrderId, router]);

  const fetchInbox = useCallback(async (showSpinner = true) => {
    if (!user?.id) return;

    try {
      if (showSpinner) setLoading(true);
      const { data, error } = await db
        .from("driver_notifications")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setInbox(data || []);
    } catch (error) {
      console.error("Error fetching driver notifications:", error);
      setInbox([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    if (!user?.id) return;
    const topic = `driver-notifications-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_notifications",
          filter: `driver_id=eq.${user.id}`,
        },
        () => fetchInbox(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInbox, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInbox(false);
  };

  const markAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    try {
      const { error } = await db
        .from("driver_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("driver_id", user.id)
        .eq("read", false);

      if (error) throw error;
      fetchInbox(false);
    } catch {
      Alert.alert("Error", "Could not mark notifications as read.");
    }
  };

  const handleGoBack = useCallback(() => {
    goBackOrDriverFallback(router, "/(driver)/dashboard");
  }, [router]);

  const openNotification = useCallback(async (notification: any) => {
    if (!notification.read) {
      await db
        .from("driver_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notification.id);
    }

    const orderId = notificationOrderIdFromData(notification.data);
    const conversationId = notification.data?.conversation_id;

    if (orderId) {
      router.push(notificationOrderDetailRouteForUserType("driver", orderId) as any);
      return;
    }

    if (conversationId) {
      router.push(`/(driver)/messages/${conversationId}` as any);
      return;
    }

    router.push(`/(driver)/notifications/${notification.id}` as any);
  }, [router]);

  const renderNotification = useCallback(
    ({ item }: { item: any }) => <NotificationRow item={item} onPress={openNotification} imageCache={imageCache} />,
    [openNotification, imageCache],
  );

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={23} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inbox</Text>
          <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={markAllAsRead}>
          <Text style={styles.headerActionText}>Read all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="radio-outline" size={18} color="#FF6B35" />
        <Text style={styles.infoBannerText}>
          Real-time alerts appear here for new assignments, earnings, delivery updates, and messages.
        </Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" colors={["#FF6B35"]} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={58} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>New delivery alerts and updates will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
  imageCache: cache,
}: {
  item: any;
  onPress: (notification: any) => void;
  imageCache?: Record<string, { restaurantImg?: string; customerImg?: string }>;
}) {
  const notificationData = parseNotificationData(item.data);
  const orderId = notificationData.order_id;
  const senderId = notificationData.sender_id;

  // Build cache key
  let cacheKey: string | undefined;
  if (orderId) cacheKey = orderId;
  else if (senderId && item.type === "message") cacheKey = `msg_${senderId}`;

  const cachedImage = cacheKey && cache?.[cacheKey] ? cache[cacheKey] : undefined;
  const imageUrl = getNotificationImage(notificationData, item.type, cachedImage);
  const color = getColor(item.type);
  const iconName = getIcon(item.type, notificationData);

  return (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.notificationUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {imageUrl ? (
        <View style={styles.notificationImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.notificationImage} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={iconName as any} size={20} color={color} />
        </View>
      )}
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
        <View style={styles.notificationMeta}>
          <Text style={[styles.typeText, { color }]}>{item.type || "info"}</Text>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", marginBottom: -50 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 10, color: "#6B7280", fontSize: 15, fontWeight: "600", fontFamily: "Inter" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 0.8, borderBottomColor: "#E5E7EB" },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center", },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 18, color: "#111827", fontWeight: "700", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12.5, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  headerAction: { paddingHorizontal: 10, paddingVertical: 8 },
  headerActionText: { color: "#FF6B35", fontSize: 12.2, fontWeight: "700", fontFamily: "Inter" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", margin: 13, marginBottom: 6, padding: 12, borderRadius: 15, backgroundColor: "#FFF7ED", borderWidth: 0.8, borderColor: "#fed7aaae", gap: 8 },
  infoBannerText: { flex: 1, fontSize: 12.2, color: "#9A3412", lineHeight: 18, fontWeight: "600", fontFamily: "Inter" },
  listContent: { padding: 12, paddingBottom: 110, top: 4 },
  notificationCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, padding: 8, marginBottom: 12, borderWidth: 0.5, borderColor: "#e5e7eb9e" },
  notificationUnread: { borderColor: "#ff6b354f", backgroundColor: "#FFFDFB" },
  iconContainer: { width: 50, height: 50, borderRadius: 30, justifyContent: "center", alignItems: "center", marginRight: 12 },
  notificationImageContainer: { width: 60, height: 60, borderRadius: 12, overflow: "hidden", marginRight: 12, backgroundColor: "#F3F4F6" },
  notificationImage: { width: "100%", height: "100%" },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notificationTitle: { flex: 1, color: "#111827", fontSize: 14.2, fontWeight: "700", fontFamily: "Inter" },
  notificationTime: { color: "#9CA3AF", fontSize: 10, fontWeight: "600", fontFamily: "Inter" },
  notificationBody: { color: "#6B7280", fontSize: 12.2, lineHeight: 18, marginTop: 4, fontWeight: "500", fontFamily: "Inter" },
  notificationMeta: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  typeText: { fontSize: 10, textTransform: "uppercase", fontWeight: "600", fontFamily: "Inter" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF6B35" },
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { color: "#111827", fontSize: 17, fontWeight: "700", marginTop: 10, fontFamily: "Inter" },
  emptyText: { color: "#6B7280", fontSize: 13, marginTop: 5, textAlign: "center", fontWeight: "500", fontFamily: "Inter" },
});
