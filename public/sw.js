// Service worker: รับแจ้งเตือนเด้ง (Web Push) แม้ปิดแอพอยู่ ไม่ได้เก็บไฟล์ไว้ใช้ออฟไลน์
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: e.data ? e.data.text() : "แบดกบินทร์" };
  }
  e.waitUntil(show(data));
});

// เสียง+สั่นตอนถึงคิว: ผู้เล่นเปิด/ปิดได้ที่โปรไฟล์ (แอพเขียนค่าไว้ใน Cache Storage ค่าเริ่มต้น = เปิด)
async function alertOn() {
  try {
    const r = await (await caches.open("bk-prefs")).match("/__bk/turn-alert");
    return !r || (await r.text()) !== "0";
  } catch {
    return true;
  }
}

async function show(data) {
  // บรรทัดบนสุด = ชื่อแอพ ตามด้วยหัวข้อเดิมและเนื้อหาอยู่ข้างล่าง
  const lines = [data.title, data.body].filter(Boolean).join("\n");
  const opts = {
    body: lines,
    tag: data.tag,
    renotify: !!data.tag,
    icon: "/icon-192.png",
    data: { url: data.url || "/", tab: data.tab || "courts" },
  };
  if (data.alert) {
    // ผู้เล่นปิดไว้: ยังเด้งบอก แต่เงียบ
    // (ไม่เงียบตอนแอพเปิดอยู่ เพราะแอพเล่นเสียงเองไม่ได้ทุกกรณี เช่น iPhone ปิดเสียงเครื่อง หรือยังไม่ได้แตะจอ: ยอมดังซ้ำดีกว่าพลาดคิว)
    if (!(await alertOn())) opts.silent = true;
    else {
      // ขอให้สั่น และให้ "ถึงคิวแล้ว" ค้างบนจอจนกว่าจะปัดทิ้ง
      // ทั้งสองอย่างเป็นแค่คำขอ: Android รุ่นใหม่ใช้การตั้งค่าแจ้งเตือนของเว็บในเครื่อง iPhone ใช้เสียง/สั่นของเครื่องเอง
      opts.vibrate = [200, 100, 200, 100, 400];
      if (data.alert === "play") opts.requireInteraction = true;
    }
  }
  return self.registration.showNotification("แบดกบินทร์", opts);
}

// แตะแจ้งเตือน: เปิดแอพ (หรือสลับไปหน้าที่เปิดอยู่) แล้วไปที่หน้าสนาม (คำขอเปลี่ยนมือ = หน้าผู้เล่น)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  const tab = (e.notification.data && e.notification.data.tab) || "courts";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // หน้าแอพหลัก (ไม่ใช่หน้าคู่มือ) ที่เปิดอยู่
      const app = list.find((c) => new URL(c.url).pathname === "/" && "focus" in c);
      if (app) {
        app.postMessage({ type: "goto-tab", tab });
        return app.focus();
      }
      return self.clients.openWindow(url + (url.includes("?") ? "&" : "?") + "go=" + encodeURIComponent(tab));
    }),
  );
});
