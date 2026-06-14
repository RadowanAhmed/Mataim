import React, { useEffect } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { TYPOGRAPHY, COLORS } from './theme';

interface AnimatedEarningsCounterProps extends TextProps {
  amount: number;
  currency?: string;
  duration?: number;
  fontSize?: number;
}

const AnimatedText = Animated.createAnimatedComponent(Text);

/**
 * Real-time earnings counter with smooth number animation
 * Animates when the earnings amount changes
 */
export const AnimatedEarningsCounter: React.FC<AnimatedEarningsCounterProps> = ({
  amount,
  currency = '₭',
  duration = 500,
  fontSize = 24,
  style,
  ...props
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(amount, { duration });
  }, [amount, duration, animatedValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const displayValue = interpolate(
      animatedValue.value,
      [0, amount],
      [0, amount],
      Extrapolate.CLAMP
    );
    return {};
  });

  // Since Animated.Text doesn't support interpolated text directly,
  // we'll use a workaround with updating the display
  const [displayAmount, setDisplayAmount] = React.useState(amount);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let current = displayAmount;
    const step = (amount - displayAmount) / 10;

    if (step !== 0) {
      interval = setInterval(() => {
        current += step;
        if ((step > 0 && current >= amount) || (step < 0 && current <= amount)) {
          current = amount;
          setDisplayAmount(amount);
          clearInterval(interval);
        } else {
          setDisplayAmount(current);
        }
      }, duration / 10);
    }

    return () => clearInterval(interval);
  }, [amount, displayAmount, duration]);

  return (
    <Text
      {...props}
      style={[
        {
          fontSize,
          fontWeight: '700',
          color: COLORS.accent_primary,
        },
        style,
      ]}
    >
      {currency}
      {displayAmount.toFixed(2)}
    </Text>
  );
};
