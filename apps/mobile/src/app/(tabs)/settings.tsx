import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { api, del, patch, post } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ensureNotificationPermission, syncWaterReminders } from '@/lib/notifications';
import { ACTIVITY_LABEL, ACTIVITY_LEVELS, calcWaterGoalMl } from '@lifepilot/shared';
import type { ActivityLevel } from '@lifepilot/shared';
import type { CityData, GeocodeItem, MeData } from '@/lib/types';

const DAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeData>('/users/me') });
  const cities = useQuery({ queryKey: ['cities'], queryFn: () => api<CityData[]>('/cities') });

  const [form, setForm] = useState<Partial<MeData['settings']>>({});
  const s = { ...(me.data?.settings ?? {}), ...form };
  const update = (p: Partial<MeData['settings']>) => setForm((f) => ({ ...f, ...p }));

  const save = useMutation({
    mutationFn: () => patch('/users/me/settings', form),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['water'] });
      setForm({});
      // 本地喝水提醒跟随设置同步到系统通知
      if (form.waterReminderEnabled !== undefined || form.waterReminderTimes !== undefined) {
        const granted = await ensureNotificationPermission();
        if (granted) {
          const n = await syncWaterReminders(s.waterReminderTimes ?? [], s.waterReminderEnabled ?? true);
          Alert.alert('已保存', `已在本机设置 ${n} 个喝水提醒`);
        } else {
          Alert.alert('已保存', '但通知权限未开启，提醒不会生效');
        }
      } else {
        Alert.alert('已保存');
      }
    },
    onError: (e) => Alert.alert('保存失败', e instanceof Error ? e.message : '未知错误'),
  });

  useEffect(() => {
    if (me.data && Object.keys(form).length === 0) {
      // 首次加载后把提醒同步到本地通知（静默，不弹窗）
      void (async () => {
        const granted = await ensureNotificationPermission().catch(() => false);
        if (granted) await syncWaterReminders(me.data!.settings.waterReminderTimes, me.data!.settings.waterReminderEnabled);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  // ---- 城市 ----
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const searchCity = async () => {
    if (!query.trim()) return;
    setResults(await api<GeocodeItem[]>(`/cities/search?q=${encodeURIComponent(query.trim())}`).catch(() => []));
  };
  const addCity = useMutation({
    mutationFn: (item: GeocodeItem) =>
      post('/cities', { name: item.name, label: item.label, latitude: item.latitude, longitude: item.longitude }),
    onSuccess: () => {
      setQuery('');
      setResults([]);
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['weather'] });
    },
  });
  const setPrimary = useMutation({
    mutationFn: (id: string) => patch(`/cities/${id}/primary`, { isPrimary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['weather'] });
    },
  });
  const removeCity = useMutation({
    mutationFn: (id: string) => del(`/cities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['weather'] });
    },
  });

  const goalPreview = s.weightKg != null ? calcWaterGoalMl(s.weightKg, (s.activityLevel as ActivityLevel) ?? 'LIGHT') : null;
  const dirty = Object.keys(form).length > 0;

  return (
    <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
      <Text className="text-xl font-bold text-zinc-900">设置</Text>

      <View className="mt-4 gap-4">
        <View className="rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">账号</Text>
          <Text className="mt-1.5 text-sm text-zinc-600">{me.data?.email ?? '…'}</Text>
          <Text className="text-xs text-zinc-400">时区：{me.data?.timezone ?? '…'}</Text>
        </View>

        <View className="rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">天气城市</Text>
          <View className="mt-3 flex-row gap-2">
            <TextInput
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
              placeholder="搜索城市，如：上海"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void searchCity()}
              returnKeyType="search"
            />
            <Pressable className="items-center justify-center rounded-xl bg-brand-600 px-4" onPress={() => void searchCity()}>
              <Text className="text-xs font-semibold text-white">搜索</Text>
            </Pressable>
          </View>
          {results.map((r, i) => (
            <Pressable
              key={i}
              className="mt-2 flex-row items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"
              onPress={() => addCity.mutate(r)}
            >
              <Text className="flex-1 text-sm text-zinc-700">{r.label}</Text>
              <Text className="text-xs text-brand-600">添加</Text>
            </Pressable>
          ))}
          {cities.data?.map((c) => (
            <View key={c.id} className="mt-2 flex-row items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
              <Text className="flex-1 text-sm text-zinc-700">{c.name}</Text>
              {c.isPrimary ? (
                <Text className="text-xs text-brand-600">★ 默认</Text>
              ) : (
                <Pressable onPress={() => setPrimary.mutate(c.id)} hitSlop={6}>
                  <Text className="text-xs text-zinc-400">设为默认</Text>
                </Pressable>
              )}
              <Pressable onPress={() => removeCity.mutate(c.id)} hitSlop={6}>
                <Text className="text-xs text-zinc-300">删除</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View className="gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">饮水目标</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">体重 (kg)</Text>
              <TextInput
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
                keyboardType="number-pad"
                value={s.weightKg != null ? String(s.weightKg) : ''}
                onChangeText={(v) => update({ weightKg: v ? Number(v) : null })}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">活动量</Text>
              <View className="flex-row flex-wrap gap-1">
                {ACTIVITY_LEVELS.map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => update({ activityLevel: l })}
                    className={`rounded-lg px-2 py-1 ${(s.activityLevel ?? 'LIGHT') === l ? 'bg-brand-600' : 'bg-zinc-100'}`}
                  >
                    <Text className={`text-xs ${(s.activityLevel ?? 'LIGHT') === l ? 'text-white' : 'text-zinc-500'}`}>
                      {ACTIVITY_LABEL[l]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          {goalPreview ? (
            <Text className="text-xs text-zinc-400">按体重和活动量推荐：{goalPreview.toLocaleString()}ml/天</Text>
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">每日目标 (ml)</Text>
              <TextInput
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
                keyboardType="number-pad"
                value={String(s.waterGoalMl ?? 2000)}
                onChangeText={(v) => update({ waterGoalMl: Number(v) || 0 })}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">一杯容量 (ml)</Text>
              <TextInput
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
                keyboardType="number-pad"
                value={String(s.cupSizeMl ?? 250)}
                onChangeText={(v) => update({ cupSizeMl: Number(v) || 0 })}
              />
            </View>
          </View>
        </View>

        <View className="gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">喝水提醒（本机通知）</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-zinc-700">开启提醒</Text>
            <Switch
              value={s.waterReminderEnabled ?? true}
              onValueChange={(v) => update({ waterReminderEnabled: v })}
              trackColor={{ true: '#4f46e5' }}
            />
          </View>
          <Text className="text-xs text-zinc-400">
            提醒时间：{(s.waterReminderTimes ?? []).join('、') || '未设置'}（保存后写入系统日历式本地通知；
            网页端「设置」里改时间点会同步到 App）
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">免打扰开始</Text>
              <TextInput
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
                value={s.quietStart ?? '22:00'}
                onChangeText={(v) => update({ quietStart: v })}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-medium text-zinc-500">免打扰结束</Text>
              <TextInput
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm"
                value={s.quietEnd ?? '08:00'}
                onChangeText={(v) => update({ quietEnd: v })}
              />
            </View>
          </View>
        </View>

        <View className="gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">周报生成时间</Text>
          <Text className="text-xs text-zinc-500">
            每周{DAY_LABELS[s.weeklyReportDay ?? 5]} {String(s.weeklyReportHour ?? 17).padStart(2, '0')}:00
            自动生成并推送（推送令牌在 App 登录后自动注册）
          </Text>
          <View className="flex-row flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Pressable
                key={d}
                onPress={() => update({ weeklyReportDay: d })}
                className={`rounded-lg px-2.5 py-1 ${(s.weeklyReportDay ?? 5) === d ? 'bg-brand-600' : 'bg-zinc-100'}`}
              >
                <Text className={`text-xs ${(s.weeklyReportDay ?? 5) === d ? 'text-white' : 'text-zinc-500'}`}>
                  {DAY_LABELS[d]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-1">
            {[8, 12, 17, 21, 22].map((h) => (
              <Pressable
                key={h}
                onPress={() => update({ weeklyReportHour: h })}
                className={`rounded-lg px-2.5 py-1 ${(s.weeklyReportHour ?? 17) === h ? 'bg-brand-600' : 'bg-zinc-100'}`}
              >
                <Text className={`text-xs ${(s.weeklyReportHour ?? 17) === h ? 'text-white' : 'text-zinc-500'}`}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          className="items-center rounded-2xl border border-red-100 bg-white py-3"
          onPress={() =>
            Alert.alert('退出登录', '确定要退出当前账号吗？', [
              { text: '取消', style: 'cancel' },
              { text: '退出', style: 'destructive', onPress: () => void logout() },
            ])
          }
        >
          <Text className="text-sm font-medium text-red-500">退出登录</Text>
        </Pressable>
      </View>

      {dirty ? (
        <View className="mt-4">
          <Pressable
            className="items-center rounded-xl bg-brand-600 py-3.5 active:opacity-80"
            onPress={() => save.mutate()}
            disabled={save.isPending}
          >
            <Text className="text-sm font-semibold text-white">{save.isPending ? '保存中…' : '保存设置'}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
