import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { FadeIn } from '../motion';
import { C, F, levelColor } from '../theme';
import { Screen, useApp } from '../state';

type Item = { key: string; group: string; label: string; hint?: string; color?: string; run: () => void };

const SCREEN_ITEMS: [Screen, string, string][] = [
  ['overview', 'Overview', 'Market pulse'], ['projections', 'Projections', 'Projection desk'], ['conflicts', 'Conflicts', 'Conflict monitor'],
  ['exposure', 'Exposure', 'Sector & ticker exposure'], ['archive', 'Archive', 'Historical analogs'], ['alerts', 'Alerts', 'Configure alerts'],
  ['notifications', 'Notifications', 'Inbox'], ['settings', 'Settings', 'Account & plan'],
];

export default function CommandPalette({ open, onClose, onRefresh, live, onToggleLive }: {
  open: boolean; onClose: () => void; onRefresh: () => void; live: boolean; onToggleLive: () => void;
}) {
  const { go, toast, bump } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [universe, setUniverse] = useState<any[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0);
    api('/events').then((r) => setEvents(r.events)).catch(() => {});
    api('/watchlist').then((w) => { setUniverse(w.universe); setWatch(w.items.map((i: any) => i.ticker)); }).catch(() => {});
    setTimeout(() => input.current?.focus(), 50);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const done = (fn: () => void) => () => { onClose(); fn(); };
    const all: Item[] = [
      { key: 'refresh', group: 'Actions', label: 'Refresh data', hint: 'Ingest the next event and re-run the projection', color: C.lime, run: done(onRefresh) },
      { key: 'live', group: 'Actions', label: live ? 'Stop live feed' : 'Start live feed', hint: 'Stream new events automatically', color: C.coral, run: done(onToggleLive) },
      { key: 'alert', group: 'Actions', label: 'Create an alert', hint: 'Alerts', run: done(() => go('alerts')) },
      ...SCREEN_ITEMS.map(([s, l, h]) => ({ key: `s-${s}`, group: 'Go to', label: l, hint: h, run: done(() => go(s)) })),
      ...events.map((e) => ({ key: `e-${e.id}`, group: 'Events', label: e.title, hint: `${e.level} · ${e.region}`, color: levelColor(e.level), run: done(() => go('conflicts', { eventId: e.id })) })),
      ...universe.map((u) => {
        const on = watch.includes(u.ticker);
        return {
          key: `t-${u.ticker}`, group: 'Companies', label: `${on ? 'Unfollow' : 'Follow'} ${u.ticker}`, hint: `${u.name} · ${u.sector}`, color: on ? C.lime : undefined,
          run: done(async () => {
            try { await api(`/watchlist/${u.ticker}`, { method: on ? 'DELETE' : 'POST' }); toast(on ? `Unfollowed ${u.ticker}` : `Following ${u.ticker}`); bump(); }
            catch (err: any) { toast("Couldn't update watchlist", err.message); }
          }),
        };
      }),
    ];
    const ql = q.trim().toLowerCase();
    if (!ql) return all.filter((i) => i.group !== 'Companies').slice(0, 18);
    return all.filter((i) => i.label.toLowerCase().includes(ql) || (i.hint || '').toLowerCase().includes(ql)).slice(0, 24);
  }, [q, events, universe, watch, live]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSel(0), [q]);
  const onKey = (e: any) => {
    const k = e.nativeEvent.key;
    if (k === 'ArrowDown') { e.preventDefault?.(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (k === 'ArrowUp') { e.preventDefault?.(); setSel((s) => Math.max(0, s - 1)); }
    else if (k === 'Enter') items[sel]?.run();
    else if (k === 'Escape') onClose();
  };

  let lastGroup = '';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,9,9,0.7)', alignItems: 'center', paddingTop: 90, paddingHorizontal: 16 }} onPress={onClose}>
        <FadeIn distance={-12} duration={220} style={{ width: '100%', maxWidth: 640 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: '#5A6157', overflow: 'hidden', boxShadow: `0 30px 80px -20px #000, 0 0 0 1px ${C.lime}22` } as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={{ color: C.lime, fontSize: 16 }}>⌕</Text>
              <TextInput ref={input} value={q} onChangeText={setQ} onKeyPress={onKey} onSubmitEditing={() => items[sel]?.run()}
                placeholder="Jump to a screen, event or ticker, or run an action…" placeholderTextColor={C.faint}
                style={{ flex: 1, height: 54, color: C.text, fontFamily: F.regular, fontSize: 15, outlineStyle: 'none' } as any} accessibilityLabel="Command palette search" />
              <Text style={{ color: C.faint, fontFamily: F.bold, fontSize: 9, borderWidth: 1, borderColor: C.line, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>ESC</Text>
            </View>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {items.length === 0 && <Text style={{ color: C.muted, fontFamily: F.regular, padding: 18 }}>No matches for "{q}".</Text>}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                return (
                  <View key={it.key}>
                    {header && <Text style={{ color: C.faint, fontFamily: F.bold, fontSize: 8.5, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>{header.toUpperCase()}</Text>}
                    <Pressable onPress={it.run} onHoverIn={() => setSel(i)} accessibilityRole="button"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: i === sel ? C.raised : 'transparent', borderLeftWidth: 2, borderLeftColor: i === sel ? C.lime : 'transparent' }}>
                      <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: it.color || C.muted, transform: [{ rotate: '45deg' }] }} />
                      <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13, flex: 1 }} numberOfLines={1}>{it.label}</Text>
                      {it.hint ? <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11, maxWidth: 240 }} numberOfLines={1}>{it.hint}</Text> : null}
                      {i === sel && <Text style={{ color: C.lime, fontFamily: F.bold, fontSize: 11 }}>↵</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.rail }}>
              {[['↑↓', 'navigate'], ['↵', 'select'], [Platform.OS === 'web' ? '⌘K' : '', 'toggle']].filter(([k]) => k).map(([k, l]) => (
                <Text key={l} style={{ color: C.faint, fontFamily: F.regular, fontSize: 10.5 }}><Text style={{ color: C.muted, fontFamily: F.bold }}>{k}</Text> {l}</Text>
              ))}
            </View>
          </Pressable>
        </FadeIn>
      </Pressable>
    </Modal>
  );
}
