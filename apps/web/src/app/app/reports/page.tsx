"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, FileText } from "lucide-react";
import { api, post } from "@/lib/api";
import type { WeeklyReportPayload } from "@lifepilot/shared";

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const report = useQuery({
    queryKey: ["reports", "latest"],
    queryFn: () =>
      api<WeeklyReportPayload>("/reports/weekly").catch((err: { status?: number }) => {
        if (err.status === 404) return null;
        throw err;
      }),
  });

  const generate = useMutation({
    mutationFn: () => post<WeeklyReportPayload>("/reports/weekly/generate", {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  async function copyMarkdown(markdown: string) {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const r = report.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">周报</h1>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? "生成中…" : "生成本周周报"}
        </button>
      </div>

      {report.data === undefined && <p className="text-center text-sm text-zinc-400">加载中…</p>}

      {report.data !== undefined && r === null && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <FileText className="size-8 text-zinc-300" />
          <p className="text-sm text-zinc-500">还没有周报，点右上角「生成本周周报」试试</p>
        </div>
      )}

      {r && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                {r.weekStart.slice(5).replace("-", ".")} – {r.weekEnd.slice(5).replace("-", ".")}
              </h2>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1 text-xs"
                onClick={() => copyMarkdown(r.markdown)}
              >
                <Copy className="size-3.5" />
                {copied ? "已复制" : "复制 Markdown"}
              </button>
            </div>

            {r.highlights.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {r.highlights.map((h, i) => (
                  <li key={i} className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs text-zinc-400">待办完成率</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{r.todos.completionRate}%</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                完成 {r.todos.completed} / 创建 {r.todos.created}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-zinc-400">日均饮水</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {r.water.avgMlPerDay.toLocaleString()}
                <span className="text-sm font-normal text-zinc-400">ml</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">达标 {r.water.goalHitDays}/7 天</p>
            </div>
          </div>

          {/* 每日饮水量 */}
          <div className="card">
            <p className="section-title">每日饮水</p>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {r.water.dailyMl.map((ml, i) => {
                const max = Math.max(...r.water.dailyMl, r.water.goalMl);
                const height = max > 0 ? Math.max(4, (ml / max) * 100) : 4;
                const hit = ml >= r.water.goalMl && ml > 0;
                return (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className={`w-full rounded-t-md ${hit ? "bg-sky-400" : "bg-zinc-200"}`}
                      style={{ height: `${height}%` }}
                      title={`${ml.toLocaleString()}ml`}
                    />
                    <span className="text-[10px] text-zinc-400">
                      {"一二三四五六日"[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 习惯 */}
          <div className="card">
            <p className="section-title">习惯</p>
            {r.habits.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">本周暂无习惯记录</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {r.habits.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    <span>{h.icon}</span>
                    <span className="flex-1 truncate">{h.name}</span>
                    <span className="tabular-nums text-zinc-400">
                      {h.done}/{h.targetPerWeek}
                    </span>
                    {h.achieved && <span className="text-emerald-600">✅</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
