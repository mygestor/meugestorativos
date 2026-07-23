import { useMemo } from "react";
import type { Asset } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { getTypeColor } from "../detectType";

interface Props {
  assets: Asset[];
}

export function PortfolioRebalancing({ assets }: Props) {
  const analysis = useMemo(() => {
    if (assets.length === 0) return null;

    const totalInvested = assets.reduce((s, a) => s + a.investedAmount, 0);
    const byType: Record<string, { invested: number; target: number; assets: Asset[] }> = {};

    for (const a of assets) {
      if (!byType[a.type]) byType[a.type] = { invested: 0, target: 0, assets: [] };
      byType[a.type].invested += a.investedAmount;
      byType[a.type].target += a.targetTotal || 0;
      byType[a.type].assets.push(a);
    }

    // Suggest target allocation: equal split by count, or 50/30/20 for FII/AÇÃO/ETF
    const count = assets.length;
    const suggestions: { type: string; current: number; suggested: number; diff: number; action: string }[] = [];

    const defaultTargets: Record<string, number> = {
      FII: 50,
      AÇÃO: 30,
      ETF: 10,
      BDR: 5,
    };

    const remaining = Object.keys(byType).filter((t) => !defaultTargets[t]).length;
    const defaultRemaining = remaining > 0 ? (100 - 50 - 30 - 10 - 5) / remaining : 0;

    for (const [type, data] of Object.entries(byType)) {
      const currentPct = totalInvested > 0 ? (data.invested / totalInvested) * 100 : 0;
      const suggestedPct = defaultTargets[type] ?? defaultRemaining;
      const diff = currentPct - suggestedPct;

      suggestions.push({
        type,
        current: Math.round(currentPct * 10) / 10,
        suggested: suggestedPct,
        diff: Math.round(diff * 10) / 10,
        action: diff > 3 ? "Vender" : diff < -3 ? "Comprar" : "OK",
      });
    }

    const totalSuggest = suggestions.reduce((s, d) => s + d.suggested, 0);
    if (Math.abs(totalSuggest - 100) > 0.1) {
      // Normalize
      const factor = 100 / totalSuggest;
      suggestions.forEach((s) => { s.suggested = Math.round(s.suggested * factor * 10) / 10; });
    }

    return suggestions;
  }, [assets]);

  if (!analysis) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-4">Rebalanceamento Sugerido</h3>
      <div className="space-y-2">
        {analysis.map((s) => (
          <div key={s.type} className="bg-surface rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: getTypeColor(s.type) }} />
                <span className="text-sm font-medium">{s.type}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                s.action === "OK" ? "bg-income/10 text-income" :
                s.action === "Comprar" ? "bg-blue-500/10 text-blue-500" :
                "bg-expense/10 text-expense"
              }`}>{s.action}</span>
            </div>
            <div className="h-2 bg-card rounded-full overflow-hidden flex">
              <div className="h-full rounded-full transition-all" style={{ width: `${s.current}%`, backgroundColor: getTypeColor(s.type) }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted mt-1">
              <span>Atual: {s.current}%</span>
              <span>Sugerido: {s.suggested}%</span>
              {s.diff !== 0 && (
                <span className={s.diff > 0 ? "text-expense" : "text-blue-500"}>
                  {s.diff > 0 ? `+${s.diff}%` : `${s.diff}%`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
