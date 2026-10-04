"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { loadRemote, persist, selfService, supabase } from "./remote";
import { EMPTY_STATE, prepare, reducer, today, type Intent, type SelfAction, type State } from "./state";
import { DEFAULT_SETTINGS } from "./types";

export { today, newId } from "./state";
export type { State, Intent } from "./state";

const STORAGE_KEY = "badminton-kabinburi:v1";

function loadLocal(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const s = JSON.parse(raw) as State;
    return { ...EMPTY_STATE, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings }, monthly: s.monthly ?? {} };
  } catch {
    return EMPTY_STATE;
  }
}

export interface Auth {
  /** โหมดออนไลน์ (Supabase) หรือเก็บในเครื่อง */
  online: boolean;
  email?: string;
  isAdmin: boolean;
  signIn: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

interface Ctx {
  state: State;
  dispatch: (i: Intent) => void;
  /** ผู้เล่นลงชื่อ/ยกเลิก/เช็คอินเองสำหรับวันนี้ คืนข้อความผิดพลาด หรือ null */
  self: (action: SelfAction, playerId: string, pin: string) => Promise<string | null>;
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

  const dispatch = useCallback((i: Intent) => apply(prepare(i)), []);
  const self = useCallback(async (action: SelfAction, playerId: string) => {
    dispatch({ type: action, date: today(), playerId });
    return null;
  }, [dispatch]);
  const auth: Auth = { online: false, isAdmin: true, signIn: async () => null, signOut: async () => {} };
  return <StoreCtx.Provider value={{ state, dispatch, self, ready: true, error: null, auth }}>{children}</StoreCtx.Provider>;
}

function RemoteProvider({ children }: { children: ReactNode }) {
  const db = supabase!;
  const [state, apply] = useReducer(reducer, EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
  useEffect(() => {
    const check = async (s: Session | null) => {
      setSession(s);
      let admin = false;
      if (s) {
        const { data } = await db.rpc("is_admin");
        admin = data === true;
      }
      adminRef.current = admin;
      setIsAdmin(admin);
      await reload();
    };
    db.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [db, reload]);

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
      persist(db, a).catch((e) => {
        setError(`บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : e}`);
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

  const auth: Auth = {
    online: true,
    email: session?.user.email,
    isAdmin,
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

  return <StoreCtx.Provider value={{ state, dispatch, self, ready, error, auth }}>{children}</StoreCtx.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return supabase ? <RemoteProvider>{children}</RemoteProvider> : <LocalProvider>{children}</LocalProvider>;
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
