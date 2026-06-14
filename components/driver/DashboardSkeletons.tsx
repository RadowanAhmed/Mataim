// components/driver/DashboardSkeletons.tsx
import React from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";

const SkeletonPlaceholder = ({ width = "100%", height = 20, borderRadius = 4, style = {} }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#E5E7EB",
          opacity,
        },
        style,
      ]}
    />
  );
};

export const DashboardSkeleton = () => (
  <View style={styles.container}>
    {/* Status Card */}
    <View style={styles.statusCardSkeleton}>
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonPlaceholder width={150} height={16} />
        <SkeletonPlaceholder width={200} height={14} />
      </View>
      <SkeletonPlaceholder width={100} height={40} borderRadius={8} />
    </View>

    {/* Earnings Card */}
    <View style={styles.earningsCardSkeleton}>
      <SkeletonPlaceholder width={120} height={12} />
      <SkeletonPlaceholder width={200} height={32} style={{ marginTop: 8 }} />
    </View>

    {/* Stats Grid */}
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.statItem}>
          <SkeletonPlaceholder width={40} height={40} borderRadius={8} />
          <SkeletonPlaceholder width={60} height={12} style={{ marginTop: 8 }} />
          <SkeletonPlaceholder width={80} height={16} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>

    {/* Active Order Card */}
    <View style={styles.orderCardSkeleton}>
      <SkeletonPlaceholder width={150} height={14} />
      <SkeletonPlaceholder width="100%" height={120} style={{ marginTop: 12 }} borderRadius={8} />
    </View>
  </View>
);

export const TripsStatsSkeleton = () => (
  <View style={styles.tripsStatsContainer}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.tripStatItem}>
        <SkeletonPlaceholder width={40} height={40} borderRadius={8} />
        <SkeletonPlaceholder width={60} height={12} style={{ marginTop: 8 }} />
        <SkeletonPlaceholder width={50} height={16} style={{ marginTop: 4 }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
  },
  statusCardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  earningsCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  orderCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tripsStatsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
  },
  tripStatItem: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
});
