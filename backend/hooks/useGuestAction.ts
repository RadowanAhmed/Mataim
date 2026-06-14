import { useAuth } from "@/backend/AuthContext";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { isGuestActionAllowed } from "../utils/guestPermissions";

export const useGuestAction = () => {
  const { isGuest } = useAuth();
  const router = useRouter();

  const showGuestAlert = (action: string, customMessage?: string) => {
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

  const checkGuestAction = (
    action: keyof typeof import("../utils/guestPermissions").guestPermissions,
    callback: () => void,
    customMessage?: string,
  ) => {
    if (isGuest && !isGuestActionAllowed(action, isGuest)) {
      showGuestAlert(action, customMessage);
      return false;
    }
    callback();
    return true;
  };

  return { checkGuestAction, isGuest, showGuestAlert };
};
