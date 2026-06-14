import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Delay navigation to ensure Root Layout is mounted
    const timer = setTimeout(() => {
      router.replace("/(auth)");
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return <View style={{ flex: 1 }} />;
}
