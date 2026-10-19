"use client";

import { useSyncExternalStore } from "react";
import { msUntilNextLocalMidnight, todayIso, type IsoDate } from "@/lib/dates/calendar";

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, msUntilNextLocalMidnight());
  };
  schedule();
  // Timers are throttled in background tabs / sleep: re-check on return.
  const onVisible = () => document.visibilityState === "visible" && onChange();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

/**
 * Today's date in the browser's local timezone, updated automatically when
 * the day changes. `serverToday` is used during SSR/hydration.
 */
export function useLocalToday(serverToday: IsoDate): IsoDate {
  return useSyncExternalStore(subscribe, () => todayIso(), () => serverToday);
}
