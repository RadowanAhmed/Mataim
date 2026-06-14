import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';

interface AchievementCelebrationProps {
  visible: boolean;
  title: string;
  subtitle: string;
  icon?: string;
  onDismiss: () => void;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

/**
 * Achievement celebration popup with confetti animation
 * Triggers on milestones (10 orders, 50 hours online, etc.)
 */
export const AchievementCelebration: React.FC<AchievementCelebrationProps> = ({
  visible,
  title,
  subtitle,
  icon = '🎉',
  onDismiss,
  autoClose = true,
  autoCloseDuration = 3000,
}) => {
  const scale = useSharedValue(0);
  const confettiRef = React.useRef<LottieView>(null);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, {
        damping: 8,
        mass: 1,
        stiffness: 100,
      });
      confettiRef.current?.play();

      if (autoClose) {
        const timer = setTimeout(onDismiss, autoCloseDuration);
        return () => clearTimeout(timer);
      }
    } else {
      scale.value = withSpring(0);
    }
  }, [visible, autoClose, autoCloseDuration, onDismiss, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <View
      style={{
        ...require('react-native').StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
      }}
      pointerEvents="box-none"
    >
      {/* Confetti Animation */}
      <LottieView
        ref={confettiRef}
        source={require('lottie-react-native')}
        autoPlay={false}
        loop={false}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Celebration Card */}
      <Animated.View
        entering={ZoomIn.springify()}
        exiting={ZoomOut.springify()}
        style={[
          {
            backgroundColor: COLORS.dark_secondary,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xxl,
            alignItems: 'center',
            borderWidth: 2,
            borderColor: COLORS.accent_primary,
            width: '80%',
            maxWidth: 300,
          },
          animatedStyle,
        ]}
      >
        {/* Icon */}
        <Text style={{ fontSize: 64, marginBottom: SPACING.lg }}>{icon}</Text>

        {/* Title */}
        <Text
          style={[
            TYPOGRAPHY.h2,
            {
              color: COLORS.text_primary,
              marginBottom: SPACING.md,
              textAlign: 'center',
            },
          ]}
        >
          {title}
        </Text>

        {/* Subtitle */}
        <Text
          style={[
            TYPOGRAPHY.body_base,
            {
              color: COLORS.text_secondary,
              textAlign: 'center',
              marginBottom: SPACING.lg,
            },
          ]}
        >
          {subtitle}
        </Text>

        {/* Close Button */}
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            {
              backgroundColor: COLORS.accent_primary,
              paddingHorizontal: SPACING.xxl,
              paddingVertical: SPACING.md,
              borderRadius: BORDER_RADIUS.md,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text
            style={[
              TYPOGRAPHY.label_base,
              { color: COLORS.text_white, fontWeight: '700' },
            ]}
          >
            Amazing! 🚀
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};
