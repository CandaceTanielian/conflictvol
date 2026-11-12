// Motion primitives. Everything respects the OS "reduce motion" setting.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';

export const NATIVE = Platform.OS !== 'web';

let reduced = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduced = !!v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => { reduced = v; });
export const prefersReducedMotion = () => reduced;

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Tweens a number toward `target` with requestAnimationFrame. */
export function useTween(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) { setValue(target); current.current = target; return; }
    from.current = current.current;
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const t = Math.min(1, (ts - start) / duration);
        const v = from.current + (target - from.current) * easeOut(t);
        current.current = v;
        setValue(v);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

/** 0 → 1 progress that replays whenever `key` changes. */
export function useReveal(key: any, duration = 1100, delay = 0): number {
  const [p, setP] = useState(prefersReducedMotion() ? 1 : 0);
  useEffect(() => {
    if (prefersReducedMotion()) { setP(1); return; }
    setP(0);
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const t = Math.min(1, (ts - start) / duration);
        setP(easeInOut(t));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [key, duration, delay]);
  return p;
}

/** A shared ~30fps clock for continuous SVG animation (only while mounted). */
export function useClock(fps = 30): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    let last = 0;
    const frame = 1000 / fps;
    const step = (ts: number) => {
      if (ts - last >= frame) { last = ts; setT(ts); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}

/** Number that rolls to its new value. Flashes lime/coral on change. */
export function AnimatedNumber({ value, decimals = 1, prefix = '', suffix = '', style, format, flash = true, upIsGood = false }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; style?: StyleProp<TextStyle>;
  format?: (v: number) => string; flash?: boolean; upIsGood?: boolean;
}) {
  const v = useTween(value, 1100);
  const prev = useRef(value);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  useEffect(() => {
    if (!flash || value === prev.current) return;
    setDir(value > prev.current ? 1 : -1);
    prev.current = value;
    const t = setTimeout(() => setDir(0), 1400);
    return () => clearTimeout(t);
  }, [value, flash]);
  const text = format ? format(v) : v.toFixed(decimals);
  return (
    <Text style={[style, dir !== 0 && { color: (dir > 0) !== upIsGood ? '#E77467' : '#79C795' }]}>
      {prefix}{text}{suffix}
    </Text>
  );
}

/** Fades and slides children in on mount (staggered with `delay`). */
export function FadeIn({ children, delay = 0, distance = 10, style, duration = 520 }: {
  children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>; duration?: number;
}) {
  const a = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    Animated.timing(a, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [a, delay, duration]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Looping pulse ring/dot (radar ping). */
export function Pulse({ size = 10, color = '#E77467', duration = 1800, delay = 0, style, ring = true }: {
  size?: number; color?: string; duration?: number; delay?: number; style?: StyleProp<ViewStyle>; ring?: boolean;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, duration, delay]);
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', width: size, height: size, borderRadius: size / 2,
      borderWidth: ring ? 1.5 : 0, borderColor: color, backgroundColor: ring ? 'transparent' : color,
      opacity: a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] }) }],
    }, style]} />
  );
}

/** Breathing opacity for "live" indicators. */
export function Breathe({ children, style, min = 0.35, duration = 1100 }: { children: ReactNode; style?: StyleProp<ViewStyle>; min?: number; duration?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: min, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      Animated.timing(a, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, min, duration]);
  return <Animated.View style={[style, { opacity: a }]}>{children}</Animated.View>;
}
