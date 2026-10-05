"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/remote";
import { today, useStore } from "@/lib/store";
import { resizePhoto } from "@/lib/image";
import { locale, t } from "@/lib/i18n";
import { Button, Card, Icon, SectionTitle, inputClass } from "./ui";
import { Auto } from "@/lib/autoTranslate";

/** รูปกิจกรรมของก๊วน: แอดมินอัปโหลด (ย่อรูปก่อนส่ง) ทุกคนดูได้ */
type Photo = { id: string; date: string; url: string; path: string; caption: string | null };

const BUCKET = "event-photos";
const SHOW = 24;

/** โหมดทดลอง: เก็บรูปไว้ในหน่วยความจำ (หายเมื่อรีเฟรช) */
const demoPhotos: Photo[] = [];

async function listPhotos(): Promise<Photo[]> {
  if (!supabase) return [...demoPhotos];
  const { data, error } = await supabase
    .from("event_photos")
    .select("id,date,path,caption")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SHOW);
  if (error) throw new Error(error.message);
  return (data as Omit<Photo, "url">[]).map((p) => ({ ...p, url: supabase!.storage.from(BUCKET).getPublicUrl(p.path).data.publicUrl }));
}

export function EventPhotos({ bare }: { bare?: boolean } = {}) {
  const { auth } = useStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const online = auth.online && Boolean(supabase);

  const load = useCallback(async () => {
    try {
      setPhotos(online ? await listPhotos() : [...demoPhotos]);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, [online]);

  useEffect(() => {
    let live = true;
    (online ? listPhotos() : Promise.resolve([...demoPhotos]))
      .then((p) => live && setPhotos(p))
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [online]);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError("");
    try {
      for (const f of Array.from(files).slice(0, 10)) {
        const blob = await resizePhoto(f);
        const date = today();
        if (!online) {
          demoPhotos.unshift({ id: crypto.randomUUID(), date, path: "", url: URL.createObjectURL(blob), caption: caption.trim() || null });
          continue;
        }
        const path = `${date}/${crypto.randomUUID()}.jpg`;
        const up = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw new Error(up.error.message);
        const { error } = await supabase!.from("event_photos").insert({ date, path, caption: caption.trim().slice(0, 200) || null });
        if (error) throw new Error(error.message);
      }
      setCaption("");
      await load();
    } catch (e) {
      setError(t("อัปโหลดไม่สำเร็จ") + ": " + String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Photo) => {
    if (!confirm(t("ลบรูปนี้?"))) return;
    if (!online) {
      demoPhotos.splice(demoPhotos.findIndex((x) => x.id === p.id), 1);
    } else {
      const { error } = await supabase!.from("event_photos").delete().eq("id", p.id);
      if (error) return setError(error.message);
      await supabase!.storage.from(BUCKET).remove([p.path]);
    }
    setOpen(null);
    await load();
  };

  if (!auth.isAdmin && photos.length === 0) return null;

  // จัดกลุ่มตามวัน
  const byDate = new Map<string, Photo[]>();
  for (const p of photos) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
  const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-3">
      {!bare && <SectionTitle>{t("รูปกิจกรรม")}</SectionTitle>}
      {auth.isAdmin && (
        <Card className="space-y-2">
          <input
            className={inputClass}
            placeholder={t("คำบรรยาย (ไม่ใส่ก็ได้)")}
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button variant="primary" className="flex w-full items-center justify-center gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon.Camera width={18} height={18} /> {busy ? t("กำลังอัปโหลด...") : t("เพิ่มรูปกิจกรรม")}
          </Button>
          <p className="text-xs text-zinc-500">{t("เลือกได้ครั้งละ 10 รูป")}</p>
        </Card>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {[...byDate].map(([date, list]) => (
        <div key={date} className="space-y-1.5">
          <div className="px-1 text-xs font-semibold text-zinc-500">{dateLabel(date)}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {list.map((p) => (
              <button key={p.id} onClick={() => setOpen(p)} className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black p-3" onClick={() => setOpen(null)}>
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {auth.isAdmin && (
              <button className="rounded-full bg-red-500/80 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => remove(open)}>
                {t("ลบ")}
              </button>
            )}
            <button className="grid size-9 place-items-center rounded-full bg-white/15 text-white" aria-label={t("ปิด")} onClick={() => setOpen(null)}>
              <Icon.X width={18} height={18} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.url} alt={open.caption ?? ""} className="max-h-full max-w-full rounded-xl object-contain" />
          </div>
          {open.caption && <p className="py-2 text-center text-sm text-white"><Auto text={open.caption} /></p>}
        </div>,
          document.body,
        )}
    </div>
  );
}
