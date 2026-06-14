import React from 'react';
import { View, Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  Easing,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';
import { OnlinePulse } from './OnlinePulse';
import { PremiumCard } from './PremiumCard';

interface AnimatedOnlineToggleProps {
  isOnline: boolean;
  onToggle: (isOnline: boolean) => void;
  loading?: boolean;
}

/**
 * Premium animated online/offline toggle with visual feedback and pulse
 */
export const AnimatedOnlineToggle: React.FC<AnimatedOnlineToggleProps> = ({
  isOnline,
  onToggle,
  loading = false,
}) => {
  const thumbPosition = useSharedValue(isOnline ? 1 : 0);
  const bgOpacity = useSharedValue(isOnline ? 1 : 0.5);

  const handleToggle = () => {
    if (!loading) {
      const newState = !isOnline;
      thumbPosition.value = withSpring(newState ? 1 : 0, {
        damping: 10,
        mass: 1,
        stiffness: 100,
      });
      bgOpacity.value = withTiming(newState ? 1 : 0.5, { duration: 200 });
      onToggle(newState);
    }
  };

  const toggleWidth = 60;
  const thumbSize = 24;
  const trackPadding = 2;

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: thumbPosition.value * (toggleWidth - thumbSize - trackPadding * 2),
      },
    ],
  }));

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor:
      bgOpacity.value > 0.7 ? COLORS.accent_primary : COLORS.dark_tertiary,
    opacity: bgOpacity.value,
  }));

  return (
    <PremiumCard>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left side: Status text and pulse */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <OnlinePulse isOnline={isOnline} size={8} />
          <View>
            <Text style={[TYPOGRAPHY.label_base, { color: COLORS.text_primary }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Text
              style={[
                TYPOGRAPHY.caption,
                {
                  color: isOnline ? COLORS.status_success : COLORS.text_tertiary,
                },
              ]}
            >
              {isOnline ? 'Ready for orders' : 'Tap to go online'}
            </Text>
          </View>
        </View>

        {/* Right side: Animated toggle */}
        <Pressable
          onPress={handleToggle}
          disabled={loading}
          style={{
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Animated.View
            style={[
              {
                width: toggleWidth,
                height: 32,
                borderRadius: BORDER_RADIUS.full,
                backgroundColor: COLORS.dark_tertiary,
                justifyContent: 'center',
                padding: trackPadding,
              },
              bgAnimatedStyle,
            ]}
          >
            <Animated.View
              style={[
                {
                  width: thumbSize,
                  height: thumbSize,
                  borderRadius: thumbSize / 2,
                  backgroundColor: COLORS.text_white,
                  ...{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                  },
                },
                thumbAnimatedStyle,
              ]}
            />
          </Animated.View>
        </Pressable>
      </View>
    </PremiumCard>
  );
};
