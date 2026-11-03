import { safeGetItem, safeSetItem, safeDeleteItem } from './storage';

// EXPO_PUBLIC_API_BASE 支持空串（GitHub Pages 构建时未配置变量则回退本地）
const BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:4000/api/v1';

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

/** 冷启动恢复会话：只把存储的 access token 恢复进内存，不在此处强制 refresh（body 方式，原生端不走 Cookie） */
export async function bootstrapSession(): Promise<boolean> {
  const stored = await safeGetItem(ACCESS_KEY);
  if (stored) accessToken = stored;
  // access token 有效性交给首个请求验证（401 时 api() 会自动走 tryRefresh）——
  // 原实现无条件 refresh：断网时把仍有效的会话直接踢掉，且每次冷启动都作废旧 refresh token
  if (accessToken) return true;
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

/** 会话失效（刷新也失败）时通知订阅者（auth store → 跳回登录页） */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(cb: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(cb);
  return () => sessionExpiredListeners.delete(cb);
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
    if (ok) {
      res = await doFetch();
    }
    if (res.status === 401) {
      // 刷新失败或刷新后重试仍 401：清除会话并通知跳转登录（否则用户卡死在坏会话）
      accessToken = null;
      await safeDeleteItem(ACCESS_KEY);
      await safeDeleteItem(REFRESH_KEY);
      sessionExpiredListeners.forEach((cb) => cb());
    }
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
