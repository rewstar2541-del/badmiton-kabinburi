/**
 * เสียงและสั่นเมื่อถึงคิว / อีก 1 เกมถึงคิว
 * - ค่าเปิด/ปิด จำในเครื่อง (ค่าเริ่มต้น = เปิด) และเขียนลง Cache Storage ด้วย ให้ service worker (sw.js) อ่านได้ตอนแจ้งเตือนเด้ง
 * - ตอนเปิดแอพอยู่: เล่นเสียงสั้นๆ (สร้างด้วย Web Audio ไม่ต้องมีไฟล์) และสั่น (เฉพาะ Android; iPhone ไม่รองรับการสั่นจากเว็บ)
 */
const KEY = "badminton-kabinburi:turn-alert";
/** ต้องตรงกับใน public/sw.js */
const CACHE = "bk-prefs";
const PREF_URL = "/__bk/turn-alert";

/** รูปแบบการสั่น (มิลลิวินาที): สั่น-หยุด-สั่น-หยุด-สั่นยาว ใช้ทั้งในแอพและแจ้งเตือนเด้ง */
export const VIBRATE = [200, 100, 200, 100, 400];

export function turnAlertOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setTurnAlertOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  syncTurnAlertPref();
}

/** บอก service worker ว่าเปิด/ปิดไว้ (เรียกตอนเปิดแอพด้วย เผื่อเครื่องล้างแคช) */
export function syncTurnAlertPref() {
  if (typeof caches === "undefined") return;
  caches
    .open(CACHE)
    .then((c) => c.put(PREF_URL, new Response(turnAlertOn() ? "1" : "0")))
    .catch(() => {});
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  // iPhone: ล็อกจอ/สลับแอพแล้ว เสียงค้างเป็น "interrupted" หรือปิดไป สร้างใหม่ (ทำตอนแตะจอเท่านั้นถึงจะเล่นได้)
  if (ctx && (ctx.state === "closed" || (ctx.state as string) === "interrupted")) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
  try {
    ctx ??= new AC();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * มือถือเล่นเสียงได้หลังผู้ใช้แตะจอเท่านั้น: ปลุกเสียงไว้ทุกครั้งที่แตะจอแล้วเสียงยังไม่พร้อม
 * (ตอนถึงคิวจริงอาจไม่ได้แตะจอเลย และ iPhone ปิดเสียงทุกครั้งที่ล็อกจอ)
 */
export function unlockTurnSound() {
  if (typeof window === "undefined") return () => {};
  const go = () => {
    if (ctx?.state === "running") return;
    const c = audio();
    if (!c) return;
    // iPhone (Safari 17+): ให้เสียงในแอพดังเหมือนเพลง
    try {
      const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (s) s.type = "playback";
    } catch {}
    if (c.state !== "running") void c.resume().catch(() => {});
    // iOS ต้องเล่นเสียงเปล่าๆ สักครั้งในจังหวะที่แตะ ถึงจะยอมเล่นทีหลัง
    try {
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    } catch {}
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener("pointerdown", go, opts);
  window.addEventListener("keydown", go, opts);
  return () => {
    window.removeEventListener("pointerdown", go, opts);
    window.removeEventListener("keydown", go, opts);
  };
}

/** เสียงติ๊ง-ต๊อง สั้นๆ (ถึงคิวลงสนาม = 3 โน้ต, อีก 1 เกม = 2 โน้ต) */
export function playChime(kind: "play" | "soon") {
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  const notes = kind === "play" ? [880, 1175, 1568] : [880, 1175];
  const t0 = c.currentTime + 0.02;
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const at = t0 + i * 0.18;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + 0.35);
  });
}

/** สั่น (Android) iPhone ไม่มี navigator.vibrate ก็ข้ามไปเงียบๆ */
export function buzz() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(VIBRATE);
  } catch {}
}
