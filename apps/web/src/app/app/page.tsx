"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { TodoItem } from "@/components/todo-item";
import { WaterRing } from "@/components/water-ring";
import { WeatherCard } from "@/components/weather-card";
import { api, post } from "@/lib/api";
import type { CityWeather } from "@lifepilot/shared";
import type { WaterSummary } from "@/lib/types";
import type { HabitWithStatus, TodoData } from "@/lib/types";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [newTodo, setNewTodo] = useState("");

  const weather = useQuery({
    queryKey: ["weather"],
    queryFn: () =>
      api<CityWeather>("/weather").catch((err: { status?: number }) => {
        if (err.status === 404) return null;
        throw err;
      }),
  });

  const todos = useQuery({
    queryKey: ["todos", "today"],
    queryFn: () => api<TodoData[]>("/todos?view=today"),
  });

  const water = useQuery({
    queryKey: ["water", "summary"],
    queryFn: () => api<WaterSummary>("/water/summary"),
  });

  const habits = useQuery({
    queryKey: ["habits"],
    queryFn: () => api<HabitWithStatus[]>("/habits"),
  });

  const addTodo = useMutation({
    mutationFn: (title: string) => post("/todos", { title }),
    onSuccess: () => {
      setNewTodo("");
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const toggleTodo = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api(`/todos/${input.id}`, { method: "PATCH", body: JSON.stringify({ completed: input.completed }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const quickWater = useMutation({
    mutationFn: (amountMl: number) => post("/water/logs", { amountMl }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["water"] }),
  });

  const toggleHabit = useMutation({
    mutationFn: (id: string) => post(`/habits/${id}/check-ins`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["habits"] }),
  });

  const now = new Date();
  const greeting =
    now.getHours() < 6 ? "夜深了" : now.getHours() < 11 ? "早安" : now.getHours() < 14 ? "午安" : now.getHours() < 18 ? "下午好" : "晚上好";
  const dateLabel = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  const todayTodos = todos.data ?? [];
  const waterSummary = water.data;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">
          {greeting}
          <span className="ml-2 text-sm font-normal text-zinc-400">{dateLabel}</span>
        </h1>
      </header>

      {weather.data !== undefined && <WeatherCard data={weather.data} />}

      {/* 今日待办 */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="section-title">
            今日待办
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {todayTodos.length > 0 ? `${todayTodos.length} 项` : ""}
            </span>
          </h2>
          <a href="/app/todos" className="flex items-center text-xs text-zinc-400 hover:text-brand-600">
            全部 <ChevronRight className="size-3.5" />
          </a>
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTodo.trim()) addTodo.mutate(newTodo.trim());
          }}
        >
          <input
            className="input flex-1"
            placeholder="加一个待办，回车保存"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          />
          <button type="submit" className="btn-primary px-3" aria-label="添加待办">
            <Plus className="size-4" />
          </button>
        </form>

        <div className="divide-y divide-zinc-50">
          {todayTodos.slice(0, 6).map((t) => (
            <TodoItem key={t.id} todo={t} onToggle={(todo, completed) => toggleTodo.mutate({ id: todo.id, completed })} />
          ))}
          {todayTodos.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-400">今天没有待办，享受当下 🌿</p>
          )}
        </div>
        {todayTodos.length > 6 && (
          <a href="/app/todos" className="mt-2 block text-center text-xs text-brand-600">
            还有 {todayTodos.length - 6} 项，查看全部
          </a>
        )}
      </section>

      {/* 喝水 */}
      <section className="card flex items-center gap-5">
        {waterSummary ? (
          <>
            <WaterRing
              hydrationMl={waterSummary.hydrationMl}
              goalMl={waterSummary.goalMl}
              percent={waterSummary.percent}
            />
            <div className="flex-1">
              <h2 className="section-title">喝水打卡</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {waterSummary.remainingMl > 0
                  ? `还差 ${waterSummary.remainingMl.toLocaleString()}ml 达标`
                  : "今日已达标，棒！🎉"}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => quickWater.mutate(250)}>
                  +250ml
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => quickWater.mutate(500)}>
                  +500ml
                </button>
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => quickWater.mutate(250)}>
                  记一杯
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="flex-1 py-6 text-center text-sm text-zinc-400">喝水数据加载中…</p>
        )}
      </section>

      {/* 习惯 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">今日习惯</h2>
          <a href="/app/habits" className="flex items-center text-xs text-zinc-400 hover:text-brand-600">
            管理 <ChevronRight className="size-3.5" />
          </a>
        </div>
        {(habits.data ?? []).length === 0 ? (
          <div className="card text-center text-sm text-zinc-400">
            还没有习惯，<a href="/app/habits" className="text-brand-600">去创建一个</a> 👇
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {(habits.data ?? []).map((h) => (
              <div key={h.id} className="card w-32 shrink-0 text-center">
                <div className="text-3xl">{h.icon}</div>
                <p className="mt-1.5 truncate text-xs font-medium">{h.name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  {h.streak.streakWeeks > 0 ? `🔥 连击 ${h.streak.streakWeeks} 周` : `本周 ${h.streak.thisWeekCount}/${h.targetPerWeek}`}
                </p>
                <button
                  type="button"
                  onClick={() => toggleHabit.mutate(h.id)}
                  className={`mx-auto mt-2 flex size-9 items-center justify-center rounded-full border-2 transition ${
                    h.todayChecked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-200 text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                  }`}
                  aria-label={h.todayChecked ? "取消打卡" : "打卡"}
                >
                  <Check className="size-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
