import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/lib/auth';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';

  async function submit() {
    if (loading || !email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      if (isRegister) await register(email.trim(), password);
      else await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 items-center justify-center bg-zinc-50 px-6"
    >
      <View className="mb-8 h-14 w-14 items-center justify-center rounded-3xl bg-brand-600">
        <Text style={{ fontSize: 28 }}>🛟</Text>
      </View>
      <Text className="text-xl font-bold text-zinc-900">LifePilot</Text>
      <Text className="mt-1 text-sm text-zinc-500">
        {isRegister ? '创建账号，开始你的生活驾驶舱' : '欢迎回来，今天也要元气满满'}
      </Text>

      <View className="mt-8 w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <Text className="mb-1.5 text-xs font-medium text-zinc-500">邮箱</Text>
        <TextInput
          className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text className="mb-1.5 mt-3 text-xs font-medium text-zinc-500">密码</Text>
        <TextInput
          className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm"
          placeholder={isRegister ? '至少 8 位，含字母和数字' : '••••••••'}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
        />

        {error ? (
          <Text className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</Text>
        ) : null}

        <Pressable
          className="mt-4 items-center rounded-xl bg-brand-600 py-3 active:opacity-80"
          onPress={() => void submit()}
          disabled={loading}
        >
          <Text className="text-sm font-semibold text-white">
            {loading ? '请稍候…' : isRegister ? '创建账号' : '登录'}
          </Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row">
        <Text className="text-sm text-zinc-500">
          {isRegister ? '已有账号？' : '还没有账号？'}
        </Text>
        <Link href={isRegister ? '/login' : '/register'} asChild>
          <Pressable>
            <Text className="text-sm font-semibold text-brand-600">
              {isRegister ? '去登录' : '注册一个'}
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
