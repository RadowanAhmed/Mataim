// app/(auth)/user-type.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#FF6B35";
const INK = "#111827";

const USER_TYPES = [
  {
    id: "customer",
    title: "Customer",
    description: "Order food from nearby restaurants",
    icon: "restaurant-outline" as const,
  },
  {
    id: "driver",
    title: "Driver",
    description: "Deliver orders and earn per trip",
    icon: "bicycle-outline" as const,
  },
];

export default function UserTypeScreen() {
  const [selectedType, setSelectedType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const handleResetLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleContinue = () => {
    if (!selectedType || isLoading) return;
    setIsLoading(true);
    router.push({
      pathname: "/(auth)/signup",
      params: { userType: selectedType, ...(params || {}) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Mataim</Text>
        <Text style={styles.title}>Choose how you will use the app</Text>

        <View style={styles.subtitleContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" style={{ marginRight: 4, marginTop: 10 }} />
          <Text style={styles.subtitle}>You can switch account type later by creating a separate account.</Text>
        </View>

        <View style={styles.cards}>
          {USER_TYPES.map((type) => {
            const active = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.9}
              >
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Ionicons name={type.icon} size={24} color={active ? "#FFFFFF" : INK} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{type.title}</Text>
                  <Text style={[styles.cardDescription, active && styles.cardDescriptionActive]}>{type.description}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, (!selectedType || isLoading) && styles.continueDisabled]}
          onPress={handleContinue}
          disabled={!selectedType || isLoading}
        >
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/signin" as any)}>
          <Text style={styles.signInText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 24, paddingBottom: 28 },
  eyebrow: { color: ACCENT, fontFamily: "Inter", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { color: INK, fontFamily: "Inter", fontSize: 19, fontWeight: "800", marginTop: 8 },
  subtitleContainer: { flexDirection: "row", alignItems: "flex-start" },
  subtitle: { color: "#6B7280", fontFamily: "Inter", fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 7, marginBottom: 24 },
  cards: { gap: 12, marginTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 12,
    borderWidth: 0.55,
    borderColor: "#0000008b",
    backgroundColor: "#F9FAFB",
    shadowColor: "#0000000a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  cardActive: { backgroundColor: INK, borderColor: INK },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  iconWrapActive: { backgroundColor: ACCENT },
  cardCopy: { flex: 1 },
  cardTitle: { color: INK, fontFamily: "Inter", fontSize: 16, fontWeight: "700", letterSpacing: 0.25 },
  cardTitleActive: { color: "#FFFFFF" },
  cardDescription: { color: "#6B7280", fontFamily: "Inter", fontSize: 13.5, fontWeight: "600", marginTop: 4 },
  cardDescriptionActive: { color: "#D1D5DB" },
  continueButton: {
    marginTop: 44,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
  },
  continueDisabled: { opacity: 0.5 },
  continueText: { color: "#FFFFFF", fontFamily: "Inter", fontSize: 16, fontWeight: "700", letterSpacing: 0.25 },
  signInText: {
    marginTop: 18,
    textAlign: "center",
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.25,
  },
});
