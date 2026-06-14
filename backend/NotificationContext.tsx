import { logger } from "@/backend/utils/logger";
// backend/NotificationContext.tsx
import Constants from "expo-constants";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { NotificationService } from "./services/notificationService";
import { supabase } from "./supabase";

const isExpoGo = Constants.appOwnership === "expo";
const NotificationContext = createContext<any>(null);
let notificationsModule: any | null | false = undefined as any;

async function getNotifications() {
  if (notificationsModule !== undefined) return notificationsModule || null;
  if (isExpoGo) {
    notificationsModule = false;
    return null;
  }

  try {
    const mod = await import("expo-notifications");
    notificationsModule = mod;
    return mod;
  } catch (error) {
    logger.debug("NotificationContext listener unavailable:", error);
    notificationsModule = false;
    return null;
  }
}

function normalizeNotificationUserType(userType?: unknown) {
  const raw = Array.isArray(userType) ? userType[0] : userType;
  const value = typeof raw === "string" ? raw.toLowerCase() : "customer";

  if (value === "restaurant" || value === "driver" || value === "customer") {
    return value;
  }

  return "customer";
}

function notificationTarget(userType?: unknown) {
  switch (normalizeNotificationUserType(userType)) {
    case "restaurant":
      return { tableName: "restaurant_notifications", userIdColumn: "restaurant_id" };
    case "driver":
      return { tableName: "driver_notifications", userIdColumn: "driver_id" };
    default:
      return { tableName: "user_notifications", userIdColumn: "user_id" };
  }
}

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth() as any;
  const [notificationCount, setNotificationCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadNotificationCount = useCallback(async () => {
    if (!user?.id) return;

    const result = await NotificationService.getUnreadCount(user.id, user.user_type);
    if (result.success) setNotificationCount(result.count || 0);
  }, [user?.id, user?.user_type]);

  useEffect(() => {
    let cleanupNotifications = () => {};

    const initialize = async () => {
      await NotificationService.initialize();
      setIsInitialized(true);
      await loadNotificationCount();
    };

    initialize();

    return () => cleanupNotifications();
  }, [loadNotificationCount, user?.id, user?.user_type]);

  useEffect(() => {
    if (!user?.id) return;

    const { tableName, userIdColumn } = notificationTarget(user.user_type);
    const topic = `${tableName}-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: tableName,
          filter: `${userIdColumn}=eq.${user.id}`,
        },
        async (payload) => {
          setNotificationCount((prev) => prev + 1);

          const Notifications = await getNotifications();
          if (!Notifications) return;

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: (payload.new as any).title,
                body: (payload.new as any).body,
                data: (payload.new as any).data,
                sound: true,
              },
              trigger: null,
            });
          } catch (error) {
            logger.debug("Local realtime notification skipped:", error);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.user_type]);

  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    const result = await NotificationService.markNotificationAsRead(notificationId, user.user_type);
    if (result.success) setNotificationCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const result = await NotificationService.markAllNotificationsAsRead(user.id, user.user_type);
    if (result.success) setNotificationCount(0);
  };

  const clearBadgeCount = async () => {
    setNotificationCount(0);
    const Notifications = await getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.setBadgeCountAsync(0);
    } catch {
      // no-op
    }
  };

  const sendWelcomeNotification = async () => {
    if (!user?.id) return;
    await NotificationService.sendWelcomeNotification(user.id, user.full_name || "User", user.user_type);
  };

  const sendSignInNotification = async () => {
    if (!user?.id) return;
    await NotificationService.sendSignInNotification(user.id, user.user_type);
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationCount,
        unreadCount: notificationCount,
        clearBadgeCount,
        markAllAsRead,
        markAsRead,
        isInitialized,
        sendWelcomeNotification,
        sendSignInNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within NotificationProvider");
  return context;
};
