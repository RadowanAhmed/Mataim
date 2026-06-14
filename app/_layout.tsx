/**
 * Root Layout - app/_layout.tsx
 * 
 * CRITICAL POLYFILL SETUP - Must execute FIRST
 * Registers global DOMException before ANY other code runs
 */

// ============================================================================
// STEP 1: POLYFILL - Executes immediately when module loads
// ============================================================================
try {
  if (typeof (globalThis as any).DOMException === 'undefined') {
    class DOMException extends Error {
      name: string;
      code: number;
      constructor(message: string = '', name: string = 'DOMException') {
        super(message);
        this.name = name || 'DOMException';
        this.code = 0;
        Object.setPrototypeOf(this, DOMException.prototype);
      }
    }
    (globalThis as any).DOMException = DOMException;
  }

  if (typeof (globalThis as any).Event === 'undefined') {
    (globalThis as any).Event = function (type: string, eventInitDict?: any) {
      this.type = type;
      this.bubbles = eventInitDict?.bubbles ?? false;
      this.cancelable = eventInitDict?.cancelable ?? false;
    };
  }
} catch (error) {
  console.error('[INIT] Polyfill registration error:', error);
}

// ============================================================================
// STEP 2: Import all modules (polyfill already in global scope)
// ============================================================================

import { LocationProvider } from "@/backend/LocationContext";
import { AuthProvider, useAuth } from "@/backend/AuthContext";
import { NotificationProvider } from "@/backend/NotificationContext";
import { OnboardingProvider, useOnboarding } from "@/backend/OnboardingContext";
import { passwordResetManager } from "@/backend/PasswordResetManager";
import { useNotifications } from "@/backend/hooks/useNotifications";
import { PushNotificationService } from "@/backend/services/PushNotificationService";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { useLoadFonts } from "@/backend/hooks/useFonts";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";

import { StripeProvider } from "@stripe/stripe-react-native";
import { logger } from "@/backend/utils/logger";

// Keep splash screen visible during initialization
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen might already be hidden
});

const DEBUG = __DEV__;
let defaultFontsApplied = false;

// Validate required environment variables
const validateEnvironment = () => {
  const missingVars = [];

  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    missingVars.push("EXPO_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    missingVars.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missingVars.length > 0) {
    logger.error(
      "Missing required environment variables:",
      missingVars.join(", ")
    );
    if (!DEBUG) {
      console.error(
        "⚠️ CRITICAL: Missing environment variables. The app will not work properly."
      );
    }
  }

  if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    logger.warn(
      "⚠️ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY not set. Payment features will be disabled."
    );
  }
};

// Call validation on app startup
validateEnvironment();

function applyDefaultInterFont() {
  if (defaultFontsApplied) return;

  const applyDefaultFont = (Component: any) => {
    Component.defaultProps = Component.defaultProps || {};
    Component.defaultProps.style = [{ fontFamily: "Inter" }, Component.defaultProps.style];
  };

  applyDefaultFont(Text);
  applyDefaultFont(TextInput);
  defaultFontsApplied = true;
}

function RootLayoutNav() {
  const router = useRouter();
  const { user, isLoading: authLoading, signOut } = useAuth() as any;
  const { isLoading: onboardingLoading } = useOnboarding() as any;
  const [initialized, setInitialized] = useState(false);
  const [notificationInitialized, setNotificationInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const registerToken = async () => {
      if (!user?.id || user.user_type === "restaurant") return;

      try {
        await PushNotificationService.registerPushToken(user.id);

        if (DEBUG) {
          await supabase.from("user_push_tokens").select("id").eq("user_id", user.id).limit(1);
        }
      } catch (error) {
        logger.error("Push token registration failed:", error);
        // Don't throw - this is not critical for app startup
      }
    };

    registerToken();
  }, [user?.id, user?.user_type]);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        logger.debug("Initializing core services...");

        // Initialize each service with error handling
        try {
          await passwordResetManager.initialize();
          logger.debug("✓ Password reset manager initialized");
        } catch (error) {
          logger.error("Password reset manager initialization failed:", error);
          // Continue - not critical
        }

        try {
          await NotificationService.initialize();
          logger.debug("✓ Notification service initialized");
        } catch (error) {
          logger.error("Notification service initialization failed:", error);
          // Continue - not critical
        }

        try {
          await PushNotificationService.initialize();
          logger.debug("✓ Push notification service initialized");
        } catch (error) {
          logger.error("Push notification service initialization failed:", error);
          // Continue - not critical
        }

        setNotificationInitialized(true);
        setInitializationError(null);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error("Service initialization failed:", error);
        setInitializationError(errorMsg);
      } finally {
        setInitialized(true);
      }
    };

    initializeServices();
  }, []);

  useEffect(() => {
    const blockRestaurantMobileSession = async () => {
      if (user?.user_type === "restaurant") {
        await signOut?.();
        router.replace("/(auth)/signin" as any);
      }
    };

    blockRestaurantMobileSession();
  }, [user?.user_type, signOut, router]);

  useNotifications(notificationInitialized && !authLoading && Boolean(user?.id));

  // CRITICAL: Don't wait for initialization to render Stack
  // This allows the app to load even if services fail
  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }} initialRouteName="splash">
        <Stack.Screen name="splash" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="post" />
        <Stack.Screen name="posts" />
        <Stack.Screen name="index" />
      </Stack>
    </NotificationProvider>
  );
}

export default function RootLayout() {
  const fontsLoaded = useLoadFonts();
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  useEffect(() => {
    const hideSplashScreen = async () => {
      try {
        // Hide splash as soon as fonts are loaded - don't wait for appReady
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      } catch (error) {
        logger.debug("Error hiding splash screen:", error);
      }
    };

    hideSplashScreen();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  applyDefaultInterFont();

  // Warn if Stripe key is missing
  if (!stripePublishableKey) {
    logger.warn(
      "⚠️ Stripe publishable key is missing. Payment features will be disabled. " +
      "Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable."
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={stripePublishableKey}
        merchantIdentifier="merchant.com.radowanahmed.MataimApp"
        threeDSecureParams={{
          backgroundColor: "#FFFFFF",
        }}
      >
        <OnboardingProvider>
          <LocationProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </LocationProvider>
        </OnboardingProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
