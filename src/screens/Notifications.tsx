import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Btn, Card, Empty, ErrorState, Loading, Muted, PageHead, Pill } from '../components/ui';
import { C, F } from '../theme';
import { fmt, useApi, useApp } from '../state';

const ICON: Record<string, [string, string]> = { critical: ['!', C.coral], warning: ['▲', C.amber], info: ['i', C.cyan] };

export default function Notifications() {
  const { refreshUnread, go } = useApp();
  const { data, error, loading, reload } = useApi('/notifications');
  async function readAll() { await api('/notifications/read-all', { method: 'POST' }); reload(); refreshUnread(); }
  async function read(n: any) { if (n.read) return; await api(`/notifications/${n.id}/read`, { method: 'POST' }); reload(); refreshUnread(); }

  if (loading && !data) return <Loading label="Loading notifications" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <View>
      <PageHead eyebrow={`${data.unread} UNREAD`} title="Inbox" sub="Alerts that have fired, plus account updates. Tap a notification to mark it read."
        right={<Btn label="MARK ALL READ" onPress={readAll} disabled={!data.unread} />} />
      <Card pad={0}>
        {data.notifications.length === 0 ? (
          <Empty title="You're all caught up" body="When an alert fires, it will show up here." action={<Btn small label="MANAGE ALERTS" onPress={() => go('alerts')} />} />
        ) : data.notifications.map((n: any) => {
          const [glyph, color] = ICON[n.level] || ICON.info;
          return (
            <Pressable key={n.id} onPress={() => read(n)} style={({ hovered }: any) => [st.row, !n.read && st.unread, hovered && { backgroundColor: C.panel2 }]}>
              <View style={[st.icon, { borderColor: color }]}><Text style={{ color, fontFamily: F.bold, fontSize: 13 }}>{glyph}</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!n.read && <View style={st.dot} />}
                  <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13, flex: 1 }}>{n.title}</Text>
                </View>
                <Muted>{n.body}</Muted>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {n.level !== 'info' && <Pill tone={n.level === 'critical' ? 'coral' : 'amber'}>{n.level}</Pill>}
                  {String(n.delivered).startsWith('email') && <Pill tone="cyan">{n.delivered}</Pill>}
                </View>
              </View>
              <Text style={{ color: C.faint, fontFamily: F.semi, fontSize: 10.5 }}>{fmt.ago(n.created_at)}</Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  unread: { backgroundColor: '#272B26' },
  icon: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 1, backgroundColor: C.lime, transform: [{ rotate: '45deg' }] },
});
