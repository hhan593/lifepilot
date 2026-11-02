import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, del, post } from '@/lib/api';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { HabitCard } from '@/components/habit-card';
import type { HabitWithStatus } from '@/lib/types';

const ICON_PRESETS = ['📚', '🏃', '🧘', '💪', '🥗', '🛏️', '✍️', '🎸', '💧', '🎯'];

export default function HabitsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_PRESETS[0]);
  const [target, setTarget] = useState(5);

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
    mutationFn: (input: { id: string; wasChecked: boolean }) => post(`/habits/${input.id}/check-ins`),
    onSuccess: (_res, input) => {
      void queryClient.invalidateQueries({ queryKey: ['habits'] });
      void (input.wasChecked ? hapticLight() : hapticSuccess());
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/habits/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const list = habits.data ?? [];
  const achievedCount = list.filter((h) => h.streak.achievedThisWeek).length;

  return (
    <View className="flex-1 bg-zinc-100" style={{ paddingTop: insets.top }}>
      {/* 头部标题 */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <View>
          <Text className="text-2xl font-black tracking-tight text-zinc-900">习惯养成</Text>
          <Text className="text-xs text-zinc-500">微习惯积蓄复利，宽容连击漏一天不清零</Text>
        </View>
        <View className="rounded-xl bg-white px-3 py-1.5 border border-zinc-200/80 shadow-2xs">
          <Text className="text-xs font-bold text-emerald-700">
            {achievedCount}/{list.length} 达标
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={habits.isRefetching}
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['habits'] })}
            tintColor="#4f46e5"
          />
        }
      >
        {/* 新建习惯 Bento Card */}
        <View className="mt-2 overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
          <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            创建新习惯
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              className="min-w-0 flex-1 rounded-2xl bg-zinc-50 border border-zinc-200/80 px-3.5 py-2.5 text-xs text-zinc-800"
              placeholder="习惯名称，如：睡前阅读 20 分钟"
              placeholderTextColor="#a1a1aa"
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => name.trim() && create.mutate()}
              returnKeyType="done"
            />
            <Pressable
              className="items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2.5 shadow-sm active:bg-indigo-700"
              onPress={() => name.trim() && create.mutate()}
              disabled={create.isPending || !name.trim()}
            >
              <Text className="text-xs font-bold text-white">创建</Text>
            </Pressable>
          </View>

          {/* 预设图标选择器 */}
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {ICON_PRESETS.map((i) => {
              const active = icon === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => setIcon(i)}
                  className={`size-9 items-center justify-center rounded-xl transition-all ${
                    active ? 'bg-indigo-50 border-2 border-indigo-600' : 'bg-zinc-50 border border-zinc-200/60'
                  }`}
                >
                  <Text className="text-base">{i}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 每周目标选择器 */}
          <View className="mt-3 flex-row items-center justify-between border-t border-zinc-100 pt-2.5">
            <Text className="text-xs font-medium text-zinc-500">每周目标频次</Text>
            <View className="flex-row gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                const active = target === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setTarget(n)}
                    className={`rounded-lg px-2.5 py-1 ${
                      active ? 'bg-zinc-900 shadow-2xs' : 'bg-zinc-100'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                      {n}天
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 习惯卡片列表 */}
        <View className="mt-4 gap-3">
          {habits.isLoading ? (
            <Text className="py-8 text-center text-xs text-zinc-400">加载习惯中…</Text>
          ) : list.length === 0 ? (
            <View className="items-center rounded-3xl bg-white p-8 border border-zinc-200/80">
              <Text className="text-4xl">🌱</Text>
              <Text className="mt-2 text-xs font-semibold text-zinc-700">暂无追踪的习惯</Text>
              <Text className="mt-0.5 text-[11px] text-zinc-400">在上方创建第一个微习惯，开启自律飞轮</Text>
            </View>
          ) : (
            list.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                onToggle={() => toggle.mutate({ id: h.id, wasChecked: h.todayChecked })}
                onDelete={() => remove.mutate(h.id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
