import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api } from '../api/client';
import VolChart, { Metric } from '../components/VolChart';
import { Bar, Card, ErrorState, Eyebrow, H3, LevelPill, Loading, Muted, Pill, Seg, toneForRegime } from '../components/ui';
import { C, F, levelColor, regimeColor } from '../theme';
import { fmt, useApi, useApp } from '../state';

export function FeedItem({ e, onPress }: { e: any; onPress: () => void }) {
  const followed = e.followed_tickers?.length > 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ hovered }: any) => [st.newsItem, followed && st.newsFollowed, hovered && { backgroundColor: C.panel2 }]}>
      <View style={st.newsHead}>
        <LevelPill level={e.level} />
        <Text style={st.newsAge}>{fmt.ago(e.occurred_at)}</Text>
        {followed && <Text style={st.followedBadge}>★ {e.followed_tickers.join(' · ')}</Text>}
      </View>
      <Text style={st.newsTitle}>{e.title}</Text>
      <Text style={st.newsBody}>
        Countries: {e.country}{'\n'}Industry: {e.sectors.slice(0, 2).join(' · ') || '—'}{'\n'}Companies: {e.companies.join(' · ')}
      </Text>
      <View style={st.newsFoot}>
        <Text style={st.newsSource}>{e.source.toUpperCase()} · {e.region.toUpperCase()}</Text>
        <Text style={[st.newsImpact, { color: e.vol_points >= 0 ? C.coral : C.green }]}>{fmt.signed(e.vol_points, 1)} pts</Text>
      </View>
    </Pressable>
  );
}

export default function Overview() {
  const { go, toast, bump } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1150;
  const { data: d, error, loading, reload } = useApi('/dashboard');
  const alerts = useApi('/alerts');
  const [metric, setMetric] = useState<Metric>('vol');
  const [range, setRange] = useState<'1M' | '3M'>('3M');
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'WATCH'>('ALL');
  const [showAll, setShowAll] = useState(false);

  const watchAlert = useMemo(() => alerts.data?.alerts?.find((a: any) => a.name === 'S&P 500 watch'), [alerts.data]);

  if (loading && !d) return <Loading label="Loading market pulse" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const wk = d.horizons.find((h: any) => h.horizon === '1w');
  const desk = d.desk;
  const feed = d.top_events.filter((e: any) => filter === 'ALL' || e.level === filter);

  async function toggleWatch() {
    try {
      if (watchAlert) {
        await api(`/alerts/${watchAlert.id}`, { method: 'DELETE' });
        toast('Stopped watching the S&P 500', 'The quick-watch alert was removed.');
      } else {
        const threshold = Math.round(wk.vol + 2);
        await api('/alerts', { method: 'POST', body: { name: 'S&P 500 watch', metric: 'vol_1w', operator: 'above', threshold, channel: 'in_app' } });
        toast('Watching the S&P 500', `We'll notify you if 1-week projected volatility rises above ${threshold}%.`);
      }
      alerts.reload(); bump();
    } catch (e: any) { toast("Couldn't update watch", e.message); }
  }

  const tickers: [Metric | 'proj', string, string, string, string][] = [
    ['price', 'S&P 500', fmt.money(d.spot), `${fmt.signed(d.spot_change_pct, 2)}%`, d.spot_change_pct >= 0 ? C.green : C.coral],
    ['vol', 'REALIZED VOL 20D', fmt.pct(d.realized_vol), `avg 17.5%`, C.muted],
    ['cri', 'CONFLICT RISK INDEX', fmt.num(d.cri), `${fmt.signed(d.cri_change)} wk · ${d.cri_label}`, d.cri_change >= 0 ? C.coral : C.green],
    ['proj', 'PROJECTED VOL 1W', fmt.pct(wk.vol), `${fmt.signed(wk.change)} pts`, wk.change >= 0 ? C.coral : C.green],
  ];

  const right = (
    <View style={[st.rightPanel, !wide && { width: '100%' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={st.panelTitle}>Conflict intelligence</Text>
          <Text style={st.panelMeta}><Text style={{ color: C.coral }}>▸ </Text>CURATED SIGNAL FEED</Text>
        </View>
        <Pill tone="neutral">{`${d.active_event_count} ACTIVE`}</Pill>
      </View>
      <View style={{ marginTop: 14 }}>
        <Seg value={filter} onChange={setFilter} options={[['ALL', 'ALL'], ['HIGH', 'HIGH'], ['WATCH', 'WATCH']]} />
      </View>
      <View style={{ marginTop: 6 }}>
        {feed.slice(0, showAll ? 6 : 4).map((e: any) => <FeedItem key={e.id} e={e} onPress={() => go('conflicts', { eventId: e.id })} />)}
        {feed.length === 0 && <Muted style={{ paddingVertical: 20 }}>No {filter.toLowerCase()} signals right now.</Muted>}
      </View>
      <Pressable onPress={() => (feed.length > 4 && !showAll ? setShowAll(true) : go('conflicts'))} style={st.allNews}>
        <Text style={st.allNewsText}>{feed.length > 4 && !showAll ? 'Show more' : 'View all signals'} ↗</Text>
      </Pressable>
      <View style={st.note}>
        <Text style={st.noteLabel}>HOW THIS WORKS</Text>
        <Text style={st.noteText}>ConflictVol scores each event for severity, scope, recency and regional market relevance, then adds that conflict premium to mean-reverting realized volatility to produce an explainable range.</Text>
      </View>
    </View>
  );

  return (
    <View style={[st.grid, !wide && { flexDirection: 'column' }]}>
      <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
        <View style={st.tickerRow}>
          {tickers.map(([m, label, value, change, color]) => {
            const sel = m === metric || (m === 'proj' && metric === 'vol' && false);
            return (
              <Pressable key={label} onPress={() => (m === 'proj' ? go('projections') : setMetric(m as Metric))} accessibilityRole="button"
                style={({ hovered }: any) => [st.ticker, sel && st.tickerSelected, hovered && !sel && { borderColor: '#5A6157' }]}>
                <Text style={st.tickerSymbol}>{label}</Text>
                <Text style={st.tickerPrice}>{value}</Text>
                <Text style={[st.tickerChange, { color }]}>{change}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card pad={22}>
          <View style={st.cardHeader}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <Text style={st.cardTitle}>S&amp;P 500</Text>
                <Pill tone="lime">FORECAST</Pill>
                <Pill tone={toneForRegime(wk.regime)}>{wk.regime}</Pill>
              </View>
              <Text style={st.cardMeta}>SHORT-TERM VOLATILITY PROJECTION · NEXT 5 TRADING DAYS</Text>
            </View>
            <View style={st.posture}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.postureLabel}>MODEL POSTURE</Text>
                <Text style={st.postureValue}>{desk.posture.label.toUpperCase()}</Text>
              </View>
              <View style={st.postureBar}><View style={[st.postureFill, { width: `${desk.posture.bear_pct}%` }]} /></View>
              <Text style={st.postureMeta}>{desk.posture.bear_pct}% bear · {desk.posture.bull_pct}% bull</Text>
            </View>
            <Pressable onPress={toggleWatch} accessibilityRole="button" style={[st.watchButton, watchAlert && st.watchOn]}>
              <Text style={{ color: watchAlert ? C.lime : C.muted, fontSize: 13 }}>{watchAlert ? '★' : '☆'}</Text>
              <Text style={st.watchText}>{watchAlert ? 'Watching' : 'Watch'}</Text>
            </Pressable>
          </View>

          <View style={st.projectionRow}>
            <Text style={st.projection}>{fmt.num(wk.vol)}<Text style={st.projectionUnit}>%</Text></Text>
            <View>
              <Text style={[st.deltaText, { color: wk.change >= 0 ? C.coral : C.green }]}>{fmt.signed(wk.change)} pts</Text>
              <Text style={st.deltaSub}>vs. realized {fmt.pct(d.realized_vol)}</Text>
            </View>
            <View>
              <Text style={st.deltaSub}>80% RANGE</Text>
              <Text style={[st.deltaText, { color: C.text }]}>{fmt.num(wk.low)}–{fmt.num(wk.high)}%</Text>
            </View>
            <View style={st.confidence}>
              <Text style={st.confidenceLabel}>MODEL CONFIDENCE</Text>
              <Bar value={desk.confidence} color={C.lime} height={4} style={{ width: 130, marginVertical: 6 }} />
              <Text style={st.confidenceValue}>{desk.confidence} / 100</Text>
            </View>
          </View>

          <View style={st.chartLegend}>
            <Seg value={metric} onChange={setMetric} options={[['vol', 'VOLATILITY'], ['price', 'S&P 500'], ['cri', 'RISK INDEX']]} />
            <Seg value={range} onChange={setRange} options={[['1M', '1M'], ['3M', '3M']]} />
          </View>
          <View style={st.indicatorStrip}>
            {metric === 'vol' && <>
              <Legend color={C.text} label="REALIZED" /><Legend color={C.lime} label="PROJECTED" dashed /><Legend color={C.lime} label="80% RANGE" soft />
              <Legend color={C.coral} label="RISK INDEX" soft /><Legend color={C.cyan} label="LONG-RUN AVG" dashed />
            </>}
            {metric === 'price' && <><Legend color={C.cyan} label="S&P 500 CLOSE" /><Legend color={C.lime} label="±1σ IMPLIED BY PROJECTION" soft /></>}
            {metric === 'cri' && <Legend color={C.coral} label="CONFLICT RISK INDEX (0–100)" soft />}
            <Text style={st.indicatorValue}>Hover or drag to inspect</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <VolChart series={d.series} forecast={d.forecast} metric={metric} days={range === '1M' ? 21 : 90} spot={d.spot} />
          </View>
          <View style={st.callout}>
            <View style={st.calloutIcon}><Text style={{ color: C.ink, fontFamily: F.bold }}>↗</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.calloutTitle}>{desk.premium_share >= 50 ? 'Conflict premium is the dominant driver' : 'Mean reversion is doing most of the work'}</Text>
              <Text style={st.calloutBody}>
                The model attributes <Text style={{ color: C.coral, fontFamily: F.semi }}>{desk.premium_share}%</Text> of the projected move to conflict-linked signals, led by "{d.top_events[0]?.title}". This is a statistical estimate, not a trade recommendation.
              </Text>
            </View>
          </View>
        </Card>

        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Signal breakdown</Text>
          <Pressable onPress={() => go('projections')}><Text style={st.viewLink}>Full projection ↗</Text></Pressable>
        </View>
        <View style={st.breakdownRow}>
          {d.horizons.map((h: any) => (
            <Pressable key={h.horizon} onPress={() => go('projections')} style={st.breakdownCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.breakdownLabel}>{h.label.toUpperCase()}</Text>
                <Text style={[st.breakdownLabel, { color: regimeColor(h.regime) }]}>{h.regime.toUpperCase()}</Text>
              </View>
              <Text style={st.breakdownValue}>{fmt.pct(h.vol)}</Text>
              <Bar value={(h.vol / 40) * 100} color={regimeColor(h.regime)} />
              <Text style={st.breakdownMeta}>Range {fmt.num(h.low)}–{fmt.num(h.high)}% · S&amp;P ±{fmt.num(h.expected_move_pct, 2)}%</Text>
            </Pressable>
          ))}
        </View>
        <View style={[st.breakdownRow, { marginTop: 10 }]}>
          {[
            ['CONFLICT PREMIUM', `+${fmt.num(wk.conflict_premium)} pts`, desk.premium_share, C.coral, `${desk.premium_share}% of the projected move`],
            ['BASELINE VOL', fmt.pct(wk.baseline), (wk.baseline / 40) * 100, C.cyan, 'Mean-reverting realized volatility'],
            ['MOST EXPOSED', d.top_sectors[0]?.sector || '—', d.top_sectors[0]?.exposure || 0, levelColor('HIGH'), `${d.top_sectors.slice(1, 3).map((x: any) => x.sector).join(', ')} next`],
          ].map(([label, value, w, color, meta]) => (
            <View key={label as string} style={st.breakdownCard}>
              <Text style={st.breakdownLabel}>{label}</Text>
              <Text style={[st.breakdownValue, String(value).length > 12 && { fontSize: 17 }]} numberOfLines={1}>{value}</Text>
              <Bar value={w as number} color={color as string} />
              <Text style={st.breakdownMeta}>{meta}</Text>
            </View>
          ))}
        </View>
      </View>
      {right}
    </View>
  );
}

function Legend({ color, label, dashed, soft }: { color: string; label: string; dashed?: boolean; soft?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: soft ? 8 : 2, backgroundColor: soft ? color + '44' : dashed ? 'transparent' : color, borderTopWidth: dashed ? 2 : 0, borderStyle: 'dashed', borderColor: color }} />
      <Text style={{ color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

export const st = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  tickerRow: { flexDirection: 'row', gap: 9, marginBottom: 18, flexWrap: 'wrap' },
  ticker: { flex: 1, minWidth: 150, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 },
  tickerSelected: { borderColor: C.cyan, backgroundColor: '#2C312E' },
  tickerSymbol: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.8 },
  tickerPrice: { color: C.text, fontFamily: F.semi, fontSize: 18, marginTop: 7 },
  tickerChange: { fontFamily: F.bold, fontSize: 9.5, marginTop: 4 },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  cardTitle: { color: C.text, fontFamily: F.semi, fontSize: 18 },
  cardMeta: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.8, marginTop: 7 },
  posture: { width: 190, backgroundColor: C.coralBg, borderWidth: 1, borderColor: '#8C4B41', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 },
  postureLabel: { color: '#D8B1A9', fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  postureValue: { color: C.coral, fontFamily: F.bold, fontSize: 10.5 },
  postureBar: { height: 5, backgroundColor: '#5A3433', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  postureFill: { height: '100%', backgroundColor: C.coral },
  postureMeta: { color: '#E1B8AF', fontFamily: F.regular, fontSize: 9, marginTop: 6 },
  watchButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 11, height: 32 },
  watchOn: { borderColor: C.lime, backgroundColor: C.limeBg },
  watchText: { color: C.text, fontFamily: F.bold, fontSize: 10 },
  projectionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 26, marginTop: 20, flexWrap: 'wrap' },
  projection: { color: C.text, fontFamily: F.semi, fontSize: 52, letterSpacing: -2, lineHeight: 56 },
  projectionUnit: { color: C.muted, fontSize: 24 },
  deltaText: { fontFamily: F.bold, fontSize: 14 },
  deltaSub: { color: C.muted, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.6, marginTop: 3 },
  confidence: { marginLeft: 'auto' },
  confidenceLabel: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  confidenceValue: { color: C.text, fontFamily: F.semi, fontSize: 12 },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, gap: 10, flexWrap: 'wrap' },
  indicatorStrip: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft, paddingVertical: 8 },
  indicatorValue: { marginLeft: 'auto', color: C.faint, fontFamily: F.semi, fontSize: 9 },
  callout: { marginTop: 18, flexDirection: 'row', gap: 12, backgroundColor: C.panel2, borderRadius: 9, padding: 14, borderWidth: 1, borderColor: C.lineSoft },
  calloutIcon: { width: 24, height: 24, borderRadius: 5, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  calloutTitle: { color: C.text, fontFamily: F.semi, fontSize: 13 },
  calloutBody: { color: C.muted, fontFamily: F.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: C.text, fontFamily: F.semi, fontSize: 16 },
  viewLink: { color: C.cyan, fontFamily: F.semi, fontSize: 11 },
  breakdownRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  breakdownCard: { flex: 1, minWidth: 190, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 8 },
  breakdownLabel: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  breakdownValue: { color: C.text, fontFamily: F.semi, fontSize: 22 },
  breakdownMeta: { color: C.muted, fontFamily: F.regular, fontSize: 10.5 },
  rightPanel: { width: 330, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 18 },
  panelTitle: { color: C.text, fontFamily: F.semi, fontSize: 15 },
  panelMeta: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7, marginTop: 4 },
  newsItem: { borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 6, marginHorizontal: -6 },
  newsFollowed: { borderLeftWidth: 2, borderLeftColor: C.lime, paddingLeft: 10 },
  newsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  newsAge: { color: C.muted, fontFamily: F.semi, fontSize: 9.5 },
  followedBadge: { color: C.lime, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.5, marginLeft: 'auto' },
  newsTitle: { color: C.text, fontFamily: F.semi, fontSize: 13, lineHeight: 18, marginTop: 8 },
  newsBody: { color: C.muted, fontFamily: F.regular, fontSize: 10.5, lineHeight: 16, marginTop: 6 },
  newsFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  newsSource: { color: C.faint, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.6 },
  newsImpact: { fontFamily: F.bold, fontSize: 10 },
  allNews: { marginTop: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.line, borderRadius: 6, alignItems: 'center' },
  allNewsText: { color: C.cyan, fontFamily: F.semi, fontSize: 11 },
  note: { marginTop: 16, backgroundColor: C.panel2, borderRadius: 8, padding: 12 },
  noteLabel: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  noteText: { color: C.muted, fontFamily: F.regular, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
