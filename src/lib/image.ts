/** ย่อรูปเป็นสี่เหลี่ยมจัตุรัส (ครอปกลาง) แล้วคืนค่าเป็น JPEG data URL ขนาดเล็ก */
export async function resizeToSquare(file: File, size = 160, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** ย่อรูปสลิปให้อ่านตัวเลขได้ แต่ไฟล์เล็กพอส่งขึ้นฐานข้อมูล (ไม่เกินราว 500KB) */
export async function resizeSlip(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.8;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 500_000 && quality > 0.3) {
    quality -= 0.15;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  return url;
}

/** ย่อรูปกิจกรรม (ด้านยาวไม่เกิน 1600px ไฟล์ไม่เกินราว 400KB) ประหยัดพื้นที่ฟรีของ Supabase */
export async function resizePhoto(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (q: number) =>
    new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/jpeg", q));
  let quality = 0.82;
  let blob = await encode(quality);
  while (blob.size > 400_000 && quality > 0.4) {
    quality -= 0.12;
    blob = await encode(quality);
  }
  return blob;
}
