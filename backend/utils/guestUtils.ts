// backend/utils/guestUtils.ts
import { Alert } from "react-native";

export const guestPermissions = {
  // Search & Browse
  canViewRestaurants: true,
  canViewPosts: true,
  canSearch: true,
  canViewCategories: true,

  // Cart & Orders
  canAddToCart: true,
  canViewCart: true,
  canCheckout: false,
  canViewOrders: false,
  canTrackOrder: false,

  // Profile & Social
  canViewProfile: false,
  canEditProfile: false,
  canFavorite: false,
  canLike: false,
  canReview: false,
  canMessage: false,

  // Notifications
  canViewNotifications: false,
};

export const isGuestActionAllowed = (
  action: keyof typeof guestPermissions,
  isGuest: boolean,
): boolean => {
  if (!isGuest) return true;
  return guestPermissions[action] || false;
};

export const showGuestAlert = (
  action: string,
  router: any,
  customMessage?: string,
) => {
  Alert.alert(
    "Sign In Required",
    customMessage ||
      `You need to sign in to ${action}. Would you like to sign in now?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Sign In", onPress: () => router.push("/(auth)/signin") },
      {
        text: "Create Account",
        onPress: () => router.push("/(auth)/user-type"),
      },
    ],
  );
};
