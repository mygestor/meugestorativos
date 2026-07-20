import { useState, useEffect } from "react";
import type { Asset } from "../types";
import { formatCurrency } from "../format";

interface Props {
  assets: Asset[];
}

const ALERT_KEY = "gestor-alertas-notified";

export function DividendAlerts({ assets }: Props) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("Notification" in window && Notification.permission === "granted");
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setSupported(result === "granted");
  }

  useEffect(() => {
    if (!supported || assets.length === 0) return;

    const interval = setInterval(() => {
      const today = new Date();
      const day = today.getDate();
      const notified = JSON.parse(localStorage.getItem(ALERT_KEY) || "[]");

      for (const a of assets) {
        if (a.paymentDay && a.paymentDay === day && a.currentDividend > 0) {
          if (!notified.includes(`${a.ticker}-${today.getFullYear()}-${today.getMonth()}-${day}`)) {
            new Notification(`Dividendo: ${a.ticker}`, {
              body: `Hoje é dia de pagamento! Valor estimado: ${formatCurrency(a.currentDividend)}`,
              icon: "/vite.svg",
            });
            notified.push(`${a.ticker}-${today.getFullYear()}-${today.getMonth()}-${day}`);
            localStorage.setItem(ALERT_KEY, JSON.stringify(notified));
          }
        }
      }
    }, 60000 * 30); // check every 30 min

    return () => clearInterval(interval);
  }, [supported, assets]);

  if (supported) return null;

  return (
    <button
      onClick={requestPermission}
      className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors"
      title="Ativar notificações de dividendos"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      Ativar Alertas
    </button>
  );
}
