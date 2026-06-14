// app/(driver)/orders/DriverOrderActions.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface DriverOrderActionsProps {
  status: string;
  onPickup?: () => void;
  onDelivered?: () => void;
  onTrack?: () => void;
  onMessage?: () => void;
}

export default function DriverOrderActions({
  status,
  onPickup,
  onDelivered,
  onTrack,
  onMessage,
}: DriverOrderActionsProps) {
  return (
    <View style={styles.container}>
      {status === "ready" && (
        <TouchableOpacity style={styles.primaryButton} onPress={onPickup}>
          <Ionicons name="bag-check-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Pick Up Order</Text>
        </TouchableOpacity>
      )}

      {status === "out_for_delivery" && (
        <TouchableOpacity style={[styles.primaryButton, styles.successButton]} onPress={onDelivered}>
          <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Mark Delivered</Text>
        </TouchableOpacity>
      )}

      <View style={styles.secondaryRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onTrack}>
          <Ionicons name="navigate-outline" size={17} color="#FF6B35" />
          <Text style={styles.secondaryText}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onMessage}>
          <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FF6B35" />
          <Text style={styles.secondaryText}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF6B35", paddingVertical: 13, borderRadius: 10 },
  successButton: { backgroundColor: "#10B981" },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", fontFamily: "Inter" },
  secondaryRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: "#FFF1EB", borderWidth: 1, borderColor: "#FED7AA" },
  secondaryText: { color: "#FF6B35", fontSize: 12, fontWeight: "700", fontFamily: "Inter" },
});