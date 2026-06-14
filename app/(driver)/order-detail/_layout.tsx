// app/(driver)/order-detail/_layout.tsx
import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverOrderDetailLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="[orderId]" />
    </Stack>
  );
}
