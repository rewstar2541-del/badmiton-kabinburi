import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";

const body = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

const display = Prompt({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export const metadata: Metadata = {
  title: "แบดมินตันกบินทร์บุรี-สวนน้อมเกล้า",
  description: "เช็คอิน จัดคู่ลงสนาม และคิดเงินค่าลูกค่าน้ำ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${body.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
