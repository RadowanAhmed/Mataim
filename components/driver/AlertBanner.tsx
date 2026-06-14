import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from './theme';
import { Platform } from 'react-native';

interface AlertBannerProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'peak' | 'suggestion' | 'alert' | 'bonus';
  icon?: string;
  duration?: number;
  onDismiss?: () => void;
}

const getTypeStyles = (type?: string) => {
  switch (type) {
    case 'peak':
      return { bgColor: COLORS.accent_primary, textColor: COLORS.text_white };
    case 'suggestion':
      return { bgColor: COLORS.accent_secondary, textColor: COLORS.text_white };
    case 'bonus':
      return { bgColor: COLORS.status_success, textColor: COLORS.text_white };
    case 'alert':
      return { bgColor: COLORS.status_warning, textColor: COLORS.dark_primary };
    default:
      return { bgColor: COLORS.dark_secondary, textColor: COLORS.text_primary };
  }
};

/**
 * Animated alert banner for peak hours, suggestions, and alerts
 * Examples: "🔥 Peak hour active in Kampala", "+20% bonus in Kololo"
 */
export const AlertBanner: React.FC<AlertBannerProps> = ({
  visible,
  title,
  message,
  type = 'alert',
  icon,
  duration = 4000,
  onDismiss,
}) => {
  const { bgColor, textColor } = getTypeStyles(type);

  useEffect(() => {
    if (visible && duration && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(10)}
      exiting={FadeOutUp.springify().damping(10)}
      style={{
        marginTop: SPACING.lg,
        marginHorizontal: SPACING.lg,
        backgroundColor: bgColor,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.md,
        ...(Platform.OS === 'android' && { elevation: SHADOWS.elevation_md }),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        {icon && (
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              TYPOGRAPHY.label_base,
              { color: textColor, marginBottom: SPACING.xs },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              TYPOGRAPHY.body_sm,
              {
                color: textColor,
                opacity: 0.9,
              },
            ]}
          >
            {message}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

/**
 * Multiple alert banners manager
 */
interface AlertStackProps {
  alerts: Array<AlertBannerProps & { id: string }>;
  onDismiss: (id: string) => void;
}

export const AlertStack: React.FC<AlertStackProps> = ({ alerts, onDismiss }) => {
  return (
    <View style={{ gap: SPACING.md }}>
      {alerts.map((alert) => (
        <AlertBanner
          key={alert.id}
          {...alert}
          onDismiss={() => onDismiss(alert.id)}
        />
      ))}
    </View>
  );
};
