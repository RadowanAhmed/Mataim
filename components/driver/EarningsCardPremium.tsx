import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';
import { AnimatedEarningsCounter } from './AnimatedEarningsCounter';
import { PremiumCard } from './PremiumCard';

interface EarningsCardProps {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  sparklineData?: number[];
  currency?: string;
}

/**
 * Premium earnings card with today/week/month toggle and sparkline chart
 */
export const EarningsCard: React.FC<EarningsCardProps> = ({
  todayEarnings,
  weekEarnings,
  monthEarnings,
  sparklineData = [0, 50, 30, 80, 60, 40, 90],
  currency = '₭',
}) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');

  const earnings =
    timeframe === 'today'
      ? todayEarnings
      : timeframe === 'week'
        ? weekEarnings
        : monthEarnings;

  const screenWidth = Dimensions.get('window').width - SPACING.lg * 2;

  return (
    <PremiumCard accentBorder="primary">
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.lg,
        }}
      >
        <Text style={[TYPOGRAPHY.h3, { color: COLORS.text_primary }]}>
          💰 Earnings
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: SPACING.sm,
            backgroundColor: COLORS.dark_tertiary,
            borderRadius: BORDER_RADIUS.full,
            padding: SPACING.xs,
          }}
        >
          {(['today', 'week', 'month'] as const).map((tf) => (
            <Pressable
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={{
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                borderRadius: BORDER_RADIUS.full,
                backgroundColor:
                  timeframe === tf ? COLORS.accent_primary : 'transparent',
              }}
            >
              <Text
                style={[
                  TYPOGRAPHY.label_sm,
                  {
                    color:
                      timeframe === tf ? COLORS.text_white : COLORS.text_secondary,
                  },
                ]}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Earnings Amount */}
      <View style={{ marginBottom: SPACING.lg }}>
        <Text style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}>
          Total {timeframe}
        </Text>
        <AnimatedEarningsCounter
          amount={earnings}
          currency={currency}
          fontSize={32}
          style={{ marginTop: SPACING.sm }}
        />
      </View>

      {/* Sparkline Chart */}
      {sparklineData.length > 0 && (
        <View
          style={{
            marginHorizontal: -SPACING.lg,
            marginBottom: -SPACING.lg,
            marginTop: SPACING.lg,
          }}
        >
          <LineChart
            data={{
              labels: [],
              datasets: [
                {
                  data: sparklineData,
                  color: () => COLORS.accent_primary,
                  strokeWidth: 2,
                },
              ],
            }}
            width={screenWidth}
            height={150}
            chartConfig={{
              backgroundColor: COLORS.dark_secondary,
              backgroundGradientFrom: COLORS.dark_secondary,
              backgroundGradientTo: COLORS.dark_secondary,
              decimalPlaces: 0,
              color: () => COLORS.text_tertiary,
              labelColor: () => COLORS.text_tertiary,
              style: {
                borderRadius: BORDER_RADIUS.lg,
              },
              propsForDots: {
                r: '0',
              },
              propsForBackgroundLines: {
                strokeDasharray: '0',
                stroke: COLORS.dark_tertiary,
                strokeOpacity: 0.2,
              },
            }}
            bezier
            withHorizontalLabels={false}
            withVerticalLabels={false}
            withOuterLines={false}
            withInnerLines={true}
          />
        </View>
      )}
    </PremiumCard>
  );
};
