// app/(driver)/live-track/_layout.tsx
import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverLiveTrackLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="[orderId]" />
    </Stack>
  );
}
