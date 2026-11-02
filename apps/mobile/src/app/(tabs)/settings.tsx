import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, del, patch, post } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ensureNotificationPermission, syncWaterReminders } from '@/lib/notifications';
import { ACTIVITY_LABEL, ACTIVITY_LEVELS, calcWaterGoalMl } from '@lifepilot/shared';
import type { ActivityLevel } from '@lifepilot/shared';
import type { CityData, GeocodeItem, MeData } from '@/lib/types';

const DAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WATER_GOAL_PRESETS = [1800, 2000, 2400, 2800, 3200];
const CUP_SIZE_PRESETS = [200, 250, 350, 500];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
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
      if (form.waterReminderEnabled !== undefined || form.waterReminderTimes !== undefined) {
        const granted = await ensureNotificationPermission();
        if (granted) {
          const n = await syncWaterReminders(s.waterReminderTimes ?? [], s.waterReminderEnabled ?? true);
          Alert.alert('设置已保存', `已在本机同步 ${n} 个喝水提醒`);
        } else {
          Alert.alert('设置已保存', '注意：通知权限未开启，提醒可能无法生效');
        }
      } else {
        Alert.alert('设置已保存', '个性化偏好已更新');
      }
    },
    onError: (e) => Alert.alert('保存失败', e instanceof Error ? e.message : '网络异常，请重试'),
  });

  useEffect(() => {
    if (me.data && Object.keys(form).length === 0) {
      void (async () => {
        const granted = await ensureNotificationPermission().catch(() => false);
        if (granted) await syncWaterReminders(me.data!.settings.waterReminderTimes, me.data!.settings.waterReminderEnabled);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  // 城市搜索
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchCity = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await api<GeocodeItem[]>(`/cities/search?q=${encodeURIComponent(query.trim())}`).catch(() => []);
      setResults(res);
    } finally {
      setIsSearching(false);
    }
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
  const emailPrefix = me.data?.email ? me.data.email[0].toUpperCase() : 'U';

  return (
    <View className="flex-1 bg-zinc-100" style={{ paddingTop: insets.top }}>
      {/* 顶部标题栏 */}
      <View className="px-5 pt-3 pb-2">
        <Text className="text-2xl font-black tracking-tight text-zinc-900">偏好设置</Text>
        <Text className="text-xs text-zinc-500">个性化目标、提醒调度与驾驶舱规则</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: dirty ? 140 : 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 账号资料 Hero Card */}
        <View className="mt-2 overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
          <View className="flex-row items-center gap-3.5">
            <View className="size-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
              <Text className="text-xl font-black text-white">{emailPrefix}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text numberOfLines={1} className="text-base font-bold text-zinc-900">
                  {me.data?.email ?? '加载中…'}
                </Text>
                <View className="rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-200/60">
                  <Text className="text-[10px] font-bold text-emerald-700">在线</Text>
                </View>
              </View>
              <Text className="mt-0.5 text-xs text-zinc-400">
                时区：{me.data?.timezone ?? 'Asia/Shanghai'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. 天气城市与定位 */}
        <View className="mt-5">
          <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            天气城市与定位
          </Text>
          <View className="overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
            <View className="flex-row items-center gap-2">
              <TextInput
                className="min-w-0 flex-1 rounded-xl bg-zinc-50 border border-zinc-200/80 px-3.5 py-2.5 text-xs text-zinc-800"
                placeholder="搜索城市，如：北京、杭州、深圳"
                placeholderTextColor="#a1a1aa"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void searchCity()}
                returnKeyType="search"
              />
              <Pressable
                className="items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 active:bg-zinc-800"
                onPress={() => void searchCity()}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-xs font-bold text-white">搜索</Text>
                )}
              </Pressable>
            </View>

            {/* 搜索结果 */}
            {results.length > 0 && (
              <View className="mt-3 gap-1.5 border-t border-zinc-100 pt-3">
                <Text className="text-[11px] font-medium text-zinc-400">搜索匹配结果：</Text>
                {results.map((r, i) => (
                  <Pressable
                    key={i}
                    className="flex-row items-center justify-between rounded-xl bg-indigo-50/60 px-3 py-2 border border-indigo-100"
                    onPress={() => addCity.mutate(r)}
                  >
                    <Text className="flex-1 text-xs font-medium text-indigo-950">{r.label}</Text>
                    <Text className="text-xs font-bold text-indigo-600">+ 添加</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* 当前添加的城市列表 */}
            <View className="mt-3 gap-2">
              {cities.data?.map((c) => (
                <View
                  key={c.id}
                  className="flex-row items-center justify-between rounded-2xl bg-zinc-50/80 px-3.5 py-2.5 border border-zinc-200/50"
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm">📍</Text>
                    <Text className="text-xs font-bold text-zinc-800">{c.name}</Text>
                    {c.isPrimary && (
                      <View className="rounded-full bg-amber-50 px-2 py-0.5 border border-amber-200/60">
                        <Text className="text-[10px] font-bold text-amber-700">★ 默认主城市</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2.5">
                    {!c.isPrimary && (
                      <Pressable onPress={() => setPrimary.mutate(c.id)} hitSlop={8}>
                        <Text className="text-xs font-medium text-indigo-600">设为默认</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => removeCity.mutate(c.id)} hitSlop={8}>
                      <Text className="text-xs font-medium text-zinc-400">删除</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 3. 水分目标与个性化折算 */}
        <View className="mt-5">
          <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            水合目标与个性化推荐
          </Text>
          <View className="overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80 gap-4">
            {/* 体重与活动量 */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-zinc-700">体重 (kg)</Text>
                <View className="flex-row items-center rounded-xl bg-zinc-50 border border-zinc-200/80 px-3 py-2">
                  <TextInput
                    className="flex-1 text-xs font-bold text-zinc-800"
                    placeholder="如 65"
                    keyboardType="number-pad"
                    value={s.weightKg != null ? String(s.weightKg) : ''}
                    onChangeText={(v) => update({ weightKg: v ? Number(v) : null })}
                  />
                  <Text className="text-[11px] text-zinc-400">kg</Text>
                </View>
              </View>

              <View className="flex-2">
                <Text className="mb-1 text-xs font-semibold text-zinc-700">日常活动量</Text>
                <View className="flex-row gap-1">
                  {ACTIVITY_LEVELS.map((l) => {
                    const active = (s.activityLevel ?? 'LIGHT') === l;
                    return (
                      <Pressable
                        key={l}
                        onPress={() => update({ activityLevel: l })}
                        className={`flex-1 items-center justify-center rounded-xl py-2 transition-all ${
                          active ? 'bg-indigo-600 shadow-2xs' : 'bg-zinc-50 border border-zinc-200/60'
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                          {ACTIVITY_LABEL[l]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 智能推荐提示 */}
            {goalPreview ? (
              <View className="rounded-2xl bg-sky-50/70 p-3 border border-sky-100 flex-row items-center gap-2">
                <Text className="text-sm">💧</Text>
                <Text className="flex-1 text-xs font-medium text-sky-950">
                  按体重与活动量计算，科学推荐目标为{' '}
                  <Text className="font-bold text-sky-700">{goalPreview.toLocaleString()} ml / 天</Text>
                </Text>
              </View>
            ) : null}

            {/* 目标量快捷预设 */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-semibold text-zinc-700">每日饮水目标 (ml)</Text>
                <Text className="text-xs font-bold text-indigo-600">{s.waterGoalMl ?? 2000} ml</Text>
              </View>
              <View className="flex-row gap-1.5">
                {WATER_GOAL_PRESETS.map((p) => {
                  const active = (s.waterGoalMl ?? 2000) === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => update({ waterGoalMl: p })}
                      className={`flex-1 items-center justify-center rounded-xl py-2 ${
                        active ? 'bg-zinc-900' : 'bg-zinc-50 border border-zinc-200/60'
                      }`}
                    >
                      <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 一杯容量 */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-semibold text-zinc-700">常用单杯容量 (ml)</Text>
                <Text className="text-xs font-bold text-indigo-600">{s.cupSizeMl ?? 250} ml</Text>
              </View>
              <View className="flex-row gap-2">
                {CUP_SIZE_PRESETS.map((c) => {
                  const active = (s.cupSizeMl ?? 250) === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => update({ cupSizeMl: c })}
                      className={`flex-1 items-center justify-center rounded-xl py-2 ${
                        active ? 'bg-indigo-600' : 'bg-zinc-50 border border-zinc-200/60'
                      }`}
                    >
                      <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                        {c}ml
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* 4. 定时喝水提醒与免打扰 */}
        <View className="mt-5">
          <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            定时喝水提醒与勿扰
          </Text>
          <View className="overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80 gap-3.5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-zinc-900">开启喝水提醒</Text>
                <Text className="mt-0.5 text-[11px] text-zinc-400">写入本地系统通知，离线也可准时唤醒</Text>
              </View>
              <Switch
                value={s.waterReminderEnabled ?? true}
                onValueChange={(v) => update({ waterReminderEnabled: v })}
                trackColor={{ true: '#6366f1', false: '#e4e4e7' }}
              />
            </View>

            {/* 提醒时间点展示 */}
            <View className="rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
              <Text className="text-[11px] font-semibold text-zinc-500 mb-1.5">预设计划提醒时间点：</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(s.waterReminderTimes ?? ['10:00', '12:30', '15:00', '18:00', '21:00']).map((t) => (
                  <View key={t} className="rounded-lg bg-white px-2.5 py-1 border border-zinc-200/80">
                    <Text className="text-[11px] font-bold text-indigo-700">{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 免打扰区间 */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-zinc-700">免打扰起始</Text>
                <TextInput
                  className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-3 py-2 text-xs font-bold text-zinc-800"
                  value={s.quietStart ?? '22:00'}
                  onChangeText={(v) => update({ quietStart: v })}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs font-semibold text-zinc-700">免打扰结束</Text>
                <TextInput
                  className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-3 py-2 text-xs font-bold text-zinc-800"
                  value={s.quietEnd ?? '08:00'}
                  onChangeText={(v) => update({ quietEnd: v })}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 5. 自动周报推送规则 */}
        <View className="mt-5">
          <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
            自动周报生成规则
          </Text>
          <View className="overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80 gap-3">
            <Text className="text-xs text-zinc-500">
              系统将根据时区在设定的周期点自动生成结构化复盘与推送：
            </Text>

            {/* 星期选择 */}
            <View className="flex-row gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const active = (s.weeklyReportDay ?? 5) === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => update({ weeklyReportDay: d })}
                    className={`flex-1 items-center justify-center rounded-xl py-2 ${
                      active ? 'bg-indigo-600' : 'bg-zinc-50 border border-zinc-200/60'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                      {DAY_LABELS[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 时间点选择 */}
            <View className="flex-row gap-1.5">
              {[8, 12, 17, 20, 22].map((h) => {
                const active = (s.weeklyReportHour ?? 17) === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => update({ weeklyReportHour: h })}
                    className={`flex-1 items-center justify-center rounded-xl py-2 ${
                      active ? 'bg-zinc-900' : 'bg-zinc-50 border border-zinc-200/60'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-zinc-600'}`}>
                      {String(h).padStart(2, '0')}:00
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 6. 退出登录操作 */}
        <View className="mt-6">
          <Pressable
            className="items-center justify-center rounded-2xl bg-red-50/80 py-3.5 border border-red-100 active:bg-red-100"
            onPress={() =>
              Alert.alert('退出登录', '确定要退出当前账号吗？', [
                { text: '取消', style: 'cancel' },
                { text: '退出登录', style: 'destructive', onPress: () => void logout() },
              ])
            }
          >
            <Text className="text-xs font-bold text-red-600">退出当前账号</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 底部悬浮保存条 */}
      {dirty && (
        <View
          className="absolute inset-x-4 z-50 flex-row items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 shadow-2xl border border-zinc-800"
          style={{ bottom: Math.max(16, insets.bottom + 10) }}
        >
          <View>
            <Text className="text-xs font-bold text-white">检测到配置已修改</Text>
            <Text className="text-[10px] text-zinc-400">点击右侧按钮立即同步</Text>
          </View>
          <Pressable
            className="rounded-xl bg-indigo-600 px-4 py-2 active:bg-indigo-700"
            onPress={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-xs font-bold text-white">保存设置</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
