import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // 模拟器上 iOS 也允许本地通知，这里照常请求
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** 喝水提醒走本地通知：按用户配置的每日时间点在设备上重复调度（离线也生效） */
export async function syncWaterReminders(times: string[], enabled: boolean): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return 0;

  let scheduled = 0;
  for (const t of times) {
    const [hour, minute] = t.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '该喝水啦 💧',
        body: '小口慢饮，补水更均匀。打开 App 记一杯！',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    scheduled++;
  }
  return scheduled;
}

/**
 * 注册远程推送令牌（用于服务端推送周报）。
 * 注意：正式包需要 EAS projectId；Expo Go 开发环境下尽力而为，失败返回 null 不影响使用。
 */
export async function registerExpoPushToken(projectId?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '默认',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (!Device.isDevice) return null; // 模拟器收不到远程推送
    const permission = await ensureNotificationPermission();
    if (!permission) return null;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data ?? null;
  } catch {
    return null;
  }
}
