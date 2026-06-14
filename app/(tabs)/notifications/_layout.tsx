import { Stack } from "expo-router";

export default function CustomerNotificationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="user_notifications" />
      <Stack.Screen name="user_notifacations" />
      <Stack.Screen name="order/[orderId]" />
      <Stack.Screen name="test-notifications" />
    </Stack>
  );
}
