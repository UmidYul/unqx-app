import { Easing, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const EASE_OUT = Easing.out(Easing.ease);
const EASE_IN_OUT = Easing.inOut(Easing.ease);

export const LIST_STAGGER_MS = 50;

export const anim = {
  fadeIn: (delay = 0) =>
    withDelay(
      delay,
      withTiming(1, {
        duration: 300,
        easing: EASE_OUT,
      }),
    ),
  slideUp: (delay = 0) =>
    withDelay(
      delay,
      withSpring(0, {
        damping: 20,
        stiffness: 200,
      }),
    ),
  press: withSpring(0.96, { damping: 15, stiffness: 400 }),
  release: withSpring(1, { damping: 15, stiffness: 400 }),
  success: withSequence(
    withSpring(1.12, { damping: 10, stiffness: 400 }),
    withSpring(1, { damping: 15, stiffness: 300 }),
  ),
  shake: withSequence(
    withTiming(-8, { duration: 60 }),
    withTiming(8, { duration: 60 }),
    withTiming(-6, { duration: 60 }),
    withTiming(6, { duration: 60 }),
    withTiming(0, { duration: 60 }),
  ),
  pulse: withSequence(
    withTiming(1.05, { duration: 800, easing: EASE_IN_OUT }),
    withTiming(1, { duration: 800, easing: EASE_IN_OUT }),
  ),
};

