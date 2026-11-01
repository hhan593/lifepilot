import { useAuthStore } from "./auth-store";

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let refreshing: Promise<boolean> | null = null;

/** 用 httpOnly Cookie 里的 refresh token 换新 accessToken */
function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string };
      useAuthStore.getState().setToken(data.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** 应用启动时恢复会话 */
export async function ensureToken(): Promise<boolean> {
  if (useAuthStore.getState().token) return true;
  return tryRefresh();
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(useAuthStore.getState().token
          ? { Authorization: `Bearer ${useAuthStore.getState().token}` }
          : {}),
        ...options.headers,
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith("/auth/")) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    let errors: unknown;
    try {
      const body = (await res.json()) as { detail?: string; errors?: unknown };
      detail = body.detail ?? detail;
      errors = body.errors;
    } catch {
      // 非 JSON 响应体
    }
    if (res.status === 401 && typeof window !== "undefined") {
      useAuthStore.getState().clear();
      if (window.location.pathname.startsWith("/app")) {
        window.location.href = "/login";
      }
    }
    throw new ApiError(res.status, detail, errors);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });

export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
