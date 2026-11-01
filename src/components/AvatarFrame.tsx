"use client";

import { FESTIVAL_FRAMES, frameOf, type Frame } from "@/lib/frames";
import { LEVELS, type Level, type Player } from "@/lib/types";
import { Avatar } from "./ui";

/**
 * กรอบสไตล์ Neon Glow: วงแหวนไล่สีเรืองแสง ยิ่งระดับสูงยิ่งเด่น
 * colors = สีวงแหวน (ไล่รอบวง) · glow = ความแรงของแสง · icon = ไอคอนมุมบน · orbit/dots = ของตกแต่งระดับสูง
 */
type Look = { colors: string[]; glow: number; icon?: string; orbit?: boolean; dots?: boolean; label: string; name: string };

const LEVEL_LOOK: Record<Level, Omit<Look, "label" | "name">> = {
  1: { colors: ["#7dd3fc", "#38bdf8"], glow: 6 },
  2: { colors: ["#5eead4", "#14b8a6"], glow: 10, icon: "✦" },
  6: { colors: ["#bef264", "#84cc16"], glow: 12, icon: "✦" },
  3: { colors: ["#fde047", "#f59e0b"], glow: 16, icon: "⚡", orbit: true },
  4: { colors: ["#fb923c", "#f43f5e"], glow: 22, icon: "🔥", orbit: true, dots: true },
  5: { colors: ["#c084fc", "#22d3ee", "#f472b6", "#fde047"], glow: 30, icon: "👑", orbit: true, dots: true },
};

function lookOf(f: Frame, small = false): Look {
  if (f.kind === "level") {
    const code = LEVELS.find((l) => l.value === f.level)!.code;
    return { ...LEVEL_LOOK[f.level], label: code, name: code };
  }
  const x = FESTIVAL_FRAMES.find((y) => y.id === f.id)!;
  return { colors: [x.colors[0], x.colors[1]], glow: 22, icon: x.emoji, orbit: true, dots: true, label: small ? x.short : x.label, name: x.label };
}

const ringBg = (c: string[]) => `conic-gradient(from 210deg, ${[...c, c[0]].join(", ")})`;

type FramePlayer = Pick<Player, "name" | "photo" | "level" | "frame" | "frames" | "guestOf">;

/**
 * รูปโปรไฟล์พร้อมกรอบที่ผู้เล่นเลือก
 * compact = วงแหวนเรืองแสงอย่างเดียว (ใช้ในรายชื่อ) ไม่งั้นมีไอคอนมุมบนและป้ายระดับใต้รูป
 */
export function FramedAvatar({ player, size = 40, compact, ring: plainRing, frame: forced }: { player: FramePlayer; size?: number; compact?: boolean; ring?: boolean; frame?: Frame | null }) {
  const frame = forced === undefined ? frameOf(player) : forced;
  if (!frame) return <Avatar name={player.name} photo={player.photo} size={size} ring={plainRing} />;
  // รูปเล็ก: ป้ายชื่อย่อ และไม่มีวงโคจร/จุดแสง (รายชื่อยาวๆ จะได้ไม่หน่วง)
  const small = size < 96;
  const look = { ...lookOf(frame, small), ...(size < 64 ? { orbit: false, dots: false } : {}) };
  const glowColor = `${look.colors[1]}aa`;
  const tiny = size < 28;
  const ring = tiny ? 1.5 : Math.max(2, Math.round(size * (compact ? 0.06 : 0.045)));
  const gap = tiny ? 0 : compact ? 1 : Math.max(2, Math.round(size * 0.025));
  const inner = size - (ring + gap) * 2;
  const disc = (
    <span
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        padding: ring,
        background: ringBg(look.colors),
        // ในรายชื่อใช้แสงเบาๆ (หลายคนพร้อมกันจะได้ไม่หน่วง)
        boxShadow: compact ? `0 0 ${Math.min(6, look.glow / 4)}px ${glowColor}` : `0 0 ${(look.glow * size) / 120}px ${(look.glow * size) / 480}px ${glowColor}`,
      }}
    >
      <span className="grid size-full place-items-center rounded-full bg-[#0b1220]" style={{ padding: gap }}>
        <Avatar name={player.name} photo={player.photo} size={inner} />
      </span>
    </span>
  );
  if (compact) return disc;

  const pad = Math.round(size * 0.12);
  const chip = Math.round(size * 0.3);
  const font = Math.max(11, Math.round(size * 0.13));
  return (
    <span className="relative inline-block shrink-0" style={{ padding: pad, paddingBottom: pad + font * 0.6 }} role="img" aria-label={look.name}>
      {look.orbit && (
        <span className="absolute rounded-full border-[1.5px] border-dashed opacity-65" style={{ inset: pad - size * 0.075, bottom: pad + font * 0.6 - size * 0.075, borderColor: look.colors[0] }} />
      )}
      {disc}
      {look.dots && (
        <>
          <Dot color={look.colors[0]} s={size * 0.085} style={{ left: pad + size * 0.02, top: pad + size * 0.18 }} />
          <Dot color={look.colors[0]} s={size * 0.06} style={{ left: pad + size * 0.88, top: pad + size * 0.8 }} />
        </>
      )}
      {look.icon && (
        <span
          className="absolute grid place-items-center rounded-full bg-[#0b1220] leading-none"
          style={{
            width: chip,
            height: chip,
            left: pad + size - chip * 0.85,
            top: pad - chip * 0.15,
            border: `2px solid ${look.colors[0]}`,
            color: look.colors[0],
            fontSize: chip * 0.5,
            boxShadow: `0 0 ${chip * 0.3}px ${glowColor}`,
          }}
          aria-hidden
        >
          {look.icon}
        </span>
      )}
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full font-extrabold whitespace-nowrap text-[#0b1220]"
        style={{
          top: pad + size - font * 0.9,
          padding: `${font * 0.15}px ${font * 0.8}px`,
          fontSize: font,
          lineHeight: 1.25,
          background: `linear-gradient(90deg, ${look.colors[0]}, ${look.colors[1]})`,
          boxShadow: `0 0 ${font}px ${glowColor}`,
        }}
      >
        {look.label}
      </span>
    </span>
  );
}

function Dot({ color, s, style }: { color: string; s: number; style: React.CSSProperties }) {
  return <span className="absolute rounded-full bg-white" style={{ width: s, height: s, boxShadow: `0 0 ${s}px ${s * 0.3}px ${color}`, ...style }} aria-hidden />;
}
