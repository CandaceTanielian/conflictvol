// API client. Talks to the FastAPI backend, or to the in-browser demo backend
// when EXPO_PUBLIC_DEMO=true (used for the static GitHub Pages build).
export const DEMO = process.env.EXPO_PUBLIC_DEMO === 'true';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const memory: Record<string, string> = {};
export const storage = {
  get(key: string): string | null {
    try {
      const ls = (globalThis as any).localStorage;
      if (ls) return ls.getItem(key);
    } catch { /* storage unavailable */ }
    return memory[key] ?? null;
  },
  set(key: string, value: string) {
    memory[key] = value;
    try { (globalThis as any).localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
  },
  remove(key: string) {
    delete memory[key];
    try { (globalThis as any).localStorage?.removeItem(key); } catch { /* storage unavailable */ }
  },
};

const TOKEN_KEY = 'cv_token';
let token: string | null = storage.get(TOKEN_KEY);
let onUnauthorized: () => void = () => {};

export const getToken = () => token;
export function setToken(t: string | null) {
  token = t;
  if (t) storage.set(TOKEN_KEY, t); else storage.remove(TOKEN_KEY);
}
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

type Opts = { method?: string; body?: any; params?: Record<string, any> };

export async function api<T = any>(path: string, { method = 'GET', body, params }: Opts = {}): Promise<T> {
  if (DEMO) {
    const demo = await import('./demo');
    try {
      return (await demo.handle(method, path, body, params || {}, token)) as T;
    } catch (e: any) {
      if (e?.status === 401 && token) { setToken(null); onUnauthorized(); }
      throw e;
    }
  }
  const qs = params
    ? '?' + Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}${qs}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Can't reach the ConflictVol server at ${API_URL}. Is the backend running?`, 0);
  }
  if (res.status === 204) return null as T;
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) { setToken(null); onUnauthorized(); }
    let msg = data?.detail;
    if (Array.isArray(msg)) msg = msg.map((d: any) => String(d.msg || '').replace(/^Value error, /, '')).join(' ');
    throw new ApiError(msg || 'Something went wrong. Please try again.', res.status);
  }
  return data as T;
}
