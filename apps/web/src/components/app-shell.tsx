"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, FileText, ListTodo, Settings, Sun } from "lucide-react";
import { Providers } from "@/components/providers";
import { ensureToken } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const NAV = [
  { href: "/app", label: "今日", icon: Sun, exact: true },
  { href: "/app/todos", label: "待办", icon: ListTodo, exact: false },
  { href: "/app/habits", label: "习惯", icon: CalendarCheck, exact: false },
  { href: "/app/reports", label: "周报", icon: FileText, exact: false },
  { href: "/app/settings", label: "设置", icon: Settings, exact: false },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureToken().then((ok) => {
      if (!ok) {
        clear();
        router.replace("/login");
      } else {
        setReady(true);
        // PWA：注册 service worker（Web Push 需要）
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("/sw.js").catch(() => undefined);
        }
      }
    });
  }, [clear, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-400">
        正在进入 LifePilot…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-24 pt-6">
      <main className="flex-1">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {NAV.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavItem({ item }: { item: (typeof NAV)[number] }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <a
      href={item.href}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
        active ? "text-brand-600" : "text-zinc-400"
      }`}
    >
      <item.icon className="size-5" />
      {item.label}
    </a>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}
