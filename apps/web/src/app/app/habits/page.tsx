"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { HabitCard } from "@/components/habit-card";
import { api, post } from "@/lib/api";
import type { HabitWithStatus } from "@/lib/types";

const ICON_PRESETS = ["📚", "🏃", "🧘", "💪", "🥗", "🛏️", "✍️", "🎸"];

export default function HabitsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_PRESETS[0]);
  const [target, setTarget] = useState(7);

  const habits = useQuery({
    queryKey: ["habits"],
    queryFn: () => api<HabitWithStatus[]>("/habits"),
  });

  const create = useMutation({
    mutationFn: () => post("/habits", { name: name.trim(), icon, targetPerWeek: target }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">习惯</h1>

      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="新习惯，如：睡前读书 30 分钟"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn-primary px-3" aria-label="创建习惯">
            <Plus className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {ICON_PRESETS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`flex size-9 items-center justify-center rounded-xl border text-lg transition ${
                icon === i ? "border-brand-500 bg-brand-50" : "border-zinc-200"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          每周目标
          <select
            className="input w-24 py-1.5"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} 次
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-400">（宽容连击：漏一天不清零）</span>
        </div>
      </form>

      <div className="space-y-3">
        {habits.data === undefined && <p className="text-center text-sm text-zinc-400">加载中…</p>}
        {habits.data !== undefined && habits.data.length === 0 && (
          <div className="card text-center text-sm text-zinc-400">还没有习惯，先创建一个吧 🌱</div>
        )}
        {habits.data?.map((h) => (
          <HabitCard key={h.id} habit={h} />
        ))}
      </div>
    </div>
  );
}
