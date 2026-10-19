"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  CreditCard,
  Flag,
  GitCommitVertical,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils/text";
import { ThemeToggle } from "./theme-toggle";

export const NAV_ITEMS = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessões", icon: ListChecks },
  { href: "/cycles", label: "Ciclos e bônus", icon: CreditCard },
  { href: "/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/timeline", label: "Linha do tempo", icon: GitCommitVertical },
  { href: "/events", label: "Eventos", icon: Flag },
  { href: "/statistics", label: "Estatísticas", icon: BarChart3 },
  { href: "/import", label: "Importar histórico", icon: Upload },
  { href: "/settings", label: "Configurações", icon: Settings },
] as const;

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md px-1 font-semibold tracking-tight text-fg">
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-white dark:text-black">
        <Activity className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
      FisioControl
    </Link>
  );
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              active ? "bg-surface-hover font-medium text-fg" : "text-fg-2 hover:bg-surface-hover hover:text-fg",
            )}
          >
            <Icon className={cn("size-4", active ? "text-accent-text" : "text-fg-3")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarFooter() {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
      <ThemeToggle />
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-fg-3 hover:bg-surface-hover hover:text-fg"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sair
        </button>
      </form>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r border-border bg-surface px-3 py-4 lg:flex">
      <Logo />
      <div className="flex-1 overflow-y-auto">
        <NavLinks />
      </div>
      <SidebarFooter />
    </aside>
  );
}
