import type { ButtonHTMLAttributes, ReactNode, SVGProps } from "react";
import { locale, t } from "@/lib/i18n";
import { LEVELS, type Level } from "@/lib/types";

type Variant = "primary" | "accent" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm shadow-ink/20 active:scale-[0.98] disabled:bg-zinc-300 disabled:shadow-none",
  accent: "bg-lime text-ink shadow-sm shadow-lime-dark/40 active:scale-[0.98] disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none",
  secondary: "bg-zinc-100 text-ink active:bg-zinc-200",
  danger: "bg-red-50 text-red-600 active:bg-red-100",
  ghost: "text-zinc-500 active:bg-zinc-100",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(11,18,32,0.04),0_8px_24px_-12px_rgba(11,18,32,0.12)] ${className}`}>
      {children}
    </div>
  );
}

/** หน้าต่างเลื่อนขึ้นจากด้านล่าง */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          {title}
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-zinc-100" aria-label={t("ปิด")}>
            <Icon.X width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1">
      <h2 className="font-display text-xl font-semibold tracking-tight">{children}</h2>
      {right && <div className="text-sm text-zinc-500">{right}</div>}
    </div>
  );
}

export function levelCode(level: Level): string {
  return LEVELS.find((l) => l.value === level)?.code ?? "?";
}

function levelColor(level: Level): string {
  return [
    "",
    "bg-sky-100 text-sky-700",
    "bg-teal-100 text-teal-700",
    "bg-amber-100 text-amber-800",
    "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700",
    "bg-lime/40 text-emerald-800",
  ][level];
}

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${levelColor(level)}`}>
      {levelCode(level)}
    </span>
  );
}

export function baht(n: number): string {
  return t("{n} บาท", { n: n.toLocaleString(locale()) });
}

export const inputClass =
  "w-full rounded-2xl border-0 bg-zinc-100 px-4 py-3 text-base outline-none ring-2 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:ring-lime-dark";

const avatarColors = [
  "bg-lime text-ink",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-amber-200 text-amber-900",
  "bg-rose-200 text-rose-900",
  "bg-teal-200 text-teal-900",
];

export function Avatar({ name, photo, size = 36, ring = false }: { name: string; photo?: string; size?: number; ring?: boolean }) {
  const ringClass = ring ? "ring-2 ring-white" : "";
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ringClass}`}
        style={{ width: size, height: size }}
      />
    );
  const color = avatarColors[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display font-semibold ${color} ${ringClass}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22} {...props} />
  );
}

export const Icon = {
  CheckIn: (p: IconProps) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </Svg>
  ),
  Court: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h18" />
    </Svg>
  ),
  Wallet: (p: IconProps) => (
    <Svg {...p}>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v4h-4a2 2 0 0 0 0 4h4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    </Svg>
  ),
  Users: (p: IconProps) => (
    <Svg {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Minus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  ),
  Camera: (p: IconProps) => (
    <Svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  ),
  Shuttle: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="18" r="3" />
      <path d="M9.5 16.3 6 4l3 1 3-2 3 2 3-1-3.5 12.3" />
      <path d="M12 3v12" />
    </Svg>
  ),
  Trophy: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  Megaphone: (p: IconProps) => (
    <Svg {...p}>
      <path d="m3 11 15-6v14L3 13z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </Svg>
  ),
  X: (p: IconProps) => (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  ),
};

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Icon.Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400" width={18} height={18} />
      <input className={`${inputClass} pl-11`} placeholder={placeholder ?? t("ค้นหาชื่อเล่น")} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
