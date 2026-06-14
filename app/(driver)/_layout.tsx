import { DriverTabBar } from "@/app/components/DriverTabBar";
import { driverTabScreenOptions } from "@/components/driver/DriverMotion";
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

export default function DriverLayout() {
  const { width } = useWindowDimensions();

  const responsiveSizes =
    width < 375
      ? { tabBarHeight: 62, borderRadius: 16 }
      : width > 414
        ? { tabBarHeight: 76, borderRadius: 24 }
        : { tabBarHeight: 70, borderRadius: 20 };

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <DriverTabBar {...props} />}
      screenOptions={{
        ...driverTabScreenOptions,
        tabBarStyle: {
          backgroundColor: "#fff",
          height: responsiveSizes.tabBarHeight,
          borderTopWidth: 0,
          borderTopLeftRadius: responsiveSizes.borderRadius,
          borderTopRightRadius: responsiveSizes.borderRadius,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Map" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="withdraw" options={{ href: null }} />
      <Tabs.Screen name="bank-account" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="order-detail" options={{ href: null }} />
      <Tabs.Screen name="live-track" options={{ href: null }} />
    </Tabs>
  );
}
