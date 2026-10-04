import type { MetadataRoute } from "next";

// ให้กด "เพิ่มไปยังหน้าจอหลัก" แล้วเปิดเต็มจอเหมือนแอพ (ไม่ต้องเปิดผ่าน LINE จึงบันทึกรูปได้)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "แบดมินตันกบินทร์บุรี-สวนน้อมเกล้า",
    short_name: "แบดกบินทร์",
    description: "เช็คอิน จัดคู่ลงสนาม และคิดเงินค่าลูกค่าน้ำ",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
