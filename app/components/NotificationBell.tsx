// app/components/NotificationBell.tsx
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { supabase } from "@/backend/supabase";
import { notificationTapRouteForUserType } from "@/backend/utils/notificationRoutes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface NotificationBellProps {
  tintColor?: string;
  size?: number;
  showBadge?: boolean;
  showQuickView?: boolean;
}

const db = supabase as any;

const getTarget = (userType?: string) => {
  if (userType === "driver") {
    return {
      table: "driver_notifications",
      column: "driver_id",
      route: "/(driver)/notifications/driver_notifications",
      title: "Driver notifications",
    };
  }

  return {
    table: "user_notifications",
    column: "user_id",
    route: "/(tabs)/notifications/user_notifications",
    title: "Notifications",
  };
};

const formatTime = (value?: string | null) => {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationBell({
  tintColor = "#111827",
  size = 24,
  showBadge = true,
  showQuickView = false,
}: NotificationBellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { notificationCount, clearBadgeCount } = useNotification();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (notificationCount > 0) {
      Animated.sequence([
        Animated.spring(badgeScale, { toValue: 1.25, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [notificationCount]);

  useEffect(() => {
    if (modalVisible) loadRecentNotifications();
  }, [modalVisible]);

  const loadRecentNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const target = getTarget(user.user_type);
      const { data } = await db
        .from(target.table)
        .select("*")
        .eq(target.column, user.id)
        .order("created_at", { ascending: false })
        .limit(6);
      setRecentNotifications(data || []);
    } finally {
      setLoading(false);
    }
  };

  const openNotifications = async () => {
    if (!user) {
      router.push("/(auth)/signin" as any);
      return;
    }
    await clearBadgeCount();
    const target = getTarget(user.user_type);
    router.push(target.route as any);
    setModalVisible(false);
  };

  const handlePress = () => {
    if (showQuickView) {
      openNotifications();
      return;
    }
    openNotifications();
  };

  const openNotification = (notification: any) => {
    setModalVisible(false);
    const data = typeof notification.data === "string" ? {} : notification.data || {};
    const route = notificationTapRouteForUserType(data, user?.user_type);
    if (route) router.push(route as any);
    else openNotifications();
  };

  const target = getTarget(user?.user_type);

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={handlePress} activeOpacity={0.85}>
        <Ionicons name={notificationCount > 0 ? "notifications" : "notifications-outline"} size={size} color={tintColor} />
        {showBadge && notificationCount > 0 ? (
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <Text style={styles.badgeText}>{notificationCount > 99 ? "99+" : notificationCount}</Text>
          </Animated.View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.quickCard}>
            <View style={styles.quickHeader}>
              <View>
                <Text style={styles.quickTitle}>{target.title}</Text>
                <Text style={styles.quickSubtitle}>Recent alerts and delivery updates</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#FF6B35" />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {recentNotifications.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="checkmark-circle-outline" size={38} color="#10B981" />
                    <Text style={styles.emptyTitle}>All caught up</Text>
                    <Text style={styles.emptyText}>No new notifications right now.</Text>
                  </View>
                ) : (
                  recentNotifications.map((notification) => (
                    <TouchableOpacity key={notification.id} style={styles.notificationItem} onPress={() => openNotification(notification)}>
                      <View style={[styles.notificationIcon, !notification.read && styles.notificationIconUnread]}>
                        <Ionicons name="notifications-outline" size={17} color="#FF6B35" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title}</Text>
                        <Text style={styles.notificationBody} numberOfLines={2}>{notification.body || notification.message}</Text>
                        <Text style={styles.notificationTime}>{formatTime(notification.created_at)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.viewAllButton} onPress={openNotifications}>
              <Text style={styles.viewAllText}>View all notifications</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 41,
    height: 41,
    borderRadius: 19,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.6,
    borderColor: "#e5e7eb3f",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF", fontSize: 10, fontWeight: "700", fontFamily: "Inter",
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-start", paddingTop: 82, paddingHorizontal: 16 },
  quickCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  quickHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  quickTitle: {
    fontSize: 17, fontWeight: "700", color: "#111827", fontFamily: "Inter",
  },
  quickSubtitle: {
    fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "500", fontFamily: "Inter",
  },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  loadingBox: { height: 120, justifyContent: "center", alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 26 },
  emptyTitle: {
    color: "#111827", fontWeight: "700", marginTop: 8, fontSize: 15, fontFamily: "Inter",
  },
  emptyText: {
    color: "#6B7280", fontSize: 12, marginTop: 4, fontFamily: "Inter",
  },
  notificationItem: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  notificationIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  notificationIconUnread: { backgroundColor: "#FFEDD5" },
  notificationTitle: {
    color: "#111827", fontSize: 13, fontWeight: "700", fontFamily: "Inter",
  },
  notificationBody: {
    color: "#6B7280", fontSize: 12, lineHeight: 17, marginTop: 3, fontFamily: "Inter",
  },
  notificationTime: {
    color: "#9CA3AF", fontSize: 11, marginTop: 5, fontWeight: "600", fontFamily: "Inter",
  },
  viewAllButton: { marginTop: 14, backgroundColor: "#FF6B35", borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  viewAllText: {
    color: "#FFFFFF", fontSize: 13, fontWeight: "700", fontFamily: "Inter",
  },
});
