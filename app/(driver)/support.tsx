// app/(driver)/support.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;
const SUPPORT_PHONE = "+256700000000";
const SUPPORT_EMAIL = "support@mataim.com";

type SupportTopic = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  type: string;
};

const topics: SupportTopic[] = [
  { title: "Active delivery", icon: "navigate-outline", type: "driver_active_delivery" },
  { title: "Payout or withdrawal", icon: "wallet-outline", type: "driver_payout" },
  { title: "Account and vehicle", icon: "person-circle-outline", type: "driver_account" },
  { title: "Safety issue", icon: "shield-checkmark-outline", type: "driver_safety" },
];

export default function DriverSupportScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [submittingType, setSubmittingType] = useState<string | null>(null);

  const openPhone = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Alert.alert("Call support", SUPPORT_PHONE);
    });
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Driver%20support`).catch(() => {
      Alert.alert("Email support", SUPPORT_EMAIL);
    });
  };

  const createSupportTicket = async (topic: SupportTopic) => {
    if (!user?.id || submittingType) return;

    try {
      setSubmittingType(topic.type);
      const { error } = await db.from("driver_support_requests").insert({
        driver_id: user.id,
        issue_type: topic.type,
        description: topic.title,
        status: "pending",
      });

      if (error) throw error;

      Alert.alert("Request sent", "Support will contact you soon.");
    } catch (error: any) {
      Alert.alert("Could not send", error?.message || "Try call or email instead.");
    } finally {
      setSubmittingType(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => goBackOrDriverFallback(router, "/(driver)/dashboard")}>
          <Ionicons name="chevron-back" size={23} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Support</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.leadText}>Call, email, or pick a topic.</Text>

        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactButton} onPress={openPhone}>
            <Ionicons name="call-outline" size={18} color="#FFFFFF" />
            <Text style={styles.contactText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactButton, styles.emailButton]} onPress={openEmail}>
            <Ionicons name="mail-outline" size={18} color="#111827" />
            <Text style={[styles.contactText, styles.emailText]}>Email</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Topics</Text>
        <View style={styles.topicList}>
          {topics.map((topic) => (
            <TouchableOpacity
              key={topic.type}
              style={styles.topicRow}
              onPress={() => createSupportTicket(topic)}
              activeOpacity={0.82}
              disabled={Boolean(submittingType)}
            >
              <View style={styles.topicIcon}>
                <Ionicons name={topic.icon} size={20} color="#111827" />
              </View>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              {submittingType === topic.type ? (
                <ActivityIndicator color="#FF6B35" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.secondaryPanel} onPress={() => router.push("/(driver)/messages" as any)}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FF6B35" />
          <Text style={styles.secondaryTitle}>Messages</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 14 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  headerTitle: { color: "#111827", fontFamily: "Inter", fontSize: 21, fontWeight: "700" },
  content: { padding: 13, paddingBottom: 112 },
  leadText: { color: "#6B7280", fontFamily: "Inter", fontSize: 15, fontWeight: "600", marginBottom: 12 },
  contactRow: { flexDirection: "row", gap: 8 },
  contactButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FF6B35",
  },
  emailButton: { backgroundColor: "#FFFFFF", borderWidth: 0.8, borderColor: "#e5e7ebc3" },
  contactText: { color: "#FFFFFF", fontFamily: "Inter", fontSize: 14, fontWeight: "700" },
  emailText: { color: "#111827" },
  sectionTitle: { color: "#111827", fontFamily: "Inter", fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 10, letterSpacing: 0.2 },
  topicList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: "#b2b3b34f",
    overflow: "hidden",
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.8,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6e8",
  },
  topicTitle: { flex: 1, color: "#111827", fontFamily: "Inter", fontSize: 14, fontWeight: "600" },
  secondaryPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7eba7",
    padding: 14,
    marginTop: 14,
  },
  secondaryTitle: { flex: 1, color: "#111827", fontFamily: "Inter", fontSize: 14, fontWeight: "600" },
});
