/** เว็บที่เปิดในแอพ LINE / Facebook / Instagram ดาวน์โหลดไฟล์ไม่ได้ */
export function inAppBrowser() {
  return typeof navigator !== "undefined" && /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
}

/** แอพ LINE (เปิดลิงก์ออกไป Chrome / Safari ได้ด้วย openExternalBrowser=1 ส่วน Facebook / Instagram ทำไม่ได้) */
export function inLineApp() {
  return typeof navigator !== "undefined" && /\bLine\//i.test(navigator.userAgent);
}

/** ลิงก์หน้าแอพที่ LINE จะเปิดใน Chrome / Safari แทน (คงโหมดทดลองไว้ถ้าเปิดอยู่) */
export function externalAppUrl() {
  const demo = new URLSearchParams(window.location.search).has("demo") ? "demo&" : "";
  return `${window.location.origin}/?${demo}openExternalBrowser=1`;
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
