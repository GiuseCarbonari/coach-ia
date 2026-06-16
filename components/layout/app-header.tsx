"use client";

import Link from "next/link";
import { Activity, CalendarDays, LogOut, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { label: "Oggi", href: "/dashboard", icon: Activity },
  { label: "Profilo", href: "/profile", icon: UserRound },
  { label: "Piano", href: "/plan", icon: CalendarDays },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-base/80 backdrop-blur-xl">
      <div className="app-container flex min-h-16 items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-2.5 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-white/10 bg-white/[0.06] text-[15px] font-bold text-foreground">
            <span className="text-amber">C</span>
          </span>
          <span className="hidden text-[15px] font-extrabold tracking-[-0.01em] text-foreground sm:inline">
            Coach <span className="text-amber">IA</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <nav
            className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 backdrop-blur-xl"
            aria-label="Navigazione principale"
          >
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "font-data inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors",
                    active
                      ? "bg-amber text-amber-on"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Esci da Coach IA"
              className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber sm:px-3"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Esci</span>
              <span className="sr-only sm:hidden">Esci da Coach IA</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
