import { Platform } from 'react-native';
import * as Device from 'expo-device';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null = null;

/** expo-notifications 无 web 入口：仅在原生端动态加载，H5 返回 null */
async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (!cachedModule) cachedModule = await import('expo-notifications');
  return cachedModule;
}

// 前台展示配置（仅原生端）
void (async () => {
  const Notifications = await getNotifications();
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
})();

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const req = await Notification.requestPermission();
    return req === 'granted';
  }
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * 喝水提醒：
 * - iOS/Android → 本地通知按每日时间点重复调度（离线也生效）
 * - H5/Web → 浏览器无可靠的定时本地通知，由 Web Push 渠道承担
 */
export async function syncWaterReminders(times: string[], enabled: boolean): Promise<number> {
  const Notifications = await getNotifications();
  if (!Notifications) return 0;

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
 * 仅原生真机可用；H5 返回 null。正式包需要 EAS projectId。
 */
export async function registerExpoPushToken(projectId?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    const Notifications = await getNotifications();
    if (!Notifications) return null;
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
