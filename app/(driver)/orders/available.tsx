// app/(driver)/orders/available.tsx
import { Redirect } from "expo-router";

export default function DriverAvailableOrdersRedirect() {
  return <Redirect href="/(driver)/orders" />;
}
