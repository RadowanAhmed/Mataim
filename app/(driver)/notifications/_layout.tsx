// app/(driver)/notifications/_layout.tsx
import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverNotificationsLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="driver_notifications" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="order/[orderId]" />
    </Stack>
  );
}
