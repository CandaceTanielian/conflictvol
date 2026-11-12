import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { NATIVE, prefersReducedMotion } from '../motion';
import { C, F, levelColor } from '../theme';
import { fmt, useApp } from '../state';

/** Bloomberg-style crawl of the live conflict feed. */
export default function TickerTape({ events, cri, vol }: { events: any[]; cri?: number; vol?: number }) {
  const { go } = useApp();
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const items = [
    { key: 'cri', label: 'CONFLICT RISK', text: fmt.num(cri), color: C.coral },
    { key: 'vol', label: 'S&P 1W VOL', text: fmt.pct(vol), color: C.lime },
    ...events.slice(0, 10).map((e) => ({ key: String(e.id), id: e.id, label: e.level, text: `${e.title}  ${fmt.signed(e.vol_points, 2)}`, color: levelColor(e.level) })),
  ];
  useEffect(() => {
    if (!w || prefersReducedMotion()) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: w * 28, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [w, x, events.length, events[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (copy: number) => (
    <View style={{ flexDirection: 'row' }} onLayout={copy === 0 ? (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width) : undefined}>
      {items.map((it) => (
        <Pressable key={`${copy}-${it.key}`} onPress={() => ('id' in it && it.id ? go('conflicts', { eventId: it.id as number }) : go('overview'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRightWidth: 1, borderRightColor: C.lineSoft }}>
          <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: it.color, transform: [{ rotate: '45deg' }] }} />
          <Text style={{ color: it.color, fontFamily: F.bold, fontSize: 9, letterSpacing: 0.8 }}>{it.label}</Text>
          <Text style={{ color: '#CACFC6', fontFamily: F.semi, fontSize: 11 }} numberOfLines={1}>{it.text}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={{ height: 30, backgroundColor: '#141616', borderBottomWidth: 1, borderBottomColor: C.line, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }}
      accessibilityLabel="Live conflict ticker">
      <View style={{ paddingHorizontal: 12, height: '100%', justifyContent: 'center', backgroundColor: C.coral, zIndex: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.bold, fontSize: 9, letterSpacing: 1.2 }}>LIVE</Text>
      </View>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        {row(0)}
        {row(1)}
      </Animated.View>
    </View>
  );
}
