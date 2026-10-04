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
