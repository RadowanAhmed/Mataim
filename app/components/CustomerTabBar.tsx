// app/components/CustomerTabBar.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useAuth } from "../../backend/AuthContext";

const AnimatedTabButton = memo(
  ({ onPress, isFocused, label, iconName, colors }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(
      new Animated.Value(isFocused ? 1 : 0.72),
    ).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: isFocused ? 1.08 : 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: isFocused ? 1 : 0.72,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isFocused, opacityAnim, scaleAnim]);

    const handlePress = useCallback(() => {
      onPress();
    }, [onPress]);

    const iconColor = isFocused ? colors.primary : colors.inactive;
    const iconSize = 22;

    const renderIcon = useCallback(() => {
      switch (iconName) {
        case "home":
          return (
            <Ionicons
              name={isFocused ? "home" : "home-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "explore":
          return (
            <Ionicons
              name={isFocused ? "compass" : "compass-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "notifications":
          return (
            <Ionicons
              name={isFocused ? "notifications" : "notifications-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "basket":
          return (
            <Ionicons
              name={isFocused ? "basket" : "basket-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "account":
          return (
            <Ionicons
              name={isFocused ? "person-circle" : "person-circle-outline"}
              size={iconSize + 1}
              color={iconColor}
            />
          );
        default:
          return null;
      }
    }, [iconColor, iconName, isFocused]);

    return (
      <Pressable
        onPress={handlePress}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={label}
      >
        <Animated.View
          style={[
            styles.tabInner,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {renderIcon()}
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: iconColor },
              isFocused && styles.labelActive,
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    );
  },
);

export const CustomerTabBar = ({ state, descriptors, navigation }: any) => {
  const { user } = useAuth();
  const customerUser = user as any;
  const [layouts, setLayouts] = useState<any>({});
  const sliderAnim = useRef(new Animated.Value(0)).current;
  const sliderWidth = 42;

  // 🔥 ADD THIS: List of routes where the tab bar should be hidden
  const hiddenRoutes = [
    'profiles/restaurant-profile/[id]',
    // Add any other routes where you want to hide the tab bar
  ];

  // 🔥 ADD THIS: Check if current route should hide the tab bar
  const currentRoute = state.routes[state.index];
  const shouldHideTabBar = currentRoute && hiddenRoutes.some(route =>
    currentRoute.name.includes(route.replace('/[id]', ''))
  );

  const tabs = [
    { name: "index", label: "Home", icon: "home" },
    { name: "search", label: "Explore", icon: "explore" },
    { name: "cart", label: "Cart", icon: "basket" },
    { name: "profile", label: "Account", icon: "account" },
  ];

  const handleLayout = useCallback((e: any, name: string) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev: any) => ({ ...prev, [name]: { x, width } }));
  }, []);

  useEffect(() => {
    const route = state.routes[state.index];
    const layout = layouts[route.name];

    if (layout) {
      const centerX = layout.x + layout.width / 2 - sliderWidth / 2;

      Animated.timing(sliderAnim, {
        toValue: centerX,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [layouts, sliderAnim, state.index, state.routes]);

  // 🔥 ADD THIS: Return null to hide the tab bar
  if (shouldHideTabBar) {
    return null;
  }

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <View style={styles.tabBarShadow} />

      <View style={styles.tabBarContainer}>
        <Animated.View
          style={[
            styles.slider,
            {
              width: sliderWidth,
              transform: [{ translateX: sliderAnim }],
            },
          ]}
        />

        <View style={styles.contentWrapper}>
          {tabs.map((tab) => {
            const routeIndex = state.routes.findIndex(
              (route: any) => route.name === tab.name,
            );
            const route = state.routes[routeIndex];
            if (!route) return null;

            const isFocused = state.index === routeIndex;
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <View
                key={tab.name}
                style={styles.tabWrapper}
                onLayout={(e) => handleLayout(e, tab.name)}
              >
                <AnimatedTabButton
                  onPress={onPress}
                  isFocused={isFocused}
                  label={tab.label}
                  iconName={tab.icon}
                  colors={{
                    primary: "#FF6B35",
                    inactive: "#041533",
                  }}
                />

                {tab.name === "profile" &&
                  customerUser?.hasNewOrders &&
                  !customerUser?.is_guest && (
                    <View style={styles.notification}>
                      <View style={styles.dot} />
                    </View>
                  )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default CustomerTabBar;

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 22 : 14,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  tabBarShadow: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: -5,
    height: 26,
    borderRadius: 26,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#0000006d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabBarContainer: {
    height: 66,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 10,
  },
  contentWrapper: {
    flexDirection: "row",
    height: "100%",
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 5,
  },
  slider: {
    position: "absolute",
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF6B35",
  },
  tabWrapper: {
    flex: 1,
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
  },
  label: {
    fontSize: 10.5,
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 13,
    letterSpacing: -0.15,
    fontFamily: "Inter",

  },
  labelActive: {
    fontWeight: "800",
    fontSize: 10.5,
    color: "#FF6B35",
    fontFamily: "Inter",
  },
  notification: {
    position: "absolute",
    top: 9,
    right: "30%",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF6B35",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
});