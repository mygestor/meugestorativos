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
      console.log("[Firestore] Dados carregados para:", uid);
      return snap.data() as UserData;
    }
    console.log("[Firestore] Nenhum dado encontrado para:", uid);
    return null;
  } catch (e) {
    console.error("[Firestore] Erro ao carregar:", e);
    return null;
  }
}

export async function saveUserData(uid: string, data: UserData): Promise<boolean> {
  try {
    const ref = doc(firestore, "users", uid);
    const toSave = { ...data, updatedAt: new Date().toISOString() };
    await setDoc(ref, toSave);
    console.log("[Firestore] Dados salvos para:", uid, "- Ativos:", data.assets.length);
    return true;
  } catch (e) {
    console.error("[Firestore] Erro ao salvar:", e);
    return false;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUid: string | null = null;
let pendingData: UserData | null = null;

export function scheduleSave(uid: string, data: UserData) {
  pendingUid = uid;
  pendingData = data;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (pendingUid && pendingData) {
      await saveUserData(pendingUid, pendingData);
      pendingUid = null;
      pendingData = null;
    }
  }, 500);
}

export async function forceSaveNow(uid: string): Promise<boolean> {
  if (saveTimer) clearTimeout(saveTimer);
  const data = getAllLocalData();
  return saveUserData(uid, data);
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
