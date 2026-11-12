import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { api } from '../api/client';
import WatchlistEditor from '../components/WatchlistEditor';
import WorldMap from '../components/WorldMap';
import { Bar, Btn, Card, Chips, Empty, ErrorState, Eyebrow, H3, LevelPill, Loading, Muted, PageHead, Pill, Sev, Sheet, s as ui, toneForBias } from '../components/ui';
import { biasColor, C, F, sevColor } from '../theme';
import { fmt, useApi, useApp } from '../state';
import { AnimatedNumber, FadeIn } from '../motion';

function EventDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { go } = useApp();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<any>(null);
  useEffect(() => { setD(null); setErr(null); if (id) api(`/events/${id}`).then(setD).catch(setErr); }, [id]);
  return (
    <Sheet open={!!id} onClose={onClose} title={d ? d.title : 'Event'} width={620}>
      {err && <Text style={{ color: C.coral }}>{err.message}</Text>}
      {!d && !err && <Loading />}
      {d && (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <LevelPill level={d.level} />
            <Pill>{d.category_label}</Pill>
            {d.escalating && <Pill tone="coral">ESCALATING</Pill>}
            {d.chokepoint && <Pill tone="amber">SHIPPING CHOKEPOINT</Pill>}
            {d.deescalation && <Pill tone="green">DE-ESCALATION</Pill>}
            {d.followed_tickers.length > 0 && <Pill tone="limeSoft">{`★ ${d.followed_tickers.join(' · ')}`}</Pill>}
          </View>
          <Eyebrow>{d.region} · {d.country}</Eyebrow>
          <Text style={{ color: '#CACFC6', fontFamily: F.regular, fontSize: 13.5, lineHeight: 21 }}>{d.summary}</Text>
          <View style={st.transmission}>
            <Eyebrow>MARKET TRANSMISSION</Eyebrow>
            <Text style={{ color: C.text, fontFamily: F.regular, fontSize: 12.5, lineHeight: 19, marginTop: 5 }}>{d.market_effect}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[['SEVERITY', <Sev key="s" value={d.severity} />], ['RANK', `#${d.rank}`], ['SHARE OF PREMIUM', `${fmt.num(d.share_of_premium)}%`], ['VOL IMPACT', `${fmt.signed(d.vol_points, 2)} pts`]].map(([l, v]) => (
              <View key={l as string} style={st.stat}><Eyebrow style={{ fontSize: 7.5 }}>{l}</Eyebrow>{typeof v === 'string' ? <Text style={st.statValue}>{v}</Text> : <View style={{ marginTop: 6 }}>{v}</View>}</View>
            ))}
          </View>
          <View>
            <H3 style={{ marginBottom: 8 }}>How it's scored</H3>
            {[['Scope', d.scope], ['Reported fatalities', String(d.fatalities)], ['Region market relevance', `×${fmt.num(d.relevance)}`],
              ['Recency weight (7-day half-life)', fmt.num(d.recency, 2)], ['Contribution to risk index', fmt.signed(d.contribution, 2)]].map(([k, v], i) => (
              <View key={k} style={[st.kv, i === 4 && { borderBottomWidth: 0 }]}>
                <Text style={{ color: i === 4 ? C.text : C.muted, fontFamily: i === 4 ? F.bold : F.regular, fontSize: 12 }}>{k}</Text>
                <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12, textTransform: 'capitalize' }}>{v}</Text>
              </View>
            ))}
          </View>
          <View>
            <H3 style={{ marginBottom: 8 }}>Sector impact</H3>
            {Object.entries(d.sector_impacts).map(([sec, v]: any) => (
              <View key={sec} style={{ marginBottom: 9 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: C.text, fontFamily: F.regular, fontSize: 12 }}>{sec}</Text>
                  <Pill tone={toneForBias(v.direction)}>{v.direction}</Pill>
                </View>
                <Bar value={v.sensitivity * 100} color={biasColor(v.direction)} />
              </View>
            ))}
          </View>
          <View>
            <H3 style={{ marginBottom: 8 }}>Closest historical analogs</H3>
            {d.analogs.map((a: any) => (
              <View key={a.id} style={st.analog}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12.5 }}>{a.name}</Text>
                  <Text style={{ color: C.lime, fontFamily: F.bold, fontSize: 11 }}>{fmt.num(a.similarity, 0)}%</Text>
                </View>
                <Muted style={{ fontSize: 11 }}>{a.start_date.slice(0, 4)} · volatility {fmt.num(a.pre_vol)} → {fmt.num(a.peak_vol)} in {a.days_to_peak}d · S&amp;P {fmt.signed(a.sp_move_pct)}%</Muted>
              </View>
            ))}
            <Btn small label="OPEN ARCHIVE" onPress={() => { onClose(); go('archive'); }} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
          </View>
          <Muted style={{ fontSize: 10.5 }}>Source: {d.source} · reported {fmt.time(d.occurred_at)}</Muted>
        </>
      )}
    </Sheet>
  );
}

export default function Conflicts() {
  const { params, go } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [q, setQ] = useState(params.q || '');
  const [debounced, setDebounced] = useState(params.q || '');
  const [level, setLevel] = useState<'' | 'HIGH' | 'WATCH' | 'LOW'>('');
  const [region, setRegion] = useState('');
  const [selected, setSelected] = useState<number | null>(params.eventId ?? null);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setSelected(params.eventId ?? null); if (params.q !== undefined) { setQ(params.q); setDebounced(params.q); } }, [params]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  const query = useMemo(() => ({ q: debounced, level, region }), [debounced, level, region]);
  const { data, error, loading, reload } = useApi('/events', query);
  const watch = useApi('/watchlist');
  const dash = useApi('/dashboard');

  if (error) return <ErrorState error={error} onRetry={reload} />;
  const events: any[] = data?.events || [];
  const followed: any[] = watch.data?.items || [];
  const regions: [string, string][] = [['', 'ALL REGIONS'], ...((data?.filters.regions || []) as string[]).map((r) => [r, r.toUpperCase()] as [string, string])];
  const topSector = dash.data?.top_sectors?.[0]?.sector;
  const cri = dash.data?.cri ?? 0;

  return (
    <View>
      <View style={st.panel}>
        <PageHead eyebrow="LIVE EVENT MAP · MARKET TRANSMISSION" title="Conflict monitor"
          sub="Current conflicts translated into the countries, sectors and companies most likely to move."
          right={
            <Pressable onPress={() => setEditing(true)} style={st.following} accessibilityRole="button" accessibilityLabel="Edit followed companies">
              <Text style={st.followingLabel}>FOLLOWING</Text>
              <Text style={st.followingCompany}>★ {followed.length ? followed.slice(0, 3).map((f) => f.ticker).join(' · ') : 'No companies yet'}</Text>
              <Text style={st.followingMeta}>{followed.length ? `${followed.filter((f) => f.level === 'HIGH').length} with HIGH sensitivity · edit` : 'Tap to follow companies'}</Text>
            </Pressable>
          } />
        <View style={st.summary}>
          <View><Eyebrow>ACTIVE SIGNALS</Eyebrow><AnimatedNumber value={data ? events.length : 0} decimals={0} style={st.summaryValue} /></View>
          <View><Eyebrow>MOST EXPOSED INDUSTRY</Eyebrow><Text style={st.summarySmall}>{topSector || '—'}</Text></View>
          <View><Eyebrow>MARKET TILT</Eyebrow><Text style={[st.summarySmall, { color: cri >= 50 ? C.coral : cri >= 25 ? C.amber : C.green }]}>{cri >= 50 ? 'Risk-off' : cri >= 25 ? 'Cautious' : 'Risk-on'}</Text></View>
          <View><Eyebrow>CONFLICT RISK INDEX</Eyebrow><Text style={st.summarySmall}>{fmt.num(cri)} / 100</Text></View>
        </View>
      </View>

      <View style={[st.cols, !wide && { flexDirection: 'column' }]}>
        <View style={{ flex: 1.15, gap: 12, width: wide ? undefined : '100%' }}>
          <Card pad={12}>
            {data ? <WorldMap events={events} selectedId={selected} onSelect={(e) => setSelected(e.id)} /> : <Loading />}
            <View style={st.legend}>
              {[['De-escalation', sevColor(-1)], ['Moderate', sevColor(5)], ['High', sevColor(7)], ['Severe', sevColor(9)]].map(([l, c]) => (
                <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} /><Text style={st.legendText}>{l}</Text></View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: C.lime }} /><Text style={st.legendText}>Affects a followed company</Text></View>
            </View>
          </Card>
          <Card pad={14} style={{ gap: 10 }}>
            <TextInput value={q} onChangeText={setQ} placeholder="Search events, countries or tickers…" placeholderTextColor={C.faint} style={ui.input} accessibilityLabel="Search events" />
            <Chips value={level} onChange={setLevel} options={[['', 'ALL'], ['HIGH', 'HIGH'], ['WATCH', 'WATCH'], ['LOW', 'LOW']]} />
            <Chips value={region} onChange={setRegion} options={regions} />
          </Card>
        </View>

        <View style={{ flex: 1, gap: 10, width: wide ? undefined : '100%' }}>
          {loading && !data ? <Loading /> : events.length === 0 ? (
            <Card><Empty title="No events match these filters" body="Try a different region, level or search term."
              action={<Btn small label="CLEAR FILTERS" onPress={() => { setQ(''); setLevel(''); setRegion(''); go('conflicts'); }} />} /></Card>
          ) : events.slice(0, showAll ? events.length : 8).map((e, idx) => {
            const isFollowed = e.followed_tickers.length > 0;
            return (
              <FadeIn key={e.id} delay={Math.min(idx, 8) * 60}>
              <Pressable onPress={() => setSelected(e.id)} accessibilityRole="button"
                style={({ hovered }: any) => [st.card, isFollowed && st.cardFollowed, selected === e.id && { borderColor: C.cyan }, hovered && st.cardHover]}>
                <View style={st.cardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <LevelPill level={e.level} />
                    <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 10 }}>{fmt.ago(e.occurred_at)} · #{e.rank}</Text>
                  </View>
                  {isFollowed && <Text style={st.followedBadge}>FOLLOWED · {e.followed_tickers.join(' · ')}</Text>}
                </View>
                <Text style={st.title}>{e.title}</Text>
                <Text style={st.body}>Countries: {e.country}{'\n'}Industry: {e.sectors.join(' · ') || '—'}{'\n'}Companies: {e.companies.join(' · ')}</Text>
                <View style={st.effect}>
                  <Text style={st.effectLabel}>MARKET TRANSMISSION</Text>
                  <Text style={st.effectText}>{e.market_effect}</Text>
                  <Text style={[st.impact, { color: e.vol_points >= 0 ? C.coral : C.green }]}>{fmt.signed(e.vol_points, 2)} vol pts estimated pressure</Text>
                </View>
              </Pressable>
              </FadeIn>
            );
          })}
          {events.length > 8 && (
            <Btn label={showAll ? 'SHOW TOP 8' : `SHOW ALL ${events.length} EVENTS`} onPress={() => setShowAll(!showAll)} />
          )}
        </View>
      </View>
      <EventDetail id={selected} onClose={() => setSelected(null)} />
      <WatchlistEditor open={editing} onClose={() => setEditing(false)} onSaved={() => { watch.reload(); reload(); }} />
    </View>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 22 },
  following: { minWidth: 200, backgroundColor: C.limeBg, borderWidth: 1, borderColor: '#55602F', borderRadius: 8, padding: 12 },
  followingLabel: { color: C.lime, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.8 },
  followingCompany: { color: C.text, fontFamily: F.semi, fontSize: 15, marginTop: 5 },
  followingMeta: { color: C.muted, fontFamily: F.regular, fontSize: 10, marginTop: 3 },
  summary: { flexDirection: 'row', gap: 32, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
  summaryValue: { color: C.text, fontFamily: F.semi, fontSize: 24, marginTop: 6 },
  summarySmall: { color: C.text, fontFamily: F.semi, fontSize: 16, marginTop: 8 },
  cols: { flexDirection: 'row', gap: 16, marginTop: 16, alignItems: 'flex-start' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingHorizontal: 4 },
  legendText: { color: C.muted, fontFamily: F.regular, fontSize: 10.5 },
  card: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 16 },
  cardFollowed: { borderColor: C.lime + 'AA', boxShadow: `0 0 0 1px ${C.lime}22, 0 12px 30px -20px ${C.lime}` } as any,
  cardHover: { backgroundColor: '#323534', transform: [{ translateY: -2 }], boxShadow: `0 16px 36px -18px #000, 0 0 0 1px ${C.lime}44` } as any,
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  followedBadge: { color: C.lime, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.6 },
  title: { color: C.text, fontFamily: F.semi, fontSize: 14.5, lineHeight: 20, marginTop: 10 },
  body: { color: C.muted, fontFamily: F.regular, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  effect: { marginTop: 12, backgroundColor: C.panel, borderRadius: 8, padding: 11, borderWidth: 1, borderColor: C.lineSoft },
  effectLabel: { color: C.muted, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  effectText: { color: '#CACFC6', fontFamily: F.regular, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  impact: { fontFamily: F.bold, fontSize: 10.5, marginTop: 6 },
  transmission: { backgroundColor: C.panel2, borderRadius: 8, padding: 12 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 8, padding: 10 },
  statValue: { color: C.text, fontFamily: F.semi, fontSize: 16, marginTop: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  analog: { backgroundColor: C.panel2, borderRadius: 8, padding: 10, marginBottom: 6, gap: 3 },
});
