import { logger } from "@/backend/utils/logger";
// backend/services/GoogleSignInService.ts
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "../supabase";

type MobileGoogleUserType = "customer" | "driver";

const RESTAURANT_WEB_ONLY_MESSAGE =
  "Restaurant accounts are managed on the website. Please use the restaurant website to sign in.";

export class GoogleSignInService {
  static async signInWithGoogle(userType: MobileGoogleUserType = "customer") {
    try {
      if (userType !== "customer" && userType !== "driver") {
        return { success: false, error: RESTAURANT_WEB_ONLY_MESSAGE };
      }

      logger.debug("🔐 Starting Google Sign-In...");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: Platform.select({
            web: "https://zkdbkmukugayxhnmzfxa.supabase.co/auth/v1/callback",
            default: "mataim://auth/callback",
          }),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No authentication URL received");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "mataim://auth/callback",
      );

      if (result.type !== "success") {
        return { success: false, error: "Authentication cancelled" };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("No session found after authentication");
      }

      const authUser = sessionData.session.user;

      const { data: existingUser, error: existingUserError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (existingUserError) throw existingUserError;

      if (existingUser?.user_type === "restaurant") {
        await supabase.auth.signOut();
        return { success: false, error: RESTAURANT_WEB_ONLY_MESSAGE };
      }

      if (!existingUser) {
        await supabase.from("users").insert({
          id: authUser.id,
          email: authUser.email!,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            "Google User",
          phone: null,
          country_code: null,
          user_type: userType,
          profile_image_url:
            authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture,
          is_verified: true,
          is_active: true,
          google_id: authUser.id,
        });

        await supabase.from("user_profiles").insert({
          user_id: authUser.id,
          avatar_url:
            authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture,
        });

        if (userType === "driver") {
          await supabase.from("delivery_users").insert({
            id: authUser.id,
            vehicle_type: null,
            license_number: "PENDING",
            vehicle_plate: "PENDING",
            years_of_experience: null,
            availability: null,
            insurance_number: null,
            address: "",
            latitude: null,
            longitude: null,
            location_code: null,
            driver_status: "available",
            total_deliveries: 0,
            rating: 0,
            current_location_lat: null,
            current_location_lng: null,
            is_online: false,
            earnings_today: 0,
            total_earnings: 0,
          });
        } else {
          await supabase.from("customers").insert({
            id: authUser.id,
            total_orders: 0,
            loyalty_points: 100,
          });
        }
      } else {
        await supabase
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", authUser.id);
      }

      return {
        success: true,
        data: sessionData,
        isNewUser: !existingUser,
      };
    } catch (error: any) {
      console.error("❌ Google sign in error:", error);
      return {
        success: false,
        error: error.message || "Failed to sign in with Google",
      };
    }
  }
}
