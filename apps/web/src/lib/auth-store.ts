import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
}

/** accessToken 只存内存（不落 localStorage，降低 XSS 风险），刷新依赖 httpOnly Cookie */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  clear: () => set({ token: null }),
}));
