type NotificationUserType = string | null | undefined;

export const CUSTOMER_NOTIFICATION_INBOX = "/(tabs)/notifications/user_notifications";
export const DRIVER_NOTIFICATION_INBOX = "/(driver)/notifications/driver_notifications";

function encodeQuery(params?: Record<string, string | number | null | undefined>) {
  if (!params) return "";

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return query ? `?${query}` : "";
}

export function normalizeNotificationUserType(userType: NotificationUserType) {
  return String(userType || "customer").toLowerCase() === "driver" ? "driver" : "customer";
}

function extractOrderId(route: string) {
  const match = route.match(/\/orders\/([^/?#]+)/);
  return match?.[1] || null;
}

export function notificationOrderIdFromData(data: any) {
  const screen = typeof data?.screen === "string" ? data.screen : null;
  return data?.order_id || data?.orderId || (screen ? extractOrderId(screen) : null);
}

export function notificationInboxRouteForUserType(userType: NotificationUserType) {
  return normalizeNotificationUserType(userType) === "driver"
    ? DRIVER_NOTIFICATION_INBOX
    : CUSTOMER_NOTIFICATION_INBOX;
}

export function orderRouteForUserType(
  userType: NotificationUserType,
  orderId: string | number,
  params?: Record<string, string | number | null | undefined>,
) {
  const encodedOrderId = encodeURIComponent(String(orderId));
  const query = encodeQuery(params);

  return normalizeNotificationUserType(userType) === "driver"
    ? `/(driver)/orders/${encodedOrderId}${query}`
    : `/orders/${encodedOrderId}${query}`;
}

export function notificationOrderEntryRouteForUserType(
  userType: NotificationUserType,
  orderId: string | number,
) {
  return `${notificationInboxRouteForUserType(userType)}${encodeQuery({
    openOrderId: String(orderId),
  })}`;
}

export function notificationOrderDetailRouteForUserType(
  userType: NotificationUserType,
  orderId: string | number,
) {
  const encodedOrderId = encodeURIComponent(String(orderId));
  return normalizeNotificationUserType(userType) === "driver"
    ? `/(driver)/notifications/order/${encodedOrderId}`
    : `/(tabs)/notifications/order/${encodedOrderId}`;
}

export function normalizeNotificationScreen(screen: unknown, userType: NotificationUserType) {
  if (typeof screen !== "string") return null;

  const orderId = extractOrderId(screen);
  if (orderId) {
    return orderRouteForUserType(userType, orderId);
  }

  return screen;
}

export function notificationTapRouteForUserType(data: any, userType: NotificationUserType) {
  const screen = typeof data?.screen === "string" ? data.screen : null;
  const orderId = notificationOrderIdFromData(data);

  if (orderId) {
    return notificationOrderEntryRouteForUserType(userType, orderId);
  }

  if (screen) {
    return normalizeNotificationScreen(screen, userType);
  }

  const conversationId = data?.conversation_id || data?.conversationId;
  if (conversationId) {
    return normalizeNotificationUserType(userType) === "driver"
      ? `/(driver)/messages/${encodeURIComponent(String(conversationId))}`
      : `/(tabs)/messages/${encodeURIComponent(String(conversationId))}`;
  }

  return notificationInboxRouteForUserType(userType);
}
