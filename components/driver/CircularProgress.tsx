import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from './theme';

interface CircularProgressProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  duration?: number;
}

/**
 * Animated circular progress ring for tracking delivery progress
 * Shows active order progress from pickup -> delivery
 */
export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 100,
  strokeWidth = 6,
  label,
  sublabel,
  color = COLORS.accent_primary,
  duration = 600,
}) => {
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(progress, 100), { duration });
  }, [progress, duration, animatedProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    const strokeDashoffset = interpolate(
      animatedProgress.value,
      [0, 100],
      [circumference, 0],
      Extrapolate.CLAMP
    );
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.dark_tertiary}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle (animated) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedStyle as any}
        />
      </Svg>

      {/* Center text */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {label && (
          <Text style={[TYPOGRAPHY.h3, { color: COLORS.text_primary }]}>
            {label}
          </Text>
        )}
        {sublabel && (
          <Text
            style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
          >
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
};
