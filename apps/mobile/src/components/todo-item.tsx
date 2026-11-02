import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TodoPriority } from '@lifepilot/shared';

export interface TodoItemData {
  id: string;
  title: string;
  notes: string | null;
  priority: TodoPriority;
  dueAt: string | null;
  completedAt: string | null;
}

const PRIORITY_BADGE: Record<TodoPriority, { bg: string; text: string; label: string }> = {
  URGENT: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: '紧急' },
  HIGH: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: '高' },
  MEDIUM: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: '中' },
  LOW: { bg: 'bg-zinc-100 border-zinc-200', text: 'text-zinc-600', label: '低' },
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

  const p = PRIORITY_BADGE[todo.priority] ?? PRIORITY_BADGE.MEDIUM;

  return (
    <View className="flex-row items-center gap-3 py-3">
      {/* 打勾 Checkbox */}
      <Pressable
        onPress={() => onToggle(todo, !done)}
        className={`size-5 items-center justify-center rounded-full border-2 transition-all ${
          done ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300 bg-white'
        }`}
        hitSlop={8}
      >
        {done && <Text className="text-[10px] font-bold text-white">✓</Text>}
      </Pressable>

      {/* 标题与附属信息 */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`flex-1 text-xs font-medium leading-relaxed ${
              done ? 'text-zinc-400 line-through' : 'text-zinc-800'
            }`}
          >
            {todo.title}
          </Text>
          <View className={`rounded-md px-1.5 py-0.5 border ${p.bg}`}>
            <Text className={`text-[9px] font-bold ${p.text}`}>{p.label}</Text>
          </View>
        </View>
        {overdue ? <Text className="mt-0.5 text-[10px] font-bold text-rose-500">已逾期</Text> : null}
      </View>

      {/* 删除按钮 */}
      {onDelete ? (
        <Pressable onPress={() => onDelete(todo)} hitSlop={10} className="pl-1">
          <Text className="text-xs text-zinc-300">✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
