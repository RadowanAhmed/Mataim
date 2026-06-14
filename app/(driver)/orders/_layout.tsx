// app/(driver)/orders/_layout.tsx
import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverOrdersLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="available" />
      <Stack.Screen name="[orderId]" />
    </Stack>
  );
}
