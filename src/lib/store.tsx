"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { isDemo, demoState } from "./demo";
import { addGuest, loadRemote, persist, selfService, setPartnerPrefs, slipImage, submitSlip, supabase } from "./remote";
import { EMPTY_STATE, guestCheck, prepare, reducer, today, type Intent, type SelfAction, type State } from "./state";
import { DEFAULT_SETTINGS, monthOf, type Level } from "./types";
import { t } from "@/lib/i18n";

export { today, newId } from "./state";
export type { State, Intent } from "./state";

const DEMO = typeof window !== "undefined" && isDemo();
const STORAGE_KEY = DEMO ? "badminton-kabinburi:demo" : "badminton-kabinburi:v1";

function loadLocal(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO ? demoState() : EMPTY_STATE;
    const s = JSON.parse(raw) as State;
    return { ...EMPTY_STATE, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings }, monthly: s.monthly ?? {}, closed: s.closed ?? {} };
  } catch {
    return DEMO ? demoState() : EMPTY_STATE;
  }
}

export interface Auth {
  /** โหมดออนไลน์ (Supabase) หรือเก็บในเครื่อง */
  online: boolean;
  email?: string;
  isAdmin: boolean;
  /** โหมดทดลอง: สลับดูแบบแอดมิน/ผู้เล่นได้ */
  demo?: { setAdmin: (admin: boolean) => void; reset: () => void };
  /** ยังไม่มีแอดมินในระบบเลย (คนที่ล็อคอินอยู่ตั้งตัวเองเป็นแอดมินคนแรกได้) */
  noAdmins: boolean;
  claimFirstAdmin: () => Promise<string | null>;
  signIn: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

interface Ctx {
  state: State;
  dispatch: (i: Intent) => void;
  /** ผู้เล่นลงชื่อ/ยกเลิก/เช็คอินเองสำหรับวันนี้ คืนข้อความผิดพลาด หรือ null */
  self: (action: SelfAction, playerId: string, pin: string) => Promise<string | null>;
  /** ผู้เล่นส่งรูปสลิปโอนเงิน คืนข้อความผิดพลาด หรือ null */
  sendSlip: (playerId: string, pin: string, amount: number, image: string) => Promise<string | null>;
  /** ผู้เล่นตั้งคนที่อยากจับคู่/ไม่อยากเจอ คืนข้อความผิดพลาด หรือ null */
  setPrefs: (playerId: string, pin: string, prefer: string[], avoid: string[]) => Promise<string | null>;
  /** สมาชิกพาเพื่อนมา (สร้างแขกและเช็คอินวันนี้) คืนข้อความผิดพลาด หรือ null */
  addGuest: (hostId: string, pin: string, name: string, level: Level) => Promise<string | null>;
  /** รูปสลิป (เฉพาะแอดมิน) */
  slipImage: (slipId: string) => Promise<string | null>;
  ready: boolean;
  error: string | null;
  auth: Auth;
}

const StoreCtx = createContext<Ctx | null>(null);

function LocalProvider({ children }: { children: ReactNode }) {
  // แอพถูกโหลดฝั่งเบราว์เซอร์เท่านั้น (ดู ClientApp) จึงอ่าน localStorage ตอนเริ่มได้เลย
  const [state, apply] = useReducer(reducer, undefined, loadLocal);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // พื้นที่เต็มหรือถูกบล็อก ใช้งานต่อได้แต่ไม่ถูกบันทึก
    }
  }, [state]);

  // แท็บอื่นในเครื่องเดียวกัน (เช่นจอสนาม) แก้ข้อมูล ให้หน้านี้อัปเดตตาม
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        apply({ type: "replace", state: JSON.parse(e.newValue) as State });
      } catch {
        // ข้อมูลเสีย ไม่ต้องทำอะไร
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dispatch = useCallback((i: Intent) => apply(prepare(i)), []);
  const self = useCallback(
    async (action: SelfAction, playerId: string) => {
      const date = today();
      if (action === "rest" || action === "unrest") dispatch({ type: "setResting", date, playerId, resting: action === "rest" });
      else if (action === "pay") dispatch({ type: "markPaid", date, playerId });
      else if (action === "payMonth") dispatch({ type: "setMonthlyPaid", month: monthOf(date), playerId, paid: true });
      else dispatch({ type: action, date, playerId });
      return null;
    },
    [dispatch],
  );
  const setPrefs = useCallback(
    async (playerId: string, _pin: string, prefer: string[], avoid: string[]) => {
      const p = state.players.find((x) => x.id === playerId);
      if (p) dispatch({ type: "updatePlayer", player: { ...p, prefer, avoid } });
      return null;
    },
    [dispatch, state.players],
  );
  const addGuestLocal = useCallback(
    async (hostId: string, _pin: string, name: string, level: Level) => {
      const date = today();
      const err = guestCheck(state, date, hostId, name);
      if (err) return err;
      apply(prepare({ type: "addGuest", date, hostId, name: name.trim().slice(0, 40), level }));
      return null;
    },
    [state],
  );
  // รูปสลิปในโหมดเครื่องเดียว เก็บไว้ในหน่วยความจำ (หายเมื่อรีเฟรช)
  const images = useRef(new Map<string, string>());
  const sendSlip = useCallback(async (playerId: string, _pin: string, amount: number, image: string) => {
    const a = prepare({ type: "addSlip", date: today(), playerId, amount });
    if (a.type === "addSlip") images.current.set(a._id, image);
    apply(a);
    return null;
  }, []);
  const getSlip = useCallback(async (id: string) => images.current.get(id) ?? null, []);
  const [isAdmin, setAdmin] = useState(true);
  const auth: Auth = {
    online: false,
    isAdmin,
    noAdmins: false,
    claimFirstAdmin: async () => null,
    signIn: async () => null,
    signOut: async () => {},
    demo: DEMO
      ? {
          setAdmin,
          reset: () => apply({ type: "replace", state: demoState() }),
        }
      : undefined,
  };
  return (
    <StoreCtx.Provider value={{ state, dispatch, self, sendSlip, setPrefs, addGuest: addGuestLocal, slipImage: getSlip, ready: true, error: null, auth }}>
      {children}
    </StoreCtx.Provider>
  );
}

function RemoteProvider({ children }: { children: ReactNode }) {
  const db = supabase!;
  const [state, apply] = useReducer(reducer, EMPTY_STATE);
  const playersRef = useRef(state.players);
  useEffect(() => {
    playersRef.current = state.players;
  }, [state.players]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [noAdmins, setNoAdmins] = useState(false);
  const adminRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      apply({ type: "replace", state: await loadRemote(db, adminRef.current) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [db]);

  // สถานะล็อคอิน และเช็คว่าเป็นแอดมินไหม
  const check = useCallback(
    async (s: Session | null) => {
      setSession(s);
      let admin = false;
      let none = false;
      if (s) {
        const { data } = await db.rpc("is_admin");
        admin = data === true;
        if (!admin) none = (await db.rpc("has_admins")).data === false;
      }
      adminRef.current = admin;
      setIsAdmin(admin);
      setNoAdmins(none);
      await reload();
    },
    [db, reload],
  );

  useEffect(() => {
    db.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [db, check]);

  // อัปเดตทันทีเมื่อเครื่องอื่นแก้ข้อมูล
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel("all-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(t);
        t = setTimeout(reload, 300);
      })
      .subscribe();
    return () => {
      clearTimeout(t);
      db.removeChannel(channel);
    };
  }, [db, reload]);

  const dispatch = useCallback(
    (i: Intent) => {
      if (!adminRef.current) return;
      const a = prepare(i);
      apply(a);
      persist(db, a, playersRef.current).catch((e) => {
        setError(t("บันทึกไม่สำเร็จ: {msg}", { msg: e instanceof Error ? e.message : String(e) }));
        reload();
      });
    },
    [db, reload],
  );

  const self = useCallback(
    async (action: SelfAction, playerId: string, pin: string) => {
      const err = await selfService(db, action, playerId, pin);
      if (!err) await reload();
      return err;
    },
    [db, reload],
  );

  const sendSlip = useCallback(
    async (playerId: string, pin: string, amount: number, image: string) => {
      const err = await submitSlip(db, playerId, pin, amount, image);
      if (!err) await reload();
      return err;
    },
    [db, reload],
  );

  const getSlip = useCallback((id: string) => slipImage(db, id), [db]);
  const addGuestRemote = useCallback(
    async (hostId: string, pin: string, name: string, level: Level) => {
      const err = await addGuest(db, hostId, pin, name, level);
      if (!err) await reload();
      return err;
    },
    [db, reload],
  );
  const setPrefs = useCallback(
    async (playerId: string, pin: string, prefer: string[], avoid: string[]) => {
      const err = await setPartnerPrefs(db, playerId, pin, prefer, avoid);
      if (!err) await reload();
      return err;
    },
    [db, reload],
  );

  const auth: Auth = {
    online: true,
    email: session?.user.email,
    isAdmin,
    noAdmins,
    claimFirstAdmin: async () => {
      const { data, error } = await db.rpc("claim_first_admin");
      const err = error?.message ?? (data as string | null);
      if (!err) await check(session);
      return err ?? null;
    },
    signIn: async (email) => {
      const { error } = await db.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
      });
      return error ? error.message : null;
    },
    signOut: async () => {
      await db.auth.signOut();
    },
  };

  return <StoreCtx.Provider value={{ state, dispatch, self, sendSlip, setPrefs, addGuest: addGuestRemote, slipImage: getSlip, ready, error, auth }}>{children}</StoreCtx.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return supabase && !DEMO ? <RemoteProvider>{children}</RemoteProvider> : <LocalProvider>{children}</LocalProvider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore ต้องอยู่ใน StoreProvider");
  return v;
}

export function useToday() {
  const { state } = useStore();
  const date = today();
  const day = state.days.find((d) => d.date === date) ?? { date, checkIns: [], games: [], drinks: [] };
  return { date, day };
}
