import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { api, post } from '@/lib/api';
import type { WeeklyReportPayload } from '@lifepilot/shared';

export default function ReportsScreen() {
  const queryClient = useQueryClient();

  const report = useQuery({
    queryKey: ['reports', 'latest'],
    queryFn: () =>
      api<WeeklyReportPayload>('/reports/weekly').catch((err: { status?: number }) =>
        err.status === 404 ? null : Promise.reject(err),
      ),
  });

  const generate = useMutation({
    mutationFn: () => post<WeeklyReportPayload>('/reports/weekly/generate', {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });

  return (
    <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-zinc-900">周报</Text>
        <Pressable
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5"
          onPress={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <Text className="text-xs text-zinc-700">{generate.isPending ? '生成中…' : '生成本周周报'}</Text>
        </Pressable>
      </View>

      {report.data === undefined ? (
        <Text className="mt-6 text-center text-sm text-zinc-400">加载中…</Text>
      ) : report.data === null ? (
        <View className="mt-6 items-center rounded-2xl border border-zinc-200 bg-white p-8">
          <Text className="text-4xl">📋</Text>
          <Text className="mt-2 text-center text-sm text-zinc-500">
            还没有周报，点右上角「生成本周周报」试试
          </Text>
        </View>
      ) : (
        <ReportView report={report.data} />
      )}
    </ScrollView>
  );
}

function ReportView({ report: r }: { report: WeeklyReportPayload }) {
  return (
    <View className="mt-4 gap-4">
      <View className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-zinc-900">
            {r.weekStart.slice(5).replace('-', '.')} – {r.weekEnd.slice(5).replace('-', '.')}
          </Text>
          <Pressable
            className="rounded-xl border border-zinc-200 px-2.5 py-1"
            onPress={() => void Share.share({ message: r.markdown })}
          >
            <Text className="text-xs text-zinc-700">分享</Text>
          </Pressable>
        </View>
        {r.highlights.map((h, i) => (
          <View key={i} className="mt-2 rounded-xl bg-brand-50 px-3 py-2">
            <Text className="text-sm text-brand-700">{h}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-xs text-zinc-400">待办完成率</Text>
          <Text className="mt-1 text-2xl font-bold text-zinc-900">{r.todos.completionRate}%</Text>
          <Text className="mt-0.5 text-xs text-zinc-400">
            完成 {r.todos.completed} / 创建 {r.todos.created}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-xs text-zinc-400">日均饮水</Text>
          <Text className="mt-1 text-2xl font-bold text-zinc-900">{r.water.avgMlPerDay.toLocaleString()}ml</Text>
          <Text className="mt-0.5 text-xs text-zinc-400">达标 {r.water.goalHitDays}/7 天</Text>
        </View>
      </View>

      <View className="rounded-2xl border border-zinc-200 bg-white p-4">
        <Text className="text-sm font-semibold text-zinc-900">每日饮水</Text>
        <View className="mt-3 h-24 flex-row items-end gap-1.5">
          {r.water.dailyMl.map((ml, i) => {
            const max = Math.max(...r.water.dailyMl, r.water.goalMl);
            const height = max > 0 ? Math.max(4, (ml / max) * 96) : 4;
            return (
              <View key={i} className="h-24 flex-1 items-center justify-end gap-1">
                <View
                  className={`w-full rounded-t-md ${ml >= r.water.goalMl && ml > 0 ? 'bg-sky-400' : 'bg-zinc-200'}`}
                  style={{ height }}
                />
                <Text className="text-[10px] text-zinc-400">{'一二三四五六日'[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="rounded-2xl border border-zinc-200 bg-white p-4">
        <Text className="text-sm font-semibold text-zinc-900">习惯</Text>
        {r.habits.length === 0 ? (
          <Text className="mt-2 text-sm text-zinc-400">本周暂无习惯记录</Text>
        ) : (
          r.habits.map((h) => (
            <View key={h.id} className="mt-2 flex-row items-center gap-2">
              <Text>{h.icon}</Text>
              <Text numberOfLines={1} className="flex-1 text-sm text-zinc-900">
                {h.name}
              </Text>
              <Text className="text-xs tabular-nums text-zinc-400">
                {h.done}/{h.targetPerWeek}
              </Text>
              {h.achieved ? <Text className="text-emerald-600">✅</Text> : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
