// app/splash.tsx
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../backend/AuthContext";
import { useOnboarding } from "../backend/OnboardingContext";
import { notificationTapRouteForUserType } from "../backend/utils/notificationRoutes";
import LottieView from "lottie-react-native";

const APP_ICON = require("../assets/icons/ic_launcher2.png");

async function getLaunchNotificationRoute(userType?: string | null) {
  try {
    const Constants = await import("expo-constants");

    if (Constants.default?.appOwnership === "expo") return null;

    const Notifications = await import("expo-notifications");
    const response = await Notifications.getLastNotificationResponseAsync?.();

    const data = response?.notification?.request?.content?.data;

    return data
      ? notificationTapRouteForUserType(data, userType)
      : null;
  } catch {
    return null;
  }
}

export default function SplashScreen() {
  const router = useRouter();

  const { user, isLoading: authLoading, signOut } = useAuth();

  const { hasCompletedOnboarding } = useOnboarding();

  const [updateChecked, setUpdateChecked] = useState(false);
  const [navigationAttempted, setNavigationAttempted] = useState(false);

  const isMounted = useRef(true);

  // Main animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;

  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(16)).current;

  // Floating animation
  const floatingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkForUpdates = async () => {
      if (__DEV__) {
        setUpdateChecked(true);
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();

          Alert.alert(
            "Update Available",
            "A new version is ready. Restart now to apply?",
            [
              {
                text: "Later",
                onPress: () => setUpdateChecked(true),
                style: "cancel",
              },
              {
                text: "Restart Now",
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ],
          );
        } else {
          setUpdateChecked(true);
        }
      } catch {
        setUpdateChecked(true);
      }
    };

    checkForUpdates();
  }, []);

  const navigateBasedOnAuth = async () => {
    if (navigationAttempted || !isMounted.current || authLoading) return;

    setNavigationAttempted(true);

    if (user) {
      const notificationRoute = await getLaunchNotificationRoute(
        user.user_type,
      );

      switch (user.user_type) {
        case "restaurant":
          await signOut();
          router.replace("/(auth)/signin");
          break;

        case "driver":
          router.replace(
            (notificationRoute || "/(driver)/dashboard") as any,
          );
          break;

        case "customer":
        default:
          router.replace((notificationRoute || "/(tabs)") as any);
          break;
      }
    } else if (!hasCompletedOnboarding) {
      router.replace("/(onboarding)/welcome1");
    } else {
      router.replace("/(auth)");
    }
  };

  useEffect(() => {
    // Entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),

        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),

        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Floating animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: 10,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.0,
          duration: 1200,
          useNativeDriver: true,
        }),

        Animated.timing(glowOpacity, {
          toValue: 0.0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    isMounted.current = true;

    const navigationTimer = setTimeout(() => {
      if (updateChecked) {
        navigateBasedOnAuth();
      }
    }, 2200);

    const backupTimer = setTimeout(() => {
      if (isMounted.current && !navigationAttempted) {
        navigateBasedOnAuth();
      }
    }, 5000);

    return () => {
      isMounted.current = false;

      clearTimeout(navigationTimer);
      clearTimeout(backupTimer);
    };
  }, [
    user,
    hasCompletedOnboarding,
    authLoading,
    updateChecked,
    signOut,
  ]);

  return (
    <View style={styles.container}>
      {/* Glow Background */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [
              { scale: logoScale },
              { translateY: floatingAnim },
              { translateY: logoTranslateY },
            ],
          },
        ]}
      >
        <LottieView
          source={require("../assets/animations/splash/Vue Anime logo.json")}
          autoPlay
          loop
          style={styles.logo}
        />

      </Animated.View>
      <View
        style={{
          position: "absolute",
          bottom: "22%",
          width: "100%",
          height: 120,
          backgroundColor: "#ff6254",
        }}
      />
      {/* <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          Mataim
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: titleOpacity,
            },
          ]}
        >
          Delicious moments delivered
        </Animated.Text> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ff6254",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  glow: {
    position: "absolute",
    width: 100,
    height: 100,
    backgroundColor: "transparent",
  },

  content: {
    alignItems: "center",
  },

  logoWrapper: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    width: 350,
    height: 350,
  },

  logo: {
    width: 470,
    height: 470,
    backgroundColor: "transparent",
    marginLeft: 0,
  },

  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#111827",
    fontFamily: "AlanSans",
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});