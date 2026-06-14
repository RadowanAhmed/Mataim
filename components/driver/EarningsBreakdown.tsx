// components/driver/EarningsBreakdown.tsx
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AppText from "@/app/components/common/AppText";
import { Ionicons } from "@expo/vector-icons";
import { formatMoney } from "@/backend/utils/currency";

interface EarningsData {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface EarningsBreakdownProps {
  data: EarningsData;
  onWithdraw?: () => void;
}

export const EarningsBreakdown: React.FC<EarningsBreakdownProps> = ({
  data,
  onWithdraw,
}) => {
  const [expandedPeriod, setExpandedPeriod] = useState<"today" | "week" | "month" | null>(null);

  const periods = [
    { key: "today", label: "Today", value: data.today, icon: "calendar-outline", color: "#3B82F6" },
    { key: "week", label: "This Week", value: data.week, icon: "calendar-outline", color: "#10B981" },
    { key: "month", label: "This Month", value: data.month, icon: "calendar-outline", color: "#F59E0B" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <AppText style={styles.label} weight="medium">Total Balance</AppText>
          <AppText style={styles.totalAmount} weight="heavy">
            {formatMoney(data.total)}
          </AppText>
        </View>
        {onWithdraw && (
          <TouchableOpacity style={styles.withdrawButton} onPress={onWithdraw}>
            <Ionicons name="arrow-up-circle-outline" size={20} color="#fff" />
            <AppText style={styles.withdrawText} weight="semibold">Withdraw</AppText>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.periodsContainer}>
        {periods.map((period) => (
          <View
            key={period.key}
            style={[
              styles.periodCard,
              expandedPeriod === period.key && styles.periodCardExpanded,
            ]}
          >
            <TouchableOpacity
              style={styles.periodContent}
              onPress={() => setExpandedPeriod(expandedPeriod === period.key ? null : period.key as any)}
            >
              <View style={[styles.periodIcon, { backgroundColor: period.color + "20" }]}>
                <Ionicons name={period.icon as any} size={18} color={period.color} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.periodLabel} weight="medium">
                  {period.label}
                </AppText>
                <AppText style={[styles.periodAmount, { color: period.color }]} weight="bold">
                  {formatMoney(period.value)}
                </AppText>
              </View>
              <Ionicons
                name={expandedPeriod === period.key ? "chevron-up" : "chevron-down"}
                size={20}
                color="#D1D5DB"
              />
            </TouchableOpacity>

            {expandedPeriod === period.key && (
              <View style={styles.periodDetails}>
                <View style={styles.detailRow}>
                  <AppText style={styles.detailLabel} weight="regular">Net Earnings</AppText>
                  <AppText style={styles.detailValue} weight="semibold">
                    {formatMoney(period.value * 0.95)}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <AppText style={styles.detailLabel} weight="regular">Platform Fee</AppText>
                  <AppText style={styles.detailValue} weight="semibold">
                    {formatMoney(period.value * 0.05)}
                  </AppText>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
        <AppText style={styles.infoText} weight="regular">
          Your earnings are calculated based on completed deliveries. Pending orders are not included.
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  label: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  totalAmount: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter",
    marginTop: 4,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  withdrawText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  periodsContainer: {
    gap: 10,
  },
  periodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  periodCardExpanded: {
    borderColor: "#FF6B35",
    borderWidth: 2,
  },
  periodContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  periodIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  periodLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  periodAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
    marginTop: 2,
  },
  periodDetails: {
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  detailValue: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#93C5FD",
    padding: 12,
  },
  infoText: {
    flex: 1,
    color: "#1E40AF",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    fontFamily: "Inter",
  },
});
