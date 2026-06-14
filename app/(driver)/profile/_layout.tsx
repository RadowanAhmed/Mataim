import { driverStackScreenOptions } from "@/components/driver/DriverMotion";
import { Stack } from "expo-router";

export default function DriverProfileLayout() {
  return (
    <Stack screenOptions={driverStackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
