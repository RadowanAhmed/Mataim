// app/components/DriverTabBar.tsx
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../backend/AuthContext";

const TAB_COLORS = {
  primary: "#FF6B35",
  inactive: "#041533",
  dark: "#0B1220",
};

const AnimatedTabButton = memo(function AnimatedTabButton({
  onPress,
  isFocused,
  label,
  iconName,
  isCenter = false,
}: any) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(isFocused ? 1 : 0.7)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: isFocused ? (isCenter ? 1.06 : 1.12) : 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: isFocused ? 1 : 0.75,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isFocused, isCenter, opacityAnim, scaleAnim]);

    const handlePress = () => {
      onPress();
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: isFocused ? (isCenter ? 1.06 : 1.12) : 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const iconColor = isFocused ? TAB_COLORS.primary : TAB_COLORS.inactive;
    const centerIconColor = "#fff";

    const renderIcon = () => {
      switch (iconName) {
        case "dashboard":
          return (
            <MaterialCommunityIcons
              name={isFocused ? "view-dashboard" : "view-dashboard-outline"}
              size={22}
              color={iconColor}
            />
          );
        case "orders":
          return (
            <MaterialIcons
              name={isFocused ? "receipt" : "receipt-long"}
              size={22}
              color={iconColor}
            />
          );
        case "explore":
          return (
            <MaterialCommunityIcons
              name="map-marker-path"
              size={28}
              color={centerIconColor}
            />
          );
        case "earnings":
          return (
            <Ionicons
              name={isFocused ? "cash" : "cash-outline"}
              size={22}
              color={iconColor}
            />
          );
        case "person":
          return (
            <Ionicons
              name={isFocused ? "person" : "person-outline"}
              size={22}
              color={iconColor}
            />
          );
        default:
          return null;
      }
    };

    if (isCenter) {
      return (
        <Pressable onPress={handlePress} style={styles.centerPressable}>
          <Animated.View
            style={[
              styles.centerButton,
              isFocused && styles.centerButtonActive,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {renderIcon()}
          </Animated.View>
          <Text style={[styles.centerLabel, isFocused && styles.centerLabelActive]}>{label}</Text>
        </Pressable>
      );
    }

    return (
      <Pressable onPress={handlePress} style={styles.tabItem}>
        <Animated.View
          style={{
            alignItems: "center",
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          {renderIcon()}
          <Animated.Text
            style={[
              styles.label,
              { color: iconColor, opacity: opacityAnim },
              isFocused && styles.labelActive,
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    );
});

export const DriverTabBar = ({ state, navigation }: any) => {
  const { user } = useAuth() as any;
  const [layouts, setLayouts] = useState<any>({});
  const sliderAnim = useRef(new Animated.Value(0)).current;
  const sliderWidth = 36;

  const tabs = [
    { name: "dashboard", label: "Home", icon: "dashboard" },
    { name: "explore", label: "Go", icon: "explore", center: true },
    { name: "profile", label: "Profile", icon: "person" },
  ];

  const currentRouteName = state.routes[state.index]?.name;

  const handleLayout = (e: any, name: string) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev: any) => ({ ...prev, [name]: { x, width } }));
  };

  useEffect(() => {
    const layout = layouts[currentRouteName];
    if (!layout || currentRouteName === "explore") return;

    const centerX = layout.x + layout.width / 2 - sliderWidth / 2;
    Animated.timing(sliderAnim, {
      toValue: centerX,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [currentRouteName, layouts, sliderAnim]);

  if (currentRouteName === "explore") {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.slider,
            { width: sliderWidth, transform: [{ translateX: sliderAnim }] },
          ]}
        />

        {tabs.map((tab) => {
          const routeExists = state.routes.some((route: any) => route.name === tab.name);
          if (!routeExists) return null;

          const isFocused = currentRouteName === tab.name;
          const onPress = () => {
            if (!isFocused) navigation.navigate(tab.name);
          };

          return (
            <View
              key={tab.name}
              style={[styles.tabWrapper, tab.center && styles.centerWrapper]}
              onLayout={(e) => handleLayout(e, tab.name)}
            >
              <AnimatedTabButton
                onPress={onPress}
                isFocused={isFocused}
                label={tab.label}
                iconName={tab.icon}
                isCenter={tab.center}
              />

              {tab.name === "orders" && user?.hasNewOrders && (
                <View style={styles.notification}>
                  <View style={styles.dot} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default DriverTabBar;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    height: 78,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
  },
  slider: {
    position: "absolute",
    top: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAB_COLORS.primary,
  },
  tabWrapper: {
    flex: 1,
  },
  centerWrapper: {
    marginTop: -28,
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 12,
  },
  labelActive: {
    fontWeight: "700",
    fontSize: 10,
  },
  centerPressable: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  centerButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: TAB_COLORS.dark,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  centerButtonActive: {
    backgroundColor: TAB_COLORS.primary,
  },
  centerLabel: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
    color: TAB_COLORS.inactive,
  },
  centerLabelActive: {
    color: TAB_COLORS.primary,
  },
  notification: {
    position: "absolute",
    top: 10,
    right: "32%",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TAB_COLORS.primary,
  },
});
