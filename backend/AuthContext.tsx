import { logger } from "@/backend/utils/logger";
// backend/AuthContext.tsx - Complete version with all helper functions
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { passwordResetManager } from "./PasswordResetManager";
import { NotificationService } from "./services/notificationService";
import { isSupabaseConfigured, supabase, User, UserProfile } from "./supabase";
import {
  STARTUP_TIMEOUTS,
  logStartup,
  runStartupTask,
  startNonBlockingStartupTask,
} from "./utils/startupDiagnostics";


type MobileUserType = "customer" | "driver";

const MOBILE_ALLOWED_USER_TYPES: MobileUserType[] = ["customer", "driver"];
const RESTAURANT_WEB_ONLY_MESSAGE =
  "Restaurant accounts are managed on the website. Please use the restaurant website to sign in.";

const isMobileAllowedUserType = (
  userType?: string | null,
): userType is MobileUserType => {
  return userType === "customer" || userType === "driver";
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: any; data?: any }>;
  signUp: (
    email: string,
    password: string,
    userData: any,
  ) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  refreshUserData: () => Promise<void>;
  checkRestaurantSetupComplete: (userId: string) => Promise<boolean>;
  refreshRestaurantData: () => Promise<void>;
  updateNewOrdersStatus: (userId: string) => Promise<void>;
  clearNewOrdersNotification: () => void;
  hasNewOrders?: boolean;
  newOrdersCount?: number;

  isGuest: boolean;
  signInAsGuest: () => Promise<void>;
  convertGuestToUser: (
    email: string,
    password: string,
    userData: any,
  ) => Promise<{ error: any; data?: any }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add to AuthProvider component
  const [isGuest, setIsGuest] = useState(false);
  const authInitFinishedRef = useRef(false);

  // Function to check if a session is a recovery session that should be blocked
  const isRecoverySessionToBlock = async (session: any): Promise<boolean> => {
    try {
      // Check if we have an active recovery session marker
      const recoverySessionActive = await AsyncStorage.getItem(
        "recovery_session_active",
      );
      const hasValidResetSession = await AsyncStorage.getItem(
        "has_valid_reset_session",
      );

      if (recoverySessionActive === "true" || hasValidResetSession === "true") {
        logger.debug("🔐 Recovery session detected - blocking auto-login");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking recovery session:", error);
      return false;
    }
  };

  useEffect(() => {
    logger.debug("AuthProvider: Initializing auth");

    startNonBlockingStartupTask(
      "password-reset-manager:init",
      () => passwordResetManager.initialize(),
      STARTUP_TIMEOUTS.serviceInit,
    );

    let mounted = true;
    authInitFinishedRef.current = false;

    const authWatchdog = setTimeout(() => {
      if (!mounted || authInitFinishedRef.current) return;

      logStartup("auth:init-watchdog-fallback", {
        timeoutMs: STARTUP_TIMEOUTS.authTotal,
      });
      authInitFinishedRef.current = true;
      setUser(null);
      setProfile(null);
      setIsGuest(false);
      setIsLoading(false);
    }, STARTUP_TIMEOUTS.authTotal);

    const initializeAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          logStartup("auth:skipped-missing-supabase");
          authInitFinishedRef.current = true;
          setUser(null);
          setProfile(null);
          setIsGuest(false);
          setIsLoading(false);
          return;
        }

        logger.debug("Checking for existing session...");

        // Get current session from Supabase
        const {
          data: { session },
          error,
        } = await runStartupTask(
          "auth:get-session",
          () => supabase.auth.getSession(),
          STARTUP_TIMEOUTS.authSession,
        );

        if (!mounted) return;

        if (error) {
          console.error("Error getting session:", error);
          authInitFinishedRef.current = true;
          setIsLoading(false);
          return;
        }

        logger.debug(
          "Session found:",
          session ? `yes (user: ${session.user.id})` : "no",
        );

        if (session?.user) {
          // Check if this is a recovery session that should be blocked
          const shouldBlock = await isRecoverySessionToBlock(session);

          if (shouldBlock) {
            logger.debug("🔐 Blocking recovery session during initialization");
            // Don't fetch profile - this prevents auto-login
            authInitFinishedRef.current = true;
            setIsLoading(false);
            return;
          }

          logger.debug("Normal session, fetching profile...");
          await runStartupTask(
            "auth:fetch-profile",
            () => fetchUserProfile(session.user.id),
            STARTUP_TIMEOUTS.authProfile,
          );
          authInitFinishedRef.current = true;
        } else {
          logger.debug("No session found, user needs to sign in");
          authInitFinishedRef.current = true;
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error in initializeAuth:", error);
        if (mounted) {
          authInitFinishedRef.current = true;
          setUser(null);
          setProfile(null);
          setIsGuest(false);
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug(
        "Auth state changed:",
        event,
        session ? `session exists (${session?.user?.id})` : "no session",
      );

      if (!mounted) return;

      // Check if this is a recovery session that should be blocked
      const shouldBlock = await isRecoverySessionToBlock(session);

      if (shouldBlock) {
        logger.debug("🔐 Blocking recovery session from auth state change");
        setIsLoading(false);
        return;
      }

      // Handle PASSWORD_RECOVERY events - allow them but don't auto-login
      if (event === "PASSWORD_RECOVERY") {
        logger.debug(
          "🔐 PASSWORD_RECOVERY event detected - allowing password reset flow",
        );
        setIsLoading(false);
        return;
      }

      // Normal auth flow
      if (session?.user) {
        logger.debug("Normal authentication, fetching profile...");
        await fetchUserProfile(session.user.id);
      } else {
        logger.debug("User signed out, clearing state");
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      logger.debug("AuthProvider: Cleaning up");
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // In AuthContext.tsx - update fetchUserProfile

  const fetchUserProfile = async (userId: string) => {
    try {
      logger.debug("📥 Fetching profile for user:", userId);

      // Step 1: Get base user from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error("❌ Error fetching base user:", userError);
        setIsLoading(false);
        return;
      }

      logger.debug("✅ Base user data found:", userData.email);

      if (!isMobileAllowedUserType(userData.user_type)) {
        console.warn("Restaurant account attempted to open mobile app");
        await supabase.auth.signOut();
        await AsyncStorage.multiRemove([
          "has_valid_reset_session",
          "recovery_session_active",
        ]);
        setUser(null);
        setProfile(null);
        setIsGuest(false);
        setIsLoading(false);
        return;
      }

      // Step 2: Get specific user data based on user type
      let specificUserData = null;
      switch (userData.user_type) {
        case "customer":
          const { data: customerData } = await supabase
            .from("customers")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          specificUserData = customerData;
          break;
        case "driver":
          const { data: driverData } = await supabase
            .from("delivery_users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          specificUserData = driverData;
          break;
      }

      if (specificUserData) {
        logger.debug("✅ Specific user data found");
      } else {
        logger.debug(
          "ℹ️ No specific user data found - user may be newly created",
        );
      }

      // Step 3: Get profile data
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Step 4: Combine all data
      const combinedUserData = {
        ...userData,
        ...specificUserData,
        role: userData.user_type,
        profile: profileData,
      };

      setUser(combinedUserData);
      setProfile(profileData);


      setIsLoading(false);

      // IMPORTANT: Register push token AFTER user data is set
      // Use setTimeout to ensure it doesn't block the main flow
      setTimeout(() => {
        setupPushNotifications(userId);
      }, 1000);

      logger.debug("✅ User profile fully loaded");
    } catch (error) {
      console.error("💥 Error in fetchUserProfile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the setupPushNotifications function with better error handling
  // Update this function in AuthContext.tsx
  const setupPushNotifications = async (userId: string) => {
    try {
      logger.debug("Setting up push notifications for user:", userId);

      // Import and call the register method
      const { PushNotificationService } =
        await import("./services/PushNotificationService");

      // Make sure PushNotificationService is initialized first
      await PushNotificationService.initialize();

      // Register the push token
      await PushNotificationService.registerPushToken(userId);

      logger.debug("✅ Push notification setup completed for user:", userId);
    } catch (error) {
      logger.debug("Push notification setup failed:", error);
    }
  };

  // In your signIn function in AuthContext
  const signIn = async (email: string, password: string) => {
    try {
      logger.debug("Signing in user:", email);

      // Clear any reset sessions
      await passwordResetManager.clearSession();
      await AsyncStorage.multiRemove([
        "has_valid_reset_session",
        "recovery_session_active",
      ]);

      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return { error };
      }

      logger.debug("Sign in successful for user:", data.user.id);

      const { data: userRecord, error: userLookupError } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", data.user.id)
        .maybeSingle();

      if (userLookupError || !userRecord) {
        await supabase.auth.signOut();
        return {
          error:
            userLookupError ||
            new Error("Your account profile is not ready. Please try again."),
        };
      }

      if (!isMobileAllowedUserType(userRecord.user_type)) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return { error: new Error(RESTAURANT_WEB_ONLY_MESSAGE) };
      }

      // Send sign in notification
      try {
        await NotificationService.sendSignInNotification(data.user.id, {});
      } catch (notifError) {
        logger.debug("Sign in notification error (non-critical):", notifError);
      }

      // The auth state change listener will handle the rest
      return { error: null, data };
    } catch (error: any) {
      console.error("Error in signIn:", error);
      return { error };
    }
  };

  // Add these functions
  const signInAsGuest = async () => {
    try {
      // Create a temporary guest session
      const guestId = `guest_${Date.now()}`;
      const guestUser = {
        id: guestId,
        email: `guest_${Date.now()}@temp.com`,
        full_name: "Guest User",
        user_type: "customer",
        is_guest: true,
        profile_image_url: null,
      };

      setUser(guestUser as any);
      setIsGuest(true);

      // Store guest flag
      await AsyncStorage.setItem("is_guest", "true");

      logger.debug("👤 Guest user created:", guestId);
    } catch (error) {
      console.error("Error creating guest user:", error);
    }
  };

  const convertGuestToUser = async (
    email: string,
    password: string,
    userData: any,
  ) => {
    try {
      // Sign up the guest user
      const { error, data } = await signUp(email, password, userData);

      if (!error) {
        // Clear guest flag
        await AsyncStorage.removeItem("is_guest");
        setIsGuest(false);
      }

      return { error, data };
    } catch (error) {
      return { error };
    }
  };

  // Helper functions for inserting specific user data
  const insertCustomerData = async (userId: string, userData: any) => {
    try {
      const customerRecord = {
        id: userId,
        date_of_birth: userData.dateOfBirth || null,
        gender: userData.gender || null,
        address: userData.address || "",
        latitude: userData.latitude || null,
        longitude: userData.longitude || null,
        location_code: userData.locationCode || null,
        total_orders: 0,
        loyalty_points: 100,
        favorite_cuisines: userData.preferredCuisines || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      logger.debug("📝 Inserting customer data:", customerRecord);

      const { error } = await supabase
        .from("customers")
        .insert([customerRecord]);

      if (error) {
        console.error("❌ Customer data insertion error:", error);
        if (error.code === "23505") {
          logger.debug("🔄 Customer already exists");
        } else if (error.code === "23503") {
          logger.debug("⚠️ Foreign key violation - user might not exist yet");
          // Try again after a delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { error: retryError } = await supabase
            .from("customers")
            .insert([customerRecord]);
          if (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      } else {
        logger.debug("✅ Customer data inserted successfully");
      }
    } catch (error) {
      console.error("💥 Error in insertCustomerData:", error);
    }
  };

  // Restaurant profile creation is intentionally not available in the mobile app.

  const insertDeliveryUserData = async (userId: string, userData: any) => {
    try {
      const deliveryUserRecord = {
        id: userId,
        vehicle_type: userData.vehicleType || null,
        license_number: userData.licenseNumber || "",
        vehicle_plate: userData.vehiclePlate || "",
        years_of_experience: userData.yearsOfExperience
          ? parseInt(userData.yearsOfExperience)
          : null,
        availability: userData.availability || null,
        insurance_number: userData.insuranceNumber || null,
        address: userData.address || "",
        latitude: userData.latitude || null,
        longitude: userData.longitude || null,
        location_code: userData.locationCode || null,
        driver_status: "available",
        total_deliveries: 0,
        rating: 0.0,
        current_location_lat: userData.latitude || null,
        current_location_lng: userData.longitude || null,
        is_online: false,
        earnings_today: 0.0,
        total_earnings: 0.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      logger.debug("📝 Inserting delivery user data:", deliveryUserRecord);

      const { error } = await supabase
        .from("delivery_users")
        .insert([deliveryUserRecord]);

      if (error) {
        console.error("❌ Delivery user data insertion error:", error);
        if (error.code === "23505") {
          logger.debug("🔄 Delivery user already exists");
        } else if (error.code === "23503") {
          logger.debug("⚠️ Foreign key violation - user might not exist yet");
          // Try again after a delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { error: retryError } = await supabase
            .from("delivery_users")
            .insert([deliveryUserRecord]);
          if (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      } else {
        logger.debug("✅ Delivery user data inserted successfully");
      }
    } catch (error) {
      console.error("💥 Error in insertDeliveryUserData:", error);
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      logger.debug("🚀 Starting sign up process for:", email);
      logger.debug("📋 User type:", userData.userType);

      if (!isMobileAllowedUserType(userData?.userType)) {
        return { error: new Error(RESTAURANT_WEB_ONLY_MESSAGE) };
      }

      // Step 1: Create user in Supabase Auth
      logger.debug("🔐 Creating auth user...");
      const { error: authError, data: authData } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            user_type: userData.userType,
            full_name: userData.fullName,
            phone: userData.phone,
            countryCode: userData.countryCode,
            address: userData.address,
            latitude: userData.latitude,
            longitude: userData.longitude,
            locationCode: userData.locationCode,
            ...(userData.userType === "customer" && {
              dateOfBirth: userData.dateOfBirth,
              gender: userData.gender,
            }),
            ...(userData.userType === "driver" && {
              vehicleType: userData.vehicleType,
              licenseNumber: userData.licenseNumber,
              vehiclePlate: userData.vehiclePlate,
              yearsOfExperience: userData.yearsOfExperience,
              availability: userData.availability,
              insuranceNumber: userData.insuranceNumber,
            }),
          },
          emailRedirectTo: "mataim://home",
        },
      });

      if (authError) {
        console.error("❌ Auth sign up error:", authError);
        return { error: authError };
      }

      if (!authData.user) {
        console.error("❌ No user data returned from auth");
        return { error: new Error("No user data returned") };
      }

      logger.debug("✅ Auth user created:", authData.user.id);

      // Wait for auth user to be fully created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Create user in custom users table
      logger.debug("📝 Creating base user record...");
      const baseUserRecord = {
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        phone: userData.phone,
        country_code: userData.countryCode,
        full_name: userData.fullName,
        user_type: userData.userType,
        is_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: userInsertError } = await supabase
        .from("users")
        .insert([baseUserRecord]);

      if (userInsertError) {
        if (userInsertError.code === "23505") {
          logger.debug("🔄 User already exists in users table");
        } else {
          console.error("❌ Error creating base user:", userInsertError);
          // Continue anyway - try to create specific data
        }
      } else {
        logger.debug("✅ Base user record created");
      }

      // Step 3: Create specific user data based on type
      logger.debug("🎯 Creating specific user data...");

      switch (userData.userType) {
        case "customer":
          await insertCustomerData(authData.user.id, userData);
          break;
        case "driver":
          await insertDeliveryUserData(authData.user.id, userData);
          break;
      }

      // Step 4: Create user profile
      logger.debug("👤 Creating user profile...");
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: authData.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError && profileError.code !== "23505") {
        logger.debug("ℹ️ Profile creation note:", profileError.message);
      } else {
        logger.debug("✅ Profile created/updated");
      }

      // Step 5: Send welcome notification
      try {
        await NotificationService.sendWelcomeNotification(
          authData.user.id,
          userData.fullName,
        );
      } catch (notifError) {
        logger.debug("Notification error (non-critical):", notifError);
      }

      logger.debug("🎉 Sign up completed successfully!");

      return {
        data: {
          user: authData.user,
          session: authData.session,
        },
        error: null,
      };
    } catch (error: any) {
      console.error("💥 Unexpected error in signUp:", error);
      return { error };
    }
  };
  // In your AuthContext signOut function
  const signOut = async () => {
    try {
      logger.debug("AuthContext: Starting sign out process");

      // Remove push token before signing out
      if (user?.id) {
        const { PushNotificationService } =
          await import("./services/PushNotificationService");
        await PushNotificationService.removeUserTokens(user.id);
      }

      // Clear password reset session
      await passwordResetManager.clearSession();
      await AsyncStorage.multiRemove([
        "has_valid_reset_session",
        "recovery_session_active",
      ]);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
      }

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Error in signOut:", error);
      setUser(null);
      setProfile(null);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;

    const { error, data } = await supabase
      .from("user_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (!error && data) {
      setProfile(data[0]);
    }
  };

  const checkRestaurantSetupComplete = async (_userId: string) => false;

  const clearNewOrdersNotification = useCallback(() => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            hasNewOrders: false,
            newOrdersCount: 0,
          }
        : prev,
    );
  }, []);

  const updateNewOrdersStatus = useCallback(async (_userId: string) => {
    // New-order management for restaurants belongs to the website dashboard.
  }, []);

  const refreshRestaurantData = async () => {
    // Restaurant accounts are handled on the website, not in the mobile app.
  };

  const refreshUserData = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshUserData,
        checkRestaurantSetupComplete,
        refreshRestaurantData,
        updateNewOrdersStatus,
        clearNewOrdersNotification,

        isGuest,
        signInAsGuest,
        convertGuestToUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Add this function to your AuthContext or a separate helper file
export const getCombinedUserData = async (userId: string) => {
  try {
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) throw userError;

    if (!isMobileAllowedUserType(userData.user_type)) {
      return null;
    }

    const { data: specificData } = userData.user_type === "driver"
      ? await supabase
          .from("delivery_users")
          .select("*")
          .eq("id", userId)
          .maybeSingle()
      : await supabase
          .from("customers")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

    // Get profile data
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Combine all data
    return {
      ...userData,
      ...specificData,
      profile: profileData,
    };
  } catch (error) {
    console.error("Error getting combined user data:", error);
    return null;
  }
};

export const markRestaurantSetupComplete = async (_userId: string) => false;
