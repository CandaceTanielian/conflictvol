import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { api, DEMO } from '../api/client';
import { C, F } from '../theme';
import { fmt, initials, Screen, useApp, useApi } from '../state';
import { Logo, Pill, Toasts } from './ui';
import BreakingOverlay, { Breaking } from './BreakingOverlay';
import CommandPalette from './CommandPalette';
import TickerTape from './TickerTape';
import { Breathe, NATIVE, prefersReducedMotion } from '../motion';

const LIVE_INTERVAL_MS = 9000;

function Scanline() {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      Animated.delay(1800),
      Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: -1, left: 0, width: 220, height: 2,
      backgroundColor: C.lime, opacity: 0.85, boxShadow: `0 0 12px 2px ${C.lime}`,
      transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-220, width] }) }] } as any} />
  );
}

const NAV: [Screen, string, string][] = [
  ['overview', 'Overview', '▦'],
  ['projections', 'Projections', '↘'],
  ['conflicts', 'Conflicts', '◍'],
  ['exposure', 'Exposure', '▥'],
  ['archive', 'Archive', '▤'],
  ['alerts', 'Alerts', '◈'],
];
export const TITLES: Record<Screen, string> = {
  overview: 'Market pulse', projections: 'Projection desk', conflicts: 'Conflict monitor', exposure: 'Sector exposure',
  archive: 'Historical archive', alerts: 'Alerts', notifications: 'Notifications', settings: 'Settings',
};

function BellIcon({ color = C.muted }: { color?: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>;
}
function GearIcon({ color = C.muted }: { color?: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>;
}

// ---------- market clocks (real session hours) ----------
function parts(tz: string, d: Date) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value || '';
  const h = Number(get('hour')) % 24, m = Number(get('minute'));
  return { wd: get('weekday'), mins: h * 60 + m, hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}
const hm = (h: number, m = 0) => h * 60 + m;
function sessions(now: Date) {
  const weekend = (wd: string) => wd === 'Sat' || wd === 'Sun';
  const tk = parts('Asia/Tokyo', now), ld = parts('Europe/London', now), ny = parts('America/New_York', now), ch = parts('America/Chicago', now);
  const tkState = weekend(tk.wd) ? 'CLOSED' : tk.mins >= hm(9) && tk.mins < hm(11, 30) ? 'OPEN' : tk.mins >= hm(11, 30) && tk.mins < hm(12, 30) ? 'LUNCH' : tk.mins >= hm(12, 30) && tk.mins < hm(15, 30) ? 'OPEN' : 'CLOSED';
  const ldState = !weekend(ld.wd) && ld.mins >= hm(8) && ld.mins < hm(16, 30) ? 'OPEN' : 'CLOSED';
  const nyState = weekend(ny.wd) ? 'CLOSED' : ny.mins >= hm(9, 30) && ny.mins < hm(16) ? 'OPEN' : ny.mins >= hm(4) && ny.mins < hm(9, 30) ? 'PRE-MARKET' : ny.mins >= hm(16) && ny.mins < hm(20) ? 'AFTER-HOURS' : 'CLOSED';
  const chClosed = ch.wd === 'Sat' || (ch.wd === 'Sun' && ch.mins < hm(17)) || (ch.wd === 'Fri' && ch.mins >= hm(16)) || (ch.mins >= hm(16) && ch.mins < hm(17));
  const tone = (st: string) => (st === 'OPEN' ? C.green : st === 'CLOSED' ? C.muted : C.amber);
  return [
    { city: 'TOKYO', time: `${tk.hhmm} JST`, state: tkState },
    { city: 'LONDON', time: `${ld.hhmm} UK`, state: ldState },
    { city: 'NEW YORK', time: `${ny.hhmm} ET`, state: nyState },
    { city: 'S&P FUTURES', time: `${ch.hhmm} CT`, state: chClosed ? 'CLOSED' : 'OPEN' },
  ].map((x) => ({ ...x, color: tone(x.state) }));
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export default function Shell({ children }: { children: ReactNode }) {
  const { user, screen, go, unread, bump, toast } = useApp();
  const { width } = useWindowDimensions();
  const compact = width < 900, phone = width < 640;
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const [live, setLive] = useState(false);
  const [palette, setPalette] = useState(false);
  const [breaking, setBreaking] = useState<Breaking | null>(null);
  const showSignals = screen === 'overview' || screen === 'projections' || screen === 'conflicts';
  const dash = useApi('/dashboard');
  const busyRef = useRef(false);
  const ctxRef = useRef({ bump, toast });
  ctxRef.current = { bump, toast };

  const refresh = useCallback(async (fromLive = false) => {
    const { bump, toast } = ctxRef.current;
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api('/data/refresh', { method: 'POST' });
      if (r.feed_empty) {
        if (fromLive) setLive(false);
        toast(fromLive ? 'Live feed caught up' : "You're up to date", 'No more queued conflict events in the sample feed.');
      } else {
        const ev = r.ingested[0];
        let detail: any = {};
        try { detail = await api(`/events/${ev.id}`); } catch { /* show what we have */ }
        setBreaking({
          id: ev.id, title: ev.title, region: ev.region, level: detail.level || 'WATCH', summary: detail.summary || '',
          market_effect: detail.market_effect || '', deescalation: !!detail.deescalation,
          cri_before: r.cri_before, cri_after: r.cri_after, vol_before: r.vol_1w_before, vol_after: r.vol_1w_after, alerts: r.alerts_triggered,
        });
      }
      setSynced(true);
      setTimeout(() => setSynced(false), 1800);
      bump();
    } catch (e: any) {
      toast('Refresh failed', e.message);
      if (fromLive) setLive(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    refresh(true);
    const t = setInterval(() => refresh(true), LIVE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [live, refresh]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === '/' && !typing) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dateLine = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).toUpperCase()}  /  ${now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Los_Angeles' })} PT`;
  const plan = user?.effective_plan;

  return (
    <View style={st.safe}>
      <View style={st.rail}>
        <Pressable onPress={() => go('overview')} accessibilityLabel="ConflictVol home" style={{ width: 44, alignItems: 'center' }}><Logo size={40} /></Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.nav} style={{ flex: 1 }}>
          {NAV.map(([key, label, glyph]) => (
            <Pressable key={key} onPress={() => go(key)} accessibilityRole="link" accessibilityState={{ selected: screen === key }}
              style={({ pressed, hovered }: any) => [st.navItem, screen === key && st.navItemActive, hovered && screen !== key && { backgroundColor: C.panel2 }, pressed && { opacity: 0.7 }]}>
              <Text style={[st.navGlyph, screen === key && { color: C.lime }]}>{glyph}</Text>
              {!phone && <Text style={[st.navText, screen === key && { color: C.text }]}>{label}</Text>}
            </Pressable>
          ))}
        </ScrollView>
        <View style={st.railRight}>
          <Pressable onPress={() => go('notifications')} accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} style={[st.iconBtn, screen === 'notifications' && st.navItemActive]}>
            <BellIcon color={screen === 'notifications' ? C.lime : C.muted} />
            {unread > 0 && <View style={st.badge}><Text style={st.badgeText}>{unread}</Text></View>}
          </Pressable>
          <Pressable onPress={() => go('settings')} accessibilityRole="button" accessibilityLabel="Settings" style={[st.iconBtn, screen === 'settings' && st.navItemActive]}>
            <GearIcon color={screen === 'settings' ? C.lime : C.muted} />
          </Pressable>
          {!compact && (
            <Pressable onPress={() => go('settings')} style={st.profile}>
              <View style={st.avatar}><Text style={st.avatarText}>{initials(user?.name)}</Text></View>
              <View>
                <Text style={st.profileName} numberOfLines={1}>{user?.name}</Text>
                <Text style={st.profileRole}>{user?.plan === 'trial' && plan === 'premium' ? 'PREMIUM TRIAL' : plan === 'premium' ? 'PREMIUM' : 'FREE PLAN'}</Text>
              </View>
            </Pressable>
          )}
        </View>
        <Scanline />
      </View>
      <TickerTape events={dash.data?.top_events || []} cri={dash.data?.cri} vol={dash.data?.horizons?.find((h: any) => h.horizon === '1w')?.vol} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.main, phone && { padding: 16 }]} keyboardShouldPersistTaps="handled">
        <View style={st.topbar}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Text style={st.eyebrow}>{dateLine}</Text>
            <Text style={st.pageTitle}>{TITLES[screen]}</Text>
          </View>
          <View style={st.topActions}>
            {DEMO && <Pill tone="cyan">DEMO MODE</Pill>}
            <Pill tone="neutral">SAMPLE DATA FEED</Pill>
            {!phone && (
              <Pressable onPress={() => setPalette(true)} accessibilityRole="button" accessibilityLabel="Open command palette"
                style={({ hovered }: any) => [st.search, hovered && { borderColor: '#5A6157', backgroundColor: C.panel }]}>
                <Text style={{ color: C.muted, fontSize: 14 }}>⌕</Text>
                <Text style={st.searchText}>Search or jump to…</Text>
                <Text style={st.shortcut}>⌘ K</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setLive((l) => !l)} accessibilityRole="switch" accessibilityState={{ checked: live }}
              accessibilityLabel={live ? 'Stop live feed' : 'Start live feed'} style={[st.liveBtn, live && st.liveOn]}>
              {live ? <Breathe min={0.25} duration={600}><View style={st.liveDotOn} /></Breathe> : <View style={[st.liveDotOn, { backgroundColor: C.muted }]} />}
              <Text style={[st.refreshText, { color: live ? C.coral : C.text }]}>{live ? 'LIVE' : 'GO LIVE'}</Text>
            </Pressable>
            <Pressable onPress={() => refresh(false)} disabled={busy} accessibilityRole="button" accessibilityLabel="Refresh data: ingest new events, re-run the projection and check alerts"
              style={({ pressed }) => [st.refresh, pressed && { opacity: 0.65 }]}>
              <Text style={st.refreshText}>{busy ? 'SYNCING' : synced ? 'SYNCED' : 'REFRESH'} <Text style={{ color: synced ? C.lime : C.muted }}>↻</Text></Text>
            </Pressable>
          </View>
        </View>

        {showSignals && (
          <>
            <View style={st.banner}>
              <View style={st.liveDot} />
              <Text style={st.bannerLabel}>LIVE SIGNALS</Text>
              <Text style={st.bannerText} numberOfLines={2}>{dash.data?.headline || 'Loading the latest conflict signals…'}</Text>
              {screen !== 'conflicts' && (
                <Pressable onPress={() => go('conflicts')}><Text style={st.bannerLink}>View drivers ↗</Text></Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={st.clocks}>
              <View style={st.clockHeading}><Text style={st.clockLabel}>GLOBAL MARKET CLOCKS</Text><Text style={st.clockMeta}>SESSION STATUS</Text></View>
              {sessions(now).map((x) => (
                <View key={x.city} style={{ minWidth: 108 }}>
                  <Text style={st.clockCity}>{x.city}</Text>
                  <Text style={st.clockTime}>{x.time}</Text>
                  <Text style={[st.clockState, { color: x.color }]}>{x.state}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
        <View style={{ marginTop: 20 }}>{children}</View>
        <Text style={st.footer}>ConflictVol projections are statistical estimates for research and education, not investment advice. Data shown comes from the bundled sample feed.</Text>
      </ScrollView>
      <BreakingOverlay item={breaking} onClose={() => setBreaking(null)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onRefresh={() => refresh(false)} live={live} onToggleLive={() => setLive((l) => !l)} />
      <Toasts />
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.ink },
  rail: { zIndex: 5, height: 64, backgroundColor: C.rail, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  nav: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  navItem: { minHeight: 34, borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  navItemActive: { backgroundColor: C.raised },
  navGlyph: { color: C.muted, fontSize: 15, width: 16, textAlign: 'center' },
  navText: { color: C.muted, fontFamily: F.semi, fontSize: 11.5 },
  railRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: C.ink, fontFamily: F.bold, fontSize: 9 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 10, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: C.line, maxWidth: 190 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  avatarText: { fontFamily: F.bold, fontSize: 10, color: C.lime },
  profileName: { fontFamily: F.semi, fontSize: 11, color: C.text, maxWidth: 130 },
  profileRole: { fontFamily: F.bold, fontSize: 7.5, color: C.muted, letterSpacing: 0.7, marginTop: 2 },
  main: { padding: 32, paddingBottom: 60, maxWidth: 1480, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { color: C.muted, fontFamily: F.bold, fontSize: 9, letterSpacing: 1.1 },
  pageTitle: { color: C.text, fontFamily: F.semi, fontSize: 28, letterSpacing: -1, marginTop: 10 },
  topActions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  search: { height: 34, borderWidth: 1, borderColor: C.line, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, width: 210 },
  searchText: { flex: 1, color: C.muted, fontFamily: F.regular, fontSize: 11 },
  shortcut: { color: C.muted, fontFamily: F.bold, fontSize: 8, borderWidth: 1, borderColor: C.line, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  liveBtn: { height: 34, borderRadius: 4, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveOn: { borderColor: C.coralLine, backgroundColor: C.coralBg, boxShadow: `0 0 18px -4px ${C.coral}` } as any,
  liveDotOn: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral },
  refresh: { height: 34, borderRadius: 4, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, justifyContent: 'center' },
  refreshText: { color: C.text, fontFamily: F.bold, fontSize: 9.5, letterSpacing: 0.7 },
  banner: { marginTop: 24, minHeight: 46, borderWidth: 1, borderColor: '#575E54', backgroundColor: '#323634', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  liveDot: { width: 8, height: 8, borderRadius: 1, backgroundColor: C.coral, transform: [{ rotate: '45deg' }] },
  bannerLabel: { color: C.coral, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.7 },
  bannerText: { flex: 1, minWidth: 220, color: '#CACFC6', fontFamily: F.regular, fontSize: 12 },
  bannerLink: { color: C.cyan, fontFamily: F.semi, fontSize: 11 },
  clocks: { minHeight: 50, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 18, flexGrow: 1 },
  clockHeading: { width: 130, borderRightWidth: 1, borderRightColor: C.line, paddingRight: 12 },
  clockLabel: { color: C.text, fontFamily: F.bold, fontSize: 8, letterSpacing: 0.7 },
  clockMeta: { color: C.muted, fontFamily: F.regular, fontSize: 8, marginTop: 3 },
  clockCity: { color: C.muted, fontFamily: F.bold, fontSize: 7.5, letterSpacing: 0.7 },
  clockTime: { color: C.text, fontFamily: F.semi, fontSize: 11.5, marginTop: 3 },
  clockState: { fontFamily: F.bold, fontSize: 7.5, letterSpacing: 0.5, marginTop: 2 },
  footer: { color: C.faint, fontFamily: F.regular, fontSize: 10.5, marginTop: 28 },
});
