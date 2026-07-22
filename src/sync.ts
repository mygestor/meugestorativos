import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";
import type { Asset, DividendRecord, ContributionRecord, TradeRecord, Lot } from "./types";

export interface UserData {
  assets: Asset[];
  dividends: DividendRecord[];
  contributions: ContributionRecord[];
  trades: TradeRecord[];
  lots: Lot[];
  appName: string;
  updatedAt: string;
}

export async function loadUserData(uid: string): Promise<UserData | null> {
  try {
    const ref = doc(firestore, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserData;
    }
    return null;
  } catch (e) {
    console.error("[Firestore] Erro ao carregar:", e);
    return null;
  }
}

export async function saveUserData(uid: string, data: UserData): Promise<void> {
  try {
    const ref = doc(firestore, "users", uid);
    await setDoc(ref, { ...data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[Firestore] Erro ao salvar:", e);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUid: string | null = null;

export function scheduleSave(uid: string, data: UserData) {
  pendingUid = uid;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (pendingUid) saveUserData(pendingUid, data);
  }, 1000);
}

export function getAllLocalData(): UserData {
  const assets = JSON.parse(localStorage.getItem("gestor-ativos-data") || "[]");
  const dividends = JSON.parse(localStorage.getItem("gestor-ativos-dividendos") || "[]");
  const contributions = JSON.parse(localStorage.getItem("gestor-ativos-aportes") || "[]");
  const trades = JSON.parse(localStorage.getItem("gestor-ativos-trades") || "[]");
  const lots = JSON.parse(localStorage.getItem("gestor-ativos-lotes") || "[]");
  const appName = localStorage.getItem("gestor-app-name") || "Gestor de Ativos";
  return { assets, dividends, contributions, trades, lots, appName, updatedAt: new Date().toISOString() };
}

export function setLocalData(data: UserData) {
  localStorage.setItem("gestor-ativos-data", JSON.stringify(data.assets || []));
  localStorage.setItem("gestor-ativos-dividendos", JSON.stringify(data.dividends || []));
  localStorage.setItem("gestor-ativos-aportes", JSON.stringify(data.contributions || []));
  localStorage.setItem("gestor-ativos-trades", JSON.stringify(data.trades || []));
  localStorage.setItem("gestor-ativos-lotes", JSON.stringify(data.lots || []));
  if (data.appName) localStorage.setItem("gestor-app-name", data.appName);
}
