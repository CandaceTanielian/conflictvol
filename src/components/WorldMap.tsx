import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { C, F, sevColor } from '../theme';

const land: any = feature(world as any, (world as any).objects.countries);
const RATIO = 0.49;

export default function WorldMap({ events, selectedId, onSelect }: { events: any[]; selectedId?: number | null; onSelect?: (e: any) => void }) {
  const [w, setW] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);
  const h = w * RATIO;
  const { proj, paths, sphere } = useMemo(() => {
    if (!w) return { proj: null as any, paths: [] as string[], sphere: '' };
    const proj = geoNaturalEarth1().fitExtent([[4, 4], [w - 4, h - 4]], { type: 'Sphere' } as any);
    const path = geoPath(proj);
    return { proj, paths: land.features.map((f: any) => path(f) || ''), sphere: path({ type: 'Sphere' } as any) || '' };
  }, [w, h]);
  const sorted = [...events].sort((a, b) => Math.abs(a.contribution) - Math.abs(b.contribution));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ width: '100%', height: h || 200 }} accessibilityLabel="Map of active conflict events">
      {w > 0 && proj && (
        <Svg width={w} height={h}>
          <Path d={sphere} fill="#1B1D1E" stroke={C.line} strokeWidth={0.8} />
          <G fill="#30332F" stroke="#1B1D1E" strokeWidth={0.5}>{paths.map((d: string, i: number) => <Path key={i} d={d} />)}</G>
          {sorted.map((e) => {
            const pt = proj([e.lon, e.lat]);
            if (!pt) return null;
            const r = 4 + Math.min(12, Math.abs(e.contribution) * 1.2) * (w / 900);
            const col = sevColor(e.severity);
            const sel = e.id === selectedId;
            const followed = e.followed_tickers?.length > 0;
            return (
              <G key={e.id} onPress={() => onSelect?.(e)} {...({ onMouseEnter: () => setTip({ x: pt[0], y: pt[1], t: e.title }), onMouseLeave: () => setTip(null) } as any)}>
                {e.escalating && <Circle cx={pt[0]} cy={pt[1]} r={r + 5} fill="none" stroke={col} strokeOpacity={0.45} strokeWidth={1.3} />}
                {followed && <Circle cx={pt[0]} cy={pt[1]} r={r + 2.5} fill="none" stroke={C.lime} strokeWidth={1.4} />}
                <Circle cx={pt[0]} cy={pt[1]} r={r} fill={col} fillOpacity={sel ? 1 : 0.78} stroke={sel ? C.text : C.ink} strokeWidth={sel ? 2 : 1} />
              </G>
            );
          })}
        </Svg>
      )}
      {tip && (
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.min(tip.x + 10, w - 220), top: Math.max(0, tip.y - 34), backgroundColor: C.ink, borderColor: C.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 11 }}>{tip.t}</Text>
        </View>
      )}
    </View>
  );
}
