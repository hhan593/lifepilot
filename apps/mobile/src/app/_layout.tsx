import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { registerExpoPushToken } from '@/lib/notifications';
import { post } from '@/lib/api';
import '../global.css';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status === 'loading') return;
    void SplashScreen.hideAsync().catch(() => undefined);

    const onAuthPages = pathname === '/login' || pathname === '/register';
    if (status === 'guest' && !onAuthPages) {
      router.replace('/login');
    }
    if (status === 'authed' && onAuthPages) {
      router.replace('/');
      // 尽力注册远程推送令牌（周报推送用），失败静默
      void registerExpoPushToken(process.env.EXPO_PUBLIC_EAS_PROJECT_ID).then((token) => {
        if (token) void post('/notifications/expo-token', { token }).catch(() => undefined);
      });
    }
  }, [status, pathname, router]);

  if (status === 'loading') return null;
  return <>{children}</>;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fafafa' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}
