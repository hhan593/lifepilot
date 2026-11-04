import { create } from 'zustand';
import { ApiError, api, bootstrapSession, getRefreshToken, onSessionExpired, post, setTokens } from './api';
import { clearNotificationSession } from './notifications';

export interface UserSummary {
  id: string;
  email: string;
  timezone: string;
}

// 会话中途失效（刷新令牌也过期）→ 自动回到登录态，AuthGate 会跳转 /login
onSessionExpired(() => {
  useAuthStore.setState({ status: 'guest', user: null });
});

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
    } catch (err) {
      // 仅 token 确认失效（401）才登出；网络/服务端故障保留本地会话，
      // 后续请求经 api() 自愈（真正过期会触发 onSessionExpired）
      if (err instanceof ApiError && err.status === 401) {
        await setTokens(null, null);
        set({ status: 'guest', user: null });
      } else {
        set({ status: 'authed', user: null });
      }
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
    // 取消本设备已调度的本地通知（喝水提醒等）并解除推送令牌绑定：
    // 不清理的话换账号后本地通知继续弹、服务端仍向旧 token 推周报
    await clearNotificationSession().catch(() => undefined);
    set({ status: 'guest', user: null });
  },
}));
