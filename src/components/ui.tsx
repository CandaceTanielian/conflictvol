import { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, TextInputProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { C, F, sevColor } from '../theme';
import { useApp } from '../state';

const logoWhite = require('../../public/conflictvol-logo-white.png');
const signalMap = require('../../public/conflictvol-signal-map.png');

type TProps = { children?: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean };
const mk = (base: TextStyle) => ({ children, style, ...rest }: TProps) => <Text style={[base, style]} {...rest}>{children}</Text>;

export const Eyebrow = mk({ color: C.muted, fontFamily: F.bold, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' });
export const H1 = mk({ color: C.text, fontFamily: F.semi, fontSize: 28, letterSpacing: -1 });
export const H2 = mk({ color: C.text, fontFamily: F.semi, fontSize: 20, letterSpacing: -0.5 });
export const H3 = mk({ color: C.text, fontFamily: F.semi, fontSize: 15 });
export const Body = mk({ color: '#CACFC6', fontFamily: F.regular, fontSize: 13, lineHeight: 20 });
export const Muted = mk({ color: C.muted, fontFamily: F.regular, fontSize: 12, lineHeight: 18 });
export const Num = mk({ color: C.text, fontFamily: F.semi, fontVariant: ['tabular-nums'] });
export const Strong = mk({ color: C.text, fontFamily: F.semi, fontSize: 13 });

export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={logoWhite} style={{ width: size, height: size, resizeMode: 'contain' }} accessibilityLabel="ConflictVol logo" />;
}
export function SignalMapIcon({ size = 24 }: { size?: number }) {
  return <Image source={signalMap} style={{ width: size, height: size, resizeMode: 'contain' }} accessibilityLabel="" />;
}

export function Card({ children, style, pad = 20 }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  return <View style={[s.card, { padding: pad }, style]}>{children}</View>;
}

const PILL: Record<string, { bg: string; border: string; color: string }> = {
  lime: { bg: C.lime, border: C.lime, color: C.ink },
  limeSoft: { bg: C.limeBg, border: '#55602F', color: C.lime },
  coral: { bg: 'transparent', border: C.coralLine, color: C.coral },
  amber: { bg: 'transparent', border: C.amberLine, color: C.amber },
  green: { bg: 'transparent', border: '#3D6A4D', color: C.green },
  neutral: { bg: 'transparent', border: C.line, color: C.muted },
  cyan: { bg: 'transparent', border: '#5A6157', color: C.cyan },
  solidCoral: { bg: C.coral, border: C.coral, color: C.ink },
};
export function Pill({ children, tone = 'neutral', style }: { children: ReactNode; tone?: string; style?: StyleProp<ViewStyle> }) {
  const p = PILL[tone] || PILL.neutral;
  return (
    <View style={[s.pill, { backgroundColor: p.bg, borderColor: p.border }, style]}>
      <Text style={[s.pillText, { color: p.color }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}
export const toneForLevel = (l: string) => (l === 'HIGH' ? 'coral' : l === 'WATCH' ? 'amber' : 'green');
export const toneForBias = (b: string) => (b === 'tailwind' ? 'green' : b === 'headwind' ? 'coral' : 'amber');
export const toneForRegime = (r: string) => (r === 'Calm' ? 'green' : r === 'Elevated' ? 'amber' : 'coral');

export function LevelPill({ level }: { level: string }) {
  if (level === 'HIGH') return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><SignalMapIcon size={20} /><Pill tone="coral">HIGH</Pill></View>;
  return <Pill tone={toneForLevel(level)}>{level}</Pill>;
}

export function Sev({ value }: { value: number }) {
  return (
    <View style={[s.sev, { backgroundColor: sevColor(value) + '26', borderColor: sevColor(value) + '88' }]}>
      <Text style={[s.sevText, { color: sevColor(value) }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

type BtnProps = { label: string; onPress?: () => void; kind?: 'primary' | 'outline' | 'ghost' | 'danger' | 'coral'; small?: boolean; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };
export function Btn({ label, onPress, kind = 'outline', small, disabled, icon, style, accessibilityLabel }: BtnProps) {
  const bg = kind === 'primary' ? C.lime : kind === 'coral' ? C.coral : 'transparent';
  const color = kind === 'primary' || kind === 'coral' ? C.ink : kind === 'danger' ? C.coral : C.text;
  const border = kind === 'ghost' ? 'transparent' : kind === 'primary' ? C.lime : kind === 'coral' ? C.coral : C.line;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} disabled={disabled} onPress={onPress}
      style={({ pressed, hovered }: any) => [s.btn, small && s.btnSmall, { backgroundColor: bg, borderColor: border },
        hovered && kind !== 'primary' && kind !== 'coral' && { backgroundColor: C.raised }, pressed && s.pressed, disabled && { opacity: 0.45 }, style]}>
      {icon ? <Text style={[s.btnText, { color, fontSize: small ? 12 : 13 }]}>{icon}</Text> : null}
      {label ? <Text style={[s.btnText, { color }, small && { fontSize: 10.5 }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function Bar({ value, color = C.lime, height = 5, style }: { value: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, backgroundColor: C.lineSoft, borderRadius: height, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Seg<T extends string>({ options, value, onChange, style }: { options: [T, string][]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.seg, style]} accessibilityRole="tablist">
      {options.map(([k, l]) => (
        <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: value === k }} onPress={() => onChange(k)}
          style={[s.segItem, value === k && s.segItemOn]}>
          <Text style={[s.segText, value === k && { color: C.text }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map(([k, l]) => (
        <Pressable key={k || 'all'} onPress={() => onChange(k)} style={[s.chip, value === k && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: value === k }}>
          <Text style={[s.chipText, value === k && { color: C.text }]}>{l}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} style={[s.input, error ? { borderColor: C.coral } : null, style]} accessibilityLabel={label} {...props} />
      {error ? <Text style={[s.hint, { color: C.coral }]}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
      trackColor={{ false: C.line, true: '#7E8F37' }} thumbColor={value ? C.lime : '#C9CCC4'}
      {...({ activeThumbColor: C.lime } as any)} />
  );
}

export function Sheet({ open, onClose, title, children, footer, width = 560 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close dialog">
        <Pressable style={[s.sheet, { maxWidth: width }]} onPress={() => {}}>
          <View style={s.sheetHead}>
            <H2 style={{ fontSize: 18, flex: 1 }}>{title}</H2>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ padding: 6 }}><Text style={{ color: C.muted, fontSize: 18 }}>✕</Text></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: 20, gap: 14 }}>{children}</ScrollView>
          {footer ? <View style={s.sheetFoot}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <View style={s.toasts} pointerEvents="none" accessibilityLiveRegion="polite" testID="toasts">
      {toasts.map((t) => (
        <View key={t.id} style={s.toast}>
          <Text style={[s.toastTitle]}>{t.title}</Text>
          {t.body ? <Text style={s.toastBody}>{t.body}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Lock({ title, body, onUpgrade }: { title: string; body?: string; onUpgrade: () => void }) {
  return (
    <View style={s.lock}>
      <Pill tone="lime">PREMIUM</Pill>
      <H3 style={{ fontSize: 17, textAlign: 'center' }}>{title}</H3>
      {body ? <Muted style={{ textAlign: 'center', maxWidth: 380 }}>{body}</Muted> : null}
      <Btn kind="primary" label="UPGRADE TO PREMIUM" onPress={onUpgrade} />
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <View style={{ padding: 60, alignItems: 'center', gap: 12 }}><ActivityIndicator color={C.lime} /><Eyebrow>{label}</Eyebrow></View>;
}

export function ErrorState({ error, onRetry }: { error: any; onRetry?: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
      <Text style={{ color: C.coral, fontSize: 22 }}>!</Text>
      <H3>We couldn't load this right now</H3>
      <Muted style={{ textAlign: 'center' }}>{error?.message || 'Check your connection and try again.'}</Muted>
      {onRetry ? <Btn label="TRY AGAIN" onPress={onRetry} small /> : null}
    </Card>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20 }}>
      <H3>{title}</H3>
      {body ? <Muted style={{ textAlign: 'center', maxWidth: 420 }}>{body}</Muted> : null}
      {action}
    </View>
  );
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={s.pageHead}>
      <View style={{ flex: 1, minWidth: 260 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2 style={{ fontSize: 24, marginTop: 8 }}>{title}</H2>
        {sub ? <Muted style={{ marginTop: 6, maxWidth: 700, fontSize: 12.5 }}>{sub}</Muted> : null}
      </View>
      {right}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: C.line, marginVertical: 14 }} />;

export const s = StyleSheet.create({
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  sev: { alignSelf: 'flex-start', minWidth: 38, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  sevText: { fontFamily: F.bold, fontSize: 11 },
  btn: { minHeight: 34, borderRadius: 6, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnSmall: { minHeight: 28, paddingHorizontal: 10 },
  btnText: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.7 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  seg: { flexDirection: 'row', backgroundColor: C.ink, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 3, gap: 2, alignSelf: 'flex-start' },
  segItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  segItemOn: { backgroundColor: C.raised },
  segText: { color: C.muted, fontFamily: F.bold, fontSize: 10, letterSpacing: 0.6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.raised, borderColor: '#5A6157' },
  chipText: { color: C.muted, fontFamily: F.bold, fontSize: 10, letterSpacing: 0.6 },
  fieldLabel: { color: C.cyan, fontFamily: F.bold, fontSize: 9.5, letterSpacing: 0.9, textTransform: 'uppercase' },
  input: { height: 40, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, color: C.text, fontFamily: F.regular, fontSize: 13, backgroundColor: C.ink },
  hint: { color: C.muted, fontFamily: F.regular, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,9,9,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  sheet: { width: '100%', backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetFoot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.rail },
  toasts: { position: 'absolute', right: 20, bottom: 20, gap: 10, zIndex: 100, maxWidth: 380 },
  toast: { backgroundColor: C.panel2, borderWidth: 1, borderColor: '#5A6157', borderLeftWidth: 3, borderLeftColor: C.lime, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16 },
  toastTitle: { color: C.text, fontFamily: F.bold, fontSize: 12.5, marginBottom: 3 },
  toastBody: { color: C.muted, fontFamily: F.regular, fontSize: 12, lineHeight: 17 },
  lock: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(34,37,38,0.9)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, borderRadius: 12 },
  pageHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
});
