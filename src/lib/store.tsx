"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { isDemo, demoState } from "./demo";
import { randomToken, readSession, writeSession } from "./session";
import { clearLineTicket, handleLineCallback, readLineTicket } from "./lineLogin";
import { addGuest, claimPlayer, signUpDay, registerPlayerLine, loadPrivate, type LoginResult, type Rows, type TableKey, TABLE_OF, loadRows, rowsToState, persist, selfService, setPartnerPrefs, slipImage, submitSlip, removeMySlip, setMyPlan, updateMyProfile, type ProfileInput, supabase } from "./remote";
import { EMPTY_STATE, guestCheck, prepare, reducer, today, type Intent, type SelfAction, type State } from "./state";
import { DEFAULT_SETTINGS, monthOf, type Level, type Plan, type Player } from "./types";
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
  /** แสดงเมนูแอดมินอยู่ (แอดมินที่สลับเป็นโหมดผู้เล่นจะเป็น false) */
  isAdmin: boolean;
  /** เป็นแอดมินจริง (ใช้แสดงปุ่มสลับโหมด) */
  canAdmin?: boolean;
  /** แอดมินสลับไปดูแบบผู้เล่นธรรมดา (จำไว้ในเครื่อง) */
  playerMode?: boolean;
  setPlayerMode?: (on: boolean) => void;
  /** โหมดทดลอง: สลับดูแบบแอดมิน/ผู้เล่นได้ */
  demo?: { setAdmin: (admin: boolean) => void; reset: () => void };
  /** ยังไม่มีแอดมินในระบบเลย (คนที่ล็อคอินอยู่ตั้งตัวเองเป็นแอดมินคนแรกได้) */
  noAdmins: boolean;
  claimFirstAdmin: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

interface Ctx {
  state: State;
  dispatch: (i: Intent) => void;
  /** ผู้เล่นลงชื่อ/ยกเลิก/เช็คอินเองสำหรับวันนี้ (ลงชื่อ/ยกเลิกล่วงหน้าได้ด้วย date) คืนข้อความผิดพลาด หรือ null */
  self: (action: SelfAction, playerId: string, pin: string, date?: string) => Promise<string | null>;
  /** ผู้เล่นส่งรูปสลิปโอนเงิน คืนข้อความผิดพลาด หรือ null */
  sendSlip: (playerId: string, pin: string, amount: number, image: string) => Promise<string | null>;
  /** ผู้เล่นลบสลิปของตัวเองที่ส่งผิด (เฉพาะที่ส่งวันนี้) คืนข้อความผิดพลาด หรือ null */
  removeSlip: (playerId: string, pin: string, slipId: string) => Promise<string | null>;
  /** ผู้เล่นตั้งคนที่อยากจับคู่/ไม่อยากเจอ คืนข้อความผิดพลาด หรือ null */
  setPrefs: (playerId: string, pin: string, prefer: string[], avoid: string[]) => Promise<string | null>;
  /** ผู้เล่นเลือกสมาชิกรายวัน/รายเดือน คืนข้อความผิดพลาด หรือ null */
  setPlan: (playerId: string, pin: string, plan: Plan) => Promise<string | null>;
  /** ผู้เล่นแก้ข้อมูลตัวเอง คืนข้อความผิดพลาด หรือ null */
  updateProfile: (playerId: string, pin: string, p: ProfileInput) => Promise<string | null>;
  /**
   * "นี่คือฉัน" กับชื่อที่แอดมินลงไว้แล้ว: ของจริงส่งคำขอผูก LINE ให้แอดมินยืนยัน (pending)
   * โหมดทดลองเข้าเป็นคนนั้นได้เลย (token)
   */
  login: (playerId: string) => Promise<LoginResult>;
  /** ผู้เล่นสมัครเองครั้งแรก รอแอดมินอนุมัติ */
  register: (p: Omit<Player, "id">) => Promise<{ id?: string; error?: string }>;
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
    async (action: SelfAction, playerId: string, _pin?: string, on?: string) => {
      if (state.players.find((p) => p.id === playerId)?.pending) return "รอแอดมินอนุมัติก่อน";
      const date = on ?? today();
      if (action === "rest" || action === "unrest") dispatch({ type: "setResting", date, playerId, resting: action === "rest" });
      else if (action === "pay") dispatch({ type: "markPaid", date, playerId });
      else if (action === "payMonth") dispatch({ type: "setMonthlyPaid", month: monthOf(date), playerId, paid: true });
      else if (action === "undoCheckIn" || action === "notComing") {
        const day = state.days.find((d) => d.date === date);
        if (day?.games.some((g) => g.playerIds.includes(playerId))) return "เล่นไปแล้ว ยกเลิกเช็คอินไม่ได้ ให้แอดมินช่วย";
        if (day?.checkIns.some((c) => c.playerId === playerId && c.paidAt)) return "จ่ายเงินแล้ว ยกเลิกเช็คอินไม่ได้ ให้แอดมินช่วย";
        dispatch({ type: "undoCheckIn", date, playerId });
        if (action === "notComing") dispatch({ type: "cancelSignUp", date, playerId });
      } else dispatch({ type: action, date, playerId });
      return null;
    },
    [dispatch, state.players, state.days],
  );
  const setPrefs = useCallback(
    async (playerId: string, _pin: string, prefer: string[], avoid: string[]) => {
      const p = state.players.find((x) => x.id === playerId);
      if (p) dispatch({ type: "updatePlayer", player: { ...p, prefer, avoid } });
      return null;
    },
    [dispatch, state.players],
  );
  const setPlanLocal = useCallback(
    async (playerId: string, _pin: string, plan: Plan) => {
      const p = state.players.find((x) => x.id === playerId);
      if (p) dispatch({ type: "updatePlayer", player: { ...p, plan } });
      return null;
    },
    [dispatch, state.players],
  );
  const updateProfileLocal = useCallback(
    async (playerId: string, _pin: string, v: ProfileInput) => {
      const p = state.players.find((x) => x.id === playerId);
      if (!p) return "ไม่พบผู้เล่น";
      const { level, ...rest } = v;
      dispatch({ type: "updatePlayer", player: { ...p, ...rest, levelRequest: level === p.level ? undefined : level } });
      return null;
    },
    [dispatch, state.players],
  );
  const addGuestLocal = useCallback(
    async (hostId: string, _pin: string, name: string, level: Level) => {
      const date = today();
      if (state.players.find((p) => p.id === hostId)?.pending) return "รอแอดมินอนุมัติก่อน";
      const err = guestCheck(state, date, hostId, name);
      if (err) return err;
      apply(prepare({ type: "addGuest", date, hostId, name: name.trim().slice(0, 40), level }));
      return null;
    },
    [state],
  );
  const loginLocal = useCallback(
    async (playerId: string): Promise<LoginResult> => {
      const p = state.players.find((x) => x.id === playerId);
      if (!p) return { error: "ไม่พบผู้เล่น" };
      if (p.pending) return { error: "รอแอดมินอนุมัติก่อน" };
      // โหมดทดลองไม่มี LINE: เลือกชื่อแล้วเข้าได้เลย
      const token = randomToken();
      writeSession({ playerId, token });
      return { token };
    },
    [state.players],
  );
  const registerLocal = useCallback(async (p: Omit<Player, "id">) => {
    const a = prepare({ type: "addPlayer", player: { ...p, pending: true } });
    apply(a);
    return { id: a.type === "addPlayer" ? a._id : undefined };
  }, []);
  // รูปสลิปในโหมดเครื่องเดียว เก็บไว้ในหน่วยความจำ (หายเมื่อรีเฟรช)
  const images = useRef(new Map<string, string>());
  const sendSlip = useCallback(async (playerId: string, _pin: string, amount: number, image: string) => {
    const a = prepare({ type: "addSlip", date: today(), playerId, amount });
    if (a.type === "addSlip") images.current.set(a._id, image);
    apply(a);
    return null;
  }, []);
  const getSlip = useCallback(async (id: string) => images.current.get(id) ?? null, []);
  const removeSlipLocal = useCallback(async (_p: string, _pin: string, slipId: string) => {
    images.current.delete(slipId);
    apply(prepare({ type: "removeSlip", date: today(), slipId }));
    return null;
  }, []);
  const [isAdmin, setAdmin] = useState(true);
  const auth: Auth = {
    online: false,
    isAdmin,
    noAdmins: false,
    claimFirstAdmin: async () => null,
    signOut: async () => {},
    demo: DEMO
      ? {
          setAdmin,
          reset: () => apply({ type: "replace", state: demoState() }),
        }
      : undefined,
  };
  return (
    <StoreCtx.Provider value={{ state, dispatch, self, sendSlip, removeSlip: removeSlipLocal, setPrefs, setPlan: setPlanLocal, updateProfile: updateProfileLocal, addGuest: addGuestLocal, register: registerLocal, login: loginLocal, slipImage: getSlip, ready: true, error: null, auth }}>
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

  // แถวล่าสุดที่โหลดมา เวลามีการเปลี่ยนแปลงจะโหลดใหม่เฉพาะตารางนั้น (คนเยอะจะได้ไม่หนัก)
  const rowsRef = useRef<{ rows: Rows; admin: boolean } | null>(null);
  const loadOnce = useCallback(async (tables?: Set<TableKey>) => {
    try {
      const prev = rowsRef.current?.admin === adminRef.current && tables ? rowsRef.current.rows : undefined;
      const rows = await loadRows(db, adminRef.current, tables, prev);
      rowsRef.current = { rows, admin: adminRef.current };
      let s = rowsToState(rows);
      // ผู้เล่นทั่วไปไม่เห็นค่าน้ำ/ค่ารายเดือนของคนอื่น โหลดเฉพาะของตัวเองหลังล็อกอิน
      const me = readSession();
      if (!adminRef.current && me) {
        const mine = await loadPrivate(db, s, me.playerId, me.token);
        if (mine === "expired") writeSession(null);
        else s = mine;
      }
      apply({ type: "replace", state: s });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [db]);
  // โหลดทีละครั้งตามลำดับ ไม่ให้ผลของรอบเก่าที่เสร็จช้ากว่ามาทับข้อมูลใหม่
  const queue = useRef<Promise<void>>(Promise.resolve());
  const reload = useCallback((tables?: Set<TableKey>) => {
    const run = queue.current.then(() => loadOnce(tables));
    queue.current = run.catch(() => {});
    return run;
  }, [loadOnce]);

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
    // กลับมาจากหน้าเข้าสู่ระบบของ LINE
    handleLineCallback(db).then((r) => {
      if (r === "redirect") return;
      if (r) setError(t(r));
      db.auth.getSession().then(({ data }) => check(data.session));
    });
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [db, check]);

  // อัปเดตทันทีเมื่อเครื่องอื่นแก้ข้อมูล
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<TableKey>();
    const channel = db
      .channel("all-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const key = TABLE_OF[payload.table];
        if (key) pending.add(key);
        clearTimeout(t);
        t = setTimeout(() => {
          const tables = new Set(pending);
          pending.clear();
          reload(tables);
        }, 300);
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
    async (action: SelfAction, playerId: string, pin: string, date?: string) => {
      const ahead = date && date !== today() && (action === "signUp" || action === "cancelSignUp");
      const err = ahead ? await signUpDay(db, playerId, pin, date, action === "signUp") : await selfService(db, action, playerId, pin);
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

  const removeSlipRemote = useCallback(
    async (playerId: string, pin: string, slipId: string) => {
      const err = await removeMySlip(db, playerId, pin, slipId);
      if (!err) {
        apply(prepare({ type: "removeSlip", date: today(), slipId }));
        await reload();
      }
      return err;
    },
    [db, reload],
  );

  const getSlip = useCallback((id: string) => slipImage(db, id), [db]);
  const loginRemote = useCallback(
    async (playerId: string): Promise<LoginResult> => {
      // ต้องเพิ่งเข้าด้วย LINE ก่อน แล้วส่งคำขอผูกบัญชีนี้กับชื่อเดิม รอแอดมินยืนยัน
      const tk = readLineTicket();
      if (!tk) return { error: "กรุณาเข้าสู่ระบบด้วย LINE ใหม่" };
      const r = await claimPlayer(db, tk.ticket, playerId);
      if (!r.ok) return { error: r.error ?? "บันทึกไม่สำเร็จ" };
      clearLineTicket();
      return { pending: true };
    },
    [db],
  );
  const registerRemote = useCallback(
    async (p: Omit<Player, "id">) => {
      const tk = readLineTicket();
      if (!tk) return { error: "กรุณาเข้าสู่ระบบด้วย LINE ใหม่" };
      const r = await registerPlayerLine(db, tk.ticket, p);
      if (r.id) clearLineTicket();
      if (r.id) await reload();
      return r;
    },
    [db, reload],
  );
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

  const setPlanRemote = useCallback(
    async (playerId: string, pin: string, plan: Plan) => {
      const err = await setMyPlan(db, playerId, pin, plan);
      if (!err) await reload();
      return err;
    },
    [db, reload],
  );

  const updateProfileRemote = useCallback(
    async (playerId: string, pin: string, v: ProfileInput) => {
      const err = await updateMyProfile(db, playerId, pin, v);
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
    // ออกจากระบบทั้งตัวตน LINE (แอดมิน) และบัญชีผู้เล่นบนเครื่องนี้
    signOut: async () => {
      writeSession(null);
      clearLineTicket();
      await db.auth.signOut();
    },
  };

  return <StoreCtx.Provider value={{ state, dispatch, self, sendSlip, removeSlip: removeSlipRemote, setPrefs, setPlan: setPlanRemote, updateProfile: updateProfileRemote, addGuest: addGuestRemote, register: registerRemote, login: loginRemote, slipImage: getSlip, ready, error, auth }}>{children}</StoreCtx.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return supabase && !DEMO ? <RemoteProvider>{children}</RemoteProvider> : <LocalProvider>{children}</LocalProvider>;
}

const MODE_KEY = "badminton-kabinburi:player-mode";
const PlayerModeCtx = createContext<{ on: boolean; set: (on: boolean) => void }>({ on: false, set: () => {} });

/** แอดมินสลับเป็นผู้เล่นธรรมดาได้ (สิทธิ์แอดมินไม่เปลี่ยน แค่ซ่อนเมนูแอดมิน) */
export function PlayerModeProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const set = useCallback((v: boolean) => {
    setOn(v);
    try {
      if (v) localStorage.setItem(MODE_KEY, "1");
      else localStorage.removeItem(MODE_KEY);
    } catch {
      // ไม่จำก็ได้
    }
  }, []);
  const value = useMemo(() => ({ on, set }), [on, set]);
  return <PlayerModeCtx.Provider value={value}>{children}</PlayerModeCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  const mode = useContext(PlayerModeCtx);
  if (!v) throw new Error("useStore ต้องอยู่ใน StoreProvider");
  const real = v.auth.isAdmin;
  const playerMode = real && mode.on;
  const auth = useMemo(
    () => ({ ...v.auth, isAdmin: real && !playerMode, canAdmin: real, playerMode, setPlayerMode: mode.set }),
    [v.auth, real, playerMode, mode.set],
  );
  return useMemo(() => ({ ...v, auth }), [v, auth]);
}

export function useToday() {
  const { state } = useStore();
  const date = today();
  const day = state.days.find((d) => d.date === date) ?? { date, checkIns: [], games: [], drinks: [] };
  return { date, day };
}
