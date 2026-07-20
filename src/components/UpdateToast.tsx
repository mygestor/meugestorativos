import { useState, useEffect } from "react";
import { RefreshCw, Check, AlertTriangle, X } from "lucide-react";

interface ToastMessage {
  type: "loading" | "success" | "error";
  text: string;
}

export function UpdateToast() {
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastUpdate = localStorage.getItem("gestor-last-price-update");
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Don't auto-update if updated within the last hour
    if (lastUpdate && now - Number(lastUpdate) < oneHour) return;

    const assets = JSON.parse(localStorage.getItem("gestor-ativos-data") || "[]");
    if (assets.length === 0) return;

    setMsg({ type: "loading", text: `Atualizando cotações (${assets.length} ativos)...` });
    setVisible(true);

    (async () => {
      try {
        const { updatePrices } = await import("../prices");
        const updated = await updatePrices(assets, () => {});
        localStorage.setItem("gestor-last-price-update", String(now));
        setMsg({ type: "success", text: `${updated}/${assets.length} cotações atualizadas` });
      } catch {
        setMsg({ type: "error", text: "Falha ao atualizar cotações" });
      }
      setTimeout(() => setVisible(false), 4000);
    })();
  }, []);

  if (!visible || !msg) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium transition-all ${
      msg.type === "loading" ? "bg-card border-border text-muted" :
      msg.type === "success" ? "bg-income/10 border-income/30 text-income" :
      "bg-expense/10 border-expense/30 text-expense"
    }`}>
      {msg.type === "loading" && <RefreshCw className="size-4 animate-spin" />}
      {msg.type === "success" && <Check className="size-4" />}
      {msg.type === "error" && <AlertTriangle className="size-4" />}
      <span>{msg.text}</span>
      <button onClick={() => setVisible(false)} className="p-0.5 rounded hover:bg-black/10 ml-2">
        <X className="size-3" />
      </button>
    </div>
  );
}
