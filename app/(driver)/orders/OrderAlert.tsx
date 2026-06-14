// app/(driver)/orders/OrderAlert.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface OrderAlertProps {
  isOnline?: boolean;
  count?: number;
  onPress?: () => void;
}

export default function OrderAlert({ isOnline = false, count = 0, onPress }: OrderAlertProps) {
  if (!isOnline || count <= 0) return null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.iconWrap}>
        <Ionicons name="flash" size={16} color="#FFFFFF" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{count} delivery{count === 1 ? "" : "ies"} ready</Text>
        <Text style={styles.subtitle}>Open orders to accept a delivery.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 54, left: 16, right: 16, zIndex: 100, flexDirection: "row", alignItems: "center", backgroundColor: "#FF6B35", borderRadius: 12, padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  content: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", fontFamily: "Inter" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2, fontWeight: "700", fontFamily: "Inter" },
});