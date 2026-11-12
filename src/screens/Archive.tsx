import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Chips, ErrorState, Eyebrow, Loading, Lock, Muted, PageHead, Pill, Seg } from '../components/ui';
import { C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

function VolBar({ pre, peak, max }: { pre: number; peak: number; max: number }) {
  const pct = (v: number) => `${(v / max) * 100}%` as const;
  const up = peak >= pre;
  return (
    <View style={{ height: 16, backgroundColor: C.ink, borderRadius: 4 }}>
      <View style={{ position: 'absolute', top: 4, bottom: 4, left: pct(Math.min(pre, peak)), width: pct(Math.max(0.6, Math.abs(peak - pre))), backgroundColor: up ? C.coral : C.green, borderRadius: 3 }} />
      <View style={{ position: 'absolute', top: 1, bottom: 1, width: 2, left: pct(pre), backgroundColor: C.text }} />
    </View>
  );
}

export default function Archive() {
  const { go } = useApp();
  const { data, error, loading, reload } = useApi('/archive');
  const [sort, setSort] = useState<'date' | 'impact' | 'severity'>('date');
  const [region, setRegion] = useState('');
  const rows = useMemo(() => {
    if (!data) return [];
    let r = [...data.episodes];
    if (region) r = r.filter((e: any) => e.region === region);
    if (sort === 'impact') r.sort((a: any, b: any) => b.vol_change - a.vol_change);
    else if (sort === 'severity') r.sort((a: any, b: any) => b.peak_severity - a.peak_severity);
    else r.sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));
    return r;
  }, [data, sort, region]);

  if (loading && !data) return <Loading label="Loading archive" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const max = Math.max(...data.episodes.map((e: any) => Math.max(e.peak_vol, e.pre_vol)), 40) + 2;
  const regions: [string, string][] = [['', 'ALL REGIONS'], ...(Array.from(new Set(data.episodes.map((e: any) => e.region))) as string[]).sort().map((r) => [r, r.toUpperCase()] as [string, string])];

  return (
    <View>
      <PageHead eyebrow="CONFLICT → VOLATILITY HISTORY" title="How past conflicts moved the market"
        sub="Index volatility before each episode versus its peak (or level after), for context and back-testing. Today's lead event is matched to its closest analogs." />
      <View style={st.analogPanel}>
        <Eyebrow style={{ color: C.lime }}>CLOSEST MATCHES TO TODAY'S LEAD EVENT</Eyebrow>
        <Text style={st.analogTitle}>"{data.current_top_event}"</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {data.current_analogs.map((a: any) => (
            <View key={a.id} style={st.analogCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12.5, flex: 1 }}>{a.name}</Text>
                <Text style={{ color: C.lime, fontFamily: F.bold, fontSize: 12 }}>{fmt.num(a.similarity, 0)}%</Text>
              </View>
              <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 10.5, marginTop: 6 }}>{a.start_date.slice(0, 4)} · vol {fmt.num(a.pre_vol)} → {fmt.num(a.peak_vol)} · S&amp;P {fmt.signed(a.sp_move_pct)}%</Text>
            </View>
          ))}
        </View>
      </View>

      <Card pad={0} style={{ marginTop: 16 }}>
        <View style={st.head}>
          <View><Text style={{ color: C.text, fontFamily: F.semi, fontSize: 15 }}>Conflict episodes</Text><Muted>{data.total} episodes</Muted></View>
          <Seg value={sort} onChange={setSort} options={[['date', 'NEWEST'], ['impact', 'BIGGEST MOVE'], ['severity', 'SEVERITY']]} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}><Chips value={region} onChange={setRegion} options={regions} /></View>
        <View>
          {rows.map((e: any) => (
            <View key={e.id} style={st.row}>
              <View style={{ flex: 2, minWidth: 240, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13.5 }}>{e.name}</Text>
                  <Pill>{e.category_label}</Pill>
                </View>
                <Muted style={{ fontSize: 11 }}>{fmt.date(e.start_date)} · {e.region}</Muted>
                <Muted style={{ fontSize: 11.5 }}>{e.summary}</Muted>
              </View>
              <View style={{ flex: 1, minWidth: 180, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={st.small}>VOL {fmt.num(e.pre_vol)} → {fmt.num(e.peak_vol)}</Text>
                  <Text style={[st.small, { color: e.vol_change >= 0 ? C.coral : C.green }]}>{fmt.signed(e.vol_change)} pts</Text>
                </View>
                <VolBar pre={e.pre_vol} peak={e.peak_vol} max={max} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={st.small}>{e.days_to_peak}d TO PEAK</Text>
                  <Text style={[st.small, { color: e.sp_move_pct < 0 ? C.coral : C.green }]}>S&amp;P {fmt.signed(e.sp_move_pct)}%</Text>
                </View>
              </View>
            </View>
          ))}
          {data.locked > 0 && [0, 1].map((i) => <View key={i} style={[st.row, { height: 74, opacity: 0.2 }]}><Text style={{ color: C.text }}>Locked episode</Text></View>)}
        </View>
        {data.locked > 0 && <Lock title={`${data.locked} more episodes in the full archive`} body="Premium unlocks every historical episode for comparison and back-testing." onUpgrade={() => go('settings')} />}
      </Card>
      <Muted style={{ marginTop: 12, fontSize: 11 }}>{data.note}</Muted>
    </View>
  );
}

const st = StyleSheet.create({
  analogPanel: { backgroundColor: C.rail, borderWidth: 1, borderColor: '#55602F', borderRadius: 12, padding: 20, gap: 10 },
  analogTitle: { color: C.text, fontFamily: F.semi, fontSize: 18, marginBottom: 4 },
  analogCard: { flex: 1, minWidth: 220, borderWidth: 1, borderColor: C.line, borderRadius: 9, padding: 12, backgroundColor: C.panel },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: 20, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.lineSoft, flexWrap: 'wrap' },
  small: { color: C.muted, fontFamily: F.bold, fontSize: 9, letterSpacing: 0.6 },
});
