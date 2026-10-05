/** เว็บที่เปิดในแอพ LINE / Facebook / Instagram ดาวน์โหลดไฟล์ไม่ได้ */
export function inAppBrowser() {
  return typeof navigator !== "undefined" && /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
}

/** ลิงก์หน้าแอพที่ LINE จะเปิดใน Chrome / Safari แทน (openExternalBrowser=1) */
export function externalAppUrl() {
  return `${window.location.origin}/?openExternalBrowser=1`;
}

/** ดาวน์โหลดไฟล์ ใส่ลิงก์ลงหน้าก่อนกด และค่อยคืนหน่วยความจำทีหลัง ไม่งั้นมือถือบางรุ่นยกเลิกการโหลด */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
