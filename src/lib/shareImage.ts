import { downloadBlob, inAppBrowser } from "./download";

/** วาดรูปสำหรับแชร์ (อันดับรายเดือน / สรุปก๊วนรายปี) ด้วย canvas ไม่ต้องลง library เพิ่ม */

const W = 1080;
const PAD = 64;
const INK = "#0b1220";
const LIME = "#c6f432";
const AVATAR = [
  ["#c6f432", INK],
  ["#bae6fd", "#0c4a6e"],
  ["#ddd6fe", "#4c1d95"],
  ["#fde68a", "#78350f"],
  ["#fecdd3", "#881337"],
  ["#99f6e4", "#134e4a"],
];

export type Person = { name: string; photo?: string };

/** ฟอนต์เดียวกับในแอพ (next/font ตั้งชื่อฟอนต์ไว้ในตัวแปร CSS) */
function fonts() {
  const css = getComputedStyle(document.documentElement);
  const body = css.getPropertyValue("--font-thai").trim();
  const display = css.getPropertyValue("--font-display").trim();
  return {
    body: (w: number, px: number) => `${w} ${px}px ${body ? `${body}, ` : ""}sans-serif`,
    display: (w: number, px: number) => `${w} ${px}px ${display ? `${display}, ` : ""}${body ? `${body}, ` : ""}sans-serif`,
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    // รูปจากเว็บอื่นต้องอนุญาต CORS ไม่งั้น canvas ส่งออกรูปไม่ได้ ถ้าโหลดไม่ได้ใช้ตัวอักษรแทน
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    // เน็ตช้า: ไม่รอเกิน 4 วินาที ใช้ตัวอักษรแทน
    setTimeout(() => ok(null), 4000);
    img.src = src;
  });
}

async function photos(people: Person[]) {
  const map = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    [...new Set(people.map((p) => p.photo).filter((x): x is string => !!x))].map(async (src) => map.set(src, await loadImage(src))),
  );
  return map;
}

/** รอฟอนต์ของแอพ แต่ไม่เกิน 3 วินาที (ไม่งั้นปุ่มค้าง) */
const fontsReady = () => Promise.race([document.fonts?.ready, new Promise((ok) => setTimeout(ok, 3000))]);

function setup(height: number) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = height;
  const g = c.getContext("2d")!;
  g.textBaseline = "middle";
  return { c, g };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = fill;
  // เบราว์เซอร์เก่า (iOS ต่ำกว่า 16) ไม่มี roundRect วาดมุมตรงแทน
  if (!g.roundRect) return g.fillRect(x, y, w, h);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

/** ตัดข้อความให้พอดีความกว้าง */
function fit(g: CanvasRenderingContext2D, s: string, max: number) {
  if (g.measureText(s).width <= max) return s;
  const chars = [...s];
  while (chars.length && g.measureText(chars.join("") + "…").width > max) chars.pop();
  return chars.join("") + "…";
}

function avatar(g: CanvasRenderingContext2D, f: ReturnType<typeof fonts>, imgs: Map<string, HTMLImageElement | null>, p: Person, x: number, y: number, size: number) {
  const img = p.photo ? imgs.get(p.photo) : null;
  g.save();
  g.beginPath();
  g.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  g.clip();
  if (img) {
    const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size);
  } else {
    const [bg, fg] = AVATAR[[...p.name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
    g.fillStyle = bg;
    g.fillRect(x, y, size, size);
    g.fillStyle = fg;
    g.font = f.display(600, size * 0.42);
    g.textAlign = "center";
    g.fillText(p.name.trim().charAt(0) || "?", x + size / 2, y + size / 2 + 2);
  }
  g.restore();
}

function header(g: CanvasRenderingContext2D, f: ReturnType<typeof fonts>, club: string, title: string, sub: string, height: number) {
  g.fillStyle = INK;
  g.fillRect(0, 0, W, height);
  g.textAlign = "left";
  g.fillStyle = LIME;
  g.font = f.body(600, 30);
  g.fillText(fit(g, club, W - PAD * 2), PAD, 70);
  g.fillStyle = "#ffffff";
  g.font = f.display(600, 64);
  g.fillText(fit(g, title, W - PAD * 2), PAD, 140);
  if (sub) {
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.font = f.body(500, 32);
    g.fillText(fit(g, sub, W - PAD * 2), PAD, 200);
  }
}

const FOOT = 24;
const FOOT_LINE = 36;

/** ตัดข้อความเป็นหลายบรรทัด (ตัดที่ช่องว่าง ภาษาไทย/จีนที่ไม่มีช่องว่างตัดทีละตัว) */
function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const part of text.split(/(?<=\s)/)) {
    const next = line + part;
    if (g.measureText(next.trimEnd()).width <= max) {
      line = next;
      continue;
    }
    if (line) lines.push(line.trimEnd());
    line = "";
    for (const ch of [...part]) {
      if (g.measureText(line + ch).width > max && line) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function footerLines(f: ReturnType<typeof fonts>, text: string) {
  const g = document.createElement("canvas").getContext("2d")!;
  g.font = f.body(400, FOOT);
  return wrap(g, text, W - PAD * 2);
}

/** ข้อความท้ายรูป วาดจากบรรทัดสุดท้ายขึ้นไป */
function footer(g: CanvasRenderingContext2D, f: ReturnType<typeof fonts>, lines: string[], bottom: number) {
  g.fillStyle = "#71717a";
  g.font = f.body(400, FOOT);
  g.textAlign = "center";
  lines.forEach((l, i) => g.fillText(l, W / 2, bottom - (lines.length - 1 - i) * FOOT_LINE));
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));

export type RankImageRow = Person & { rank: number; record: string; delta: number; me?: boolean };

/** รูปตารางอันดับรายเดือน */
export async function rankingImage(o: { club: string; title: string; month: string; rows: RankImageRow[]; note: string }): Promise<Blob> {
  await fontsReady();
  const f = fonts();
  const imgs = await photos(o.rows);
  const HEAD = 250;
  const ROW = 92;
  const note = footerLines(f, o.note);
  const height = HEAD + 32 + o.rows.length * ROW + 32 + 50 + note.length * FOOT_LINE;
  const { c, g } = setup(height);
  g.fillStyle = "#f4f4f5";
  g.fillRect(0, 0, W, height);
  header(g, f, o.club, o.title, o.month, HEAD);
  roundRect(g, PAD / 2, HEAD + 16, W - PAD, o.rows.length * ROW + 32, 36, "#ffffff");

  o.rows.forEach((r, i) => {
    const y = HEAD + 32 + i * ROW;
    const mid = y + ROW / 2;
    if (r.me) roundRect(g, PAD / 2 + 12, y + 6, W - PAD - 24, ROW - 12, 24, "rgba(198,244,50,0.45)");
    else if (i > 0) {
      g.fillStyle = "#f4f4f5";
      g.fillRect(PAD, y, W - PAD * 2, 2);
    }
    g.textAlign = "center";
    g.fillStyle = r.rank <= 3 ? "#d97706" : "#a1a1aa";
    g.font = f.display(600, 36);
    g.fillText(String(r.rank), PAD + 28, mid + 2);
    avatar(g, f, imgs, r, PAD + 72, mid - 30, 60);

    g.textAlign = "right";
    g.font = f.display(600, 36);
    g.fillStyle = r.delta >= 0 ? "#047857" : "#dc2626";
    g.fillText(`${r.delta > 0 ? "+" : ""}${r.delta}`, W - PAD, mid + 2);
    g.font = f.body(400, 26);
    g.fillStyle = "#71717a";
    g.fillText(r.record, W - PAD - 130, mid + 2);
    const recordW = g.measureText(r.record).width;

    g.textAlign = "left";
    g.fillStyle = INK;
    g.font = f.body(r.me ? 700 : 500, 34);
    g.fillText(fit(g, r.name, W - PAD * 2 - 150 - 130 - recordW - 24), PAD + 150, mid + 2);
  });

  footer(g, f, note, height - 50);
  return toBlob(c);
}

export type SummaryList = { title: string; items: (Person & { value: string })[] };

/** รูปสรุปก๊วนรายปี */
export async function yearImage(o: {
  club: string;
  title: string;
  stats: { label: string; value: string }[];
  lists: SummaryList[];
  duo?: { title: string; people: [Person, Person]; value: string };
  lines: string[];
  link: string;
}): Promise<Blob> {
  await fontsReady();
  const f = fonts();
  const imgs = await photos([...o.lists.flatMap((l) => l.items), ...(o.duo?.people ?? [])]);
  const STAT = 150;
  const HEAD = 180 + Math.ceil(o.stats.length / 2) * (STAT + 20) + 30;
  const ITEM = 76;
  const lists = o.lists.filter((l) => l.items.length);
  const body =
    lists.reduce((s, l) => s + 70 + l.items.length * ITEM + 20, 0) + (o.duo ? 70 + 110 + 20 : 0) + o.lines.length * 46 + (o.lines.length ? 20 : 0);
  const hasBody = body > 0;
  const link = footerLines(f, o.link);
  const height = HEAD + (hasBody ? 32 + body + 48 : 0) + 70 + link.length * FOOT_LINE;
  const { c, g } = setup(height);
  g.fillStyle = "#f4f4f5";
  g.fillRect(0, 0, W, height);
  header(g, f, o.club, o.title, "", HEAD);

  const sw = (W - PAD * 2 - 20) / 2;
  o.stats.forEach((s, i) => {
    const x = PAD + (i % 2) * (sw + 20);
    const y = 190 + Math.floor(i / 2) * (STAT + 20);
    roundRect(g, x, y, sw, STAT, 28, "rgba(255,255,255,0.1)");
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    g.font = f.display(600, 60);
    g.fillText(s.value, x + 30, y + 62);
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.font = f.body(400, 26);
    g.fillText(fit(g, s.label, sw - 60), x + 30, y + 115);
  });

  if (hasBody) {
    roundRect(g, PAD / 2, HEAD + 16, W - PAD, body + 64, 36, "#ffffff");
    let y = HEAD + 48;
    const heading = (s: string) => {
      g.textAlign = "left";
      g.fillStyle = INK;
      g.font = f.display(600, 36);
      g.fillText(fit(g, s, W - PAD * 2), PAD, y + 35);
      y += 70;
    };
    for (const l of lists) {
      heading(l.title);
      l.items.forEach((p, i) => {
        const mid = y + ITEM / 2;
        g.textAlign = "center";
        g.fillStyle = "#d97706";
        g.font = f.display(600, 32);
        g.fillText(String(i + 1), PAD + 18, mid + 2);
        avatar(g, f, imgs, p, PAD + 50, mid - 28, 56);
        g.textAlign = "right";
        g.fillStyle = "#71717a";
        g.font = f.body(400, 28);
        g.fillText(p.value, W - PAD, mid + 2);
        const vw = g.measureText(p.value).width;
        g.textAlign = "left";
        g.fillStyle = INK;
        g.font = f.body(500, 32);
        g.fillText(fit(g, p.name, W - PAD * 2 - 126 - vw - 24), PAD + 126, mid + 2);
        y += ITEM;
      });
      y += 20;
    }
    if (o.duo) {
      heading(o.duo.title);
      roundRect(g, PAD, y, W - PAD * 2, 110, 28, "rgba(198,244,50,0.35)");
      const mid = y + 55;
      avatar(g, f, imgs, o.duo.people[0], PAD + 20, mid - 30, 60);
      avatar(g, f, imgs, o.duo.people[1], PAD + 90, mid - 30, 60);
      g.textAlign = "right";
      g.fillStyle = "#52525b";
      g.font = f.body(400, 26);
      g.fillText(o.duo.value, W - PAD - 24, mid + 2);
      const vw = g.measureText(o.duo.value).width;
      g.textAlign = "left";
      g.fillStyle = INK;
      g.font = f.body(600, 30);
      g.fillText(fit(g, `${o.duo.people[0].name} + ${o.duo.people[1].name}`, W - PAD * 2 - 180 - vw - 48), PAD + 170, mid + 2);
      y += 130;
    }
    g.textAlign = "left";
    g.fillStyle = "#52525b";
    g.font = f.body(400, 28);
    for (const line of o.lines) {
      g.fillText(fit(g, line, W - PAD * 2), PAD, y + 23);
      y += 46;
    }
  }

  footer(g, f, link, height - 50);
  return toBlob(c);
}

/**
 * แชร์รูป: มือถือเปิดเมนูแชร์ (ส่งเข้าไลน์ได้เลย) เครื่องที่แชร์ไฟล์ไม่ได้จะดาวน์โหลดแทน
 * เว็บในแอพ LINE / Facebook บันทึกไฟล์ไม่ได้ จึงคืนรูป (data URL) ให้แสดงเต็มจอแล้วกดค้างบันทึกเอง
 */
export async function shareImage(blob: Blob, name: string): Promise<string | null> {
  const dataUrl = () =>
    new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => fail(r.error);
      r.readAsDataURL(blob);
    });
  if (inAppBrowser()) return dataUrl();
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return null;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      // iPhone ไม่ยอมเปิดเมนูแชร์ถ้าสร้างรูปนานเกินไปหลังกดปุ่ม แสดงรูปเต็มจอให้กดค้างแชร์แทน
      return dataUrl();
    }
  }
  downloadBlob(blob, name);
  return null;
}
