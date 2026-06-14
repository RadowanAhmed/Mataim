// app/(driver)/notifications/[id].tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { notificationOrderDetailRouteForUserType } from "@/backend/utils/notificationRoutes";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams,
  useRouter } from "expo-router";
import React,
  { useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { ActivityIndicator,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;
const SUCCESS_GREEN = "#10B981";
const CONFETTI = [
  { left: -50, top: -6, color: SUCCESS_GREEN, rotate: "18deg" },
  { left: -28, top: -34, color: "#22C55E", rotate: "-18deg" },
  { left: 0, top: -46, color: "#FACC15", rotate: "28deg" },
  { left: 30, top: -34, color: "#38BDF8", rotate: "-24deg" },
  { left: 52, top: -4, color: "#86EFAC", rotate: "38deg" },
];

export default function DriverNotificationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const notificationId = Array.isArray(id) ? id[0] : id;
  const successScale = useRef(new Animated.Value(0)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<any>(null);

  const isWithdrawalApproval = useMemo(() => {
    const title = String(notification?.title || "").toLowerCase();
    const event = String(notification?.data?.event || "").toLowerCase();
    const type = String(notification?.type || "").toLowerCase();
    return (
      type === "earning" &&
      (event === "withdrawal_approved" ||
        title.includes("withdrawal sent") ||
        title.includes("withdrawal approved"))
    );
  }, [notification]);

  useEffect(() => {
    const load = async () => {
      if (!notificationId || !user?.id) return;
      try {
        const { data } = await db
          .from("driver_notifications")
          .select("*")
          .eq("id", notificationId)
          .eq("driver_id", user.id)
          .maybeSingle();
        setNotification(data);
        await db
          .from("driver_notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("id", notificationId);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [notificationId, user?.id]);

  useEffect(() => {
    if (!isWithdrawalApproval) return;

    successScale.setValue(0);
    confettiProgress.setValue(0);
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 5,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(confettiProgress, {
        toValue: 1,
        duration: 760,
        useNativeDriver: true,
      }),
    ]).start();
  }, [confettiProgress, isWithdrawalApproval, successScale]);

  const openAction = () => {
    if (notification?.data?.order_id) {
      router.push(notificationOrderDetailRouteForUserType("driver", notification.data.order_id) as any);
      return;
    }

    if (notification?.data?.withdrawal_id) {
      router.push("/(driver)/withdraw" as any);
      return;
    }

    if (notification?.data?.screen) {
      router.push(notification.data.screen as any);
    }
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrDriverFallback(router, "/(driver)/notifications/driver_notifications")}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.content}>
        {notification ? (
          <View style={[styles.card, isWithdrawalApproval && styles.successCard]}>
            <View style={styles.iconStage}>
              {isWithdrawalApproval && (
                <View pointerEvents="none" style={styles.confettiLayer}>
                  {CONFETTI.map((piece, index) => (
                    <Animated.View
                      key={`${piece.left}-${index}`}
                      style={[
                        styles.confettiPiece,
                        {
                          backgroundColor: piece.color,
                          left: 76 + piece.left,
                          top: 48 + piece.top,
                          opacity: confettiProgress.interpolate({
                            inputRange: [0, 0.18, 1],
                            outputRange: [0, 1, 0],
                          }),
                          transform: [
                            { rotate: piece.rotate },
                            {
                              translateY: confettiProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [10, 38],
                              }),
                            },
                            {
                              scale: confettiProgress.interpolate({
                                inputRange: [0, 0.2, 1],
                                outputRange: [0.4, 1, 0.75],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
              <Animated.View
                style={[
                  styles.iconWrap,
                  isWithdrawalApproval && styles.successIconWrap,
                  isWithdrawalApproval && {
                    transform: [
                      {
                        scale: successScale.interpolate({
                          inputRange: [0, 0.72, 1],
                          outputRange: [0.45, 1.08, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name={isWithdrawalApproval ? "checkmark" : "notifications"}
                  size={isWithdrawalApproval ? 34 : 26}
                  color={isWithdrawalApproval ? "#FFFFFF" : "#FF6B35"}
                />
              </Animated.View>
            </View>
            <Text style={styles.title}>{notification.title}</Text>
            <Text style={styles.body}>{notification.body}</Text>
            <Text style={[styles.meta, isWithdrawalApproval && styles.successMeta]}>
              {isWithdrawalApproval ? "Payout complete" : notification.type || "info"}
            </Text>
            {(notification.data?.order_id || notification.data?.withdrawal_id || notification.data?.screen) && (
              <TouchableOpacity
                style={[styles.button, isWithdrawalApproval && styles.successButton]}
                onPress={openAction}
              >
                <Text style={styles.buttonText}>
                  {notification.data?.withdrawal_id ? "View withdrawal" : "Open order"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={52} color="#D1D5DB" />
            <Text style={styles.emptyText}>Notification not found</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, color: "#111827", fontWeight: "700", fontFamily: "Inter" },
  placeholder: { width: 40 },
  content: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  successCard: { borderColor: "#BBF7D0", backgroundColor: "#FDFFFE" },
  iconStage: { width: 160, height: 92, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  iconWrap: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: SUCCESS_GREEN },
  confettiLayer: { position: "absolute", width: 160, height: 96, alignSelf: "center" },
  confettiPiece: { position: "absolute", width: 7, height: 13, borderRadius: 3 },
  title: { fontSize: 18, color: "#111827", fontWeight: "700", textAlign: "center", fontFamily: "Inter" },
  body: { marginTop: 10, fontSize: 13, color: "#374151", lineHeight: 20, textAlign: "center", fontWeight: "500", fontFamily: "Inter" },
  meta: { marginTop: 12, color: "#FF6B35", textTransform: "uppercase", fontSize: 11, fontWeight: "600", fontFamily: "Inter" },
  successMeta: { color: "#047857" },
  button: { marginTop: 18, backgroundColor: "#FF6B35", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  successButton: { backgroundColor: "#111827" },
  buttonText: { color: "#fff", fontSize: 13, fontWeight: "700", fontFamily: "Inter" },
  emptyState: { alignItems: "center", paddingTop: 100 },
  emptyText: { marginTop: 10, color: "#6B7280", fontSize: 13, fontWeight: "500", fontFamily: "Inter" },
});
