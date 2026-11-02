import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, del, post } from '@/lib/api';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { TodoItem } from '@/components/todo-item';
import { PRIORITY_LABEL, TODO_PRIORITIES } from '@lifepilot/shared';
import type { TodoPriority } from '@lifepilot/shared';
import type { TodoData } from '@/lib/types';

type View2 = 'today' | 'upcoming' | 'done';
const VIEWS: { key: View2; label: string; icon: string }[] = [
  { key: 'today', label: '今日待办', icon: '☀️' },
  { key: 'upcoming', label: '即将到来', icon: '⏳' },
  { key: 'done', label: '已完成', icon: '✅' },
];

type DueChoice = 'none' | 'today' | 'tomorrow' | 'nextweek';
const DUE_CHOICES: { key: DueChoice; label: string }[] = [
  { key: 'none', label: '不限' },
  { key: 'today', label: '今天' },
  { key: 'tomorrow', label: '明天' },
  { key: 'nextweek', label: '下周一' },
];

function dueToDate(choice: DueChoice): string | undefined {
  const d = new Date();
  if (choice === 'today') d.setHours(20, 0, 0, 0);
  else if (choice === 'tomorrow') d.setDate(d.getDate() + 1), d.setHours(9, 0, 0, 0);
  else if (choice === 'nextweek') {
    const days = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
  } else return undefined;
  return d.toISOString();
}

export default function TodosScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View2>('today');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('MEDIUM');
  const [due, setDue] = useState<DueChoice>('none');

  const todos = useQuery({
    queryKey: ['todos', view],
    queryFn: () => api<TodoData[]>(`/todos?view=${view}`),
  });

  const create = useMutation({
    mutationFn: () => post('/todos', { title: title.trim(), priority, ...(dueToDate(due) ? { dueAt: dueToDate(due) } : {}) }),
    onSuccess: () => {
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api(`/todos/${input.id}`, { method: 'PATCH', body: JSON.stringify({ completed: input.completed }) }),
    onSuccess: (_res, input) => {
      void (input.completed ? hapticSuccess() : hapticLight());
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/todos/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const list = todos.data ?? [];
  const completedCount = list.filter((t) => t.completedAt !== null).length;

  return (
    <View className="flex-1 bg-zinc-100" style={{ paddingTop: insets.top }}>
      {/* 头部标题 */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <View>
          <Text className="text-2xl font-black tracking-tight text-zinc-900">任务待办</Text>
          <Text className="text-xs text-zinc-500">清晰推进每日核心要务</Text>
        </View>
        <View className="rounded-xl bg-white px-3 py-1.5 border border-zinc-200/80 shadow-2xs">
          <Text className="text-xs font-bold text-zinc-700">
            {list.length} 项任务
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={todos.isRefetching}
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['todos'] })}
            tintColor="#4f46e5"
          />
        }
      >
        {/* 新建任务 Bento Card */}
        <View className="mt-2 overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
          <View className="flex-row items-center gap-2">
            <TextInput
              className="min-w-0 flex-1 rounded-2xl bg-zinc-50 border border-zinc-200/80 px-3.5 py-2.5 text-xs text-zinc-800"
              placeholder="添加待办任务，回车保存…"
              placeholderTextColor="#a1a1aa"
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={() => title.trim() && create.mutate()}
              returnKeyType="done"
            />
            <Pressable
              className="items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2.5 shadow-sm active:bg-indigo-700"
              onPress={() => {
              if (title.trim()) {
                void hapticLight();
                create.mutate();
              }
            }}
              disabled={create.isPending || !title.trim()}
            >
              <Text className="text-xs font-bold text-white">添加</Text>
            </Pressable>
          </View>

          {/* 优先级 + 日期快捷选择 */}
          <View className="mt-3 flex-row items-center gap-1.5 border-t border-zinc-100 pt-2.5">
            <Text className="text-[11px] font-medium text-zinc-400 mr-1">优先级：</Text>
            {TODO_PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  className={`rounded-xl px-2.5 py-1 transition-all ${
                    active ? 'bg-zinc-900 shadow-2xs' : 'bg-zinc-50 border border-zinc-200/60'
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                    {PRIORITY_LABEL[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Text className="text-[11px] font-medium text-zinc-400 mr-1">日期：</Text>
            {DUE_CHOICES.map((c) => {
              const active = due === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setDue(c.key)}
                  className={`rounded-xl px-2.5 py-1 transition-all ${
                    active ? 'bg-indigo-600 shadow-2xs' : 'bg-zinc-50 border border-zinc-200/60'
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 视图分段选择器 Segmented Control */}
        <View className="mt-4 flex-row rounded-2xl bg-zinc-200/70 p-1">
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <Pressable
                key={v.key}
                onPress={() => setView(v.key)}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  active ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Text className="text-xs">{v.icon}</Text>
                <Text className={`text-xs font-bold ${active ? 'text-zinc-900' : 'text-zinc-500'}`}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 任务列表卡片 */}
        <View className="mt-4 overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
          {todos.isLoading ? (
            <Text className="py-8 text-center text-xs text-zinc-400">加载任务列表中…</Text>
          ) : list.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-3xl">🌿</Text>
              <Text className="mt-2 text-xs font-semibold text-zinc-700">没有待办事项</Text>
              <Text className="mt-0.5 text-[11px] text-zinc-400">享受当下或添加新任务开始推进</Text>
            </View>
          ) : (
            <View className="divide-y divide-zinc-100">
              {list.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  onToggle={(todo, completed) => toggle.mutate({ id: todo.id, completed })}
                  onDelete={(todo) => remove.mutate(todo.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
