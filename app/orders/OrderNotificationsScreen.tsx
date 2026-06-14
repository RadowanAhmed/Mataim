import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { orderRouteForUserType } from "@/backend/utils/notificationRoutes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function timeAgo(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function iconFor(type: string) {
  switch (type) {
    case "delivery":
      return "bicycle";
    case "rating":
      return "star";
    case "earning":
      return "cash";
    case "message":
      return "chatbubble";
    case "order":
    default:
      return "receipt";
  }
}

export default function OrderNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .or("type.eq.order,type.eq.delivery,type.eq.message")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Load order notifications error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`customer-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  const openNotification = async (notification: any) => {
    if (!notification.read) {
      await supabase.from("user_notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", notification.id);
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
    }

    const orderId = notification.data?.order_id || notification.data?.orderId;
    if (orderId) {
      router.push(orderRouteForUserType("customer", orderId) as any);
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("user_notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("read", false);
    loadNotifications();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
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
          <Text style={styles.heroKicker}>Updates</Text>
          <Text style={styles.heroTitle}>Order notifications</Text>
        </View>
        <TouchableOpacity style={styles.markButton} onPress={markAllRead}>
          <Text style={styles.markText}>Read all</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>Order updates will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.notificationCard, !item.read && styles.unreadCard]} onPress={() => openNotification(item)} activeOpacity={0.85}>
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons name={iconFor(item.type) as any} size={20} color={!item.read ? "#FFFFFF" : "#FF6B35"} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
              {item.data?.order_number && <Text style={styles.orderNumber}>Order #{item.data.order_number}</Text>}
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

// app/orders/notifications.tsx - Update the styles object

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  hero: { backgroundColor: "#111827", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroKicker: { color: "#FFB59D", fontSize: 12, fontFamily: "Inter", fontWeight: "800", textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Inter", fontWeight: "800", marginTop: 2 },
  markButton: { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  markText: { color: "#FFFFFF", fontFamily: "Inter", fontWeight: "800", fontSize: 12 },
  listContent: { padding: 16, paddingBottom: 40 },
  notificationCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  unreadCard: { borderColor: "#FED7AA", backgroundColor: "#FFFBF7" },
  iconWrap: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  iconWrapUnread: { backgroundColor: "#FF6B35" },
  notificationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTitle: { flex: 1, color: "#111827", fontFamily: "Inter", fontWeight: "800", fontSize: 15 },
  notificationTime: { color: "#9CA3AF", fontFamily: "Inter", fontWeight: "700", fontSize: 11 },
  notificationBody: { marginTop: 4, color: "#6B7280", fontFamily: "Inter", fontWeight: "600", lineHeight: 18 },
  orderNumber: { marginTop: 8, color: "#FF6B35", fontFamily: "Inter", fontWeight: "800", fontSize: 12 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FF6B35", marginTop: 5 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 120, paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, color: "#111827", fontFamily: "Inter", fontWeight: "800", fontSize: 18 },
  emptyText: { marginTop: 6, color: "#6B7280", textAlign: "center", fontFamily: "Inter", fontWeight: "600" },
});
