// app/orders/_layout.tsx
import { Stack } from "expo-router";

export default function OrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="[orderId]" />
      <Stack.Screen name="OrderNotificationsScreen" />
    </Stack>
  );
}
