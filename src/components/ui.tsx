import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Level } from "@/lib/types";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white active:bg-emerald-700 disabled:bg-emerald-300",
  secondary: "bg-zinc-100 text-zinc-900 active:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100",
  danger: "bg-red-50 text-red-700 active:bg-red-100 dark:bg-red-950 dark:text-red-300",
  ghost: "text-zinc-600 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

export const LEVEL_LABEL: Record<Level, string> = {
  1: "มือใหม่",
  2: "พอเล่นได้",
  3: "กลาง",
  4: "เก่ง",
  5: "เก่งมาก",
};

const levelColor: Record<Level, string> = {
  1: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  2: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  3: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  4: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  5: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${levelColor[level]}`}>
      Lv{level}
    </span>
  );
}

export function baht(n: number): string {
  return `${n.toLocaleString("th-TH")} บาท`;
}

export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950";

export function Avatar({ name, photo, size = 36 }: { name: string; photo?: string; size?: number }) {
  if (photo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
