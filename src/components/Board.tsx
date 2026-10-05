"use client";

import { useEffect, useState } from "react";
import { Auto } from "@/lib/autoTranslate";
import { resizeSlip } from "@/lib/image";
import { locale, t } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { BoardKind, BoardPost } from "@/lib/types";
import { savedPin, useMe } from "./PickMe";
import { Avatar, Button, Card, Icon, baht, inputClass } from "./ui";

const KINDS: { value: BoardKind; label: string; done: string; tone: string }[] = [
  { value: "lost", label: "ของหาย", done: "ได้คืนแล้ว", tone: "bg-amber-100 text-amber-900" },
  { value: "found", label: "เจอของ", done: "คืนเจ้าของแล้ว", tone: "bg-sky-100 text-sky-900" },
  { value: "sell", label: "ฝากขาย", done: "ขายแล้ว", tone: "bg-emerald-100 text-emerald-900" },
];
const kindOf = (k: BoardKind) => KINDS.find((x) => x.value === k)!;

/** ย่อรูปให้เล็กพอเก็บในฐานข้อมูลฟรี (ด้านยาว 800px ไม่เกินราว 150KB) */
async function smallPhoto(file: File) {
  const url = await resizeSlip(file, 800);
  return url.length > 190_000 ? resizeSlip(file, 560) : url;
}

function Photo({ post }: { post: BoardPost }) {
  const { boardPhoto } = useStore();
  const [src, setSrc] = useState<string | null>(post.photo ?? null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (src || !post.hasPhoto) return;
    let alive = true;
    boardPhoto(post.id)
      .then((u) => alive && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [post.id, post.hasPhoto, src, boardPhoto]);
  if (!post.hasPhoto) return null;
  return (
    <>
      <button className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100" onClick={() => src && setBig(true)} aria-label={t("ดูรูป")}>
        {src && <img src={src} alt="" className="size-full object-cover" />}
      </button>
      {big && src && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/90 p-4" onClick={() => setBig(false)}>
          <img src={src} alt="" className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
    </>
  );
}

/** บอร์ดของหาย / เจอของ / ฝากขาย ผู้เล่นลงเองได้ แอดมินปิดได้ทุกโพสต์ */
export function BoardCard() {
  const { state, social, dispatch, auth } = useStore();
  const [me] = useMe();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<BoardKind>("lost");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<BoardKind | null>(null);
  const isAdmin = auth.isAdmin;
  if (!me && !isAdmin) return null;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const posts = (state.board ?? []).filter((b) => !filter || b.kind === filter);
  const open = posts.filter((b) => !b.closedAt);
  const closed = posts.filter((b) => b.closedAt);

  const submit = async () => {
    if (!me || !title.trim()) return;
    setBusy(true);
    const err = await social(
      { kind: "boardPost", post: { kind, title: title.trim(), detail, price: kind === "sell" && price ? Math.round(Number(price)) : null, photo } },
      me,
      savedPin.get(),
    );
    setBusy(false);
    setError(err ? t(err) : "");
    if (err) return;
    setAdding(false);
    setTitle("");
    setDetail("");
    setPrice("");
    setPhoto("");
  };
  const close = async (b: BoardPost) => {
    if (!confirm(t("ปิดโพสต์นี้ ({done})?", { done: t(kindOf(b.kind).done) }))) return;
    if (b.playerId === me) {
      const err = await social({ kind: "boardClose", id: b.id }, me, savedPin.get());
      setError(err ? t(err) : "");
    } else dispatch({ type: "closeBoardPost", id: b.id });
  };

  const row = (b: BoardPost) => {
    const k = kindOf(b.kind);
    const p = byId.get(b.playerId);
    return (
      <li key={b.id} className={`flex gap-3 py-3 ${b.closedAt ? "opacity-50" : ""}`}>
        <Photo post={b} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${k.tone}`}>{b.closedAt ? t(k.done) : t(k.label)}</span>
            {b.price != null && <span className="text-sm font-semibold">{baht(b.price)}</span>}
          </div>
          <div className="font-semibold">
            <Auto text={b.title} />
          </div>
          {b.detail && (
            <p className="text-sm whitespace-pre-line text-zinc-600">
              <Auto text={b.detail} />
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Avatar name={p?.name ?? "?"} photo={p?.photo} size={18} />
            {p?.name ?? "?"} · {new Date(b.at).toLocaleDateString(locale(), { day: "numeric", month: "short" })}
          </div>
        </div>
        {!b.closedAt && (b.playerId === me || isAdmin) && (
          <button className="h-fit shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600" onClick={() => close(b)}>
            {t(k.done)}
          </button>
        )}
      </li>
    );
  };

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-display font-semibold">{t("ของหาย / ฝากขาย")}</h3>
        <p className="text-sm text-zinc-500">{t("ของหาย เจอของ หรือขายของมือสอง ลงไว้ที่นี่")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[null, ...KINDS.map((k) => k.value)].map((k) => (
          <button
            key={k ?? "all"}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === k ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {k ? t(kindOf(k).label) : t("ทั้งหมด")}
          </button>
        ))}
      </div>
      {open.length === 0 && closed.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("ยังไม่มีโพสต์")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {open.map(row)}
          {closed.map(row)}
        </ul>
      )}
      {me &&
        (adding ? (
          <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === k.value ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {t(k.label)}
                </button>
              ))}
            </div>
            <input
              className={inputClass}
              maxLength={60}
              placeholder={kind === "sell" ? t("ขายอะไร เช่น ไม้ Yonex มือสอง") : t("ของอะไร เช่น ขวดน้ำสีฟ้า")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {kind === "sell" && (
              <input type="number" inputMode="numeric" min={0} className={inputClass} placeholder={t("ราคา (บาท)")} value={price} onChange={(e) => setPrice(e.target.value)} />
            )}
            <textarea className={`${inputClass} min-h-16`} maxLength={300} placeholder={t("รายละเอียด (ไม่ใส่ก็ได้)")} value={detail} onChange={(e) => setDetail(e.target.value)} />
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-600">
              {photo ? <img src={photo} alt="" className="size-14 rounded-xl object-cover" /> : <Icon.Camera width={20} height={20} />}
              {photo ? t("เปลี่ยนรูป") : t("ใส่รูป (ไม่ใส่ก็ได้)")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(await smallPhoto(f));
                }}
              />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setAdding(false)}>{t("ยกเลิก")}</Button>
              <Button variant="accent" disabled={busy || !title.trim()} onClick={submit}>
                {t("ลงประกาศ")}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="flex w-full items-center justify-center gap-1.5" onClick={() => setAdding(true)}>
            <Icon.Plus width={18} height={18} /> {t("ลงประกาศ")}
          </Button>
        ))}
      {!adding && error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
