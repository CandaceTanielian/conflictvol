import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api, API_URL, DEMO } from '../api/client';
import WatchlistEditor from '../components/WatchlistEditor';
import { Btn, Card, Eyebrow, Field, H3, Muted, PageHead, Pill, Toggle } from '../components/ui';
import { C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

const PLANS = [
  { key: 'free', name: 'Free', price: '$0', items: ['Delayed projections', '3 archive episodes', '1 alert (in-app)'] },
  { key: 'premium', name: 'Premium', price: '$12.99/mo', items: ['Real-time projections', 'Full historical archive', 'Unlimited alerts + email', 'Ticker-level exposure'] },
];

export default function Settings() {
  const { user, setUser, signOut, toast, bump } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = useApi('/data/status');
  const watch = useApi('/watchlist');
  useEffect(() => setName(user?.name || ''), [user?.name]);

  const onTrial = user?.plan === 'trial' && user?.effective_plan === 'premium';
  const daysLeft = onTrial ? Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / 864e5)) : 0;
  const active = user?.plan === 'trial' ? user.effective_plan : user?.plan;

  async function saveProfile() {
    if (!name.trim()) return toast("Name can't be empty", "Enter the name you'd like to use.");
    setSaving(true);
    try { setUser(await api('/account', { method: 'PATCH', body: { name } })); toast('Profile saved'); }
    catch (e: any) { toast("Couldn't save", e.message); } finally { setSaving(false); }
  }
  async function emailAlerts(on: boolean) {
    try { setUser(await api('/account', { method: 'PATCH', body: { email_alerts: on } })); } catch (e: any) { toast("Couldn't save", e.message); }
  }
  async function choose(plan: string) {
    if (plan === user.plan) return;
    try {
      setUser(await api('/account/plan', { method: 'POST', body: { plan } })); bump();
      toast(plan === 'premium' ? 'Welcome to Premium' : 'Switched to Free', plan === 'premium' ? 'Every feature is now unlocked.' : 'You can upgrade again anytime.');
    } catch (e: any) { toast("Couldn't change plan", e.message); }
  }
  async function resetDemo() { await api('/demo/reset', { method: 'POST' }); signOut(); }

  return (
    <View>
      <PageHead eyebrow="ACCOUNT" title={user?.name || 'Settings'} sub="Profile, followed companies, notification preferences and plan." />
      <View style={[st.cols, !wide && { flexDirection: 'column' }]}>
        <View style={{ flex: 1, gap: 16, width: wide ? undefined : '100%' }}>
          <Card style={{ gap: 14 }}>
            <H3>Profile</H3>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Email" value={user?.email || ''} editable={false} hint={`Member since ${user?.created_at ? fmt.date(user.created_at) : '—'}`} />
            <Btn kind="primary" label={saving ? 'SAVING…' : 'SAVE CHANGES'} onPress={saveProfile} disabled={saving || name === user?.name} style={{ alignSelf: 'flex-start' }} />
          </Card>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H3>Followed companies</H3>
              <Btn small label="EDIT" onPress={() => setEditing(true)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(watch.data?.items || []).map((w: any) => <Pill key={w.ticker} tone="limeSoft">{`★ ${w.ticker}`}</Pill>)}
              {watch.data && !watch.data.items.length && <Muted>Not following any companies yet.</Muted>}
            </View>
          </Card>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <H3>Email alerts</H3>
              <Muted>Send alerts set to "Email + in-app" to {user?.email}.</Muted>
            </View>
            <Toggle value={!!user?.email_alerts} onChange={emailAlerts} label="Email alerts" />
          </Card>
          <Card pad={0}>
            <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: C.line }}><H3>Data sources</H3><Muted>External systems ConflictVol connects to</Muted></View>
            {(status.data?.sources || []).map((x: any) => (
              <View key={x.name} style={st.row}>
                <View style={{ flex: 1 }}><Text style={st.rowTitle}>{x.name}</Text><Muted style={{ fontSize: 11 }}>{x.provider}</Muted></View>
                <Pill tone={x.mode === 'live' ? 'green' : 'neutral'}>{x.mode === 'live' ? 'LIVE' : 'SAMPLE'}</Pill>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ flex: 1, gap: 16, width: wide ? undefined : '100%' }}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H3>Plan</H3>
              {onTrial && <Pill tone="amber">{`PREMIUM TRIAL · ${daysLeft} DAYS LEFT`}</Pill>}
            </View>
            {PLANS.map((p) => {
              const on = active === p.key;
              return (
                <Pressable key={p.key} onPress={() => choose(p.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={[st.plan, on && st.planOn]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15 }}>{p.name}</Text>
                    <Text style={{ color: on ? C.lime : C.muted, fontFamily: F.semi, fontSize: 13 }}>{p.price}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                    {p.items.map((i) => <Text key={i} style={{ color: C.muted, fontFamily: F.regular, fontSize: 11.5 }}>✓ {i}</Text>)}
                  </View>
                  {on && <Text style={{ color: C.faint, fontFamily: F.regular, fontSize: 11, marginTop: 8 }}>{onTrial && p.key === 'premium' ? 'Active on trial. Choose Premium to keep it after the trial.' : 'Current plan'}</Text>}
                </Pressable>
              );
            })}
            <Muted style={{ fontSize: 11 }}>Billing is not connected in this version; plan changes apply instantly.</Muted>
          </Card>
          <Card style={{ gap: 10 }}>
            <Eyebrow>SESSION</Eyebrow>
            <Btn label="SIGN OUT" onPress={signOut} />
            {!DEMO && <Btn kind="ghost" label="DEVELOPER API DOCS ↗" onPress={() => Linking.openURL(`${API_URL}/docs`)} />}
            {DEMO && <Btn kind="ghost" label="RESET DEMO DATA" onPress={resetDemo} />}
          </Card>
        </View>
      </View>
      <WatchlistEditor open={editing} onClose={() => setEditing(false)} onSaved={watch.reload} />
    </View>
  );
}

const st = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  rowTitle: { color: C.text, fontFamily: F.semi, fontSize: 12.5 },
  plan: { borderWidth: 1.5, borderColor: C.line, borderRadius: 10, padding: 14, backgroundColor: C.panel2 },
  planOn: { borderColor: C.lime, backgroundColor: C.limeBg },
});
