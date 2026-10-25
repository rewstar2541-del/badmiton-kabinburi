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

/** วาดใบเสร็จลง canvas แล้วคืนเป็นรูป PNG (ใช้ฟอนต์เดียวกับหน้าแอพ) */
export async function drawReceipt(r: ReceiptData, fontFamily: string): Promise<{ blob: Blob; url: string }> {
  await document.fonts?.ready;
  const H = 610 + r.lines.length * 52;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;

  ctx.fillStyle = "#f3f5f8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(24, 24, W - 48, H - 48, 28);
  ctx.fill();

  // หัวใบเสร็จ
  ctx.fillStyle = "#0b1220";
  ctx.beginPath();
  ctx.roundRect(24, 24, W - 48, 150, [28, 28, 0, 0]);
  ctx.fill();
  ctx.fillStyle = "#c6f432";
  ctx.font = font(700, 30);
  ctx.fillText(fit(ctx, r.club[0], W - PAD * 2 - 24), PAD + 12, 80);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = font(500, 22);
  ctx.fillText(fit(ctx, r.club[1], W - PAD * 2 - 24), PAD + 12, 114);
  ctx.fillStyle = "#ffffff";
  ctx.font = font(600, 22);
  ctx.fillText(r.title, PAD + 12, 150);

  let y = 226;
  ctx.fillStyle = "#0b1220";
  ctx.font = font(700, 32);
  ctx.fillText(fit(ctx, r.name, W - PAD * 2 - 24), PAD + 12, y);
  y += 38;
  ctx.fillStyle = "#52525b";
  ctx.font = font(400, 22);
  ctx.fillText(r.dateLine, PAD + 12, y);
  y += 32;
  ctx.fillText(r.paidLine, PAD + 12, y);

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
  for (const l of r.lines) {
    ctx.font = font(500, 23);
    ctx.fillStyle = "#18181b";
    ctx.textAlign = "right";
    ctx.fillText(l.amount, W - PAD - 12, y);
    const amountW = ctx.measureText(l.amount).width;
    ctx.textAlign = "left";
    ctx.font = font(400, 23);
    ctx.fillStyle = "#3f3f46";
    ctx.fillText(fit(ctx, l.label, W - PAD * 2 - 24 - amountW - 24), PAD + 12, y);
    y += 52;
  }

  y -= 16;
  rule(y);
  y += 58;
  ctx.fillStyle = "#0b1220";
  ctx.font = font(700, 28);
  ctx.fillText(r.totalLabel, PAD + 12, y);
  ctx.textAlign = "right";
  ctx.font = font(700, 36);
  ctx.fillText(r.total, W - PAD - 12, y + 2);
  ctx.textAlign = "left";

  // ตราจ่ายแล้ว
  y += 44;
  ctx.fillStyle = "#ecfdf5";
  ctx.beginPath();
  ctx.roundRect(PAD + 12, y, W - PAD * 2 - 24, 60, 16);
  ctx.fill();
  ctx.fillStyle = "#047857";
  ctx.font = font(700, 26);
  ctx.textAlign = "center";
  ctx.fillText(`✓ ${r.stamp}`, W / 2, y + 40);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = font(400, 18);
  ctx.fillText(r.footer, W / 2, H - 46);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));
  return { blob, url: canvas.toDataURL("image/png") };
}
