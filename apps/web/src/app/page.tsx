import Link from "next/link";
import { CalendarCheck, CloudSun, Droplets, FileText, LifeBuoy } from "lucide-react";

const FEATURES = [
  {
    icon: CloudSun,
    title: "天气 + 今日安排",
    desc: "打开就是天气和今天的待办，出门前一眼看清冷暖和行程",
  },
  {
    icon: Droplets,
    title: "喝水打卡",
    desc: "按体重算目标，一键记一杯，到点温和提醒，不打扰",
  },
  {
    icon: CalendarCheck,
    title: "习惯养成",
    desc: "宽容型连击：按周目标计，漏一天不清零，不挫败",
  },
  {
    icon: FileText,
    title: "自动周报",
    desc: "周五自动汇总待办、饮水、习惯数据，一键复制导出",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-6 flex size-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-xl">
        <LifeBuoy className="size-8" />
      </div>
      <h1 className="text-center text-4xl font-bold tracking-tight">LifePilot</h1>
      <p className="mt-3 max-w-md text-center text-zinc-500">
        天气、待办、喝水打卡、习惯养成、自动周报——你的生活驾驶舱，一个入口全搞定。
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">
          免费注册
        </Link>
        <Link href="/login" className="btn-ghost">
          登录
        </Link>
      </div>

      <div className="mt-14 grid w-full gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <f.icon className="mb-3 size-6 text-brand-600" />
            <h2 className="section-title">{f.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-zinc-400">
        演示账号：demo@lifepilot.app / Demo1234!
      </p>
    </main>
  );
}
