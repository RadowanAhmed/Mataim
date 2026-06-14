import { logger } from "@/backend/utils/logger";
// backend/hooks/useNotifications.tsx
import { useAuth } from "@/backend/AuthContext";
import { notificationTapRouteForUserType } from "@/backend/utils/notificationRoutes";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

let notificationsModule: any | null | false = undefined as any;

async function getNotifications() {
  if (notificationsModule !== undefined) return notificationsModule || null;

  try {
    const Constants = await import("expo-constants");
    if (Constants.default?.appOwnership === "expo") {
      notificationsModule = false;
      return null;
    }

    const mod = await import("expo-notifications");
    notificationsModule = mod;
    return mod;
  } catch (error) {
    logger.debug("Notification listeners unavailable:", error);
    notificationsModule = false;
    return null;
  }
}

export const useNotifications = (enabled = true) => {
  const router = useRouter();
  const { user } = useAuth();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;

    let cleanup = () => {};
    let active = true;

    const routeNotificationResponse = (response: any) => {
      const request = response?.notification?.request;
      const responseId = request?.identifier ? String(request.identifier) : null;

      if (responseId) {
        if (handledResponseIds.current.has(responseId)) return;
        handledResponseIds.current.add(responseId);
      }

      const data = request?.content?.data || {};
      const route = notificationTapRouteForUserType(data, user?.user_type);
      if (route) router.push(route as any);
    };

    getNotifications().then((Notifications) => {
      if (!Notifications || !active) return;

      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const subscription = Notifications.addNotificationResponseReceivedListener(routeNotificationResponse);

        cleanup = () => subscription.remove();
      } catch (error) {
        logger.debug("Notification hook skipped:", error);
      }
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [enabled, router, user?.user_type]);

  return null;
};
