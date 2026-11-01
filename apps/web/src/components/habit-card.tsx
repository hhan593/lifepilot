"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { api, del, post } from "@/lib/api";
import type { HabitWithStatus } from "@/lib/types";

interface HistoryDay {
  date: string;
  checked: boolean;
}

export function HabitCard({ habit }: { habit: HabitWithStatus }) {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["habit-history", habit.id],
    queryFn: () => api<HistoryDay[]>(`/habits/${habit.id}/history`),
  });

  const toggle = useMutation({
    mutationFn: () => post(`/habits/${habit.id}/check-ins`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habit-history", habit.id] });
    },
  });

  const remove = useMutation({
    mutationFn: () => del(`/habits/${habit.id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["habits"] }),
  });

  const last7 = (history.data ?? []).slice(-7);
  const dayLabels = last7.map((d) => "周" + "日一二三四五六"[new Date(`${d.date}T00:00:00`).getDay()]);

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{habit.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{habit.name}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            本周 {habit.streak.thisWeekCount}/{habit.targetPerWeek} 次
            {habit.streak.streakWeeks > 0 && (
              <span className="ml-1.5 font-medium text-orange-500">🔥 连击 {habit.streak.streakWeeks} 周</span>
            )}
            {habit.streak.achievedThisWeek && <span className="ml-1.5 text-emerald-600">本周已达成 ✅</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => remove.mutate()}
          className="text-zinc-300 transition hover:text-red-500"
          aria-label="删除习惯"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle.mutate()}
          className={`flex size-10 items-center justify-center rounded-full border-2 transition ${
            habit.todayChecked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-200 text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
          }`}
          aria-label={habit.todayChecked ? "取消打卡" : "打卡"}
        >
          <Check className="size-5" />
        </button>
      </div>

      {last7.length > 0 && (
        <div className="mt-3 flex gap-1.5 border-t border-zinc-100 pt-3">
          {last7.map((d, i) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-400">{dayLabels[i]}</span>
              <span
                className={`size-2.5 rounded-full ${d.checked ? "bg-emerald-500" : "bg-zinc-200"}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
