import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useReveal } from '../motion';

/** Mini area chart that draws itself in. */
export default function Sparkline({ data, color, height = 34, id }: { data: number[]; color: string; height?: number; id: string }) {
  const [w, setW] = useState(0);
  const p = useReveal(data.length ? `${data[0]}-${data[data.length - 1]}` : 'empty', 1200, 120);
  const vals = data.filter((v) => Number.isFinite(v));
  const n = Math.max(2, Math.ceil(vals.length * p));
  const shown = vals.slice(0, n);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i: number) => (i / Math.max(1, vals.length - 1)) * w;
  const y = (v: number) => 3 + (1 - (v - min) / (max - min || 1)) * (height - 6);
  const line = shown.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = shown.length ? `${line} L${x(shown.length - 1)},${height} L0,${height} Z` : '';
  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && vals.length > 1 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.35} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#sp-${id})`} />
          <Path d={line} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
