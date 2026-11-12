import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { AnimatedNumber, useTween } from '../motion';
import { C, F } from '../theme';

/** Semicircular Conflict Risk Index gauge with a sweeping needle. */
export default function Gauge({ value, label, size = 220 }: { value: number; label: string; size?: number }) {
  const v = useTween(value, 1600, 150);
  const w = size, h = size * 0.62, cx = w / 2, cy = h - 8, r = w / 2 - 16;
  const ang = (x: number) => Math.PI * (1 - x / 100); // 0 → left, 100 → right
  const pt = (x: number, rr = r) => [cx + rr * Math.cos(ang(x)), cy - rr * Math.sin(ang(x))];
  const arc = (a: number, b: number, rr = r) => {
    const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr);
    return `M${x1},${y1} A${rr},${rr} 0 0 1 ${x2},${y2}`;
  };
  const [nx, ny] = pt(v, r - 18);
  const color = v < 25 ? C.green : v < 50 ? C.amber : v < 75 ? '#E8925F' : C.coral;
  return (
    <View style={{ width: w, alignItems: 'center' }} accessibilityLabel={`Conflict Risk Index ${value.toFixed(1)}, ${label}`}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.green} />
            <Stop offset="0.45" stopColor={C.amber} />
            <Stop offset="0.75" stopColor="#E8925F" />
            <Stop offset="1" stopColor={C.coral} />
          </LinearGradient>
        </Defs>
        <Path d={arc(0, 100)} stroke={C.lineSoft} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Path d={arc(0, 100)} stroke="url(#g)" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.22} />
        <Path d={arc(0, Math.max(0.5, v))} stroke="url(#g)" strokeWidth={14} fill="none" strokeLinecap="round" />
        {[0, 25, 50, 75, 100].map((t) => {
          const [x1, y1] = pt(t, r + 10), [x2, y2] = pt(t, r + 4);
          return <Line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.muted} strokeWidth={1.5} />;
        })}
        <G>
          <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.text} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={cx} cy={cy} r={8} fill={C.panel} stroke={color} strokeWidth={3} />
          <Circle cx={nx} cy={ny} r={4} fill={color} />
        </G>
      </Svg>
      <View style={{ marginTop: 8, alignItems: 'center' }}>
        <AnimatedNumber value={value} style={{ color: C.text, fontFamily: F.semi, fontSize: 34, letterSpacing: -1 }} />
        <Text style={{ color, fontFamily: F.bold, fontSize: 10, letterSpacing: 1.2 }}>{label.toUpperCase()} RISK</Text>
      </View>
    </View>
  );
}
