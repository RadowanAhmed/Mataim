import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { formatMoney } from "@/backend/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuestProfileBanner } from "../../components/GuestProfileBanner";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const db = supabase as any;

type AccountStats = {
  orders: number;
  activeOrders: number;
  addresses: number;
  favorites: number;
  points: number;
  spent: number;
};

type AccountAction = {
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  route?: string;
};

const EMPTY_STATS: AccountStats = {
  orders: 0,
  activeOrders: 0,
  addresses: 0,
  favorites: 0,
  points: 0,
  spent: 0,
};

const accountActions: AccountAction[] = [
  {
    title: "Orders",
    subtitle: "History and live tracking",
    icon: "receipt-outline",
    color: "#FF6B35",
    route: "/(tabs)/profile/orders",
  },
  {
    title: "Favorites",
    subtitle: "Saved meals and restaurants",
    icon: "heart-outline",
    color: "#EF4444",
    route: "/(tabs)/profile/favorites",
  },
  {
    title: "Addresses",
    subtitle: "Homes, work, and delivery notes",
    icon: "location-outline",
    color: "#10B981",
    route: "/(tabs)/profile/addresses",
  },
  {
    title: "Notifications",
    subtitle: "Orders, messages, and offers",
    icon: "notifications-outline",
    color: "#3B82F6",
    route: "/(tabs)/notifications/user_notifications",
  },
];

const quickActions: AccountAction[] = [
  {
    title: "Messages",
    subtitle: "Chat with support or restaurants",
    icon: "chatbubble-ellipses-outline",
    color: "#7C3AED",
    route: "/(tabs)/messages",
  },
  {
    title: "Cart",
    subtitle: "Review basket",
    icon: "basket-outline",
    color: "#0F766E",
    route: "/(tabs)/cart",
  },
  {
    title: "Edit profile",
    subtitle: "Name, phone, and photo",
    icon: "create-outline",
    color: "#111827",
    route: "/(tabs)/profile/settings",
  },
];

function getInitials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isGuest, showGuestAlert } = useGuestAction();
  const [stats, setStats] = useState<AccountStats>(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = useMemo(() => {
    if (isGuest) return "Guest";
    return user?.full_name || "Customer";
  }, [isGuest, user?.full_name]);

  const profileImage = user?.profile_image_url || null;

  const loadStats = useCallback(async () => {
    if (!user?.id || isGuest) {
      setStats(EMPTY_STATS);
      setLoadingStats(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoadingStats(true);

      const [
        ordersResult,
        activeOrdersResult,
        favoritesResult,
        addressesResult,
        customerResult,
        spendResult,
      ] = await Promise.allSettled([
        db
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", user.id),
        db
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", user.id)
          .not("status", "in", "(delivered,cancelled)"),
        db
          .from("favorites")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        db
          .from("addresses")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        db
          .from("customers")
          .select("loyalty_points,total_orders")
          .eq("id", user.id)
          .maybeSingle(),
        db
          .from("orders")
          .select("final_amount")
          .eq("customer_id", user.id)
          .eq("status", "delivered"),
      ]);

      const orderCount =
        ordersResult.status === "fulfilled" ? ordersResult.value.count || 0 : 0;
      const activeCount =
        activeOrdersResult.status === "fulfilled"
          ? activeOrdersResult.value.count || 0
          : 0;
      const favoriteCount =
        favoritesResult.status === "fulfilled"
          ? favoritesResult.value.count || 0
          : 0;
      const addressCount =
        addressesResult.status === "fulfilled"
          ? addressesResult.value.count || 0
          : 0;
      const customerData =
        customerResult.status === "fulfilled" ? customerResult.value.data : null;
      const deliveredOrders =
        spendResult.status === "fulfilled" ? spendResult.value.data || [] : [];
      const spent = deliveredOrders.reduce(
        (sum: number, order: any) => sum + Number(order.final_amount || 0),
        0,
      );

      setStats({
        orders: customerData?.total_orders || orderCount,
        activeOrders: activeCount,
        addresses: addressCount,
        favorites: favoriteCount,
        points: customerData?.loyalty_points || 0,
        spent,
      });
    } catch (error) {
      console.error("Error loading account stats:", error);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, [isGuest, user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const openRoute = useCallback(
    (route?: string) => {
      if (!route) return;
      if (isGuest && route !== "/(tabs)/cart") {
        showGuestAlert("use account features");
        return;
      }
      router.push(route as any);
    },
    [isGuest, router, showGuestAlert],
  );

  const handleSignOut = useCallback(() => {
    const title = isGuest ? "Exit guest mode" : "Sign out";
    const message = isGuest
      ? "Do you want to leave guest mode?"
      : "Do you want to sign out of your account?";

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: isGuest ? "Exit" : "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/signin");
        },
      },
    ]);
  }, [isGuest, router, signOut]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  const statItems = [
    { label: "Orders", value: stats.orders },
    { label: "Active", value: stats.activeOrders },
    { label: "Saved", value: stats.favorites },
    { label: "Points", value: stats.points },
  ];

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
            <Text style={styles.headerEyebrow}>Account</Text>
            <Text style={styles.headerTitle}>Your Mataim space</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => openRoute("/(tabs)/notifications/user_notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        {isGuest ? <GuestProfileBanner /> : null}

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
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.emailText} numberOfLines={1}>
              {user?.email || "Sign in to save orders"}
            </Text>
            {user?.phone ? (
              <Text style={styles.phoneText} numberOfLines={1}>
                {user.phone}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openRoute("/(tabs)/profiles/edit")}
          >
            <Ionicons name="create-outline" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsPanel}>
          {loadingStats ? (
            <View style={styles.loadingStats}>
              <ActivityIndicator color="#FF6B35" />
              <Text style={styles.loadingText}>Loading account</Text>
            </View>
          ) : (
            statItems.map((item) => (
              <View key={item.label} style={styles.statItem}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.walletPanel}>
          <View>
            <Text style={styles.walletLabel}>Delivered spend</Text>
            <Text style={styles.walletValue}>{formatMoney(stats.spent)}</Text>
          </View>
          <TouchableOpacity
            style={styles.walletButton}
            onPress={() => openRoute("/(tabs)/orders")}
          >
            <Text style={styles.walletButtonText}>Orders</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.actionList}>
          {accountActions.map((item) => (
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
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.supportPanel}>
          <Text style={styles.supportTitle}>Need help?</Text>
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => openRoute("/(tabs)/messages")}
          >
            <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.supportText}>Help center</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => openRoute("/(tabs)/messages")}
          >
            <Ionicons name="headset-outline" size={20} color="#6B7280" />
            <Text style={styles.supportText}>Contact support</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>{isGuest ? "Exit guest mode" : "Sign out"}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Mataim v1.0.0</Text>
        <View style={{ height: 50 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    paddingBottom: -50,
  },
  content: {
    padding: 14,
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
    fontWeight: "800",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.8,
    borderColor: "#e5e7eb80",
  },
  profilePanel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eba1",
    padding: 14,
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
    fontSize: 18,
    fontWeight: "800",
  },
  profileText: {
    flex: 1,
  },
  nameText: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "800",
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
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 0.8,
    borderColor: "#e5e7eb52",
  },
  statsPanel: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eb9c",
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
    fontSize: 12,
    fontWeight: "600",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 17,
    fontWeight: "700",
  },
  statLabel: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3.5,
    letterSpacing: 0.2,
  },
  walletPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  walletLabel: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 11.8,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  walletValue: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "800",
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
    fontSize: 16,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 10,
  },
  actionList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eb8d",
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 99,
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
    fontWeight: "800",
  },
  actionSubtitle: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
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
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: "#e5e7eb94",
    padding: 12,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 10,
  },
  quickSubtitle: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 3,
  },
  supportPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eb72",
    marginTop: 20,
    padding: 12,
  },
  supportTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  supportText: {
    flex: 1,
    color: "#374151",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },
  signOutButton: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#fecacab9",
  },
  signOutText: {
    color: "#EF4444",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "800",
  },
  versionText: {
    color: "#9CA3AF",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
});
