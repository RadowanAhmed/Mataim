import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';
import { PremiumCard } from './PremiumCard';

interface WeeklyStats {
  totalEarnings: number;
  deliveriesCount: number;
  hoursOnline: number;
  topZone?: string;
  averageRating?: number;
  acceptanceRate?: number;
  currency?: string;
}

interface WeeklyRecapProps {
  stats: WeeklyStats;
}

const StatCard: React.FC<{
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  index: number;
}> = ({ icon, iconColor, label, value, index }) => (
  <Animated.View
    entering={FadeInUp.delay(index * 100)}
    style={{
      flex: 1,
      minHeight: 100,
    }}
  >
    <PremiumCard style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text
            style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
          >
            {label}
          </Text>
          <Text
            style={[
              TYPOGRAPHY.h3,
              { color: COLORS.text_primary, marginTop: SPACING.sm },
            ]}
          >
            {value}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={icon as any}
          size={28}
          color={iconColor}
        />
      </View>
    </PremiumCard>
  </Animated.View>
);

/**
 * Weekly recap showing statistics and achievements
 * Displays earnings, deliveries, hours, and performance metrics
 */
export const WeeklyRecap: React.FC<WeeklyRecapProps> = ({ stats }) => {
  const statCards = [
    {
      icon: 'cash-multiple',
      iconColor: COLORS.accent_primary,
      label: 'Total Earnings',
      value: `${stats.currency || '₭'}${stats.totalEarnings.toFixed(2)}`,
    },
    {
      icon: 'truck-check',
      iconColor: COLORS.status_success,
      label: 'Deliveries',
      value: stats.deliveriesCount.toString(),
    },
    {
      icon: 'clock-check',
      iconColor: COLORS.accent_secondary,
      label: 'Hours Online',
      value: stats.hoursOnline.toFixed(1),
    },
    ...(stats.averageRating
      ? [
          {
            icon: 'star',
            iconColor: COLORS.status_warning,
            label: 'Avg Rating',
            value: stats.averageRating.toFixed(1),
          },
        ]
      : []),
  ];

  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text
        style={[
          TYPOGRAPHY.h3,
          { color: COLORS.text_primary, marginBottom: SPACING.lg },
        ]}
      >
        📊 Weekly Summary
      </Text>

      <FlatList
        data={statCards}
        renderItem={({ item, index }) => (
          <StatCard index={index} {...item} />
        )}
        keyExtractor={(item) => item.label}
        numColumns={2}
        columnWrapperStyle={{ gap: SPACING.md, marginBottom: SPACING.md }}
        scrollEnabled={false}
      />

      {/* Top Zone Card */}
      {stats.topZone && (
        <PremiumCard
          accentBorder="secondary"
          style={{ marginTop: SPACING.md }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text
                style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
              >
                🔥 Most Active Zone
              </Text>
              <Text
                style={[
                  TYPOGRAPHY.h4,
                  {
                    color: COLORS.text_primary,
                    marginTop: SPACING.sm,
                  },
                ]}
              >
                {stats.topZone}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="map-marker-multiple"
              size={32}
              color={COLORS.accent_primary}
            />
          </View>
        </PremiumCard>
      )}

      {/* Acceptance Rate */}
      {stats.acceptanceRate !== undefined && (
        <PremiumCard
          accentBorder="primary"
          style={{ marginTop: SPACING.md }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text
                style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
              >
                ✅ Order Acceptance Rate
              </Text>
              <Text
                style={[
                  TYPOGRAPHY.h4,
                  {
                    color: COLORS.text_primary,
                    marginTop: SPACING.sm,
                  },
                ]}
              >
                {(stats.acceptanceRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: COLORS.dark_tertiary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  TYPOGRAPHY.h3,
                  { color: COLORS.accent_primary },
                ]}
              >
                {Math.round(stats.acceptanceRate * 100)}%
              </Text>
            </View>
          </View>
        </PremiumCard>
      )}
    </View>
  );
};
