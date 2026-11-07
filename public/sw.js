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
  const opts = {
    body: data.body || "",
    tag: data.tag,
    renotify: !!data.tag,
    icon: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  if (data.alert) {
    const on = await alertOn();
    // เปิดแอพค้างไว้บนจออยู่: แอพเล่นเสียงและสั่นเอง แจ้งเตือนเด้งเงียบไว้ ไม่ให้ซ้ำ
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = list.some((c) => c.visibilityState === "visible");
    if (!on || visible) opts.silent = true;
    else {
      // Android สั่นตามรูปแบบนี้ (iPhone ใช้เสียง/สั่นของเครื่องเอง)
      opts.vibrate = [200, 100, 200, 100, 400];
      opts.requireInteraction = true;
    }
  }
  return self.registration.showNotification(data.title || "แบดกบินทร์", opts);
}

// แตะแจ้งเตือน: เปิดแอพ (หรือสลับไปหน้าที่เปิดอยู่) แล้วไปที่หน้าสนาม
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // หน้าแอพหลัก (ไม่ใช่หน้าคู่มือ) ที่เปิดอยู่
      const app = list.find((c) => new URL(c.url).pathname === "/" && "focus" in c);
      if (app) {
        app.postMessage({ type: "goto-tab", tab: "courts" });
        return app.focus();
      }
      return self.clients.openWindow(url + (url.includes("?") ? "&" : "?") + "go=courts");
    }),
  );
});
