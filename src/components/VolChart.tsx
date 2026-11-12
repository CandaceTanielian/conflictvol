import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Text, View } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { C, F } from '../theme';
import { fmt } from '../state';

export type Metric = 'vol' | 'price' | 'cri';

type Props = {
  series: { date: string; close: number; realized_vol: number | null; cri: number }[];
  forecast: { date: string; point: number; low: number; high: number }[];
  metric: Metric;
  days: number; // history window
  height?: number;
  spot?: number;
};

export default function VolChart({ series, forecast, metric, days, height = 260, spot }: Props) {
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const model = useMemo(() => {
    const hist = series.slice(-days);
    const last = hist[hist.length - 1];
    const fc = metric === 'cri' ? [] : forecast.map((f, i) => {
      if (metric === 'vol') return { date: f.date, mid: f.point, lo: f.low, hi: f.high };
      // Price cone: +/- one standard deviation implied by the projected vol path.
      const sd = (spot || last.close) * (f.point / 100) * Math.sqrt((i + 1) / 252);
      return { date: f.date, mid: last.close, lo: last.close - sd, hi: last.close + sd };
    });
    const hv = hist.map((p) => (metric === 'vol' ? p.realized_vol : metric === 'price' ? p.close : p.cri));
    const all = [...hv.filter((v): v is number => v !== null), ...fc.flatMap((f) => [f.lo, f.hi])];
    let min = metric === 'vol' ? 0 : metric === 'cri' ? 0 : Math.min(...all);
    let max = metric === 'cri' ? 100 : Math.max(...all);
    if (metric === 'vol') max = Math.ceil((max + 2) / 5) * 5;
    if (metric === 'price') { const pad = (max - min) * 0.08; min -= pad; max += pad; }
    return { hist, fc, hv, min, max, total: hist.length + fc.length };
  }, [series, forecast, metric, days, spot]);

  const L = 46, R = 12, T = 12, B = 24;
  const plotW = Math.max(10, w - L - R), plotH = height - T - B;
  const x = (i: number) => L + (model.total <= 1 ? 0 : (i / (model.total - 1)) * plotW);
  const y = (v: number) => T + (1 - (v - model.min) / (model.max - model.min || 1)) * plotH;
  const n = model.hist.length;
  const ticks = Array.from({ length: 5 }, (_, i) => model.min + ((model.max - model.min) * i) / 4);
  const label = (v: number) => (metric === 'vol' ? `${Math.round(v)}%` : metric === 'price' ? fmt.int(v) : `${Math.round(v)}`);

  const histPts = model.hv.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
  const lastV = model.hv[n - 1] ?? 0;
  const fcLine = model.fc.length ? [`${x(n - 1)},${y(lastV)}`, ...model.fc.map((f, i) => `${x(n + i)},${y(f.mid)}`)].join(' ') : '';
  const band = model.fc.length
    ? `M${x(n - 1)},${y(lastV)} ` + model.fc.map((f, i) => `L${x(n + i)},${y(f.hi)}`).join(' ') + ' ' +
      [...model.fc].reverse().map((f, j) => `L${x(n + model.fc.length - 1 - j)},${y(f.lo)}`).join(' ') + ` L${x(n - 1)},${y(lastV)} Z`
    : '';
  const criArea = metric === 'vol'
    ? `M${x(0)},${T + plotH} ` + model.hist.map((p, i) => `L${x(i)},${T + plotH - (p.cri / 100) * plotH}`).join(' ') + ` L${x(n - 1)},${T + plotH} Z`
    : metric === 'cri' ? `M${x(0)},${y(0)} ` + model.hist.map((p, i) => `L${x(i)},${y(p.cri)}`).join(' ') + ` L${x(n - 1)},${y(0)} Z` : '';
  const dates = [...model.hist.map((p) => p.date), ...model.fc.map((f) => f.date)];
  const xLabels = [0, Math.floor(n / 2), n - 1, model.total - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0);
  const color = metric === 'price' ? C.cyan : metric === 'cri' ? C.coral : C.text;

  const pick = (px: number) => {
    if (!w) return;
    const i = Math.round(((px - L) / plotW) * (model.total - 1));
    setHover(Math.max(0, Math.min(model.total - 1, i)));
  };
  const hoverInfo = hover === null ? null : hover < n
    ? { date: model.hist[hover].date, a: model.hv[hover], b: null as null | { lo: number; hi: number }, proj: false, cri: model.hist[hover].cri }
    : { date: model.fc[hover - n].date, a: model.fc[hover - n].mid, b: { lo: model.fc[hover - n].lo, hi: model.fc[hover - n].hi }, proj: true, cri: null };

  const webHandlers: any = Platform.OS === 'web'
    ? { onMouseMove: (e: any) => pick(e.nativeEvent.offsetX ?? e.nativeEvent.locationX), onMouseLeave: () => setHover(null) }
    : {};

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel={`${metric} chart`}
      onStartShouldSetResponder={() => true} onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)} onResponderRelease={() => setHover(null)} {...webHandlers}>
      {w > 0 && (
        <Svg width={w} height={height} pointerEvents="none">
          <Defs>
            <LinearGradient id="cri" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.coral} stopOpacity={metric === 'cri' ? 0.35 : 0.14} />
              <Stop offset="1" stopColor={C.coral} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={L} x2={L + plotW} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} opacity={0.6} />
              <SvgText x={4} y={y(t) + 3} fill={C.muted} fontSize={9} fontFamily={F.semi}>{label(t)}</SvgText>
            </G>
          ))}
          {criArea ? <Path d={criArea} fill="url(#cri)" /> : null}
          {metric === 'vol' && <Line x1={L} x2={L + plotW} y1={y(17.5)} y2={y(17.5)} stroke={C.cyan} strokeDasharray="2 5" opacity={0.6} />}
          {band ? <Path d={band} fill={C.lime} opacity={0.14} /> : null}
          <Polyline points={histPts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {fcLine ? <Polyline points={fcLine} fill="none" stroke={C.lime} strokeWidth={2} strokeDasharray="5 4" /> : null}
          {model.fc.length ? (
            <G>
              <Line x1={x(n - 1)} x2={x(n - 1)} y1={T} y2={T + plotH} stroke={C.muted} strokeDasharray="2 3" opacity={0.7} />
              <SvgText x={x(n - 1) + 5} y={T + 10} fill={C.muted} fontSize={8.5} fontFamily={F.bold}>TODAY</SvgText>
            </G>
          ) : null}
          {xLabels.map((i, k) => (
            <SvgText key={i} x={x(i)} y={height - 6} fill={C.muted} fontSize={8.5} fontFamily={F.bold}
              textAnchor={k === 0 ? 'start' : i === model.total - 1 ? 'end' : 'middle'}>{dates[i] ? fmt.short(dates[i]) : ''}</SvgText>
          ))}
          {hover !== null && <Line x1={x(hover)} x2={x(hover)} y1={T} y2={T + plotH} stroke={C.lime} strokeWidth={1} opacity={0.7} />}
          {hover !== null && hoverInfo?.a !== null && hoverInfo?.a !== undefined && <Rect x={x(hover) - 3} y={y(hoverInfo.a) - 3} width={6} height={6} fill={C.lime} />}
        </Svg>
      )}
      {hoverInfo && (
        <View style={{ position: 'absolute', left: L + 6, top: 4, backgroundColor: C.ink, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 }} pointerEvents="none">
          <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 9, letterSpacing: 0.6 }}>{fmt.short(hoverInfo.date)}{hoverInfo.proj ? ' · PROJECTED' : ''}</Text>
          <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12 }}>
            {metric === 'vol' ? `Vol ${fmt.pct(hoverInfo.a)}` : metric === 'price' ? `S&P ${fmt.int(hoverInfo.a)}` : `Risk ${fmt.num(hoverInfo.a)}`}
            {hoverInfo.b ? `  ·  range ${label(hoverInfo.b.lo)}–${label(hoverInfo.b.hi)}` : ''}
            {metric === 'vol' && hoverInfo.cri !== null ? `  ·  risk ${fmt.num(hoverInfo.cri)}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}
