import type { MetadataRoute } from "next";

// Tells phones this site is a real installable app (name, icon, colours),
// so "Install app" / "Add to Home screen" works without warnings.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "แบดมินตันกบินทร์บุรี-สวนน้อมเกล้า",
    short_name: "แบดกบินทร์",
    description: "เช็คอิน จัดคู่ลงสนาม และคิดเงินค่าลูกค่าน้ำ",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    categories: ["sports"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
