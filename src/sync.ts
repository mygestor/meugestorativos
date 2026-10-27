import { loadRemoteData, saveRemoteData } from "./firebase";
import { normalizeAssetType } from "./detectType";

export interface UserData {
  assets: any[];
  dividends: any[];
  contributions: any[];
  trades: any[];
  lots: any[];
  appName: string;
}

export async function loadUserData(uid: string): Promise<UserData | null> {
  return loadRemoteData(uid);
}

export async function saveUserData(uid: string, data: UserData): Promise<boolean> {
  return saveRemoteData(uid, data);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUid: string | null = null;

export function scheduleSave(uid: string, data: UserData) {
  pendingUid = uid;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (pendingUid) await saveUserData(pendingUid, data);
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
  return { assets, dividends, contributions, trades, lots, appName };
}

export function setLocalData(data: UserData) {
  // Normaliza tipos vindos da nuvem para evitar duplicidade ("Ação" x "AÇÃO")
  const normAssets = (data.assets || []).map((a) => ({ ...a, type: normalizeAssetType(a.type) }));
  const normDividends = (data.dividends || []).map((d) => ({ ...d, type: normalizeAssetType(d.type) }));
  localStorage.setItem("gestor-ativos-data", JSON.stringify(normAssets));
  localStorage.setItem("gestor-ativos-dividendos", JSON.stringify(normDividends));
  localStorage.setItem("gestor-ativos-aportes", JSON.stringify(data.contributions || []));
  localStorage.setItem("gestor-ativos-trades", JSON.stringify(data.trades || []));
  localStorage.setItem("gestor-ativos-lotes", JSON.stringify(data.lots || []));
  if (data.appName) localStorage.setItem("gestor-app-name", data.appName);
}
