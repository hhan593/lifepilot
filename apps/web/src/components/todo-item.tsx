"use client";

import { Trash2 } from "lucide-react";
import type { TodoPriority } from "@lifepilot/shared";

export interface TodoItemData {
  id: string;
  title: string;
  notes: string | null;
  priority: TodoPriority;
  dueAt: string | null;
  completedAt: string | null;
}

const PRIORITY_DOT: Record<TodoPriority, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-sky-400",
  LOW: "bg-zinc-300",
};

export function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoItemData;
  onToggle: (todo: TodoItemData, completed: boolean) => void;
  onDelete?: (todo: TodoItemData) => void;
}) {
  const done = todo.completedAt !== null;
  const overdue =
    !done && todo.dueAt !== null && new Date(todo.dueAt) < new Date(new Date().toDateString());

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        aria-label={done ? "标记未完成" : "完成"}
        onClick={() => onToggle(todo, !done)}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          done ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 hover:border-brand-500"
        }`}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-2">
            <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
          <p className={`truncate text-sm ${done ? "text-zinc-400 line-through" : ""}`}>
            {todo.title}
          </p>
        </div>
        {overdue && (
          <p className="mt-0.5 pl-3.5 text-[11px] text-red-500">已过期</p>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          aria-label="删除"
          onClick={() => onDelete(todo)}
          className="shrink-0 text-zinc-300 transition hover:text-red-500"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
