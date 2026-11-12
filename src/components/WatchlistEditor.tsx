import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { C, F } from '../theme';
import { useApp } from '../state';
import { Btn, Muted, Sheet, s as ui } from './ui';

export default function WatchlistEditor({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const { toast, bump } = useApp();
  const [universe, setUniverse] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    api('/watchlist').then((w) => { setUniverse(w.universe); setSel(w.items.map((i: any) => i.ticker)); }).catch((e) => toast("Couldn't load watchlist", e.message));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.trim().toLowerCase();
  const rows = universe.filter((u) => !ql || u.ticker.toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql) || u.sector.toLowerCase().includes(ql));
  const toggle = (t: string) => setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  async function save() {
    setBusy(true);
    try {
      await api('/watchlist', { method: 'PUT', body: { tickers: sel } });
      toast('Watchlist saved', sel.length ? `Following ${sel.join(', ')}.` : 'You are not following any companies.');
      bump(); onSaved?.(); onClose();
    } catch (e: any) { toast("Couldn't save watchlist", e.message); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Followed companies"
      footer={<><Btn label="CANCEL" onPress={onClose} /><Btn kind="primary" label={busy ? 'SAVING…' : `SAVE (${sel.length})`} onPress={save} disabled={busy} /></>}>
      <Muted>Followed companies are highlighted across the conflict feed, the map and the projection desk whenever an event affects their sector.</Muted>
      <TextInput value={q} onChangeText={setQ} placeholder="Search ticker, company or sector" placeholderTextColor={C.faint} style={ui.input} accessibilityLabel="Search companies" />
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8 }}>
        {rows.map((u, i) => {
          const on = sel.includes(u.ticker);
          return (
            <Pressable key={u.ticker} onPress={() => toggle(u.ticker)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={({ hovered }: any) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }, hovered && { backgroundColor: C.panel2 }]}>
              <Text style={{ color: on ? C.lime : C.faint, fontSize: 15, width: 16 }}>{on ? '★' : '☆'}</Text>
              <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 12, width: 52 }}>{u.ticker}</Text>
              <Text style={{ color: C.text, fontFamily: F.regular, fontSize: 12, flex: 1 }} numberOfLines={1}>{u.name}</Text>
              <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11 }} numberOfLines={1}>{u.sector}</Text>
            </Pressable>
          );
        })}
        {rows.length === 0 && <Muted style={{ padding: 14 }}>No companies match "{q}".</Muted>}
      </View>
    </Sheet>
  );
}
