"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await post<{ accessToken: string }>(`/auth/${isRegister ? "register" : "login"}`, {
        email,
        password,
      });
      setToken(res.accessToken);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "出错了，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <LifeBuoy className="size-7" />
          </div>
          <h1 className="text-xl font-bold">LifePilot</h1>
          <p className="text-sm text-zinc-500">
            {isRegister ? "创建账号，开始你的生活驾驶舱" : "欢迎回来，今天也要元气满满"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={isRegister ? 8 : 1}
              className="input"
              placeholder={isRegister ? "至少 8 位，含字母和数字" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "请稍候…" : isRegister ? "创建账号" : "登录"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          {isRegister ? "已有账号？" : "还没有账号？"}
          <a
            href={isRegister ? "/login" : "/register"}
            className="ml-1 font-medium text-brand-600 hover:underline"
          >
            {isRegister ? "去登录" : "注册一个"}
          </a>
        </p>
      </div>
    </div>
  );
}
