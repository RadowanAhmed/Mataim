//customer app
// app/(tabs)/_layout.tsx
import { CustomerTabBar } from "@/app/components/CustomerTabBar";
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

export default function TabLayout() {
  const { width } = useWindowDimensions();

  const getResponsiveSizes = () => {
    if (width < 375) {
      return {
        tabBarHeight: 62,
        borderRadius: 16,
      };
    } else if (width > 414) {
      return {
        tabBarHeight: 76,
        borderRadius: 24,
      };
    } else {
      return {
        tabBarHeight: 70,
        borderRadius: 20,
      };
    }
  };

  const responsiveSizes = getResponsiveSizes();

  return (
    <Tabs
      tabBar={(props) => <CustomerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Alerts" }} />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
          title: "Orders",
        }}

      />
    </Tabs>
  );
}
