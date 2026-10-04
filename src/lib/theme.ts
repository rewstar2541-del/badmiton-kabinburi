import { useSyncExternalStore } from "react";

/** ธีมสว่าง/มืด จำไว้ในเครื่องนี้ (ค่าเริ่มต้นตามเครื่อง) */
export type Theme = "light" | "dark";

const KEY = "badminton-kabinburi:theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // ใช้ค่าตามเครื่อง
  }
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let current: Theme | null = null;

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getTheme(): Theme {
  if (current === null) {
    current = read();
    apply(current);
  }
  return current;
}

export function setTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ไม่จำก็ได้
  }
  apply(theme);
  listeners.forEach((f) => f());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getTheme,
    () => "light",
  );
}
