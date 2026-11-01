import { create } from 'zustand';
import { api, bootstrapSession, getRefreshToken, post, setTokens } from './api';

export interface UserSummary {
  id: string;
  email: string;
  timezone: string;
}

interface AuthState {
  status: 'loading' | 'authed' | 'guest';
  user: UserSummary | null;
  /** 冷启动：用 SecureStore 里的 refresh token 恢复会话 */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: UserSummary;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    const ok = await bootstrapSession();
    if (!ok) {
      set({ status: 'guest', user: null });
      return;
    }
    try {
      const me = await api<UserSummary>('/users/me');
      set({ status: 'authed', user: me });
    } catch {
      await setTokens(null, null);
      set({ status: 'guest', user: null });
    }
  },

  login: async (email, password) => {
    const res = await post<AuthResponse>('/auth/login', { email, password });
    await setTokens(res.accessToken, res.refreshToken ?? null);
    set({ status: 'authed', user: res.user });
  },

  register: async (email, password) => {
    const res = await post<AuthResponse>('/auth/register', { email, password });
    await setTokens(res.accessToken, res.refreshToken ?? null);
    set({ status: 'authed', user: res.user });
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    await post('/auth/logout', { refreshToken }).catch(() => undefined);
    await setTokens(null, null);
    set({ status: 'guest', user: null });
  },
}));
