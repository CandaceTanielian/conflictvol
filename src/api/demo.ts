// In-browser demo backend for the static GitHub Pages build.
// Analytics responses are snapshots exported from the real FastAPI service
// (backend/scripts/export_demo_data.py). Accounts, alerts, notifications and
// watchlists are kept in local storage so the demo is fully interactive.
import DATA from './demo-data.json';
import { ApiError, storage } from './client';

const D: any = DATA;
const KEY = 'cv_demo_state_v2';
const FREE_ALERT_LIMIT = 1;
const FREE_ARCHIVE_LIMIT = 3;
const UNIVERSE: Record<string, { ticker: string; name: string; sector: string }> =
  Object.fromEntries(D.universe.map((u: any) => [u.ticker, u]));

type State = {
  snapshot: number; refreshedAt: string | null; nextId: number;
  users: any[]; alerts: any[]; notifications: any[]; watch: Record<string, string[]>;
};

function initialState(): State {
  const trialEnds = new Date(Date.now() + 14 * 864e5).toISOString();
  return {
    snapshot: 0, refreshedAt: null, nextId: 1000,
    users: [{ ...D.demo_user, id: 1, password: D.demo_password, trial_ends_at: trialEnds }],
    alerts: D.alerts.map((a: any) => ({ ...a, user_id: 1, last_state: false })),
    notifications: D.notifications.map((n: any) => ({ ...n, user_id: 1 })),
    watch: { '1': [...D.watchlist] },
  };
}

let state: State = load();
function load(): State {
  try { const raw = storage.get(KEY); if (raw) return JSON.parse(raw); } catch { /* corrupted */ }
  return initialState();
}
const save = () => storage.set(KEY, JSON.stringify(state));
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const snap = () => D.snapshots[state.snapshot];
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms));
const fail = (msg: string, status = 400): never => { throw new ApiError(msg, status); };
const nowIso = () => new Date().toISOString();

const plan = (u: any) => (u.plan === 'trial' ? (new Date(u.trial_ends_at) > new Date() ? 'premium' : 'free') : u.plan);
function userView(u: any) { const { password, ...rest } = u; return { ...rest, effective_plan: plan(u) }; }
function auth(token: string | null) {
  const id = token?.startsWith('demo.') ? Number(token.split('.')[1]) : null;
  const u = state.users.find((x) => x.id === id);
  if (!u) fail('Your session has expired. Please sign in again.', 401);
  return u;
}

// ---- watchlist helpers (same rules as the backend) ----
const watchOf = (u: any): string[] => state.watch[String(u.id)] || [];
function followedIn(impacts: any, watch: string[]) {
  return watch.filter((t) => UNIVERSE[t] && (impacts?.[UNIVERSE[t].sector]?.sensitivity ?? 0) >= 0.5);
}
function withFollowed(ev: any, watch: string[]) { return { ...ev, followed_tickers: followedIn(ev.sector_impacts, watch) }; }
function watchlistView(u: any) {
  const s = snap();
  const tickers: Record<string, any> = Object.fromEntries(s.exposure.tickers.map((t: any) => [t.ticker, t]));
  const items = watchOf(u).filter((t) => UNIVERSE[t] && tickers[t]).map((t) => {
    const info = UNIVERSE[t]; const x = tickers[t];
    const events = s.events.events
      .filter((e: any) => e.contribution > 0 && (e.sector_impacts?.[info.sector]?.sensitivity ?? 0) >= 0.4)
      .slice(0, 3).map((e: any) => ({ id: e.id, title: e.title, level: e.level }));
    return { ...info, exposure: x.exposure, bias: x.bias, level: x.exposure >= 70 ? 'HIGH' : x.exposure >= 40 ? 'WATCH' : 'LOW', events };
  });
  return { items, universe: D.universe };
}

// ---- alerts ----
const METRIC_LABELS = D.options.metrics;
const metricValue = (a: any, s: any) => (a.metric === 'exposure' ? s.current.exposure[a.target] ?? null : s.current[a.metric] ?? null);
const met = (a: any, v: number) => (a.operator === 'above' ? v > a.threshold : v < a.threshold);
function alertView(a: any, s: any) {
  const v = metricValue(a, s);
  return { ...a, metric_label: METRIC_LABELS[a.metric], current_value: v, triggered: v !== null && met(a, v) };
}
function evaluate(a: any, s: any, owner: any) {
  const v = metricValue(a, s);
  if (v === null || !a.active) return false;
  const isMet = met(a, v);
  let fired = false;
  if (isMet && !a.last_state) {
    const unit = a.metric.startsWith('vol_') ? '%' : '';
    const subject = a.metric === 'exposure' ? a.target : 'S&P 500';
    const d = s.dashboard;
    state.notifications.unshift({
      id: state.nextId++, user_id: a.user_id, alert_id: a.id,
      title: `${a.name}: ${subject} ${METRIC_LABELS[a.metric]} ${a.operator === 'above' ? 'rose above' : 'fell below'} ${a.threshold}${unit}`,
      body: `Now at ${v}${unit} (threshold ${a.threshold}${unit}). Conflict Risk Index ${d.cri} (${d.cri_label}). Leading driver: ${d.top_events[0]?.title}. Most exposed sectors: ${s.exposure.sectors.slice(0, 2).map((x: any) => x.sector).join(', ')}.`,
      level: Math.abs(v - a.threshold) / Math.max(a.threshold, 1) > 0.2 ? 'critical' : 'warning',
      channel: a.channel, delivered: a.channel === 'email' && owner.email_alerts ? 'email (simulated)' : 'in_app',
      read: false, created_at: nowIso(),
    });
    a.last_triggered_at = nowIso();
    fired = true;
  }
  a.last_state = isMet;
  a.last_value = v;
  return fired;
}

export async function handle(method: string, path: string, body: any, params: Record<string, any>, token: string | null): Promise<any> {
  await wait();
  const p = path.replace(/\/+$/, '');
  const s = snap();

  if (p === '/auth/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!String(body.name || '').trim()) fail('Please enter your name.', 422);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Please enter a valid email address.', 422);
    if (String(body.password || '').length < 8) fail('Password must be at least 8 characters.', 422);
    if (state.users.some((u) => u.email === email)) fail('An account with this email already exists. Try signing in instead.', 409);
    const u = { id: state.nextId++, name: body.name.trim(), email, password: body.password, plan: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(), email_alerts: true, created_at: nowIso() };
    state.users.push(u);
    state.watch[String(u.id)] = [];
    state.notifications.unshift({ id: state.nextId++, user_id: u.id, alert_id: null, title: 'Welcome to ConflictVol',
      body: 'Your 14-day Premium trial is active: real-time projections, the full archive, and custom alerts. Start by following a few companies and setting an alert.',
      level: 'info', channel: 'in_app', delivered: 'in_app', read: false, created_at: nowIso() });
    save();
    return { access_token: `demo.${u.id}`, token_type: 'bearer', user: userView(u) };
  }
  if (p === '/auth/login' && method === 'POST') {
    const u = state.users.find((x) => x.email === String(body.email || '').trim().toLowerCase());
    if (!u || u.password !== body.password) fail('Incorrect email or password.', 401);
    return { access_token: `demo.${u.id}`, token_type: 'bearer', user: userView(u) };
  }

  const user = auth(token);
  const premium = plan(user) === 'premium';
  const watch = watchOf(user);
  if (p === '/auth/me') return userView(user);

  if (p === '/dashboard') {
    const d = clone(s.dashboard);
    d.top_events = d.top_events.map((e: any) => withFollowed(e, watch));
    if (state.refreshedAt) d.as_of = state.refreshedAt;
    return { ...d, plan: plan(user) };
  }
  if (p === '/events') {
    let rows = s.events.events.map((e: any) => withFollowed(e, watch));
    if (params.region) rows = rows.filter((r: any) => r.region === params.region);
    if (params.category) rows = rows.filter((r: any) => r.category === params.category);
    if (params.level) rows = rows.filter((r: any) => r.level === String(params.level).toUpperCase());
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter((r: any) => [r.title, r.country, r.summary, r.companies.join(' ')].some((t) => t.toLowerCase().includes(q)));
    }
    return { ...clone(s.events), events: rows };
  }
  const ev = p.match(/^\/events\/(\d+)$/);
  if (ev) {
    const d = s.event_details[ev[1]];
    if (!d) fail('That event is no longer in the active feed.', 404);
    return withFollowed(clone(d), watch);
  }
  if (p === '/exposure') { const e = clone(s.exposure); return { ...e, tickers: premium ? e.tickers : [], tickers_locked: !premium }; }
  if (p === '/rationale') return clone(s.rationale[params.horizon || '1w']);
  if (p === '/archive') {
    const a = clone(s.archive);
    return premium ? a : { ...a, episodes: a.episodes.slice(0, FREE_ARCHIVE_LIMIT), locked: a.total - FREE_ARCHIVE_LIMIT };
  }

  // watchlist
  if (p === '/watchlist' && method === 'GET') return watchlistView(user);
  if (p === '/watchlist' && method === 'PUT') {
    const tickers = Array.from(new Set((body.tickers || []).map((t: string) => t.toUpperCase()))) as string[];
    const unknown = tickers.filter((t) => !UNIVERSE[t]);
    if (unknown.length) fail(`Unknown ticker: ${unknown.join(', ')}`, 422);
    state.watch[String(user.id)] = tickers; save();
    return watchlistView(user);
  }
  const wm = p.match(/^\/watchlist\/([A-Za-z.]+)$/);
  if (wm) {
    const t = wm[1].toUpperCase();
    const list = watchOf(user);
    if (method === 'POST') {
      if (!UNIVERSE[t]) fail("That ticker isn't covered yet.", 404);
      if (!list.includes(t)) state.watch[String(user.id)] = [...list, t];
    } else if (method === 'DELETE') {
      state.watch[String(user.id)] = list.filter((x) => x !== t);
    }
    save();
    return watchlistView(user);
  }

  // alerts
  const mine = () => state.alerts.filter((a) => a.user_id === user.id);
  if (p === '/alerts' && method === 'GET') {
    return { alerts: mine().map((a) => alertView(a, s)), options: D.options, limit: premium ? null : FREE_ALERT_LIMIT, current: s.current };
  }
  if (p === '/alerts' && method === 'POST') {
    if (!premium && mine().length >= FREE_ALERT_LIMIT) fail('The Free plan includes one alert. Upgrade to Premium for unlimited custom alerts.', 402);
    if (!String(body.name || '').trim()) fail('Give your alert a name.', 422);
    if (!(body.threshold > 0)) fail('Threshold must be greater than zero.', 422);
    if (body.metric === 'exposure' && !D.options.sectors.includes(body.target)) fail('Choose a sector for exposure alerts.', 422);
    const a = { id: state.nextId++, user_id: user.id, name: body.name.trim(), target: body.metric === 'exposure' ? body.target : 'S&P 500',
      metric: body.metric, operator: body.operator || 'above', threshold: Number(body.threshold), channel: body.channel || 'in_app',
      active: body.active !== false, last_state: false, last_value: null, last_triggered_at: null, created_at: nowIso() };
    state.alerts.push(a);
    const fired = evaluate(a, s, user);
    save();
    return { alert: alertView(a, s), fired_now: fired };
  }
  const am = p.match(/^\/alerts\/(\d+)(\/test)?$/);
  if (am) {
    const a = mine().find((x) => x.id === Number(am[1]));
    if (!a) fail('Alert not found.', 404);
    if (am[2]) {
      state.notifications.unshift({ id: state.nextId++, user_id: user.id, alert_id: a.id, title: `Test: ${a.name}`,
        body: `This is a test notification. Current value: ${metricValue(a, s)}. Threshold: ${a.operator} ${a.threshold}.`,
        level: 'info', channel: a.channel, delivered: a.channel === 'email' ? 'email (simulated)' : 'in_app', read: false, created_at: nowIso() });
      save();
      return { ok: true };
    }
    if (method === 'DELETE') { state.alerts = state.alerts.filter((x) => x !== a); save(); return null; }
    if (method === 'PATCH') {
      Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null) a[k] = v; });
      if (body.threshold !== undefined || body.operator !== undefined || body.active) a.last_state = false;
      const fired = evaluate(a, s, user);
      save();
      return { alert: alertView(a, s), fired_now: fired };
    }
  }

  // notifications
  if (p === '/notifications') {
    const rows = state.notifications.filter((n) => n.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { notifications: clone(rows), unread: rows.filter((n) => !n.read).length };
  }
  if (p === '/notifications/read-all') { state.notifications.forEach((n) => { if (n.user_id === user.id) n.read = true; }); save(); return { ok: true }; }
  const nm = p.match(/^\/notifications\/(\d+)\/read$/);
  if (nm) { const n = state.notifications.find((x) => x.id === Number(nm[1]) && x.user_id === user.id); if (n) n.read = true; save(); return { ok: true }; }

  // account & data
  if (p === '/account' && method === 'PATCH') {
    if (body.name !== undefined) user.name = String(body.name).trim() || user.name;
    if (body.email_alerts !== undefined) user.email_alerts = body.email_alerts;
    save();
    return userView(user);
  }
  if (p === '/account/plan') { user.plan = body.plan; save(); return userView(user); }
  if (p === '/data/status') return { sources: s.dashboard.sources };
  if (p === '/data/refresh') {
    if (state.snapshot >= D.snapshots.length - 1) {
      return { ingested: [], feed_empty: true, alerts_triggered: 0, cri_before: s.dashboard.cri, cri_after: s.dashboard.cri,
        vol_1w_before: s.current.vol_1w, vol_1w_after: s.current.vol_1w };
    }
    state.snapshot += 1;
    state.refreshedAt = nowIso();
    const next = snap();
    let triggered = 0;
    state.alerts.filter((a) => a.active).forEach((a) => {
      const owner = state.users.find((u) => u.id === a.user_id) || user;
      if (evaluate(a, next, owner)) triggered += 1;
    });
    save();
    return { ...clone(next.refresh), alerts_triggered: triggered };
  }
  if (p === '/demo/reset') { state = initialState(); save(); return { ok: true }; }
  return fail('Not found', 404);
}
