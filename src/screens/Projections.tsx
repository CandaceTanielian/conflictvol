import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import WatchlistEditor from '../components/WatchlistEditor';
import { Bar, Body, Btn, Card, ErrorState, Eyebrow, H2, H3, Loading, Muted, PageHead, Pill, Seg, toneForLevel, toneForRegime } from '../components/ui';
import { C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

type H = '1d' | '1w' | '1m';

function Waterfall({ r }: { r: any }) {
  const p = r.projection;
  const max = Math.max(p.high, r.realized_vol, 17.5) + 3;
  const pct = (v: number) => `${(v / max) * 100}%` as const;
  const rows = [
    { label: 'Long-run average', from: 0, to: 17.5, color: '#5A6157', val: '17.5' },
    { label: "Today's realized (20d)", from: 0, to: r.realized_vol, color: C.cyan, val: fmt.num(r.realized_vol) },
    { label: 'Mean-reversion baseline', from: 0, to: p.baseline, color: C.muted, val: fmt.num(p.baseline) },
    { label: '+ Conflict premium', from: p.baseline, to: p.vol, color: C.coral, val: fmt.signed(p.conflict_premium) },
    { label: '= Projected volatility', from: 0, to: p.vol, color: C.lime, val: fmt.num(p.vol), bold: true },
  ];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((x) => (
        <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 170, color: x.bold ? C.text : C.muted, fontFamily: x.bold ? F.bold : F.regular, fontSize: 12 }}>{x.label}</Text>
          <View style={{ flex: 1, height: 20, backgroundColor: C.ink, borderRadius: 4 }}>
            <View style={{ position: 'absolute', top: 3, bottom: 3, left: pct(Math.min(x.from, x.to)), width: pct(Math.abs(x.to - x.from)), backgroundColor: x.color, borderRadius: 3 }} />
            {x.bold && <View style={{ position: 'absolute', top: 0, bottom: 0, left: pct(p.low), width: pct(p.high - p.low), borderWidth: 1, borderStyle: 'dashed', borderColor: C.lime, borderRadius: 4 }} />}
          </View>
          <Text style={{ width: 56, textAlign: 'right', color: C.text, fontFamily: x.bold ? F.bold : F.semi, fontSize: 12 }}>{x.val}%</Text>
        </View>
      ))}
      <Muted style={{ fontSize: 11 }}>Dashed outline: 80% range, {fmt.num(p.low)}% to {fmt.num(p.high)}%.</Muted>
    </View>
  );
}

export default function Projections() {
  const { go } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [h, setH] = useState<H>('1w');
  const dash = useApi('/dashboard');
  const rat = useApi('/rationale', { horizon: h });
  const watch = useApi('/watchlist');
  const [editing, setEditing] = useState(false);

  if (dash.loading && !dash.data) return <Loading label="Loading projection desk" />;
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  const d = dash.data, desk = d.desk, r = rat.data;
  const hz = d.horizons.find((x: any) => x.horizon === h);

  return (
    <View>
      <View style={st.panel}>
        <PageHead eyebrow={`DECISION BRIEF · ${hz.label.toUpperCase()} OUTLOOK`} title="Projection desk"
          sub="A concise read on expected volatility, what's behind it, and how to think about managing exposure."
          right={
            <View style={st.signal}>
              <Text style={st.signalLabel}>MODEL POSTURE</Text>
              <Text style={st.signalValue}>{desk.posture.label.toUpperCase()}</Text>
              <Text style={st.signalMeta}>{desk.posture.bear_pct}% bear · {desk.posture.bull_pct}% bull</Text>
            </View>
          } />
        <Seg value={h} onChange={setH} options={[['1d', '1 DAY'], ['1w', '1 WEEK'], ['1m', '1 MONTH']]} />
        <View style={st.summaryGrid}>
          <View style={st.summaryCard}>
            <Eyebrow>EXPECTED VOLATILITY</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Text style={st.summaryValue}>{fmt.pct(hz.vol)}</Text>
              <Pill tone={toneForRegime(hz.regime)}>{hz.regime}</Pill>
            </View>
            <Muted>{fmt.signed(hz.change)} pts vs. realized · range {fmt.num(hz.low)}–{fmt.num(hz.high)}%</Muted>
          </View>
          <View style={st.summaryCard}>
            <Eyebrow>MODEL CONFIDENCE</Eyebrow>
            <Text style={[st.summaryValue, { marginTop: 8 }]}>{desk.confidence} / 100</Text>
            <Muted>Narrower ranges score higher · S&amp;P ±{fmt.num(hz.expected_move_pct, 2)}% ({fmt.int(hz.expected_move_pts)} pts)</Muted>
          </View>
          <View style={st.summaryCard}>
            <Eyebrow>RISK WINDOW</Eyebrow>
            <Text style={[st.summaryValue, { marginTop: 8 }]}>{desk.risk_window}</Text>
            <Muted>{desk.risk_window_note}</Muted>
          </View>
        </View>
      </View>

      <View style={[st.cols, !wide && { flexDirection: 'column' }]}>
        <View style={{ flex: 1.5, gap: 16, width: wide ? undefined : '100%' }}>
          <Card>
            <Eyebrow>WHY THIS FORECAST</Eyebrow>
            {r ? (
              <>
                <H2 style={{ fontSize: 19, lineHeight: 26, marginTop: 10 }}>{r.headline}</H2>
                <View style={{ height: 1, backgroundColor: C.line, marginVertical: 14 }} />
                <View style={{ gap: 10 }}>{r.paragraphs.map((p: string, i: number) => <Body key={i}>{p}</Body>)}</View>
              </>
            ) : <Loading />}
          </Card>
          <Card>
            <Eyebrow>HOW THE NUMBER IS BUILT</Eyebrow>
            <View style={{ marginTop: 14 }}>{r ? <Waterfall r={r} /> : null}</View>
          </Card>
          <View style={st.tipPanel}>
            <Eyebrow>WHAT TO CONSIDER</Eyebrow>
            <Text style={st.tipTitle}>{desk.posture.label === 'Defensive' ? 'Reduce unhedged exposure while the conflict premium is elevated.' : 'Conditions look manageable; keep an eye on the lead events.'}</Text>
            {desk.tips.map((t: string, i: number) => (
              <View key={i} style={st.tipRow}>
                <Text style={st.tipNumber}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={st.tipText}>{t}</Text>
              </View>
            ))}
            <Muted style={{ marginTop: 12, fontSize: 10.5 }}>{desk.disclaimer}</Muted>
          </View>
        </View>

        <View style={{ flex: 1, gap: 16, width: wide ? undefined : '100%' }}>
          <Card pad={0}>
            <View style={st.cardHead}><H3>Event contributions</H3><Muted>Volatility points added</Muted></View>
            {r?.drivers.map((x: any) => (
              <Pressable key={x.event_id} onPress={() => go('conflicts', { eventId: x.event_id })} style={({ hovered }: any) => [st.row, hovered && { backgroundColor: C.panel2 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitle}>{x.title}</Text>
                  <Muted style={{ fontSize: 11 }}>{x.region} · severity {fmt.num(x.severity)}</Muted>
                </View>
                <Text style={{ color: x.vol_points < 0 ? C.green : C.coral, fontFamily: F.bold, fontSize: 12 }}>{fmt.signed(x.vol_points, 2)}</Text>
              </Pressable>
            ))}
          </Card>

          {r?.analog && (
            <Card>
              <Eyebrow>CLOSEST HISTORICAL ANALOG</Eyebrow>
              <H3 style={{ fontSize: 17, marginTop: 8 }}>{r.analog.name}</H3>
              <Muted>{fmt.date(r.analog.start_date)} · {fmt.num(r.analog.similarity, 0)}% similarity</Muted>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
                {[['BEFORE', `${fmt.num(r.analog.pre_vol)}%`], ['PEAK / AFTER', `${fmt.num(r.analog.peak_vol)}%`], ['S&P MOVE', `${fmt.signed(r.analog.sp_move_pct)}%`]].map(([l, v]) => (
                  <View key={l}><Eyebrow style={{ fontSize: 8 }}>{l}</Eyebrow><Text style={{ color: C.text, fontFamily: F.semi, fontSize: 17, marginTop: 4 }}>{v}</Text></View>
                ))}
              </View>
              <Btn small label="COMPARE IN ARCHIVE" onPress={() => go('archive')} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
            </Card>
          )}

          <View style={st.watchlistPanel}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Eyebrow>WATCHLIST IMPACT</Eyebrow>
              <Pressable onPress={() => setEditing(true)}><Text style={{ color: C.cyan, fontFamily: F.semi, fontSize: 11 }}>Edit ↗</Text></Pressable>
            </View>
            {watch.data?.items.length ? watch.data.items.map((w: any) => (
              <View key={w.ticker} style={st.watchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.watchCompany}>{w.name} <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 10 }}>{w.ticker}</Text></Text>
                  <Text style={st.watchTag}>{w.sector}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <Pill tone={toneForLevel(w.level)}>{w.level === 'HIGH' ? 'HIGH SENSITIVITY' : w.level === 'WATCH' ? 'WATCH' : 'LOW'}</Pill>
                  <Bar value={w.exposure} color={w.level === 'HIGH' ? C.coral : w.level === 'WATCH' ? C.amber : C.green} style={{ width: 90 }} />
                </View>
              </View>
            )) : (
              <View style={{ paddingVertical: 14, gap: 8 }}>
                <Muted>Follow a few companies to see how today's conflicts affect them.</Muted>
                <Btn small kind="primary" label="FOLLOW COMPANIES" onPress={() => setEditing(true)} style={{ alignSelf: 'flex-start' }} />
              </View>
            )}
          </View>
        </View>
      </View>
      <WatchlistEditor open={editing} onClose={() => setEditing(false)} onSaved={watch.reload} />
    </View>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 22 },
  signal: { minWidth: 160, backgroundColor: C.coralBg, borderWidth: 1, borderColor: '#8C4B41', borderRadius: 8, padding: 12 },
  signalLabel: { color: '#D8B1A9', fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  signalValue: { color: C.coral, fontFamily: F.bold, fontSize: 18, marginTop: 4 },
  signalMeta: { color: '#E1B8AF', fontFamily: F.regular, fontSize: 10, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: 200, backgroundColor: C.panel2, borderRadius: 10, padding: 14, gap: 4 },
  summaryValue: { color: C.text, fontFamily: F.semi, fontSize: 24 },
  cols: { flexDirection: 'row', gap: 16, marginTop: 16, alignItems: 'flex-start' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowTitle: { color: C.text, fontFamily: F.semi, fontSize: 12.5 },
  tipPanel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 20 },
  tipTitle: { color: C.text, fontFamily: F.semi, fontSize: 16, marginTop: 8, marginBottom: 6 },
  tipRow: { flexDirection: 'row', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.lineSoft },
  tipNumber: { color: C.coral, fontFamily: F.bold, fontSize: 11, width: 20 },
  tipText: { color: C.muted, fontFamily: F.regular, fontSize: 12.5, lineHeight: 19, flex: 1 },
  watchlistPanel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 18 },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  watchCompany: { color: C.text, fontFamily: F.semi, fontSize: 12.5 },
  watchTag: { color: C.muted, fontFamily: F.regular, fontSize: 11, marginTop: 2 },
});
