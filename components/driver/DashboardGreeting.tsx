import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from './theme';

interface DashboardGreetingProps {
  driverName: string;
  activeOrderCount: number;
  motivationalMessage?: string;
}

/**
 * Dashboard greeting header with driver name and active orders count
 */
export const DashboardGreeting: React.FC<DashboardGreetingProps> = ({
  driverName,
  activeOrderCount,
  motivationalMessage,
}) => {
  const greeting = getGreeting();

  return (
    <View style={{ marginBottom: SPACING.xxl }}>
      <Text style={[TYPOGRAPHY.h1, { color: COLORS.text_primary }]}>
        {greeting}, {driverName}! 👋
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.md,
          marginTop: SPACING.md,
        }}
      >
        <View
          style={{
            backgroundColor: COLORS.accent_primary,
            borderRadius: 8,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.sm,
          }}
        >
          <Text style={[TYPOGRAPHY.label_base, { color: COLORS.text_white }]}>
            {activeOrderCount} active order{activeOrderCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {motivationalMessage && (
          <Text
            style={[TYPOGRAPHY.body_base, { color: COLORS.text_secondary }]}
            numberOfLines={1}
          >
            {motivationalMessage}
          </Text>
        )}
      </View>
    </View>
  );
};

// Helper to get contextual greeting based on time
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
