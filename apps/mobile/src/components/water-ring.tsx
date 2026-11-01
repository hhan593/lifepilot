import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text, View } from 'react-native';

export function WaterRing({
  hydrationMl,
  goalMl,
  percent,
  size = 140,
}: {
  hydrationMl: number;
  goalMl: number;
  percent: number;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, percent);
  const offset = c * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="waterGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38bdf8" />
            <Stop offset="100%" stopColor="#6366f1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#waterGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text className="text-xl font-bold tabular-nums text-zinc-900">{clamped}%</Text>
      <Text className="text-[11px] text-zinc-400">
        {hydrationMl.toLocaleString()}/{goalMl.toLocaleString()}ml
      </Text>
    </View>
  );
}
