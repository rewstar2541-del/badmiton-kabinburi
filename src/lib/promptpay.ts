// สร้างข้อความสำหรับ PromptPay QR ตามมาตรฐาน EMVCo (Thai QR Payment)

function field(id: string, value: string): string {
  return id + value.length.toString().padStart(2, "0") + value;
}

export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** แปลงเบอร์มือถือ/เลขบัตร เป็นรหัสบัญชี PromptPay */
function target(id: string): { tag: string; value: string } {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 15) return { tag: "03", value: digits }; // e-Wallet
  if (digits.length >= 13) return { tag: "02", value: digits }; // เลขบัตร / เลขผู้เสียภาษี
  // เบอร์มือถือ 0812345678 -> 0066812345678
  const phone = ("0000000000000" + digits.replace(/^0/, "66")).slice(-13);
  return { tag: "01", value: phone };
}

export function isValidPromptPayId(id: string): boolean {
  const n = id.replace(/\D/g, "").length;
  return n === 10 || n === 13 || n === 15;
}

export function promptPayPayload(id: string, amount?: number): string {
  const t = target(id);
  const merchant = field("00", "A000000677010111") + field(t.tag, t.value);
  const hasAmount = amount !== undefined && amount > 0;
  const body =
    field("00", "01") +
    field("01", hasAmount ? "12" : "11") +
    field("29", merchant) +
    field("58", "TH") +
    field("53", "764") +
    (hasAmount ? field("54", amount.toFixed(2)) : "") +
    "6304";
  return body + crc16(body);
}
