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
  e.waitUntil(
    self.registration.showNotification(data.title || "แบดกบินทร์", {
      body: data.body || "",
      tag: data.tag,
      renotify: !!data.tag,
      icon: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

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
