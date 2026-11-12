import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Btn, Card, Chips, Empty, ErrorState, Eyebrow, Field, H3, Loading, Muted, PageHead, Pill, Seg, Sheet, Toggle } from '../components/ui';
import { C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

const METRICS: [string, string, string][] = [
  ['vol_1w', '1-WEEK VOL', 'Most popular. Fires when the weekly volatility outlook crosses your level.'],
  ['vol_1d', 'NEXT-DAY VOL', 'Next-day projected volatility.'],
  ['vol_1m', '1-MONTH VOL', '1-month projected volatility.'],
  ['cri', 'RISK INDEX', '0–100 composite of every active conflict event.'],
  ['exposure', 'SECTOR', "0–100 sensitivity of one sector to current conflicts."],
];
const unitOf = (m: string) => (m.startsWith('vol_') ? '%' : '');
const currentFor = (cur: any, metric: string, target: string) => (cur ? (metric === 'exposure' ? cur.exposure?.[target] : cur[metric]) : null);

function AlertForm({ open, initial, options, current, onClose, onSaved }: any) {
  const { toast } = useApp();
  const blank = { name: '', metric: 'vol_1w', target: 'Energy', operator: 'above', threshold: '', channel: 'in_app' };
  const [f, setF] = useState<any>(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(initial ? { ...initial, target: initial.metric === 'exposure' ? initial.target : 'Energy', threshold: String(initial.threshold) } : blank);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = currentFor(current, f.metric, f.target);
  const t = parseFloat(f.threshold);
  const wouldFire = cur !== null && cur !== undefined && !Number.isNaN(t) && (f.operator === 'above' ? cur > t : cur < t);
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function save() {
    setErr('');
    if (!f.name.trim()) return setErr("Give your alert a name so you'll recognize it.");
    if (Number.isNaN(t) || t <= 0) return setErr('Enter a threshold greater than zero.');
    setBusy(true);
    try {
      const res = initial
        ? await api(`/alerts/${initial.id}`, { method: 'PATCH', body: { name: f.name, threshold: t, operator: f.operator, channel: f.channel } })
        : await api('/alerts', { method: 'POST', body: { name: f.name, metric: f.metric, target: f.target, operator: f.operator, threshold: t, channel: f.channel } });
      toast(initial ? 'Alert updated' : 'Alert created', res.fired_now ? "It's already past your threshold, so we sent a notification right away." : "We'll notify you when it crosses your threshold.");
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'Edit alert' : 'New volatility alert'}
      footer={<><Btn label="CANCEL" onPress={onClose} /><Btn kind="primary" label={busy ? 'SAVING…' : initial ? 'SAVE CHANGES' : 'CREATE ALERT'} onPress={save} disabled={busy} /></>}>
      {err ? <View style={st.error}><Text style={{ color: C.coral, fontFamily: F.semi, fontSize: 12 }}>{err}</Text></View> : null}
      <Field label="Alert name" value={f.name} onChangeText={set('name')} placeholder="e.g. Weekly volatility spike" />
      <View style={{ gap: 6 }}>
        <Text style={st.label}>Watch</Text>
        {initial ? <Pill tone="cyan">{METRICS.find((m) => m[0] === f.metric)?.[1] || f.metric}</Pill>
          : <Chips value={f.metric} onChange={set('metric')} options={METRICS.map(([k, l]) => [k, l] as [string, string])} />}
        <Muted style={{ fontSize: 11 }}>{METRICS.find((m) => m[0] === f.metric)?.[2]}</Muted>
      </View>
      {f.metric === 'exposure' && !initial && (
        <View style={{ gap: 6 }}>
          <Text style={st.label}>Sector</Text>
          <Chips value={f.target} onChange={set('target')} options={(options?.sectors || []).map((s: string) => [s, s.toUpperCase()] as [string, string])} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <View style={{ gap: 6 }}>
          <Text style={st.label}>Notify me when it goes</Text>
          <Seg value={f.operator} onChange={set('operator')} options={[['above', 'ABOVE'], ['below', 'BELOW']]} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={`Threshold${unitOf(f.metric) ? ' (%)' : ''}`} value={f.threshold} onChangeText={set('threshold')} keyboardType="decimal-pad"
            placeholder={cur !== null && cur !== undefined ? String(Math.round(cur + 2)) : '20'} />
        </View>
      </View>
      <View style={[st.preview, wouldFire && { borderColor: C.amberLine, backgroundColor: '#3A3022' }]}>
        <Text style={{ color: wouldFire ? C.amber : C.cyan, fontFamily: F.regular, fontSize: 12 }}>
          Right now it's <Text style={{ fontFamily: F.bold }}>{cur !== null && cur !== undefined ? `${fmt.num(cur)}${unitOf(f.metric)}` : '—'}</Text>.
          {f.threshold && !Number.isNaN(t) ? (wouldFire ? ' This alert would fire immediately.' : " You'll be notified when it crosses your threshold.") : ''}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={st.label}>Deliver to</Text>
        <Seg value={f.channel} onChange={set('channel')} options={[['in_app', 'IN-APP'], ['email', 'EMAIL + IN-APP']]} />
      </View>
    </Sheet>
  );
}

export default function Alerts() {
  const { toast, bump, user, go } = useApp();
  const { data, error, loading, reload } = useApi('/alerts');
  const [form, setForm] = useState<{ open: boolean; initial: any }>({ open: false, initial: null });
  const [confirm, setConfirm] = useState<any>(null);

  async function toggle(a: any, active: boolean) {
    try {
      const r = await api(`/alerts/${a.id}`, { method: 'PATCH', body: { active } });
      if (r.fired_now) toast('Alert re-activated', "It's already past your threshold, so a notification was sent.");
      reload(); bump();
    } catch (e: any) { toast("Couldn't update alert", e.message); }
  }
  async function remove(a: any) {
    setConfirm(null);
    try { await api(`/alerts/${a.id}`, { method: 'DELETE' }); toast('Alert deleted', a.name); reload(); } catch (e: any) { toast("Couldn't delete alert", e.message); }
  }
  async function test(a: any) {
    try { await api(`/alerts/${a.id}/test`, { method: 'POST' }); toast('Test notification sent', a.channel === 'email' ? `Check ${user.email} and Notifications.` : 'Check Notifications.'); bump(); }
    catch (e: any) { toast('Test failed', e.message); }
  }

  if (loading && !data) return <Loading label="Loading alerts" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const atLimit = data.limit !== null && data.alerts.length >= data.limit;

  return (
    <View>
      <PageHead eyebrow="CONFIGURE · NOTIFY" title="Volatility alerts"
        sub="Get notified when projected volatility, the Conflict Risk Index or a sector's exposure crosses your level. Alerts are checked every time new data comes in."
        right={<Btn kind="primary" label="+ NEW ALERT" onPress={() => setForm({ open: true, initial: null })} disabled={atLimit} />} />
      {atLimit && (
        <View style={[st.preview, { marginBottom: 14, borderColor: C.amberLine }]}>
          <Text style={{ color: C.amber, fontFamily: F.regular, fontSize: 12 }}>
            The Free plan includes {data.limit} alert. <Text style={{ fontFamily: F.bold, textDecorationLine: 'underline' }} onPress={() => go('settings')}>Upgrade to Premium</Text> for unlimited alerts and email delivery.
          </Text>
        </View>
      )}
      {data.alerts.length === 0 ? (
        <Card><Empty title="No alerts yet" body={`Most people start with a 1-week volatility alert a few points above today's level (${fmt.pct(data.current.vol_1w)}).`}
          action={<Btn kind="primary" label="CREATE YOUR FIRST ALERT" onPress={() => setForm({ open: true, initial: null })} />} /></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {data.alerts.map((a: any) => {
            const unit = unitOf(a.metric);
            const v = a.current_value ?? 0;
            const scale = Math.max(a.threshold, v) * 1.25 || 1;
            return (
              <Card key={a.id} pad={16} style={!a.active ? { opacity: 0.6 } : undefined}>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 260 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <H3>{a.name}</H3>
                      {a.active && a.triggered ? <Pill tone="coral">ABOVE THRESHOLD</Pill> : a.active ? <Pill tone="green">WATCHING</Pill> : <Pill>PAUSED</Pill>}
                      <Pill tone="cyan">{a.channel === 'email' ? 'EMAIL' : 'IN-APP'}</Pill>
                    </View>
                    <Muted style={{ marginTop: 4 }}>
                      {a.metric === 'exposure' ? `${a.target} exposure score` : a.metric_label} {a.operator} <Text style={{ color: C.text, fontFamily: F.bold }}>{a.threshold}{unit}</Text>
                      {' · '}now <Text style={{ color: C.text, fontFamily: F.bold }}>{fmt.num(a.current_value)}{unit}</Text>
                      {a.last_triggered_at ? ` · last fired ${fmt.ago(a.last_triggered_at)} ago` : ''}
                    </Muted>
                    <View style={st.meter}>
                      <View style={{ width: `${Math.min(100, (v / scale) * 100)}%`, height: '100%', backgroundColor: a.triggered ? C.coral : C.cyan, borderRadius: 4 }} />
                      <View style={{ position: 'absolute', top: -4, width: 2, height: 14, backgroundColor: C.lime, left: `${(a.threshold / scale) * 100}%` }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Toggle value={a.active} onChange={(on) => toggle(a, on)} label={a.active ? 'Pause alert' : 'Activate alert'} />
                    <Btn small label="TEST" onPress={() => test(a)} />
                    <Btn small label="EDIT" onPress={() => setForm({ open: true, initial: a })} />
                    <Btn small kind="danger" label="DELETE" onPress={() => setConfirm(a)} />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
      <Card style={{ marginTop: 16 }}>
        <Eyebrow>CURRENT LEVELS</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 32, marginTop: 10, flexWrap: 'wrap' }}>
          {[['Next-day vol', data.current.vol_1d, '%'], ['1-week vol', data.current.vol_1w, '%'], ['1-month vol', data.current.vol_1m, '%'], ['Risk index', data.current.cri, '']].map(([l, v, u]) => (
            <View key={l as string}><Muted>{l}</Muted><Text style={{ color: C.text, fontFamily: F.semi, fontSize: 20 }}>{fmt.num(v)}{u}</Text></View>
          ))}
        </View>
      </Card>
      <AlertForm open={form.open} initial={form.initial} options={data.options} current={data.current}
        onClose={() => setForm({ open: false, initial: null })} onSaved={() => { reload(); bump(); }} />
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Delete alert?" width={440}
        footer={<><Btn label="CANCEL" onPress={() => setConfirm(null)} /><Btn kind="coral" label="DELETE" onPress={() => remove(confirm)} /></>}>
        <Muted>"{confirm?.name}" will stop watching and can't be restored. Past notifications stay in your inbox.</Muted>
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  label: { color: C.cyan, fontFamily: F.bold, fontSize: 9.5, letterSpacing: 0.9, textTransform: 'uppercase' },
  error: { backgroundColor: C.coralBg, borderColor: C.coralLine, borderWidth: 1, borderRadius: 8, padding: 10 },
  preview: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 11, backgroundColor: C.panel2 },
  meter: { height: 6, backgroundColor: C.ink, borderRadius: 4, marginTop: 12 },
});
