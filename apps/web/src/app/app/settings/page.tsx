"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, BellOff, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { api, del, patch, post } from "@/lib/api";
import { ACTIVITY_LABEL, ACTIVITY_LEVELS, calcWaterGoalMl } from "@lifepilot/shared";
import type { ActivityLevel } from "@lifepilot/shared";
import type { CityData, GeocodeItem, MeData } from "@/lib/types";

const DAY_LABELS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<MeData>("/users/me") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<CityData[]>("/cities") });

  const [form, setForm] = useState<Partial<MeData["settings"]>>({});
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const s = { ...(me.data?.settings ?? {}), ...form };
  const update = (patchData: Partial<MeData["settings"]>) => setForm((f) => ({ ...f, ...patchData }));

  const save = useMutation({
    mutationFn: () => patch("/users/me/settings", form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["water"] });
      setForm({});
    },
  });

  // ---- 城市搜索 ----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const [searching, setSearching] = useState(false);

  async function searchCity() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await api<GeocodeItem[]>(`/cities/search?q=${encodeURIComponent(query.trim())}`));
    } finally {
      setSearching(false);
    }
  }

  const addCity = useMutation({
    mutationFn: (item: GeocodeItem) =>
      post("/cities", { name: item.name, label: item.label, latitude: item.latitude, longitude: item.longitude }),
    onSuccess: () => {
      setQuery("");
      setResults([]);
      void queryClient.invalidateQueries({ queryKey: ["cities"] });
      void queryClient.invalidateQueries({ queryKey: ["weather"] });
    },
  });

  const setPrimary = useMutation({
    mutationFn: (id: string) => patch(`/cities/${id}/primary`, { isPrimary: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cities"] });
      void queryClient.invalidateQueries({ queryKey: ["weather"] });
    },
  });

  const removeCity = useMutation({
    mutationFn: (id: string) => del(`/cities/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cities"] });
      void queryClient.invalidateQueries({ queryKey: ["weather"] });
    },
  });

  // ---- Web Push ----
  async function enablePush() {
    setPushMsg(null);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setPushMsg("当前浏览器不支持通知");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushMsg("通知权限被拒绝");
        return;
      }
      const { publicKey } = await api<{ publicKey: string | null }>("/notifications/public-key");
      if (!publicKey) {
        setPushMsg("服务端未配置 VAPID 密钥（见 .env 说明）");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await post("/notifications/subscriptions", {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      await post("/notifications/test");
      setPushMsg("已开启推送，测试通知已发送 ✅");
    } catch (err) {
      setPushMsg(err instanceof Error ? err.message : "开启失败");
    }
  }

  const pushSupported = typeof window !== "undefined" && "Notification" in window;
  const pushOn = pushSupported && typeof Notification !== "undefined" && Notification.permission === "granted";

  const goalPreview =
    s.weightKg != null ? calcWaterGoalMl(s.weightKg, (s.activityLevel as ActivityLevel) ?? "LIGHT") : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">设置</h1>

      {/* 账号 */}
      <section className="card">
        <p className="section-title">账号</p>
        <p className="mt-1.5 text-sm text-zinc-600">{me.data?.email ?? "…"}</p>
        <p className="text-xs text-zinc-400">时区：{me.data?.timezone ?? "…"}</p>
      </section>

      {/* 城市 */}
      <section className="card">
        <p className="section-title flex items-center gap-1.5">
          <MapPin className="size-4" /> 天气城市
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="搜索城市，如：上海"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void searchCity())}
          />
          <button type="button" className="btn-primary px-3" onClick={() => void searchCity()} disabled={searching}>
            <Plus className="size-4" />
          </button>
        </div>

        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => addCity.mutate(r)}
                >
                  <span>{r.label}</span>
                  <span className="text-xs text-brand-600">添加</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-3 space-y-1.5">
          {cities.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm">
              <span className="flex-1">{c.name}</span>
              {c.isPrimary ? (
                <span className="flex items-center gap-1 text-xs text-brand-600">
                  <Star className="size-3.5 fill-current" /> 默认
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-brand-600"
                  onClick={() => setPrimary.mutate(c.id)}
                >
                  设为默认
                </button>
              )}
              <button
                type="button"
                onClick={() => removeCity.mutate(c.id)}
                className="text-zinc-300 hover:text-red-500"
                aria-label={`删除 ${c.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          {cities.data !== undefined && cities.data.length === 0 && (
            <li className="py-2 text-center text-sm text-zinc-400">还没有城市，搜一个加上吧</li>
          )}
        </ul>
      </section>

      {/* 饮水 */}
      <section className="card space-y-3">
        <p className="section-title">饮水目标</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">体重 (kg)</label>
            <input
              type="number"
              className="input"
              min={30}
              max={200}
              value={s.weightKg ?? ""}
              onChange={(e) => update({ weightKg: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="flex-1">
            <label className="label">活动量</label>
            <select
              className="input"
              value={s.activityLevel ?? "LIGHT"}
              onChange={(e) => update({ activityLevel: e.target.value as ActivityLevel })}
            >
              {ACTIVITY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {ACTIVITY_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {goalPreview && (
          <p className="text-xs text-zinc-400">
            按体重和活动量推荐：{goalPreview.toLocaleString()}ml/天（也可手动指定）
          </p>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">每日目标 (ml)</label>
            <input
              type="number"
              className="input"
              min={500}
              max={6000}
              step={50}
              value={s.waterGoalMl ?? 2000}
              onChange={(e) => update({ waterGoalMl: Number(e.target.value) })}
            />
          </div>
          <div className="flex-1">
            <label className="label">一杯容量 (ml)</label>
            <input
              type="number"
              className="input"
              min={50}
              max={1000}
              step={50}
              value={s.cupSizeMl ?? 250}
              onChange={(e) => update({ cupSizeMl: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {/* 提醒 */}
      <section className="card space-y-3">
        <p className="section-title flex items-center gap-1.5">
          <Bell className="size-4" /> 喝水提醒
        </p>
        <label className="flex items-center justify-between text-sm">
          开启提醒
          <input
            type="checkbox"
            className="size-4 accent-indigo-600"
            checked={s.waterReminderEnabled ?? true}
            onChange={(e) => update({ waterReminderEnabled: e.target.checked })}
          />
        </label>
        <div>
          <label className="label">提醒时间（每天）</label>
          <div className="flex flex-wrap gap-1.5">
            {(s.waterReminderTimes ?? []).map((t) => (
              <button
                key={t}
                type="button"
                className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700"
                onClick={() =>
                  update({ waterReminderTimes: (s.waterReminderTimes ?? []).filter((x) => x !== t) })
                }
                title="点击移除"
              >
                {t} ✕
              </button>
            ))}
            <input
              type="time"
              className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  update({
                    waterReminderTimes: [...new Set([...(s.waterReminderTimes ?? []), e.target.value])].sort(),
                  });
                }
              }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">免打扰开始</label>
            <input
              type="time"
              className="input"
              value={s.quietStart ?? "22:00"}
              onChange={(e) => update({ quietStart: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="label">免打扰结束</label>
            <input
              type="time"
              className="input"
              value={s.quietEnd ?? "08:00"}
              onChange={(e) => update({ quietEnd: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* 周报 */}
      <section className="card space-y-3">
        <p className="section-title">周报生成时间</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">生成日</label>
            <select
              className="input"
              value={s.weeklyReportDay ?? 5}
              onChange={(e) => update({ weeklyReportDay: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">生成时间</label>
            <select
              className="input"
              value={s.weeklyReportHour ?? 17}
              onChange={(e) => update({ weeklyReportHour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 推送 */}
      <section className="card space-y-3">
        <p className="section-title flex items-center gap-1.5">
          {pushOn ? <Bell className="size-4 text-emerald-500" /> : <BellOff className="size-4" />} 浏览器推送
        </p>
        <p className="text-sm text-zinc-500">
          {pushOn
            ? "已授权通知。提醒将按上面配置的时间推送（需服务端配置 VAPID）。"
            : "开启后，喝水提醒和周报完成会推送到此设备（建议把 App 安装到主屏幕）。"}
        </p>
        {!pushOn && (
          <button type="button" className="btn-primary w-full" onClick={() => void enablePush()}>
            开启推送通知
          </button>
        )}
        {pushMsg && <p className="text-xs text-zinc-500">{pushMsg}</p>}
      </section>

      {Object.keys(form).length > 0 && (
        <div className="sticky bottom-20">
          <button type="button" className="btn-primary w-full shadow-lg" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "保存中…" : "保存设置"}
          </button>
        </div>
      )}
    </div>
  );
}
