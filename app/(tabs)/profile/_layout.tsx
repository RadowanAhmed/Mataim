import { Stack } from "expo-router";

export default function CustomerProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
