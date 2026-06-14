import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatMoney } from "@/backend/utils/currency";
import { calculateDriverPayout } from "@/backend/utils/deliveryPricing";
import { LinearGradient } from "expo-linear-gradient";
import React, { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

export const DRIVER_COLORS = {
  orange: "#FF6B35",
  orangeDark: "#E85A2A",
  black: "#0B0F17",
  blackSoft: "#111827",
  charcoal: "#1F2937",
  muted: "#6B7280",
  softText: "#9CA3AF",
  border: "#E5E7EB",
  background: "#F8FAFC",
  card: "#FFFFFF",
  success: "#10B981",
  blue: "#3B82F6",
  red: "#EF4444",
  warning: "#F59E0B",
  purple: "#8B5CF6",
};

export type DriverOrderLike = {
  id: string;
  order_number?: string;
  status?: string;
  final_amount?: number | string | null;
  delivery_fee?: number | string | null;
  created_at?: string | null;
  estimated_delivery_time?: string | null;
  special_instructions?: string | null;
  distance?: number | null;
  earnings?: number | null;
  restaurants?: any;
  restaurant?: any;
  users?: any;
  customer?: any;
  delivery_address?: any;
};

const DEFAULT_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop";

export const currency = (value?: number | string | null, _label = "UGX") => formatMoney(value);

export const shortDate = (value?: string | null) => {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export const shortTime = (value?: string | null) => {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const minutesAgo = (value?: string | null) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return shortDate(value);
};

export const normalizeStatus = (status?: string | null) =>
  String(status || "pending").toLowerCase();

export const prettyStatus = (status?: string | null) =>
  normalizeStatus(status)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const statusColor = (status?: string | null) => {
  switch (normalizeStatus(status)) {
    case "ready":
      return DRIVER_COLORS.blue;
    case "out_for_delivery":
      return DRIVER_COLORS.orange;
    case "delivered":
      return DRIVER_COLORS.success;
    case "cancelled":
      return DRIVER_COLORS.red;
    case "preparing":
    case "confirmed":
      return DRIVER_COLORS.purple;
    default:
      return DRIVER_COLORS.muted;
  }
};

export const getRestaurant = (order: DriverOrderLike) =>
  order.restaurants || order.restaurant || {};

export const getCustomer = (order: DriverOrderLike) =>
  order.users || order.customer || {};

export const formatAddress = (address: any): string => {
  if (!address) return "Address not available";
  if (typeof address === "string") {
    try {
      return formatAddress(JSON.parse(address));
    } catch {
      return address;
    }
  }
  const parts = [
    address.label,
    address.address_line1,
    address.address_line2,
    address.street,
    address.city,
    address.state,
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Address not available";
};

export function DriverHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerEyebrow}>Mataim Driver</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function BlackHero({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={[DRIVER_COLORS.black, DRIVER_COLORS.blackSoft, "#251006"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.blackHero, style]}
    >
      <View style={styles.heroGlow} />
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
        {children}
      </View>
    </LinearGradient>
  );
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  dark = false,
  style,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionCard, dark && styles.darkCard, style]}>
      {(title || subtitle || right) && (
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            {!!title && (
              <Text style={[styles.sectionTitle, dark && styles.darkTitle]}>
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={[styles.sectionSubtitle, dark && styles.darkSubtitle]}>
                {subtitle}
              </Text>
            )}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  color = DRIVER_COLORS.orange,
  dark = false,
}: {
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.metricCard, dark && styles.metricCardDark]}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.metricValue, dark && { color: "#FFFFFF" }]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, dark && { color: "#D1D5DB" }]}>
        {label}
      </Text>
    </View>
  );
}

export function StatusPill({
  label,
  color = DRIVER_COLORS.orange,
  filled = false,
}: {
  label: string;
  color?: string;
  filled?: boolean;
}) {
  return (
    <View
      style={[
        styles.statusPill,
        filled
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: `${color}14`, borderColor: `${color}30` },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          { backgroundColor: filled ? "#FFFFFF" : color },
        ]}
      />
      <Text style={[styles.statusPillText, { color: filled ? "#FFFFFF" : color }]}>
        {label}
      </Text>
    </View>
  );
}

export function AnimatedPressable({
  children,
  onPress,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 35,
      bounciness: 5,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 5,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PrimaryButton({
  title,
  icon,
  onPress,
  disabled,
  dark = false,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <AnimatedPressable onPress={onPress} disabled={disabled}>
      <LinearGradient
        colors={
          dark
            ? ["#FFFFFF", "#F3F4F6"]
            : [DRIVER_COLORS.orange, DRIVER_COLORS.orangeDark]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryButton, disabled && { opacity: 0.55 }]}
      >
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color={dark ? DRIVER_COLORS.black : "#FFFFFF"}
          />
        )}
        <Text style={[styles.primaryButtonText, dark && { color: DRIVER_COLORS.black }]}>
          {title}
        </Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export function SecondaryButton({
  title,
  icon,
  onPress,
  color = DRIVER_COLORS.black,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={styles.secondaryButton} onPress={onPress} activeOpacity={0.88}>
      {!!icon && <Ionicons name={icon} size={18} color={color} />}
      <Text style={[styles.secondaryButtonText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function DriverAvatar({
  name,
  imageUrl,
  size = 56,
}: {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
}) {
  const initials = String(name || "Driver")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: DRIVER_COLORS.black,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: size * 0.3, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

export function FoodImage({
  uri,
  source,
  size = 64,
}: {
  uri?: string | null;
  source?: ImageSourcePropType;
  size?: number;
}) {
  return (
    <Image
      source={source || { uri: uri || DEFAULT_RESTAURANT_IMAGE }}
      style={{ width: size, height: size, borderRadius: 18, backgroundColor: "#E5E7EB" }}
    />
  );
}

export function DriverOrderCard({
  order,
  onPress,
  onPrimary,
  primaryLabel,
}: {
  order: DriverOrderLike;
  onPress?: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
}) {
  const restaurant = getRestaurant(order);
  const customer = getCustomer(order);
  const title = restaurant.restaurant_name || "Restaurant";
  const earning = order.earnings ?? calculateDriverPayout(order.delivery_fee);

  return (
    <AnimatedPressable onPress={onPress} style={styles.orderCardWrap}>
      <View style={styles.orderCard}>
        <View style={styles.orderTopRow}>
          <FoodImage uri={restaurant.image_url} size={68} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.orderTitleRow}>
              <Text style={styles.orderNumber}>#{order.order_number || "Order"}</Text>
              <StatusPill label={prettyStatus(order.status)} color={statusColor(order.status)} />
            </View>
            <Text numberOfLines={1} style={styles.orderRestaurant}>{title}</Text>
            <Text numberOfLines={1} style={styles.orderMeta}>
              {restaurant.address || formatAddress(order.delivery_address)}
            </Text>
          </View>
        </View>

        <View style={styles.orderDivider} />

        <View style={styles.routeLine}>
          <View style={styles.routeDotStart} />
          <Text numberOfLines={1} style={styles.routeText}>
            Pickup: {restaurant.address || "Restaurant address"}
          </Text>
        </View>
        <View style={styles.routeLine}>
          <View style={styles.routeDotEnd} />
          <Text numberOfLines={1} style={styles.routeText}>
            Dropoff: {formatAddress(order.delivery_address)}
          </Text>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.footerMetric}>
            <Ionicons name="cash-outline" size={16} color={DRIVER_COLORS.success} />
            <Text style={styles.footerMetricText}>{currency(earning)}</Text>
          </View>
          <View style={styles.footerMetric}>
            <Ionicons name="navigate-outline" size={16} color={DRIVER_COLORS.blue} />
            <Text style={styles.footerMetricText}>
              {order.distance ? `${order.distance.toFixed(1)} km` : "Nearby"}
            </Text>
          </View>
          <View style={styles.footerMetric}>
            <Ionicons name="time-outline" size={16} color={DRIVER_COLORS.warning} />
            <Text style={styles.footerMetricText}>{shortTime(order.estimated_delivery_time)}</Text>
          </View>
        </View>

        {!!customer.full_name && (
          <Text numberOfLines={1} style={styles.customerLine}>
            Customer: {customer.full_name}
          </Text>
        )}

        {!!primaryLabel && (
          <View style={styles.orderButtonRow}>
            <PrimaryButton title={primaryLabel} icon="checkmark-circle" onPress={onPrimary} />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={DRIVER_COLORS.orange} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function LivePulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.livePulseWrap}>
      <Animated.View style={[styles.livePulseOuter, { opacity, transform: [{ scale }] }]} />
      <View style={styles.livePulseInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: DRIVER_COLORS.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: DRIVER_COLORS.orange,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: DRIVER_COLORS.black,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: DRIVER_COLORS.muted,
    marginTop: 2,
    fontWeight: "500",
  },
  blackHero: {
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 132,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  heroGlow: {
    position: "absolute",
    right: -45,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,107,53,0.28)",
  },
  heroContent: {
    padding: 20,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.9)",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: DRIVER_COLORS.black,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: DRIVER_COLORS.black,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: DRIVER_COLORS.muted,
    lineHeight: 17,
    fontWeight: "500",
  },
  darkTitle: { color: "#FFFFFF" },
  darkSubtitle: { color: "#D1D5DB" },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  metricCardDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: DRIVER_COLORS.black,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    color: DRIVER_COLORS.muted,
    fontWeight: "700",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  orderCardWrap: {
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: DRIVER_COLORS.orange,
  },
  orderRestaurant: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: "700",
    color: DRIVER_COLORS.black,
  },
  orderMeta: {
    marginTop: 3,
    fontSize: 12,
    color: DRIVER_COLORS.muted,
    fontWeight: "500",
  },
  orderDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DRIVER_COLORS.orange,
    marginRight: 10,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DRIVER_COLORS.success,
    marginRight: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 12,
    color: DRIVER_COLORS.charcoal,
    fontWeight: "600",
  },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 3,
  },
  footerMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerMetricText: {
    fontSize: 11,
    fontWeight: "700",
    color: DRIVER_COLORS.black,
  },
  customerLine: {
    marginTop: 10,
    fontSize: 12,
    color: DRIVER_COLORS.muted,
    fontWeight: "700",
  },
  orderButtonRow: {
    marginTop: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 18,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 28,
    backgroundColor: "#FFF1EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: DRIVER_COLORS.black,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 7,
    fontSize: 13,
    color: DRIVER_COLORS.muted,
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },
  livePulseWrap: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulseOuter: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DRIVER_COLORS.success,
  },
  livePulseInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: DRIVER_COLORS.success,
  },
});
