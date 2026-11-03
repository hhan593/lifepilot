"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Droplets,
  Flame,
  History,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { api, post } from "@/lib/api";
import type { DrinkType, TodoPriority, WeeklyReportPayload, WeeklyReportSummary } from "@lifepilot/shared";
import { DRINK_LABEL, PRIORITY_LABEL, formatLocalDate, shiftLocalDate } from "@lifepilot/shared";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const PRIORITY_CLASSES: Record<TodoPriority, string> = {
  LOW: "bg-zinc-100 text-zinc-600 border-zinc-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  URGENT: "bg-rose-50 text-rose-700 border-rose-200",
};

const DRINK_COLORS: Record<DrinkType, string> = {
  WATER: "#0284c7",
  TEA: "#059669",
  COFFEE: "#b45309",
  JUICE: "#ea580c",
  MILK: "#4f46e5",
  SODA: "#dc2626",
  OTHER: "#64748b",
};

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const history = useQuery({
    queryKey: ["reports", "history"],
    queryFn: () => api<WeeklyReportSummary[]>("/reports/history"),
  });

  const report = useQuery({
    queryKey: ["reports", "weekly", selectedWeek],
    queryFn: () => {
      const path = selectedWeek ? `/reports/weekly?weekStart=${selectedWeek}` : "/reports/weekly";
      return api<WeeklyReportPayload>(path).catch((err: { status?: number }) => {
        if (err.status === 404) return null;
        throw err;
      });
    },
  });

  const generate = useMutation({
    mutationFn: (weekStart?: string) =>
      post<WeeklyReportPayload>("/reports/weekly/generate", weekStart ? { weekStart } : {}),
    onSuccess: (data) => {
      setSelectedWeek(data.weekStart);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  async function copyMarkdown(markdown: string) {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const r = report.data;

  const handlePrevWeek = () => {
    if (!r) return;
    setSelectedWeek(shiftLocalDate(r.weekStart, -7));
  };

  const handleNextWeek = () => {
    if (!r) return;
    const next = shiftLocalDate(r.weekStart, 7);
    const today = formatLocalDate();
    if (next > today) return;
    setSelectedWeek(next);
  };

  const isCurrentWeek = Boolean(r && shiftLocalDate(r.weekStart, 7) > formatLocalDate());

  return (
    <div className="space-y-6">
      {/* 头部标题与控制栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">生活周报 · 复盘驾驶舱</h1>
          <p className="mt-0.5 text-xs text-zinc-500">沉淀每周成就，洞察身心节奏与行动指南</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs gap-1.5 cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="size-3.5 text-zinc-500" />
            <span>历史归档</span>
          </button>

          {r && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs gap-1.5 cursor-pointer"
              onClick={() => copyMarkdown(r.markdown)}
            >
              <Copy className="size-3.5 text-zinc-500" />
              <span>{copied ? "已复制" : "复制报告"}</span>
            </button>
          )}

          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs gap-1.5 cursor-pointer"
            onClick={() => generate.mutate(selectedWeek ?? undefined)}
            disabled={generate.isPending}
          >
            <RefreshCw className={`size-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
            <span>{generate.isPending ? "计算中…" : "重新生成"}</span>
          </button>
        </div>
      </div>

      {/* 历史记录快速抽屉 / 面板 */}
      {showHistory && history.data && (
        <div className="card bg-zinc-50/80 border-dashed animate-in fade-in slide-in-from-top-2 duration-150">
          <p className="text-xs font-bold text-zinc-700 mb-2.5">往期生活周报</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {history.data.map((h) => {
              const active = r?.weekStart === h.weekStart;
              return (
                <button
                  key={h.weekStart}
                  type="button"
                  onClick={() => {
                    setSelectedWeek(h.weekStart);
                    setShowHistory(false);
                  }}
                  className={`flex flex-col items-start rounded-xl p-2.5 text-left transition border ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-950 font-semibold"
                      : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700"
                  }`}
                >
                  <span className="text-xs">
                    {h.weekStart.slice(5).replace("-", ".")} – {h.weekEnd.slice(5).replace("-", ".")}
                  </span>
                  <div className="mt-1 flex items-center justify-between w-full">
                    <span className="text-[11px] text-zinc-500">{h.title}</span>
                    <span className="text-xs font-bold text-indigo-600">{h.score}分</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 周切换导航 */}
      {r && (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-xs">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition"
          >
            <ChevronLeft className="size-4" />
            <span>上一周</span>
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-indigo-600" />
            <span className="text-sm font-bold text-zinc-800">
              {r.weekStart.slice(5).replace("-", ".")} – {r.weekEnd.slice(5).replace("-", ".")}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              综合评分 {r.score}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextWeek}
            disabled={isCurrentWeek}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              isCurrentWeek
                ? "text-zinc-300 cursor-not-allowed"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <span>下一周</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {report.isLoading && <p className="py-12 text-center text-sm text-zinc-400">正在生成本周驾驶舱分析…</p>}

      {!report.isLoading && r === null && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-4xl">📋</p>
          <p className="text-sm font-semibold text-zinc-700">还没有本周周报记录</p>
          <p className="text-xs text-zinc-400">点击下方按钮聚合本周数据</p>
          <button
            type="button"
            className="btn-primary mt-2 text-xs"
            onClick={() => generate.mutate()}
          >
            立即生成本周周报
          </button>
        </div>
      )}

      {r && (
        <div className="space-y-5">
          {/* Bento Hero Cockpit Card */}
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-xl">
            <div className="absolute -right-20 -top-20 size-64 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 size-56 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                {/* 评分刻度环 */}
                <div className="relative flex size-20 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-inner">
                  <div className="text-center">
                    <span className="text-2xl font-black">{r.score}</span>
                    <span className="block text-[10px] text-zinc-400 -mt-1">分</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-bold tracking-wider text-indigo-300 border border-indigo-400/30">
                      {r.grade} 级 · {r.title}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-white">生活活力指数</h2>
                  <p className="mt-0.5 text-xs text-zinc-300 max-w-md leading-relaxed">{r.personaSummary}</p>
                </div>
              </div>

              {/* 三大维度数据胶囊 */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/5 p-3.5 border border-white/10 md:min-w-[340px]">
                <div className="text-center">
                  <p className="text-[11px] text-zinc-400">待办完成率</p>
                  <p className="mt-0.5 text-lg font-black text-white">{r.todos.completionRate}%</p>
                  <p className="text-[10px] text-zinc-500">{r.todos.completed}/{r.todos.completed + r.todos.open}</p>
                </div>
                <div className="border-x border-white/10 text-center">
                  <p className="text-[11px] text-zinc-400">日均补水</p>
                  <p className="mt-0.5 text-lg font-black text-sky-400">{r.water.avgMlPerDay}ml</p>
                  <p className="text-[10px] text-zinc-500">达标 {r.water.goalHitDays}/7天</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-zinc-400">习惯满标</p>
                  <p className="mt-0.5 text-lg font-black text-emerald-400">
                    {r.habits.filter((h) => h.achieved).length}/{r.habits.length}
                  </p>
                  <p className="text-[10px] text-zinc-500">项达成</p>
                </div>
              </div>
            </div>
          </div>

          {/* 双列 Bento: 本周高光时刻 & 智能下周建议 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 高光 */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-amber-500" />
                <h3 className="section-title">本周高光时刻</h3>
              </div>
              <ul className="space-y-2">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-xl bg-amber-50/60 p-3 text-xs font-medium text-amber-950 border border-amber-100">
                    <span className="text-sm">🌟</span>
                    <span className="leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 建议 */}
            <div className="card border-indigo-100 bg-indigo-50/20">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="size-4 text-indigo-600" />
                <h3 className="section-title text-indigo-950">下周重点建议</h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  Smart
                </span>
              </div>
              <ul className="space-y-2">
                {r.suggestions && r.suggestions.map((s, i) => (
                  <li key={i} className="rounded-xl bg-white p-3 text-xs font-medium text-zinc-800 shadow-2xs border border-indigo-100/60 leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 🎯 待办执行效率 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-indigo-600" />
                <h3 className="section-title">待办执行节奏与重点攻克</h3>
              </div>
              <span className="text-xs font-bold text-indigo-600">完成率 {r.todos.completionRate}%</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 每日柱状图 */}
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <p className="text-[11px] font-medium text-zinc-500 mb-2">周内每日任务完成节奏</p>
                <div className="flex h-20 items-end gap-2">
                  {r.todos.dailyCompleted.map((count, i) => {
                    const max = Math.max(...r.todos.dailyCompleted, 1);
                    const height = (count / max) * 100;
                    const peak = count > 0 && count === Math.max(...r.todos.dailyCompleted);
                    return (
                      <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <span className={`text-[10px] font-semibold ${count > 0 ? "text-zinc-700" : "text-zinc-300"}`}>
                          {count}
                        </span>
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            peak ? "bg-indigo-600" : count > 0 ? "bg-indigo-300" : "bg-zinc-200"
                          }`}
                          style={{ height: `${Math.max(8, height)}%` }}
                        />
                        <span className={`text-[10px] font-bold ${peak ? "text-indigo-600" : "text-zinc-400"}`}>
                          {WEEKDAYS[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 斩获重点事项 */}
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 mb-2">本周攻克重点事项</p>
                  {r.todos.topCompleted && r.todos.topCompleted.length > 0 ? (
                    <div className="space-y-1.5">
                      {r.todos.topCompleted.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 border border-zinc-100 text-xs">
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                          <span className="flex-1 truncate font-medium text-zinc-800">{t.title}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${PRIORITY_CLASSES[t.priority]}`}>
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-zinc-400">本周未完成待办事项</p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-200 pt-2">
                  <span>完成 {r.todos.completed} 项</span>
                  <span>新建 {r.todos.created} 项</span>
                  <span>开放积压 {r.todos.open} 项</span>
                </div>
              </div>
            </div>
          </div>

          {/* 💧 水合与饮水节奏 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="size-4 text-sky-500" />
                <h3 className="section-title">水合与饮水节奏</h3>
              </div>
              <span className="text-xs font-bold text-sky-600">日均 {r.water.avgMlPerDay.toLocaleString()}ml</span>
            </div>

            <div className="rounded-xl bg-sky-50/50 p-4 border border-sky-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-sky-900">每日饮水量（目标 {r.water.goalMl}ml）</span>
                <span className="text-xs font-bold text-sky-700">达标 {r.water.goalHitDays}/7 天</span>
              </div>
              <div className="flex h-28 items-end gap-2">
                {r.water.dailyMl.map((ml, i) => {
                  const max = Math.max(...r.water.dailyMl, r.water.goalMl, 2000);
                  const height = max > 0 ? (ml / max) * 100 : 4;
                  const hit = ml >= r.water.goalMl && ml > 0;
                  const isBest = i === r.water.bestDayIndex && ml > 0;
                  return (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className={`text-[10px] tabular-nums font-semibold ${hit ? "text-sky-700" : "text-zinc-400"}`}>
                        {ml > 0 ? (ml >= 1000 ? `${(ml / 1000).toFixed(1)}k` : ml) : "-"}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          hit ? "bg-sky-500 shadow-xs" : ml > 0 ? "bg-sky-200" : "bg-zinc-200"
                        }`}
                        style={{ height: `${Math.max(6, height)}%` }}
                        title={`周${WEEKDAYS[i]}: ${ml}ml`}
                      />
                      <span className={`text-[10px] font-bold ${isBest ? "text-sky-700 underline" : "text-zinc-500"}`}>
                        {WEEKDAYS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 饮品分类 */}
              {r.water.drinkBreakdown && r.water.drinkBreakdown.length > 0 && (
                <div className="mt-4 pt-3 border-t border-sky-100 flex flex-wrap gap-2">
                  {r.water.drinkBreakdown.map((b) => (
                    <div
                      key={b.type}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs border border-sky-100 shadow-2xs"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: DRINK_COLORS[b.type] }} />
                      <span className="font-medium text-zinc-700">{DRINK_LABEL[b.type]}</span>
                      <span className="font-bold text-zinc-900">{b.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 🔥 习惯打卡 7 日矩阵 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-rose-500" />
                <h3 className="section-title">习惯打卡 7 日矩阵</h3>
              </div>
              <span className="text-xs text-zinc-400">连续性追踪</span>
            </div>

            {r.habits.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">本周暂无习惯记录</p>
            ) : (
              <div className="space-y-3">
                {/* 星期头部 */}
                <div className="flex items-center justify-end pr-2">
                  <div className="flex gap-2">
                    {WEEKDAYS.map((w, i) => (
                      <span key={i} className="w-6 text-center text-[10px] font-bold text-zinc-400">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                {r.habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 border border-zinc-100 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{h.icon}</span>
                      <span className="text-xs font-bold text-zinc-900">{h.name}</span>
                      <span className="text-[11px] tabular-nums text-zinc-500">
                        {h.done}/{h.targetPerWeek} 次
                      </span>
                      {h.achieved && (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          达标
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <div className="flex gap-2">
                        {h.dailyStatus.map((checked, idx) => (
                          <div
                            key={idx}
                            className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-all border ${
                              checked
                                ? "border-transparent text-white shadow-2xs"
                                : "border-zinc-200 bg-white text-zinc-300"
                            }`}
                            style={checked ? { backgroundColor: h.color || "#6366f1" } : {}}
                            title={`周${WEEKDAYS[idx]}: ${checked ? "已打卡" : "未打卡"}`}
                          >
                            {checked ? "✓" : "·"}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
