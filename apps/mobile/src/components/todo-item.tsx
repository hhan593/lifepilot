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

const PRIORITY_DOT: Record<TodoPriority, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-sky-400',
  LOW: 'bg-zinc-300',
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
    <View className="flex-row items-center gap-3 py-2.5">
      <Pressable
        onPress={() => onToggle(todo, !done)}
        className={`size-5 items-center justify-center rounded-full border-2 ${
          done ? 'border-brand-600 bg-brand-600' : 'border-zinc-300'
        }`}
        hitSlop={8}
      >
        {done ? <Text className="text-xs text-white">✓</Text> : null}
      </Pressable>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <View className={`size-1.5 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
          <Text
            numberOfLines={1}
            className={`flex-1 text-sm ${done ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}
          >
            {todo.title}
          </Text>
        </View>
        {overdue ? <Text className="mt-0.5 pl-3.5 text-[11px] text-red-500">已过期</Text> : null}
      </View>

      {onDelete ? (
        <Pressable onPress={() => onDelete(todo)} hitSlop={8}>
          <Text className="text-xs text-zinc-300">删除</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
