"use client";

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { markPaid } from "./billing";
import { DEFAULT_SETTINGS, type Day, type Game, type Level, type Player, type Settings, type Team } from "./types";

export interface State {
  players: Player[];
  settings: Settings;
  days: Day[];
}

export type Action =
  | { type: "addPlayer"; name: string; level: Level; isMonthly: boolean }
  | { type: "updatePlayer"; player: Player }
  | { type: "removePlayer"; id: string }
  | { type: "checkIn"; date: string; playerId: string }
  | { type: "undoCheckIn"; date: string; playerId: string }
  | { type: "startGame"; date: string; court: number; playerIds: Game["playerIds"] }
  | { type: "setShuttles"; date: string; gameId: string; shuttles: number }
  | { type: "endGame"; date: string; gameId: string; winner?: Team }
  | { type: "cancelGame"; date: string; gameId: string }
  | { type: "addDrink"; date: string; playerId: string; amount: number; note: string }
  | { type: "removeDrink"; date: string; drinkId: string }
  | { type: "markPaid"; date: string; playerId: string }
  | { type: "unmarkPaid"; date: string; playerId: string }
  | { type: "updateSettings"; settings: Settings }
  | { type: "replace"; state: State };

const STORAGE_KEY = "badminton-kabinburi:v1";

export const EMPTY_STATE: State = { players: [], settings: DEFAULT_SETTINGS, days: [] };

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function withDay(state: State, date: string, fn: (d: Day) => Day): State {
  const exists = state.days.some((d) => d.date === date);
  const days = exists
    ? state.days.map((d) => (d.date === date ? fn(d) : d))
    : [...state.days, fn({ date, checkIns: [], games: [], drinks: [] })].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
  return { ...state, days };
}

function updateGame(state: State, date: string, gameId: string, fn: (g: Game) => Game): State {
  return withDay(state, date, (d) => ({
    ...d,
    games: d.games.map((g) => (g.id === gameId ? fn(g) : g)),
  }));
}

export function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "addPlayer":
      return {
        ...state,
        players: [...state.players, { id: newId(), name: a.name.trim(), level: a.level, isMonthly: a.isMonthly }],
      };
    case "updatePlayer":
      return { ...state, players: state.players.map((p) => (p.id === a.player.id ? a.player : p)) };
    case "removePlayer":
      return { ...state, players: state.players.filter((p) => p.id !== a.id) };
    case "checkIn":
      return withDay(state, a.date, (d) =>
        d.checkIns.some((c) => c.playerId === a.playerId)
          ? d
          : { ...d, checkIns: [...d.checkIns, { playerId: a.playerId, at: Date.now() }] },
      );
    case "undoCheckIn":
      return withDay(state, a.date, (d) => ({
        ...d,
        checkIns: d.checkIns.filter((c) => c.playerId !== a.playerId),
      }));
    case "startGame":
      return withDay(state, a.date, (d) => ({
        ...d,
        games: [
          ...d.games,
          { id: newId(), court: a.court, playerIds: a.playerIds, startedAt: Date.now(), shuttles: 1 },
        ],
      }));
    case "setShuttles":
      return updateGame(state, a.date, a.gameId, (g) => ({ ...g, shuttles: Math.max(0, a.shuttles) }));
    case "endGame":
      return updateGame(state, a.date, a.gameId, (g) => ({ ...g, endedAt: Date.now(), winner: a.winner }));
    case "cancelGame":
      return withDay(state, a.date, (d) => ({ ...d, games: d.games.filter((g) => g.id !== a.gameId) }));
    case "addDrink":
      return withDay(state, a.date, (d) => ({
        ...d,
        drinks: [...d.drinks, { id: newId(), playerId: a.playerId, amount: a.amount, note: a.note }],
      }));
    case "removeDrink":
      return withDay(state, a.date, (d) => ({ ...d, drinks: d.drinks.filter((x) => x.id !== a.drinkId) }));
    case "markPaid":
      return { ...state, days: markPaid(state.days, a.date, a.playerId, Date.now()) };
    case "unmarkPaid":
      return withDay(state, a.date, (d) => ({
        ...d,
        checkIns: d.checkIns.map((c) => (c.playerId === a.playerId ? { ...c, paidAt: undefined } : c)),
      }));
    case "updateSettings":
      return { ...state, settings: a.settings };
    case "replace":
      return a.state;
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const s = JSON.parse(raw) as State;
    return { ...EMPTY_STATE, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
  } catch {
    return EMPTY_STATE;
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // แอพถูกโหลดฝั่งเบราว์เซอร์เท่านั้น (ดู ClientApp) จึงอ่าน localStorage ตอนเริ่มได้เลย
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // พื้นที่เต็มหรือถูกบล็อก ใช้งานต่อได้แต่ไม่ถูกบันทึก
    }
  }, [state]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore ต้องอยู่ใน StoreProvider");
  return v;
}

export function useToday() {
  const { state } = useStore();
  const date = today();
  const day = state.days.find((d) => d.date === date) ?? { date, checkIns: [], games: [], drinks: [] };
  return { date, day };
}
