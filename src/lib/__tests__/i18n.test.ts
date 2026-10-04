import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";

const root = join(__dirname, "..", "..");
const files = [
  ...readdirSync(join(root, "components")).map((f) => join(root, "components", f)),
  join(root, "lib", "store.tsx"),
];

/** ข้อความที่ส่งเข้า t("...") และ label ภาษาไทยในโค้ด */
function usedKeys(): string[] {
  const keys = new Set<string>();
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
    for (const m of s.matchAll(/label: "([^"]*[฀-๿][^"]*)"/g)) keys.add(m[1]);
  }
  return [...keys];
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("คำแปล", () => {
  it("ทุกข้อความในแอพมีคำแปลอังกฤษและจีน", () => {
    const keys = usedKeys();
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((k) => !(k in en))).toEqual([]);
    expect(keys.filter((k) => !(k in zh))).toEqual([]);
  });

  it("ตัวแปรในคำแปลตรงกับภาษาไทย", () => {
    for (const dict of [en, zh])
      for (const [th, tr] of Object.entries(dict)) expect([th, vars(tr)]).toEqual([th, vars(th)]);
  });
});
