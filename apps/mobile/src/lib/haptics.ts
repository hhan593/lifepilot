import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');

let cached: HapticsModule | null = null;

/** expo-haptics 无 web 入口：仅原生端动态加载，H5 自动降级为无操作 */
async function getHaptics(): Promise<HapticsModule | null> {
  if (Platform.OS === 'web') return null;
  if (!cached) cached = await import('expo-haptics');
  return cached;
}

/** 轻触反馈：打卡、完成、记录等成功操作 */
export async function hapticLight(): Promise<void> {
  const h = await getHaptics();
  try {
    await h?.impactAsync(h.ImpactFeedbackStyle.Light);
  } catch {
    // 触觉反馈失败不影响功能
  }
}

/** 中等反馈：按钮主操作 */
export async function hapticMedium(): Promise<void> {
  const h = await getHaptics();
  try {
    await h?.impactAsync(h.ImpactFeedbackStyle.Medium);
  } catch {
    // 触觉反馈失败不影响功能
  }
}

/** 成功反馈：达标、连击达成 */
export async function hapticSuccess(): Promise<void> {
  const h = await getHaptics();
  try {
    await h?.notificationAsync(h.NotificationFeedbackType.Success);
  } catch {
    // 触觉反馈失败不影响功能
  }
}
