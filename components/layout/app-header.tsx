"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo, NavLinks, SidebarFooter } from "./app-sidebar";

/** Top bar for tablet/mobile, with a slide-over navigation drawer. */
export function AppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-lg p-2 text-fg-2 hover:bg-surface-hover"
        >
          <Menu className="size-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" key={pathname}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fade-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 border-r border-border bg-surface px-3 py-4"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2 text-fg-2 hover:bg-surface-hover">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <SidebarFooter />
          </div>
        </div>
      ) : null}
    </>
  );
}
