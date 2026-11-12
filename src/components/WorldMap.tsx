import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { Pulse, useClock } from '../motion';
import { C, F, sevColor } from '../theme';

const land: any = feature(world as any, (world as any).objects.countries);
const RATIO = 0.49;
const NYSE: [number, number] = [-74.0, 40.7];

const Countries = memo(function Countries({ paths, sphere, graticule }: { paths: string[]; sphere: string; graticule: string }) {
  return (
    <>
      <Path d={sphere} fill="#1B1D1E" stroke={C.line} strokeWidth={0.8} />
      <Path d={graticule} stroke="#262928" strokeWidth={0.6} fill="none" />
      <G fill="#30332F" stroke="#1B1D1E" strokeWidth={0.5}>{paths.map((d: string, i: number) => <Path key={i} d={d} />)}</G>
    </>
  );
});

/** Animated "market transmission" arcs flowing from conflicts to Wall Street. */
function Arcs({ arcs, ny }: { arcs: { d: string; color: string; w: number }[]; ny: [number, number] }) {
  const t = useClock(30);
  return (
    <>
      {arcs.map((a, i) => (
        <G key={i}>
          <Path d={a.d} stroke={a.color} strokeOpacity={0.18} strokeWidth={a.w + 2} fill="none" />
          <Path d={a.d} stroke={a.color} strokeOpacity={0.9} strokeWidth={a.w} fill="none" strokeDasharray="3 9" strokeDashoffset={-(t / 45) - i * 7} strokeLinecap="round" />
        </G>
      ))}
      <Rect x={ny[0] - 4} y={ny[1] - 4} width={8} height={8} fill={C.lime} transform={`rotate(45 ${ny[0]} ${ny[1]})`} />
      <SvgText x={ny[0] - 8} y={ny[1] + 18} fill={C.lime} fontSize={9} fontFamily={F.bold} textAnchor="end">NYSE</SvgText>
    </>
  );
}

export default function WorldMap({ events, selectedId, onSelect, arcs = true }: { events: any[]; selectedId?: number | null; onSelect?: (e: any) => void; arcs?: boolean }) {
  const [w, setW] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);
  const h = w * RATIO;
  const geo = useMemo(() => {
    if (!w) return null;
    const proj = geoNaturalEarth1().fitExtent([[4, 4], [w - 4, h - 4]], { type: 'Sphere' } as any);
    const path = geoPath(proj);
    const lines: any = { type: 'MultiLineString', coordinates: [] as number[][][] };
    for (let lon = -180; lon <= 180; lon += 30) lines.coordinates.push(Array.from({ length: 37 }, (_, i) => [lon, -90 + i * 5]));
    for (let lat = -60; lat <= 60; lat += 30) lines.coordinates.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    return {
      proj, paths: land.features.map((f: any) => path(f) || ''), sphere: path({ type: 'Sphere' } as any) || '',
      graticule: path(lines) || '', ny: proj(NYSE) as [number, number],
    };
  }, [w, h]);

  const placed = useMemo(() => {
    if (!geo) return [];
    return events.map((e) => ({ e, pt: geo.proj([e.lon, e.lat]) as [number, number] | null })).filter((x) => x.pt);
  }, [events, geo]);

  const arcPaths = useMemo(() => {
    if (!geo || !arcs) return [];
    return placed.filter(({ e }) => e.contribution > 0).sort((a, b) => b.e.contribution - a.e.contribution).slice(0, 7).map(({ e, pt }) => {
      const [x1, y1] = pt!, [x2, y2] = geo.ny;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.28;
      return { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, color: sevColor(e.severity), w: 1 + Math.min(2, e.contribution / 4) };
    });
  }, [placed, geo, arcs]);

  const sorted = [...placed].sort((a, b) => Math.abs(a.e.contribution) - Math.abs(b.e.contribution));
  const pulsing = placed.filter(({ e }) => e.level === 'HIGH' || e.escalating).slice(0, 10);
  const scale = w / 900;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ width: '100%', height: h || 200 }} accessibilityLabel="Map of active conflict events with market transmission arcs to Wall Street">
      {geo && (
        <Svg width={w} height={h} style={{ position: 'absolute' }}>
          <Countries paths={geo.paths} sphere={geo.sphere} graticule={geo.graticule} />
          {arcPaths.length > 0 && <Arcs arcs={arcPaths} ny={geo.ny} />}
          {sorted.map(({ e, pt }) => {
            const r = (4 + Math.min(12, Math.abs(e.contribution) * 1.2)) * Math.max(0.6, scale);
            const col = sevColor(e.severity);
            const sel = e.id === selectedId;
            return (
              <G key={e.id} onPress={() => onSelect?.(e)} {...({ onMouseEnter: () => setTip({ x: pt![0], y: pt![1], t: e.title }), onMouseLeave: () => setTip(null) } as any)}>
                {e.followed_tickers?.length > 0 && <Circle cx={pt![0]} cy={pt![1]} r={r + 2.5} fill="none" stroke={C.lime} strokeWidth={1.4} />}
                <Circle cx={pt![0]} cy={pt![1]} r={r} fill={col} fillOpacity={sel ? 1 : 0.8} stroke={sel ? C.text : C.ink} strokeWidth={sel ? 2 : 1} />
              </G>
            );
          })}
        </Svg>
      )}
      {pulsing.map(({ e, pt }, i) => {
        const size = (14 + Math.min(16, Math.abs(e.contribution) * 1.6)) * Math.max(0.6, scale);
        return (
          <View key={e.id} pointerEvents="none" style={{ position: 'absolute', left: pt![0] - size / 2, top: pt![1] - size / 2, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Pulse size={size} color={sevColor(e.severity)} duration={2200} delay={i * 260} />
          </View>
        );
      })}
      {tip && (
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.min(tip.x + 10, w - 220), top: Math.max(0, tip.y - 34), backgroundColor: C.ink, borderColor: C.line, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 11 }}>{tip.t}</Text>
        </View>
      )}
    </View>
  );
}
