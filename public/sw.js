// service worker เปล่าๆ ให้มือถือยอมติดตั้งเป็นแอพ ไม่เก็บแคช ข้อมูลโหลดสดจากเน็ตทุกครั้ง
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
