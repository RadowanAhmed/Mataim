import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Vibration, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';
import { PremiumCard } from './PremiumCard';

interface OrderRequestAlertProps {
  visible: boolean;
  orderId?: string;
  distance?: string;
  itemCount?: number;
  pickup?: string;
  delivery?: string;
  reward?: string;
  onDismiss: () => void;
  onAccept?: () => void;
}

/**
 * Animated order request alert card that slides in from bottom
 * Triggers haptic vibration and slide animation
 */
export const OrderRequestAlert: React.FC<OrderRequestAlertProps> = ({
  visible,
  orderId,
  distance,
  itemCount,
  pickup,
  delivery,
  reward,
  onDismiss,
  onAccept,
}) => {
  const translateY = useSharedValue(500);

  useEffect(() => {
    if (visible) {
      // Trigger haptic feedback
      Vibration.vibrate(100);
      translateY.value = withSpring(0, {
        damping: 10,
        mass: 1,
        stiffness: 100,
      });
    } else {
      translateY.value = withSpring(500);
    }
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(10)}
      style={[
        StyleSheet.absoluteFillObject,
        {
          justifyContent: 'flex-end',
          pointerEvents: 'box-none',
        },
      ]}
    >
      <Animated.View style={[{ paddingBottom: SPACING.lg }, animatedStyle]}>
        <PremiumCard
          accentBorder="primary"
          style={{
            marginHorizontal: SPACING.lg,
            marginBottom: SPACING.lg,
          }}
        >
          {/* Header with Order ID and Reward */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.md,
            }}
          >
            <Text style={[TYPOGRAPHY.h3, { color: COLORS.text_primary }]}>
              🎉 New Order
            </Text>
            {reward && (
              <View
                style={{
                  backgroundColor: COLORS.accent_primary,
                  paddingHorizontal: SPACING.md,
                  paddingVertical: SPACING.xs,
                  borderRadius: BORDER_RADIUS.full,
                }}
              >
                <Text
                  style={[
                    TYPOGRAPHY.label_sm,
                    { color: COLORS.text_white, fontWeight: '700' },
                  ]}
                >
                  {reward}
                </Text>
              </View>
            )}
          </View>

          {/* Order Details */}
          <View style={{ marginBottom: SPACING.md }}>
            {itemCount !== undefined && (
              <Text style={[TYPOGRAPHY.body_base, { color: COLORS.text_secondary }]}>
                📦 {itemCount} item{itemCount !== 1 ? 's' : ''} • {distance}
              </Text>
            )}
          </View>

          {/* Pickup/Delivery Info */}
          <View style={{ marginBottom: SPACING.md }}>
            {pickup && (
              <Text
                style={[TYPOGRAPHY.body_base, { color: COLORS.text_secondary }]}
                numberOfLines={1}
              >
                📍 Pickup: {pickup}
              </Text>
            )}
            {delivery && (
              <Text
                style={[TYPOGRAPHY.body_base, { color: COLORS.text_secondary }]}
                numberOfLines={1}
              >
                🚗 Deliver to: {delivery}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: 'row',
              gap: SPACING.md,
              marginTop: SPACING.lg,
            }}
          >
            <Pressable
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: SPACING.md,
                  backgroundColor: pressed
                    ? COLORS.dark_tertiary
                    : COLORS.dark_tertiary,
                  borderRadius: BORDER_RADIUS.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onDismiss}
            >
              <Text
                style={[TYPOGRAPHY.label_base, { color: COLORS.text_primary }]}
              >
                Decline
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: SPACING.md,
                  backgroundColor: COLORS.accent_primary,
                  borderRadius: BORDER_RADIUS.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={onAccept}
            >
              <Text
                style={[
                  TYPOGRAPHY.label_base,
                  { color: COLORS.text_white, fontWeight: '700' },
                ]}
              >
                Accept Order
              </Text>
            </Pressable>
          </View>
        </PremiumCard>
      </Animated.View>
    </Animated.View>
  );
};
