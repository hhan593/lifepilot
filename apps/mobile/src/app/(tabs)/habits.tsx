import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, del, post } from '@/lib/api';
import { HabitCard } from '@/components/habit-card';
import type { HabitWithStatus } from '@/lib/types';

const ICON_PRESETS = ['📚', '🏃', '🧘', '💪', '🥗', '🛏️', '✍️', '🎸'];

export default function HabitsScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_PRESETS[0]);
  const [target, setTarget] = useState(7);

  const habits = useQuery({
    queryKey: ['habits'],
    queryFn: () => api<HabitWithStatus[]>('/habits'),
  });

  const create = useMutation({
    mutationFn: () => post('/habits', { name: name.trim(), icon, targetPerWeek: target }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (id: string) => post(`/habits/${id}/check-ins`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/habits/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  return (
    <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-zinc-900">习惯</Text>

      <View className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <View className="flex-row gap-2">
          <TextInput
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm"
            placeholder="新习惯，如：睡前读书 30 分钟"
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => name.trim() && create.mutate()}
            returnKeyType="done"
          />
          <Pressable
            className="items-center justify-center rounded-xl bg-brand-600 px-4"
            onPress={() => name.trim() && create.mutate()}
          >
            <Text className="text-sm font-semibold text-white">创建</Text>
          </Pressable>
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {ICON_PRESETS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              className={`size-9 items-center justify-center rounded-xl border text-lg ${
                icon === i ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'
              }`}
            >
              <Text>{i}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="mt-3 text-sm text-zinc-500">
          每周目标{'  '}
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Pressable
              key={n}
              onPress={() => setTarget(n)}
              className={`mx-0.5 inline rounded-lg px-2 py-0.5 ${target === n ? 'bg-brand-600' : 'bg-zinc-100'}`}
            >
              <Text className={`text-xs ${target === n ? 'text-white' : 'text-zinc-500'}`}>{n}</Text>
            </Pressable>
          ))}
          {'  '}
          <Text className="text-xs text-zinc-400">（宽容连击：漏一天不清零）</Text>
        </Text>
      </View>

      <View className="mt-4 gap-3">
        {habits.data === undefined ? (
          <Text className="text-center text-sm text-zinc-400">加载中…</Text>
        ) : habits.data.length === 0 ? (
          <View className="rounded-2xl border border-zinc-200 bg-white p-4">
            <Text className="text-center text-sm text-zinc-400">还没有习惯，先创建一个吧 🌱</Text>
          </View>
        ) : (
          habits.data.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              onToggle={() => toggle.mutate(h.id)}
              onDelete={() => remove.mutate(h.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
