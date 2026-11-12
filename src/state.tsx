import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api, getToken, setToken, setUnauthorizedHandler } from './api/client';

export type Screen = 'overview' | 'projections' | 'conflicts' | 'exposure' | 'archive' | 'alerts' | 'notifications' | 'settings';
export const SCREENS: Screen[] = ['overview', 'projections', 'conflicts', 'exposure', 'archive', 'alerts', 'notifications', 'settings'];
export type NavParams = { eventId?: number; q?: string };

// ---------- formatting ----------
export const fmt = {
  num: (v: any, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d)),
  pct: (v: any, d = 1) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(d)}%`),
  signed: (v: any, d = 1) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}`),
  int: (v: any) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US')),
  money: (v: any) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  ago(iso?: string | null) {
    if (!iso) return '—';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  },
  date: (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  short: (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
  time: (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
};
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ---------- context ----------
type Toast = { id: number; title: string; body?: string };
type Ctx = {
  user: any; setUser: (u: any) => void; ready: boolean;
  signIn: (res: any) => void; signOut: () => void;
  version: number; bump: () => void;
  unread: number; refreshUnread: () => void;
  toasts: Toast[]; toast: (title: string, body?: string, ms?: number) => void;
  screen: Screen; params: NavParams; go: (s: Screen, p?: NavParams) => void;
};
const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

function initialScreen(): Screen {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const h = window.location.hash.replace('#', '') as Screen;
    if (SCREENS.includes(h)) return h;
  }
  return 'overview';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [params, setParams] = useState<NavParams>({});
  const toastId = useRef(0);

  const toast = useCallback((title: string, body?: string, ms = 5200) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  const refreshUnread = useCallback(async () => {
    try { setUnread((await api('/notifications')).unread); } catch { /* ignore */ }
  }, []);

  const go = useCallback((s: Screen, p: NavParams = {}) => {
    setScreen(s);
    setParams(p);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.history.replaceState(null, '', `#${s}`); } catch { /* sandboxed */ }
      try { window.scrollTo?.(0, 0); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!getToken()) { setReady(true); return; }
    api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (user) refreshUnread(); }, [user, version, refreshUnread]);

  const signIn = (res: any) => { setToken(res.access_token); setUser(res.user); go('overview'); };
  const signOut = () => { setToken(null); setUser(null); };
  const bump = () => setVersion((v) => v + 1);

  return (
    <AppCtx.Provider value={{ user, setUser, ready, signIn, signOut, version, bump, unread, refreshUnread, toasts, toast, screen, params, go }}>
      {children}
    </AppCtx.Provider>
  );
}

// Fetch hook that refetches whenever data is refreshed app-wide.
export function useApi<T = any>(path: string, params?: Record<string, any>) {
  const { version } = useApp();
  const [state, setState] = useState<{ data: T | null; error: any; loading: boolean }>({ data: null, error: null, loading: true });
  const key = JSON.stringify(params || {});
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await api<T>(path, { params }), error: null, loading: false }); }
    catch (error) { setState({ data: null, error, loading: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);
  useEffect(() => { load(); }, [load, version]);
  return { ...state, reload: load };
}
