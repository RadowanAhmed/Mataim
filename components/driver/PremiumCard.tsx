import React from 'react';
import { View, ViewProps, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from './theme';

interface PremiumCardProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
  pressable?: boolean;
  accentBorder?: 'primary' | 'secondary' | 'none';
}

/**
 * Premium dark-themed card component with elevated shadows and rounded corners
 * Used throughout the driver app for consistent premium appearance
 */
export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  padded = true,
  accentBorder = 'none',
  style,
  ...props
}) => {
  const borderColor = accentBorder === 'primary' 
    ? COLORS.accent_primary 
    : accentBorder === 'secondary' 
    ? COLORS.accent_secondary 
    : COLORS.dark_tertiary;

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: COLORS.dark_secondary,
          borderRadius: BORDER_RADIUS.lg,
          borderWidth: accentBorder !== 'none' ? 2 : 1,
          borderColor: borderColor,
          overflow: 'hidden',
          paddingHorizontal: padded ? SPACING.lg : 0,
          paddingVertical: padded ? SPACING.lg : 0,
          ...SHADOWS.md,
          ...(Platform.OS === 'android' && { elevation: SHADOWS.elevation_md }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
