import { Platform } from 'react-native';

/**
 * 三端统一的安全存储：
 * - iOS/Android → expo-secure-store（Keychain / Keystore）
 * - H5/Web → localStorage（无原生 Keychain，降级为 web 存储）
 */
const memoryFallback = new Map<string, string>();

export async function safeGetItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  }
  const { getItemAsync } = await import('expo-secure-store');
  return getItemAsync(key);
}

export async function safeSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
    return;
  }
  const { setItemAsync } = await import('expo-secure-store');
  await setItemAsync(key, value);
}

export async function safeDeleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryFallback.delete(key);
    }
    return;
  }
  const { deleteItemAsync } = await import('expo-secure-store');
  await deleteItemAsync(key);
}
