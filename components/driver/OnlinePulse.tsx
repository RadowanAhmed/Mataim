import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SPACING } from './theme';

interface OnlinePulseProps {
  isOnline: boolean;
  size?: number;
}

/**
 * Live online pulse animation - a pulsing circle next to the Go Online toggle
 * Uses React Native Reanimated for native-level performance
 */
export const OnlinePulse: React.FC<OnlinePulseProps> = ({ isOnline, size = 12 }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOnline) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.2, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOnline, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ position: 'relative', width: size * 2, height: size * 2 }}>
      {/* Pulsing glow background */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: COLORS.accent_primary,
            opacity: 0.3,
          },
          animatedStyle,
        ]}
      />
      {/* Static center dot */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.accent_primary,
          top: size / 2,
          left: size / 2,
        }}
      />
    </View>
  );
};
