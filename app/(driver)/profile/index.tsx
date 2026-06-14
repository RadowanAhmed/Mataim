// app/(driver)/profile.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { DriverAppService } from "@/backend/services/driverAppService";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React,
{
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type ProfileAction = {
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  route?: string;
};

const db = supabase as any;

const driverActions: ProfileAction[] = [
  {
    title: "Earnings",
    subtitle: "Daily pay and payout history",
    icon: "cash-outline",
    color: "#FF6B35",
    route: "/(driver)/earnings",
  },
  {
    title: "Orders",
    subtitle: "Active, completed, and cancelled",
    icon: "receipt-outline",
    color: "#10B981",
    route: "/(driver)/profile/orders",
  },
  {
    title: "Messages",
    subtitle: "Chats for current deliveries",
    icon: "chatbubble-ellipses-outline",
    color: "#7C3AED",
    route: "/(driver)/messages",
  },
  {
    title: "Notifications",
    subtitle: "Order alerts and account updates",
    icon: "notifications-outline",
    color: "#3B82F6",
    route: "/(driver)/notifications/driver_notifications",
  },
];

const quickActions: ProfileAction[] = [
  {
    title: "Bank",
    subtitle: "Payout account",
    icon: "business-outline",
    color: "#0F766E",
    route: "/(driver)/withdraw",
  },
  {
    title: "Vehicle",
    subtitle: "Plate and type",
    icon: "car-outline",
    color: "#111827",
    route: "/(driver)/profile/edit",
  },
  {
    title: "History",
    subtitle: "Past trips",
    icon: "time-outline",
    color: "#F59E0B",
    route: "/(driver)/history",
  },
];

const getInitials = (name?: string | null) =>
  name
    ?.split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "D";

const maskAccount = (value?: string | null) => {
  if (!value) return "No bank account saved";
  if (value.includes("*")) return value;
  const last4 = value.replace(/\D/g, "").slice(-4);
  return last4 ? `****${last4}` : value;
};

const cleanValue = (value?: string | number | null, fallback = "Not added") => {
  if (value === 0) return "0";
  if (!value) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
};

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshUserData } = useAuth() as any;
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const driver = useMemo(() => ({ ...(user || {}), ...(details?.driver || {}) }), [details?.driver, user]);
  const stats = details?.stats || {};
  const earnings = details?.earnings || {};
  const bankAccount = details?.bankAccount;
  const profileImage = profile?.avatar_url || driver?.profile_image_url;

  const displayName = driver.full_name || "Driver";
  const rating = Number(stats.ratingAverage ?? driver.rating ?? 0);
  const ratingLabel =
    Number(stats.ratingCount || 0) > 0 || Number(stats.ratingAverage || 0) > 0 ? rating.toFixed(1) : "0.0";
  const deliveries = stats.completedDeliveries ?? driver.total_deliveries ?? 0;
  const walletBalance = earnings.walletBalance ?? driver.wallet_balance ?? driver.total_earnings ?? 0;
  const todayEarnings = earnings.today ?? driver.earnings_today ?? 0;
  const acceptanceRate = Number(stats.acceptanceRate ?? driver.acceptance_rate ?? 0);
  const onTimeRate = Number(stats.onTimeRate ?? driver.on_time_rate ?? 0);
  const phoneLabel = cleanValue(driver.phone || profile?.phone || user?.phone, "Phone not added");
  const emailLabel = cleanValue(driver.email || profile?.email || user?.email, "Email not added");
  const vehicleLabel = cleanValue(driver.vehicle_type, "Vehicle not set");
  const plateLabel = cleanValue(driver.vehicle_plate, "Plate not set");
  const bankLabel = bankAccount
    ? `${bankAccount.bank_name || "Bank"} ${maskAccount(bankAccount.account_number_masked)}`
    : maskAccount(driver.bank_account_last4);
  const driverStatus = driver.is_online
    ? driver.driver_status === "busy"
      ? "On delivery"
      : "Online"
    : "Offline";

  const statItems = [
    { label: "Trips", value: deliveries },
    { label: "Rating", value: ratingLabel },
    { label: "Accept", value: `${acceptanceRate}%` },
    { label: "On-time", value: `${onTimeRate}%` },
  ];

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const result = await DriverAppService.getDriverProfileDetails(user.id);
      if (result.success) setDetails(result.data);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshUserData?.(), loadProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile, refreshUserData]);

  const openRoute = useCallback(
    (route?: string) => {
      if (!route) return;
      router.push(route as any);
    },
    [router],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign out", "Do you want to leave the driver app?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            if (user?.id) {
              await db
                .from("delivery_users")
                .update({ is_online: false, driver_status: "offline", updated_at: new Date().toISOString() })
                .eq("id", user.id);
            }
            await signOut();
            router.replace("/(auth)/signin" as any);
          } catch (error) {
            console.error("Driver sign out failed:", error);
          }
        },
      },
    ]);
  }, [router, signOut, user?.id]);

  if (!user || user.user_type !== "driver") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={54} color="#EF4444" />
          <Text style={styles.emptyTitle}>Driver account required</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => goBackOrDriverFallback(router, "/(driver)/dashboard", navigation)}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F7" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={["#FF6B35"]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Driver</Text>
            <Text style={styles.headerTitle}>Your delivery space</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => openRoute("/(driver)/notifications/driver_notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.profilePanel}>
          <View style={styles.avatarWrap}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileText}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={[styles.statusBadge, driver.is_online ? styles.statusOnline : styles.statusOffline]}>
                <Text style={[styles.statusText, driver.is_online ? styles.statusOnlineText : styles.statusOfflineText]}>
                  {driverStatus}
                </Text>
              </View>
            </View>
            <Text style={styles.emailText} numberOfLines={1}>
              {emailLabel}
            </Text>
            <Text style={styles.phoneText} numberOfLines={1}>
              {phoneLabel}
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => openRoute("/(driver)/edit-profile")}>
            <Ionicons name="create-outline" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsPanel}>
          {loading ? (
            <View style={styles.loadingStats}>
              <ActivityIndicator color="#FF6B35" />
              <Text style={styles.loadingText}>Loading driver account</Text>
            </View>
          ) : (
            statItems.map((item) => (
              <View key={item.label} style={styles.statItem}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {item.value}
                </Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.walletPanel}>
          <View style={styles.walletTextBlock}>
            <Text style={styles.walletLabel}>Wallet balance</Text>
            <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(walletBalance)}
            </Text>
            <Text style={styles.walletBank} numberOfLines={1}>
              {bankLabel}
            </Text>
          </View>
          <TouchableOpacity style={styles.walletButton} onPress={() => openRoute("/(driver)/withdraw")}>
            <Text style={styles.walletButtonText}>Withdraw</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Driver tools</Text>
        <View style={styles.actionList}>
          {driverActions.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.actionRow}
              onPress={() => openRoute(item.route)}
              activeOpacity={0.82}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>More</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.quickCard}
              onPress={() => openRoute(item.route)}
              activeOpacity={0.82}
            >
              <View style={[styles.quickIcon, { backgroundColor: `${item.color}16` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.quickTitle}>{item.title}</Text>
              <Text style={styles.quickSubtitle} numberOfLines={2}>
                {item.title === "Vehicle" ? `${vehicleLabel} - ${plateLabel}` : item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.supportPanel}>
          <Text style={styles.supportTitle}>Today</Text>
          <View style={styles.supportRow}>
            <Ionicons name="today-outline" size={20} color="#6B7280" />
            <Text style={styles.supportText}>Earnings</Text>
            <Text style={styles.supportValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(todayEarnings)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => openRoute("/(driver)/support")}
          >
            <Ionicons name="headset-outline" size={20} color="#6B7280" />
            <Text style={styles.supportText}>Driver support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Sofra Driver v2.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    marginBottom: -50
  },
  content: {
    padding: 12,
    paddingBottom: 112,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerEyebrow: {
    color: "#FF6B35",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb9c",
  },
  profilePanel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eb87",
    padding: 12,
    marginTop: 12,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "600",
  },
  profileText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    flex: 1,
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusOnline: {
    backgroundColor: "#ECFDF5",
  },
  statusOffline: {
    backgroundColor: "#F1F5F9",
  },
  statusText: {
    fontFamily: "Inter",
    fontSize: 10,
    fontWeight: "700",
  },
  statusOnlineText: {
    color: "#047857",
  },
  statusOfflineText: {
    color: "#475569",
  },
  emailText: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  phoneText: {
    color: "#9CA3AF",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 0.8,
    borderColor: "#e5e7eb6a",
  },
  statsPanel: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#e5e7eb67",
    marginTop: 12,
    paddingVertical: 14,
  },
  loadingStats: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  statValue: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  walletPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  walletTextBlock: {
    flex: 1,
  },
  walletLabel: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
  },
  walletValue: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 4,
  },
  walletBank: {
    color: "#9CA3AF",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  walletButton: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  walletButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sectionTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
  },
  actionList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7ebb0",
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.8,
    borderBottomColor: "#F3F4F6",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
  },
  actionSubtitle: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10,
  },
  quickCard: {
    flex: 1,
    minHeight: 126,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#e5e7eb93",
    padding: 12,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
  quickSubtitle: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    marginTop: 3,
  },
  supportPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eb72",
    marginTop: 20,
    padding: 14,
  },
  supportTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 0.8,
    borderTopColor: "#F3F4F6",
  },
  supportText: {
    flex: 1,
    color: "#374151",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 10,
  },
  supportValue: {
    maxWidth: 140,
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
  },
  signOutButton: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecacad2",
  },
  signOutText: {
    color: "#EF4444",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
  },
  versionText: {
    color: "#9CA3AF",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    marginTop: 12,
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  secondaryButton: {
    marginTop: 18,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
});
