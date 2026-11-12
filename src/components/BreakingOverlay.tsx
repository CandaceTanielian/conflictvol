import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { AnimatedNumber, Breathe, NATIVE, Pulse } from '../motion';
import { C, F, levelColor } from '../theme';
import { fmt, useApp } from '../state';

export type Breaking = {
  id: number; title: string; region: string; level: string; summary: string; market_effect: string;
  cri_before: number; cri_after: number; vol_before: number; vol_after: number; alerts: number; deescalation: boolean;
};

/** Full-width "BREAKING" card that drops in when a new event is ingested. */
export default function BreakingOverlay({ item, onClose }: { item: Breaking | null; onClose: () => void }) {
  const { go } = useApp();
  const { width } = useWindowDimensions();
  const a = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [cri, setCri] = useState(0);
  const [vol, setVol] = useState(0);

  useEffect(() => {
    if (!item) return;
    setCri(item.cri_before);
    setVol(item.vol_before);
    a.setValue(0);
    flash.setValue(1);
    Animated.parallel([
      Animated.spring(a, { toValue: 1, useNativeDriver: NATIVE, friction: 8, tension: 60 }),
      Animated.timing(flash, { toValue: 0, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
    const roll = setTimeout(() => { setCri(item.cri_after); setVol(item.vol_after); }, 450);
    const auto = setTimeout(onClose, 9000);
    return () => { clearTimeout(roll); clearTimeout(auto); };
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const color = item.deescalation ? C.green : levelColor(item.level);
  const up = item.cri_after >= item.cri_before;
  return (
    <Animated.View pointerEvents="box-none" style={{
      position: 'absolute', top: 76, left: 0, right: 0, alignItems: 'center', zIndex: 90, paddingHorizontal: 16,
      opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
    }}>
      <Animated.View accessibilityRole="alert" style={{
        width: '100%', maxWidth: 860, backgroundColor: '#1A1C1D', borderRadius: 12, borderWidth: 1.5,
        borderColor: flash.interpolate({ inputRange: [0, 1], outputRange: [color + '88', '#FFFFFF'] }) as any,
        overflow: 'hidden', boxShadow: `0 24px 60px -20px ${color}AA, 0 0 0 1px ${color}33`,
      } as any}>
        <View style={{ height: 3, backgroundColor: color }} />
        <View style={{ padding: 18, flexDirection: width < 700 ? 'column' : 'row', gap: 18 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Pulse size={12} color={color} duration={1200} />
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              </View>
              <Breathe min={0.5} duration={500}><Text style={{ color, fontFamily: F.bold, fontSize: 11, letterSpacing: 2 }}>{item.deescalation ? 'DE-ESCALATION' : 'BREAKING'}</Text></Breathe>
              <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 9.5, letterSpacing: 1 }}>{item.region.toUpperCase()} · {item.level}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss breaking alert" style={{ marginLeft: 'auto', padding: 4 }}>
                <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 20, letterSpacing: -0.5, lineHeight: 26 }}>{item.title}</Text>
            <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 12.5, lineHeight: 19 }} numberOfLines={2}>{item.market_effect}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable onPress={() => { onClose(); go('conflicts', { eventId: item.id }); }} style={{ backgroundColor: C.lime, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: C.ink, fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.6 }}>VIEW EVENT  →</Text>
              </Pressable>
              {item.alerts > 0 && (
                <Pressable onPress={() => { onClose(); go('notifications'); }} style={{ borderWidth: 1, borderColor: C.coralLine, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: C.coral, fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.6 }}>{item.alerts} ALERT{item.alerts > 1 ? 'S' : ''} TRIGGERED</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ backgroundColor: C.panel, borderRadius: 10, padding: 14, minWidth: 150 }}>
              <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.8 }}>CONFLICT RISK INDEX</Text>
              <AnimatedNumber value={cri} style={{ color: C.text, fontFamily: F.semi, fontSize: 32, letterSpacing: -1, marginTop: 4 }} />
              <Text style={{ color: up ? C.coral : C.green, fontFamily: F.bold, fontSize: 11 }}>{up ? '▲' : '▼'} {fmt.signed(item.cri_after - item.cri_before)} from {fmt.num(item.cri_before)}</Text>
            </View>
            <View style={{ backgroundColor: C.panel, borderRadius: 10, padding: 14, minWidth: 150 }}>
              <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.8 }}>1-WEEK VOLATILITY</Text>
              <AnimatedNumber value={vol} suffix="%" style={{ color: C.text, fontFamily: F.semi, fontSize: 32, letterSpacing: -1, marginTop: 4 }} />
              <Text style={{ color: item.vol_after >= item.vol_before ? C.coral : C.green, fontFamily: F.bold, fontSize: 11 }}>
                {item.vol_after >= item.vol_before ? '▲' : '▼'} {fmt.signed(item.vol_after - item.vol_before)} pts
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
