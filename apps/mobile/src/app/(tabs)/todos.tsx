import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, del, post } from '@/lib/api';
import { TodoItem } from '@/components/todo-item';
import { PRIORITY_LABEL, TODO_PRIORITIES } from '@lifepilot/shared';
import type { TodoPriority } from '@lifepilot/shared';
import type { TodoData } from '@/lib/types';

type View2 = 'today' | 'upcoming' | 'done';
const VIEWS: { key: View2; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'upcoming', label: '即将到来' },
  { key: 'done', label: '已完成' },
];

export default function TodosScreen() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View2>('today');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');

  const todos = useQuery({
    queryKey: ['todos', view],
    queryFn: () => api<TodoData[]>(`/todos?view=${view}`),
  });

  const create = useMutation({
    mutationFn: () => post('/todos', { title: title.trim(), priority }),
    onSuccess: () => {
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api(`/todos/${input.id}`, { method: 'PATCH', body: JSON.stringify({ completed: input.completed }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/todos/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  return (
    <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-zinc-900">待办</Text>

      <View className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <View className="flex-row gap-2">
          <TextInput
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm"
            placeholder="要做什么？"
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => title.trim() && create.mutate()}
            returnKeyType="done"
          />
          <Pressable
            className="items-center justify-center rounded-xl bg-brand-600 px-4"
            onPress={() => title.trim() && create.mutate()}
          >
            <Text className="text-sm font-semibold text-white">添加</Text>
          </Pressable>
        </View>
        <View className="mt-2 flex-row gap-2">
          {TODO_PRIORITIES.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              className={`rounded-full px-3 py-1 text-xs ${
                priority === p ? 'bg-brand-600' : 'border border-zinc-200 bg-white'
              }`}
            >
              <Text className={`text-xs ${priority === p ? 'text-white' : 'text-zinc-500'}`}>
                {PRIORITY_LABEL[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-4 flex-row gap-1.5">
        {VIEWS.map((v) => (
          <Pressable
            key={v.key}
            onPress={() => setView(v.key)}
            className={`rounded-full px-3.5 py-1.5 ${
              view === v.key ? 'bg-brand-600' : 'border border-zinc-200 bg-white'
            }`}
          >
            <Text className={`text-xs font-medium ${view === v.key ? 'text-white' : 'text-zinc-500'}`}>
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {todos.data === undefined ? (
          <Text className="py-6 text-center text-sm text-zinc-400">加载中…</Text>
        ) : todos.data.length === 0 ? (
          <Text className="py-6 text-center text-sm text-zinc-400">这里空空如也 ✨</Text>
        ) : (
          todos.data.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={(todo, completed) => toggle.mutate({ id: todo.id, completed })}
              onDelete={(todo) => remove.mutate(todo.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
