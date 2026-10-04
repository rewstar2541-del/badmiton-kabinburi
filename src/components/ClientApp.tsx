"use client";

import dynamic from "next/dynamic";

// ข้อมูลอยู่ใน localStorage จึงไม่ render ฝั่งเซิร์ฟเวอร์
export const ClientApp = dynamic(() => import("./App").then((m) => m.App), { ssr: false });
