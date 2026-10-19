"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "fc-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies to this page view.
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onChange);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "system", label: "Tema do sistema", icon: Monitor },
];

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => applyTheme(value)}
          className={`rounded-md p-1.5 transition-colors ${
            theme === value ? "bg-surface text-fg shadow-xs" : "text-fg-3 hover:text-fg"
          }`}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
