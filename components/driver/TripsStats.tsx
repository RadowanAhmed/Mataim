// components/driver/TripsStats.tsx
import React from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import AppText from "@/app/components/common/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

interface TripsStatsData {
    completed: number;
    cancelled: number;
    active: number;
    averageRating: string | number;
    ratingCount: number;
}

interface TripsStatsProps {
    data: TripsStatsData;
    onSeeHistory?: () => void;
}

export const TripsStats: React.FC<TripsStatsProps> = ({
    data,
    onSeeHistory,
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <AppText style={styles.headerTitle} weight="semibold">Trip Statistics</AppText>
                {onSeeHistory && (
                    <TouchableOpacity onPress={onSeeHistory}>
                        <AppText style={styles.headerLink} weight="medium">View History</AppText>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statsScroll}
                scrollEventThrottle={16}
            >
                {/* Completed Trips */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: "#D1FAE5" }]}>
                        <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                    </View>
                    <AppText style={styles.statLabel} weight="medium">Completed</AppText>
                    <AppText style={[styles.statValue, { color: "#10B981" }]} weight="heavy">
                        {data.completed}
                    </AppText>
                </View>

                {/* Cancelled Trips */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: "#FEE2E2" }]}>
                        <MaterialCommunityIcons name="close-circle" size={24} color="#EF4444" />
                    </View>
                    <AppText style={styles.statLabel} weight="medium">Cancelled</AppText>
                    <AppText style={[styles.statValue, { color: "#EF4444" }]} weight="heavy">
                        {data.cancelled}
                    </AppText>
                </View>

                {/* Active Trips */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: "#DBEAFE" }]}>
                        <Ionicons name="navigate" size={24} color="#3B82F6" />
                    </View>
                    <AppText style={styles.statLabel} weight="medium">Active</AppText>
                    <AppText style={[styles.statValue, { color: "#3B82F6" }]} weight="heavy">
                        {data.active}
                    </AppText>
                </View>

                {/* Average Rating */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: "#FEF3C7" }]}>
                        <Ionicons name="star" size={24} color="#F59E0B" />
                    </View>
                    <AppText style={styles.statLabel} weight="medium">Rating</AppText>
                    <View style={styles.ratingContainer}>
                        <AppText style={[styles.statValue, { color: "#F59E0B" }]} weight="heavy">
                            {data.averageRating}
                        </AppText>
                        <AppText style={styles.ratingCount} weight="regular">
                            ({data.ratingCount})
                        </AppText>
                    </View>
                </View>
            </ScrollView>

            {/* Performance Metrics */}
            <View style={styles.performanceCard}>
                <AppText style={styles.performanceTitle} weight="semibold">Performance</AppText>

                <View style={styles.metricRow}>
                    <View style={styles.metricLeft}>
                        <Ionicons name="checkmark-done" size={18} color="#10B981" />
                        <AppText style={styles.metricLabel} weight="medium">Acceptance Rate</AppText>
                    </View>
                    <AppText style={styles.metricValue} weight="semibold">95%</AppText>
                </View>

                <View style={styles.metricRow}>
                    <View style={styles.metricLeft}>
                        <Ionicons name="time" size={18} color="#3B82F6" />
                        <AppText style={styles.metricLabel} weight="medium">On-Time Rate</AppText>
                    </View>
                    <AppText style={styles.metricValue} weight="semibold">92%</AppText>
                </View>

                <View style={styles.metricRow}>
                    <View style={styles.metricLeft}>
                        <Ionicons name="happy" size={18} color="#F59E0B" />
                        <AppText style={styles.metricLabel} weight="medium">Customer Rating</AppText>
                    </View>
                    <AppText style={styles.metricValue} weight="semibold">{data.averageRating}</AppText>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 14,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    headerTitle: {
        color: "#111827",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Inter",
    },
    headerLink: {
        color: "#FF6B35",
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Inter",
    },
    statsScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    statCard: {
        minWidth: 110,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 12,
        alignItems: "center",
        gap: 8,
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    statLabel: {
        color: "#6B7280",
        fontSize: 11,
        fontWeight: "500",
        fontFamily: "Inter",
    },
    statValue: {
        fontSize: 20,
        fontWeight: "800",
        fontFamily: "Inter",
    },
    ratingContainer: {
        alignItems: "center",
        gap: 2,
    },
    ratingCount: {
        color: "#9CA3AF",
        fontSize: 10,
        fontWeight: "500",
        fontFamily: "Inter",
    },
    performanceCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 14,
        marginHorizontal: 16,
        gap: 12,
    },
    performanceTitle: {
        color: "#111827",
        fontSize: 13,
        fontWeight: "600",
        fontFamily: "Inter",
    },
    metricRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    metricLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    metricLabel: {
        color: "#6B7280",
        fontSize: 12,
        fontWeight: "500",
        fontFamily: "Inter",
    },
    metricValue: {
        color: "#111827",
        fontSize: 13,
        fontWeight: "600",
        fontFamily: "Inter",
    },
});
