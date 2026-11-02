import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { api, post } from '@/lib/api';
import type { DrinkType, TodoPriority, WeeklyReportPayload, WeeklyReportSummary } from '@lifepilot/shared';
import { DRINK_LABEL, PRIORITY_LABEL } from '@lifepilot/shared';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const PRIORITY_COLORS: Record<TodoPriority, { bg: string; text: string }> = {
  LOW: { bg: 'bg-zinc-100', text: 'text-zinc-600' },
  MEDIUM: { bg: 'bg-blue-50', text: 'text-blue-700' },
  HIGH: { bg: 'bg-amber-50', text: 'text-amber-700' },
  URGENT: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

const DRINK_COLORS: Record<DrinkType, string> = {
  WATER: '#0284c7',
  TEA: '#059669',
  COFFEE: '#b45309',
  JUICE: '#ea580c',
  MILK: '#4f46e5',
  SODA: '#dc2626',
  OTHER: '#64748b',
};

function shiftWeek(isoDate: string, deltaDays: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default function ReportsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 历史周报列表
  const history = useQuery({
    queryKey: ['reports', 'history'],
    queryFn: () => api<WeeklyReportSummary[]>('/reports/history'),
  });

  // 当前选中周报（若未指定则查最新）
  const report = useQuery({
    queryKey: ['reports', 'weekly', selectedWeek],
    queryFn: () => {
      const path = selectedWeek ? `/reports/weekly?weekStart=${selectedWeek}` : '/reports/weekly';
      return api<WeeklyReportPayload>(path).catch((err: { status?: number }) => {
        if (err.status === 404) return null;
        throw err;
      });
    },
  });

  // 重新生成
  const generate = useMutation({
    mutationFn: (weekStart?: string) =>
      post<WeeklyReportPayload>('/reports/weekly/generate', weekStart ? { weekStart } : {}),
    onSuccess: (data) => {
      setSelectedWeek(data.weekStart);
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const r = report.data;

  // 上下周切换
  const handlePrevWeek = () => {
    if (!r) return;
    const prev = shiftWeek(r.weekStart, -7);
    setSelectedWeek(prev);
  };

  const handleNextWeek = () => {
    if (!r) return;
    const next = shiftWeek(r.weekStart, 7);
    // 不能切换到未来的下下周
    const todayISO = new Date().toISOString().slice(0, 10);
    if (next > todayISO) return;
    setSelectedWeek(next);
  };

  const isCurrentWeek = Boolean(r && shiftWeek(r.weekStart, 7) > new Date().toISOString().slice(0, 10));

  return (
    <View className="flex-1 bg-zinc-50" style={{ paddingTop: insets.top }}>
      {/* 顶部标题与操作栏 */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <View>
          <Text className="text-2xl font-black tracking-tight text-zinc-900">生活周报</Text>
          <Text className="text-xs text-zinc-500">每周成长与身心节奏深度复盘</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowHistoryModal(true)}
            className="flex-row items-center rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 shadow-xs"
          >
            <Text className="text-xs font-medium text-zinc-700">历程 📜</Text>
          </Pressable>
          <Pressable
            onPress={() => generate.mutate(selectedWeek ?? undefined)}
            disabled={generate.isPending}
            className="rounded-xl bg-zinc-900 px-3 py-1.5 shadow-xs active:bg-zinc-800"
          >
            {generate.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-xs font-semibold text-white">重新生成</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* 周切换导航 */}
      {r && (
        <View className="mx-4 mb-2 flex-row items-center justify-between rounded-2xl border border-zinc-200/80 bg-white px-3 py-2 shadow-xs">
          <Pressable
            onPress={handlePrevWeek}
            hitSlop={8}
            className="rounded-lg bg-zinc-100 px-2.5 py-1 active:bg-zinc-200"
          >
            <Text className="text-xs font-bold text-zinc-700">◀ 上周</Text>
          </Pressable>

          <Pressable onPress={() => setShowHistoryModal(true)} className="flex-row items-center gap-1.5">
            <Text className="text-xs font-bold text-zinc-800">
              {r.weekStart.slice(5).replace('-', '.')} – {r.weekEnd.slice(5).replace('-', '.')}
            </Text>
            <View className="rounded-md bg-indigo-50 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-indigo-700">第 {r.score} 分</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleNextWeek}
            disabled={isCurrentWeek}
            hitSlop={8}
            className={`rounded-lg px-2.5 py-1 ${isCurrentWeek ? 'bg-zinc-50 opacity-40' : 'bg-zinc-100 active:bg-zinc-200'}`}
          >
            <Text className="text-xs font-bold text-zinc-700">下周 ▶</Text>
          </Pressable>
        </View>
      )}

      {/* 主体滚动区 */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={report.isRefetching || history.isRefetching}
            onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['reports'] })}
            tintColor="#4f46e5"
          />
        }
      >
        {report.isLoading ? (
          <View className="mt-20 items-center justify-center">
            <ActivityIndicator size="large" color="#6366f1" />
            <Text className="mt-3 text-xs text-zinc-400">正在汇总本周驾驶舱数据…</Text>
          </View>
        ) : !r ? (
          <View className="mt-10 items-center rounded-3xl border border-dashed border-zinc-300 bg-white p-8">
            <Text className="text-5xl">📋</Text>
            <Text className="mt-3 text-base font-bold text-zinc-800">暂无周报记录</Text>
            <Text className="mt-1 text-center text-xs text-zinc-500">
              点击上方「重新生成」自动聚合待办、习惯与饮水数据
            </Text>
            <Pressable
              onPress={() => generate.mutate()}
              className="mt-5 rounded-2xl bg-indigo-600 px-5 py-2.5 shadow-sm active:bg-indigo-700"
            >
              <Text className="text-sm font-semibold text-white">立即生成本周周报</Text>
            </Pressable>
          </View>
        ) : (
          <ReportDetailView report={r} onOpenShare={() => setShowShareModal(true)} />
        )}
      </ScrollView>

      {/* 历史记录抽屉弹窗 */}
      <Modal visible={showHistoryModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="max-h-[70%] rounded-t-3xl bg-white p-5 shadow-2xl"
            style={{ paddingBottom: Math.max(20, insets.bottom) }}
          >
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-100">
              <Text className="text-base font-bold text-zinc-900">往期周报归档</Text>
              <Pressable
                onPress={() => setShowHistoryModal(false)}
                className="rounded-full bg-zinc-100 px-3 py-1"
              >
                <Text className="text-xs font-bold text-zinc-600">关闭</Text>
              </Pressable>
            </View>

            <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
              {history.data?.length ? (
                history.data.map((h) => {
                  const isSelected = r?.weekStart === h.weekStart;
                  return (
                    <Pressable
                      key={h.weekStart}
                      onPress={() => {
                        setSelectedWeek(h.weekStart);
                        setShowHistoryModal(false);
                      }}
                      className={`mb-2.5 flex-row items-center justify-between rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/60'
                          : 'border-zinc-200 bg-zinc-50 active:bg-zinc-100'
                      }`}
                    >
                      <View>
                        <Text className="text-sm font-bold text-zinc-800">
                          {h.weekStart.slice(5).replace('-', '.')} – {h.weekEnd.slice(5).replace('-', '.')}
                        </Text>
                        <Text className="mt-0.5 text-xs text-zinc-500">
                          待办完成率 {h.completionRate}% · {h.title}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="rounded-xl bg-indigo-600 px-2.5 py-1">
                          <Text className="text-xs font-bold text-white">{h.score} 分</Text>
                        </View>
                        <Text className="mt-1 text-[10px] text-zinc-400">等级 {h.grade}</Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text className="py-8 text-center text-xs text-zinc-400">暂无历史周报</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 分享海报弹窗 */}
      {r && (
        <SharePosterModal
          visible={showShareModal}
          report={r}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </View>
  );
}

function ReportDetailView({
  report: r,
  onOpenShare,
}: {
  report: WeeklyReportPayload;
  onOpenShare: () => void;
}) {
  return (
    <View className="gap-4 pt-1">
      {/* 🌟 核心驾驶舱 Bento Hero Card */}
      <View className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 shadow-lg">
        {/* 背景光影效果 */}
        <View className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-indigo-500/20 blur-2xl" />
        <View className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-sky-500/15 blur-2xl" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-indigo-500/30 px-3 py-1 border border-indigo-400/30">
              <Text className="text-xs font-bold tracking-wider text-indigo-300">
                {r.grade} 级 · {r.title}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onOpenShare}
            className="flex-row items-center gap-1 rounded-full bg-white/15 px-3 py-1 border border-white/20 active:bg-white/25"
          >
            <Text className="text-xs font-semibold text-white">✨ 分享周报</Text>
          </Pressable>
        </View>

        {/* 评分仪表 */}
        <View className="mt-5 flex-row items-center gap-5">
          <ScoreGauge score={r.score} />
          <View className="flex-1">
            <Text className="text-base font-bold text-white tracking-tight">生活活力指数</Text>
            <Text className="mt-1 text-xs leading-relaxed text-zinc-300">
              {r.personaSummary}
            </Text>
          </View>
        </View>

        {/* 关键三维数据胶囊 */}
        <View className="mt-5 flex-row gap-2 rounded-2xl bg-white/10 p-3 border border-white/10">
          <View className="flex-1 items-center">
            <Text className="text-[11px] text-zinc-400">待办完成</Text>
            <Text className="mt-0.5 text-base font-black text-white">{r.todos.completionRate}%</Text>
            <Text className="text-[10px] text-zinc-400">{r.todos.completed}/{r.todos.completed + r.todos.open}</Text>
          </View>
          <View className="h-8 w-px bg-white/15 self-center" />
          <View className="flex-1 items-center">
            <Text className="text-[11px] text-zinc-400">日均补水</Text>
            <Text className="mt-0.5 text-base font-black text-sky-300">{r.water.avgMlPerDay}</Text>
            <Text className="text-[10px] text-zinc-400">达标 {r.water.goalHitDays}/7天</Text>
          </View>
          <View className="h-8 w-px bg-white/15 self-center" />
          <View className="flex-1 items-center">
            <Text className="text-[11px] text-zinc-400">习惯达标</Text>
            <Text className="mt-0.5 text-base font-black text-emerald-400">
              {r.habits.filter((h) => h.achieved).length}/{r.habits.length}
            </Text>
            <Text className="text-[10px] text-zinc-400">项满标</Text>
          </View>
        </View>
      </View>

      {/* 🌟 本周高光亮点 */}
      {r.highlights.length > 0 && (
        <View className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs">
          <View className="flex-row items-center gap-2 mb-2.5">
            <Text className="text-base font-bold text-zinc-900">🌟 本周高光时刻</Text>
          </View>
          <View className="gap-2">
            {r.highlights.map((h, i) => (
              <View key={i} className="flex-row items-start gap-2.5 rounded-2xl bg-amber-50/60 p-3 border border-amber-100/80">
                <Text className="text-sm">⚡</Text>
                <Text className="flex-1 text-xs font-medium leading-relaxed text-amber-900">
                  {h}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 💡 智能赋能：下周行动建议 */}
      {r.suggestions && r.suggestions.length > 0 && (
        <View className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-xs">
          <View className="flex-row items-center gap-2 mb-2.5">
            <Text className="text-base font-bold text-indigo-950">💡 下周重点建议</Text>
            <View className="rounded-full bg-indigo-200/60 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-indigo-800">Smart Insights</Text>
            </View>
          </View>
          <View className="gap-2">
            {r.suggestions.map((s, i) => (
              <View key={i} className="rounded-2xl bg-white p-3 border border-indigo-100/60 shadow-2xs">
                <Text className="text-xs font-medium leading-relaxed text-zinc-800">{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 🎯 待办效率与成就 */}
      <View className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-zinc-900">🎯 待办效率与成就</Text>
          </View>
          <Text className="text-xs font-bold text-indigo-600">
            完成率 {r.todos.completionRate}%
          </Text>
        </View>

        {/* 7日待办完成节奏柱状分布 */}
        <View className="mt-1 rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
          <Text className="text-[11px] font-medium text-zinc-500 mb-2">周内每日任务完成节奏</Text>
          <View className="h-20 flex-row items-end gap-2">
            {r.todos.dailyCompleted.map((count, i) => {
              const maxCount = Math.max(...r.todos.dailyCompleted, 1);
              const height = (count / maxCount) * 56 + 8;
              const isPeak = count > 0 && count === Math.max(...r.todos.dailyCompleted);
              return (
                <View key={i} className="flex-1 items-center justify-end gap-1">
                  <Text className={`text-[10px] font-bold ${count > 0 ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    {count}
                  </Text>
                  <View
                    className={`w-full rounded-t-md ${isPeak ? 'bg-indigo-600' : count > 0 ? 'bg-indigo-300' : 'bg-zinc-200'}`}
                    style={{ height }}
                  />
                  <Text className={`text-[10px] font-semibold ${isPeak ? 'text-indigo-600 font-bold' : 'text-zinc-400'}`}>
                    {WEEKDAYS[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 本周斩获重点事项 */}
        {r.todos.topCompleted && r.todos.topCompleted.length > 0 && (
          <View className="mt-3 pt-3 border-t border-zinc-100">
            <Text className="text-[11px] font-medium text-zinc-500 mb-2">本周攻克重点事项</Text>
            <View className="gap-1.5">
              {r.todos.topCompleted.map((t) => (
                <View key={t.id} className="flex-row items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                  <Text className="text-xs text-emerald-600">✓</Text>
                  <Text numberOfLines={1} className="flex-1 text-xs font-medium text-zinc-800">
                    {t.title}
                  </Text>
                  <View className={`rounded-md px-1.5 py-0.5 ${PRIORITY_COLORS[t.priority].bg}`}>
                    <Text className={`text-[10px] font-bold ${PRIORITY_COLORS[t.priority].text}`}>
                      {PRIORITY_LABEL[t.priority]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 💧 水合与饮水节奏 */}
      <View className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-zinc-900">💧 水合与饮水节奏</Text>
          </View>
          <Text className="text-xs font-bold text-sky-600">
            日均 {r.water.avgMlPerDay.toLocaleString()}ml
          </Text>
        </View>

        {/* 饮水柱状图 */}
        <View className="mt-1 rounded-2xl bg-sky-50/50 p-3 border border-sky-100/60">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[11px] font-medium text-sky-900">每日饮水量（目标 {r.water.goalMl}ml）</Text>
            <Text className="text-[10px] font-bold text-sky-700">达标 {r.water.goalHitDays}/7 天</Text>
          </View>
          <View className="h-24 flex-row items-end gap-2">
            {r.water.dailyMl.map((ml, i) => {
              const max = Math.max(...r.water.dailyMl, r.water.goalMl, 2000);
              const height = max > 0 ? Math.max(6, (ml / max) * 64) : 6;
              const hit = ml >= r.water.goalMl && ml > 0;
              const isBest = i === r.water.bestDayIndex && ml > 0;
              return (
                <View key={i} className="flex-1 items-center justify-end gap-1">
                  <Text className={`text-[9px] font-semibold tabular-nums ${hit ? 'text-sky-700' : 'text-zinc-400'}`}>
                    {ml > 0 ? (ml >= 1000 ? `${(ml / 1000).toFixed(1)}k` : ml) : '-'}
                  </Text>
                  <View
                    className={`w-full rounded-t-md ${hit ? 'bg-sky-500' : ml > 0 ? 'bg-sky-200' : 'bg-zinc-200'}`}
                    style={{ height }}
                  />
                  <Text className={`text-[10px] font-bold ${isBest ? 'text-sky-700 underline' : 'text-zinc-500'}`}>
                    {WEEKDAYS[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 饮品结构构成 */}
        {r.water.drinkBreakdown && r.water.drinkBreakdown.length > 0 && (
          <View className="mt-3 pt-3 border-t border-zinc-100">
            <Text className="text-[11px] font-medium text-zinc-500 mb-2">饮品摄入构成</Text>
            <View className="flex-row flex-wrap gap-2">
              {r.water.drinkBreakdown.map((b) => (
                <View
                  key={b.type}
                  className="flex-row items-center gap-1.5 rounded-xl bg-zinc-50 px-2.5 py-1.5 border border-zinc-100"
                >
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: DRINK_COLORS[b.type] ?? '#0284c7' }}
                  />
                  <Text className="text-xs font-semibold text-zinc-800">
                    {DRINK_LABEL[b.type] ?? b.type}
                  </Text>
                  <Text className="text-xs font-bold text-zinc-500">{b.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 🔥 习惯养成 7 日坚持矩阵 */}
      <View className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-zinc-900">🔥 习惯坚持打卡矩阵</Text>
          </View>
          <Text className="text-xs font-medium text-zinc-500">
            7 日连续性追踪
          </Text>
        </View>

        {r.habits.length === 0 ? (
          <Text className="py-4 text-center text-xs text-zinc-400">本周暂无习惯记录</Text>
        ) : (
          <View className="gap-3">
            {/* 星期头部指示 */}
            <View className="flex-row items-center justify-end pr-1">
              <View className="flex-row gap-2.5">
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} className="w-6 text-center text-[10px] font-bold text-zinc-400">
                    {w}
                  </Text>
                ))}
              </View>
            </View>

            {r.habits.map((h) => (
              <View
                key={h.id}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3"
              >
                <View className="flex-row items-center justify-between mb-2.5">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <Text className="text-base">{h.icon}</Text>
                    <Text numberOfLines={1} className="text-xs font-bold text-zinc-800">
                      {h.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs font-bold tabular-nums text-zinc-700">
                      {h.done}/{h.targetPerWeek} 次
                    </Text>
                    {h.achieved && (
                      <View className="rounded-md bg-emerald-100 px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold text-emerald-800">达标</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 7 日圆点矩阵 */}
                <View className="flex-row items-center justify-end">
                  <View className="flex-row gap-2.5">
                    {h.dailyStatus.map((checked, idx) => (
                      <View
                        key={idx}
                        className={`h-6 w-6 items-center justify-center rounded-full border ${
                          checked
                            ? 'border-transparent'
                            : 'border-zinc-200 bg-white'
                        }`}
                        style={checked ? { backgroundColor: h.color || '#6366f1' } : {}}
                      >
                        {checked ? (
                          <Text className="text-[10px] font-bold text-white">✓</Text>
                        ) : (
                          <Text className="text-[9px] text-zinc-300">·</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** 环形评分仪表 */
function ScoreGauge({ score, size = 68 }: { score: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}
      >
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#38bdf8" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text className="text-xl font-black text-white">{score}</Text>
    </View>
  );
}

/** 分享周报海报卡片弹窗 */
function SharePosterModal({
  visible,
  report: r,
  onClose,
}: {
  visible: boolean;
  report: WeeklyReportPayload;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: r.markdown,
        title: `LifePilot 周报 (${r.weekStart} - ${r.weekEnd})`,
      });
    } catch {
      // ignore
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-sm rounded-3xl bg-zinc-950 p-6 shadow-2xl border border-zinc-800">
          {/* 品牌标识 */}
          <View className="flex-row items-center justify-between border-b border-white/10 pb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">🧭</Text>
              <Text className="text-sm font-bold tracking-wider text-white uppercase">LifePilot</Text>
            </View>
            <Text className="text-xs text-zinc-400">
              {r.weekStart.slice(5).replace('-', '.')} – {r.weekEnd.slice(5).replace('-', '.')}
            </Text>
          </View>

          {/* 核心成就卡 */}
          <View className="mt-5 items-center">
            <ScoreGauge score={r.score} size={80} />
            <Text className="mt-3 text-lg font-black text-white tracking-wide">
              {r.grade} 级 · {r.title}
            </Text>
            <Text className="mt-1 text-center text-xs text-zinc-400 px-2 leading-relaxed">
              {r.personaSummary}
            </Text>
          </View>

          {/* 关键数据 Bento */}
          <View className="mt-5 grid grid-cols-3 flex-row gap-2 rounded-2xl bg-white/5 p-3 border border-white/10">
            <View className="flex-1 items-center">
              <Text className="text-[10px] text-zinc-400">待办率</Text>
              <Text className="mt-0.5 text-base font-black text-white">{r.todos.completionRate}%</Text>
              <Text className="text-[9px] text-zinc-500">已成{r.todos.completed}</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-[10px] text-zinc-400">日均补水</Text>
              <Text className="mt-0.5 text-base font-black text-sky-400">{r.water.avgMlPerDay}ml</Text>
              <Text className="text-[9px] text-zinc-500">达标{r.water.goalHitDays}天</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-[10px] text-zinc-400">习惯满标</Text>
              <Text className="mt-0.5 text-base font-black text-emerald-400">
                {r.habits.filter((h) => h.achieved).length}/{r.habits.length}
              </Text>
              <Text className="text-[9px] text-zinc-500">项达成</Text>
            </View>
          </View>

          {/* 重点高光 */}
          {r.highlights[0] && (
            <View className="mt-4 rounded-xl bg-indigo-950/60 p-3 border border-indigo-500/30">
              <Text className="text-[11px] font-medium leading-relaxed text-indigo-200">
                🌟 {r.highlights[0]}
              </Text>
            </View>
          )}

          {/* 操作按钮组 */}
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center justify-center rounded-2xl bg-white/10 py-3 active:bg-white/20"
            >
              <Text className="text-xs font-semibold text-zinc-300">返回</Text>
            </Pressable>
            <Pressable
              onPress={handleNativeShare}
              className="flex-2 items-center justify-center rounded-2xl bg-indigo-600 py-3 shadow-md active:bg-indigo-700"
            >
              <Text className="text-xs font-bold text-white">一键导出与分享</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
