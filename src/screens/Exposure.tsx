import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api } from '../api/client';
import { Card, ErrorState, H3, Loading, Lock, Muted, PageHead, Pill, toneForBias } from '../components/ui';
import { biasColor, C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

const PLACEHOLDER = [
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', exposure: 96, bias: 'tailwind' },
  { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', exposure: 92, bias: 'tailwind' },
  { ticker: 'DAL', name: 'Delta Air Lines', sector: 'Industrials', exposure: 88, bias: 'headwind' },
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Information Technology', exposure: 61, bias: 'headwind' },
];

export default function Exposure() {
  const { go, toast, bump } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const { data, error, loading, reload } = useApi('/exposure');
  const watch = useApi('/watchlist');
  const [sector, setSector] = useState('');
  if (loading && !data) return <Loading label="Loading sector exposure" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const followed = new Set((watch.data?.items || []).map((i: any) => i.ticker));
  const tickers = data.tickers_locked ? PLACEHOLDER : data.tickers.filter((t: any) => !sector || t.sector === sector);

  async function toggleFollow(t: string) {
    try {
      await api(`/watchlist/${t}`, { method: followed.has(t) ? 'DELETE' : 'POST' });
      toast(followed.has(t) ? `Unfollowed ${t}` : `Following ${t}`, followed.has(t) ? undefined : 'It will be highlighted in the conflict feed when events affect its sector.');
      watch.reload(); bump();
    } catch (e: any) { toast("Couldn't update watchlist", e.message); }
  }

  return (
    <View>
      <PageHead eyebrow="SECTOR & TICKER SENSITIVITY · 0–100" title="Where the conflict risk lands"
        sub="How sensitive each S&P 500 sector is to today's conflict landscape, and whether the pressure is likely a tailwind or a headwind for prices. Tap a sector to filter tickers." />
      <View style={[st.cols, !wide && { flexDirection: 'column' }]}>
        <Card style={{ flex: 1.3, width: wide ? undefined : '100%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <H3>Exposure by sector</H3>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {['tailwind', 'headwind', 'mixed'].map((b) => (
                <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: biasColor(b) }} /><Text style={st.legend}>{b}</Text></View>
              ))}
            </View>
          </View>
          {data.sectors.map((s: any) => {
            const dim = sector && sector !== s.sector;
            return (
              <Pressable key={s.sector} onPress={() => setSector(sector === s.sector ? '' : s.sector)} accessibilityRole="button" accessibilityState={{ selected: sector === s.sector }}
                style={({ hovered }: any) => [st.barRow, hovered && { backgroundColor: C.panel2 }, { opacity: dim ? 0.4 : 1 }]}>
                <Text style={st.barLabel} numberOfLines={1}>{s.sector}</Text>
                <View style={st.barTrack}><View style={{ width: `${Math.max(1.5, s.exposure)}%`, height: '100%', backgroundColor: biasColor(s.bias), borderRadius: 4 }} /></View>
                <Text style={st.barVal}>{fmt.num(s.exposure, 0)}</Text>
              </Pressable>
            );
          })}
        </Card>
        <Card pad={0} style={{ flex: 1, width: wide ? undefined : '100%' }}>
          <View style={st.head}><H3>What's behind it</H3><Muted>Leading drivers per sector</Muted></View>
          {data.sectors.filter((s: any) => s.exposure >= 15).map((s: any) => (
            <Pressable key={s.sector} onPress={() => setSector(s.sector)} style={({ hovered }: any) => [st.driver, hovered && { backgroundColor: C.panel2 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12.5 }}>{s.sector}</Text>
                <Muted style={{ fontSize: 11 }}>{s.drivers.join(' · ') || 'Broad risk-off pressure'}</Muted>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <Pill tone={s.level === 'High' ? 'coral' : s.level === 'Elevated' ? 'amber' : 'neutral'}>{s.level}</Pill>
                <Pill tone={toneForBias(s.bias)}>{s.bias}</Pill>
              </View>
            </Pressable>
          ))}
        </Card>
      </View>

      <Card pad={0} style={{ marginTop: 16 }}>
        <View style={st.head}>
          <View><H3>Representative tickers</H3><Muted>{sector ? `Filtered to ${sector}` : 'Most exposed S&P 500 constituents · ☆ to follow'}</Muted></View>
          {sector ? <Pressable onPress={() => setSector('')}><Text style={{ color: C.cyan, fontFamily: F.semi, fontSize: 11 }}>Show all sectors</Text></Pressable> : null}
        </View>
        <View style={[st.tr, { backgroundColor: C.rail }]}>
          {['', 'TICKER', 'COMPANY', 'SECTOR', 'BIAS', 'EXPOSURE'].map((h, i) => <Text key={i} style={[st.th, st[`c${i}` as 'c0']]}>{h}</Text>)}
        </View>
        <View style={data.tickers_locked ? { opacity: 0.25 } : undefined}>
          {tickers.slice(0, 16).map((t: any) => (
            <View key={t.ticker} style={st.tr}>
              <Pressable onPress={() => !data.tickers_locked && toggleFollow(t.ticker)} style={st.c0} accessibilityRole="button" accessibilityLabel={followed.has(t.ticker) ? `Unfollow ${t.ticker}` : `Follow ${t.ticker}`}>
                <Text style={{ color: followed.has(t.ticker) ? C.lime : C.faint, fontSize: 15 }}>{followed.has(t.ticker) ? '★' : '☆'}</Text>
              </Pressable>
              <Text style={[st.td, st.c1, { fontFamily: F.bold }]}>{t.ticker}</Text>
              <Text style={[st.td, st.c2]} numberOfLines={1}>{t.name}</Text>
              <Text style={[st.td, st.c3, { color: C.muted }]} numberOfLines={1}>{t.sector}</Text>
              <View style={st.c4}><Pill tone={toneForBias(t.bias)}>{t.bias}</Pill></View>
              <View style={[st.c5, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <View style={[st.barTrack, { height: 6 }]}><View style={{ width: `${t.exposure}%`, height: '100%', backgroundColor: biasColor(t.bias), borderRadius: 3 }} /></View>
                <Text style={[st.td, { width: 30, textAlign: 'right' }]}>{fmt.num(t.exposure, 0)}</Text>
              </View>
            </View>
          ))}
        </View>
        {data.tickers_locked && <Lock title="Ticker-level exposure is a Premium feature" body="See which individual S&P 500 names carry the most conflict exposure, filtered by sector." onUpgrade={() => go('settings')} />}
      </Card>
      <Muted style={{ marginTop: 12, fontSize: 11 }}>Exposure measures sensitivity to current conflict drivers, not a buy or sell signal.</Muted>
    </View>
  );
}

const st = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  legend: { color: C.muted, fontFamily: F.regular, fontSize: 11, textTransform: 'capitalize' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 6 },
  barLabel: { width: 165, color: C.text, fontFamily: F.regular, fontSize: 12, textAlign: 'right' },
  barTrack: { flex: 1, height: 14, backgroundColor: C.ink, borderRadius: 4, overflow: 'hidden' },
  barVal: { width: 30, color: C.text, fontFamily: F.semi, fontSize: 12, textAlign: 'right' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft, gap: 10 },
  th: { color: C.muted, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.8 },
  td: { color: C.text, fontFamily: F.regular, fontSize: 12 },
  c0: { width: 22 }, c1: { width: 54 }, c2: { flex: 1.3 }, c3: { flex: 1.3 }, c4: { width: 86 }, c5: { flex: 1.4 },
});
