import { safeGetItem, safeSetItem, safeDeleteItem } from './storage';

const BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const ACCESS_KEY = 'lp_at';
const REFRESH_KEY = 'lp_rt';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export async function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (access) await safeSetItem(ACCESS_KEY, access);
  else await safeDeleteItem(ACCESS_KEY);
  if (refresh !== undefined) {
    if (refresh) await safeSetItem(REFRESH_KEY, refresh);
    else await safeDeleteItem(REFRESH_KEY);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  return safeGetItem(REFRESH_KEY);
}

/** 冷启动恢复会话：用存储的 refresh token 换新 access token（body 方式，原生端不走 Cookie） */
export async function bootstrapSession(): Promise<boolean> {
  const stored = await safeGetItem(ACCESS_KEY);
  if (stored) accessToken = stored;
  return tryRefresh();
}

export function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await safeGetItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken?: string };
      await setTokens(data.accessToken, data.refreshToken ?? null);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // 非 JSON 响应体
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });

export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
