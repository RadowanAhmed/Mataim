import React, { ReactNode } from "react";
import {
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const driverStackScreenOptions = {
  headerShown: false,
  animation: "slide_from_right",
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  contentStyle: { backgroundColor: "#F8FAFC" },
} as const;

export const driverTabScreenOptions = {
  headerShown: false,
  animation: "shift",
} as const;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function DriverScreenView({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180).easing(Easing.out(Easing.quad))}
      exiting={FadeOut.duration(140)}
      layout={LinearTransition.duration(180)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}

export function DriverListItem({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const delay = Math.min(index * 42, 260);

  return (
    <Animated.View
      entering={FadeInUp.duration(260).delay(delay).springify().damping(18)}
      exiting={FadeOut.duration(140)}
      layout={LinearTransition.springify().damping(18)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function DriverModalPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(240).springify().damping(18)}
      exiting={FadeOut.duration(140)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function DriverTouchable({
  children,
  style,
  disabled,
  activeOpacity = 0.86,
  onPressIn,
  onPressOut,
  pressScale = 0.965,
  ...rest
}: TouchableOpacityProps & {
  pressScale?: number;
}) {
  const scale = useSharedValue(1);
  const shouldAnimate = !disabled && activeOpacity !== 1 && pressScale !== 1;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      {...rest}
      activeOpacity={activeOpacity}
      disabled={disabled}
      onPressIn={(event) => {
        if (shouldAnimate) {
          scale.value = withTiming(pressScale, {
            duration: 85,
            easing: Easing.out(Easing.quad),
          });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (shouldAnimate) {
          scale.value = withSpring(1, { damping: 15, stiffness: 280 });
        }
        onPressOut?.(event);
      }}
      style={[style, shouldAnimate && animatedStyle]}
    >
      {children}
    </AnimatedTouchable>
  );
}
