import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { api, DEMO } from '../api/client';
import { Btn, Eyebrow, Field, Logo, Muted, Pill, Seg, Toasts } from '../components/ui';
import { C, F } from '../theme';
import { useApp } from '../state';

const DEMO_EMAIL = 'demo@conflictvol.app';
const DEMO_PASSWORD = 'Demo1234!';

export default function Auth() {
  const { signIn, toast } = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (mode === 'register' && !name.trim()) e.name = 'Enter your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (mode === 'register' ? password.length < 8 : !password) e.password = mode === 'register' ? 'Use at least 8 characters.' : 'Enter your password.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    setError('');
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        signIn(await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } }));
      } else {
        signIn(await api('/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim(), password } }));
        toast('Your Premium trial has started', 'You have 14 days of full access. Follow a few companies and set your first alert.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      <ScrollView contentContainerStyle={[st.wrap, !wide && { flexDirection: 'column' }]}>
        <View style={[st.side, !wide && { minHeight: 0, paddingBottom: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Logo size={46} />
            <Text style={st.brand}>ConflictVol</Text>
          </View>
          <View style={{ gap: 18, marginTop: wide ? 0 : 24 }}>
            <Eyebrow style={{ color: C.lime }}>GEOPOLITICAL RISK, QUANTIFIED</Eyebrow>
            <Text style={[st.hero, !wide && { fontSize: 30 }]}>See conflict-driven volatility before the market prices it in.</Text>
            <Text style={st.lede}>
              ConflictVol tracks armed conflicts, sanctions and maritime incidents worldwide, scores how much each one matters to
              markets, and turns that into a short-term S&amp;P 500 volatility range you can actually understand.
            </Text>
            {wide && (
              <View style={{ gap: 12, marginTop: 6 }}>
                {[
                  ['01', 'Projections', '1-day, 1-week and 1-month volatility ranges with a plain-language rationale.'],
                  ['02', 'Conflict monitor', 'Every event mapped to countries, industries and the companies you follow.'],
                  ['03', 'Alerts', 'Get notified when volatility, the risk index or a sector crosses your level.'],
                ].map(([n, t, d]) => (
                  <View key={n} style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ color: C.coral, fontFamily: F.bold, fontSize: 11 }}>{n}</Text>
                    <View style={{ flex: 1 }}><Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13 }}>{t}</Text><Muted>{d}</Muted></View>
                  </View>
                ))}
              </View>
            )}
          </View>
          {wide && <Muted style={{ fontSize: 11 }}>Built by Candace Tanielian, Alex Broy and Reim Nouh.</Muted>}
        </View>

        <View style={st.formWrap}>
          <View style={st.form}>
            <Seg value={mode} onChange={(m) => { setMode(m); setError(''); setErrors({}); }}
              options={[['login', 'SIGN IN'], ['register', 'CREATE ACCOUNT']]} />
            <View>
              <Text style={st.formTitle}>{mode === 'login' ? 'Welcome back' : 'Start your 14-day Premium trial'}</Text>
              <Muted style={{ marginTop: 4 }}>{mode === 'login' ? 'Sign in to your ConflictVol account.' : 'No credit card required.'}</Muted>
            </View>
            {error ? <View style={st.error} accessibilityRole="alert"><Text style={st.errorText}>{error}</Text></View> : null}
            {mode === 'register' && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" error={errors.name} />}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'password' : 'new-password'}
              error={errors.password} hint={mode === 'register' ? 'At least 8 characters.' : undefined} onSubmitEditing={submit} />
            <Btn kind="primary" label={busy ? 'PLEASE WAIT…' : mode === 'login' ? 'SIGN IN  →' : 'CREATE ACCOUNT  →'} onPress={submit} disabled={busy} style={{ minHeight: 44 }} />
            <View style={st.demo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pill tone="limeSoft">DEMO</Pill>
                <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 12 }}>Just looking?</Text>
              </View>
              <Muted>Explore with the demo account and sample data{DEMO ? ' (this hosted version runs entirely in your browser)' : ''}.</Muted>
              <Pressable onPress={() => { setMode('login'); setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setErrors({}); }} accessibilityRole="button">
                <Text style={{ color: C.lime, fontFamily: F.bold, fontSize: 11, letterSpacing: 0.5 }}>FILL DEMO CREDENTIALS  ·  {DEMO_EMAIL}</Text>
              </Pressable>
            </View>
            <Muted style={{ fontSize: 10.5 }}>ConflictVol provides statistical estimates for research and education. It is not investment advice.</Muted>
          </View>
        </View>
      </ScrollView>
      <Toasts />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, flexDirection: 'row' },
  side: { flex: 1, minHeight: 640, padding: 44, justifyContent: 'space-between', backgroundColor: C.rail, borderRightWidth: 1, borderRightColor: C.line },
  brand: { color: C.text, fontFamily: F.bold, fontSize: 20, letterSpacing: -0.5 },
  hero: { color: C.text, fontFamily: F.semi, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, maxWidth: 560 },
  lede: { color: '#CACFC6', fontFamily: F.regular, fontSize: 14, lineHeight: 22, maxWidth: 540 },
  formWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  form: { width: '100%', maxWidth: 400, gap: 16 },
  formTitle: { color: C.text, fontFamily: F.semi, fontSize: 24, letterSpacing: -0.6 },
  error: { backgroundColor: C.coralBg, borderColor: C.coralLine, borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: C.coral, fontFamily: F.semi, fontSize: 12 },
  demo: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 10, padding: 14, gap: 8, backgroundColor: C.panel },
});
