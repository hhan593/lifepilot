import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const COLOR = '#4f46e5';
const GRAY = '#a1a1aa';

const TABS: { name: string; title: string; icon: string }[] = [
  { name: 'index', title: '今日', icon: '☀️' },
  { name: 'todos', title: '待办', icon: '✅' },
  { name: 'habits', title: '习惯', icon: '🔥' },
  { name: 'reports', title: '周报', icon: '📋' },
  { name: 'settings', title: '设置', icon: '⚙️' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLOR,
        tabBarInactiveTintColor: GRAY,
        sceneStyle: { backgroundColor: '#fafafa' },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{t.icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
