export interface ReceiptData {
  club: [string, string];
  title: string;
  name: string;
  /** เช่น "วันที่ 25 ต.ค. 2569" */
  dateLine: string;
  /** เช่น "จ่ายเมื่อ 20:15" */
  paidLine: string;
  lines: { label: string; amount: string }[];
  totalLabel: string;
  total: string;
  stamp: string;
  footer: string;
}

const W = 720;
const PAD = 48;

/** ตัดข้อความยาวให้พอดีความกว้าง (ภาษาไทยไม่มีเว้นวรรค จึงตัดทีละตัวอักษร) */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(chars.join("") + "…").width > max) chars.pop();
  return chars.join("") + "…";
}

/** แบ่งข้อความยาวเป็นไม่เกิน 2 บรรทัด (ตัดที่เว้นวรรคถ้ามี) ข้อความเช่น "แอดมินแก้ยอด" จะได้ไม่หายจากใบเสร็จ */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  if (ctx.measureText(text).width <= max) return [text];
  const chars = [...text];
  let n = chars.length;
  while (n > 1 && ctx.measureText(chars.slice(0, n).join("")).width > max) n--;
  const space = chars.slice(0, n).lastIndexOf(" ");
  if (space > 0) n = space;
  return [chars.slice(0, n).join("").trimEnd(), fit(ctx, chars.slice(n).join("").trimStart(), max)];
}

/** สี่เหลี่ยมมุมโค้ง (มือถือรุ่นเก่า เช่น iOS ต่ำกว่า 16 ไม่มี ctx.roundRect) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, bottom = r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, bottom);
  ctx.arcTo(x, y + h, x, y, bottom);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/** วาดใบเสร็จลง canvas (ใช้ฟอนต์เดียวกับหน้าแอพ) */
export async function drawReceipt(r: ReceiptData, fontFamily: string): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;
  const inner = W - PAD * 2 - 24;

  // วัดรายการก่อน จะได้รู้ความสูงของรูป
  const rows = r.lines.map((l) => {
    ctx!.font = font(500, 23);
    const amountW = ctx!.measureText(l.amount).width;
    ctx!.font = font(400, 23);
    return { amount: l.amount, label: wrap(ctx!, l.label, inner - amountW - 24) };
  });
  const H = 610 - (r.paidLine ? 0 : 32) + rows.reduce((h, row) => h + 52 + (row.label.length - 1) * 30, 0);

  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#f3f5f8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);

  // หัวใบเสร็จ
  ctx.fillStyle = "#0b1220";
  roundRect(ctx, 24, 24, W - 48, 150, 28, 0);
  ctx.fillStyle = "#c6f432";
  ctx.font = font(700, 30);
  ctx.fillText(fit(ctx, r.club[0], inner), PAD + 12, 80);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = font(500, 22);
  ctx.fillText(fit(ctx, r.club[1], inner), PAD + 12, 114);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(600, 22);
  ctx.fillText(fit(ctx, r.title, inner), PAD + 12, 150);

  let y = 226;
  ctx.fillStyle = "#0b1220";
  ctx.font = font(700, 32);
  ctx.fillText(fit(ctx, r.name, inner), PAD + 12, y);
  y += 38;
  ctx.fillStyle = "#52525b";
  ctx.font = font(400, 22);
  ctx.fillText(fit(ctx, r.dateLine, inner), PAD + 12, y);
  if (r.paidLine) {
    y += 32;
    ctx.fillText(fit(ctx, r.paidLine, inner), PAD + 12, y);
  }

  y += 28;
  const rule = (at: number) => {
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(PAD + 12, at);
    ctx.lineTo(W - PAD - 12, at);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  rule(y);

  y += 48;
  for (const row of rows) {
    ctx.font = font(500, 23);
    ctx.fillStyle = "#18181b";
    ctx.textAlign = "right";
    ctx.fillText(row.amount, W - PAD - 12, y);
    ctx.textAlign = "left";
    ctx.font = font(400, 23);
    ctx.fillStyle = "#3f3f46";
    row.label.forEach((text, i) => ctx.fillText(text, PAD + 12, y + i * 30));
    y += 52 + (row.label.length - 1) * 30;
  }

  y -= 16;
  rule(y);
  y += 58;
  ctx.fillStyle = "#0b1220";
  ctx.textAlign = "right";
  ctx.font = font(700, 36);
  ctx.fillText(r.total, W - PAD - 12, y + 2);
  const totalW = ctx.measureText(r.total).width;
  ctx.textAlign = "left";
  ctx.font = font(700, 28);
  ctx.fillText(fit(ctx, r.totalLabel, inner - totalW - 24), PAD + 12, y);

  // ตราจ่ายแล้ว
  y += 44;
  ctx.fillStyle = "#ecfdf5";
  roundRect(ctx, PAD + 12, y, inner, 60, 16);
  ctx.fillStyle = "#047857";
  ctx.font = font(700, 26);
  ctx.textAlign = "center";
  ctx.fillText(fit(ctx, `✓ ${r.stamp}`, inner), W / 2, y + 40);

  ctx.fillStyle = "#71717a";
  ctx.font = font(400, 20);
  ctx.fillText(fit(ctx, r.footer, inner), W / 2, H - 46);
  ctx.textAlign = "left";

  return canvas;
}
