// app/(driver)/messages/_layout.tsx
import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverMessagesLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
