"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { TodoItem } from "@/components/todo-item";
import { api, del, post } from "@/lib/api";
import { PRIORITY_LABEL, TODO_PRIORITIES } from "@lifepilot/shared";
import type { TodoPriority } from "@lifepilot/shared";
import type { TodoData } from "@/lib/types";

type View = "today" | "upcoming" | "done";
const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "upcoming", label: "即将到来" },
  { key: "done", label: "已完成" },
];

export default function TodosPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("today");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");

  const todos = useQuery({
    queryKey: ["todos", view],
    queryFn: () => api<TodoData[]>(`/todos?view=${view}`),
  });

  const create = useMutation({
    mutationFn: () =>
      post("/todos", {
        title: title.trim(),
        priority,
        ...(dueDate ? { dueAt: new Date(`${dueDate}T09:00:00`).toISOString() } : {}),
      }),
    onSuccess: () => {
      setTitle("");
      setDueDate("");
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api(`/todos/${input.id}`, { method: "PATCH", body: JSON.stringify({ completed: input.completed }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/todos/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const upcomingHint = (t: TodoData) =>
    view !== "today" || !t.dueAt
      ? null
      : t.dueAt < new Date().toISOString() && new Date(t.dueAt) < new Date(new Date().toDateString())
        ? "已过期"
        : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">待办</h1>

      <form
        className="card space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="要做什么？"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn-primary px-3" aria-label="添加">
            <Plus className="size-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="input w-40"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <select
            className="input w-28"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
          >
            {TODO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </form>

      <div className="flex gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              view === v.key ? "bg-brand-600 text-white" : "bg-white text-zinc-500 border border-zinc-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-zinc-50">
        {todos.data === undefined && <p className="py-6 text-center text-sm text-zinc-400">加载中…</p>}
        {todos.data !== undefined && todos.data.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">这里空空如也 ✨</p>
        )}
        {todos.data?.map((t) => (
          <div key={t.id}>
            <TodoItem
              todo={t}
              onToggle={(todo, completed) => toggle.mutate({ id: todo.id, completed })}
              onDelete={(todo) => remove.mutate(todo.id)}
            />
            {upcomingHint(t) && <p className="-mt-1 pb-1.5 pl-8 text-[11px] text-red-500">已过期</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
