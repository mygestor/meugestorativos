import { useState, useMemo } from "react";
import type { Asset } from "../types";
import { formatCurrency, formatPercent } from "../format";

interface Props {
  assets: Asset[];
  hideValues: boolean;
}

export function PurchaseSimulator({ assets, hideValues }: Props) {
  const [ticker, setTicker] = useState("");
  const [mode, setMode] = useState<"value" | "qty">("value");
  const [aporteValue, setAporteValue] = useState("");
  const [qtyValue, setQtyValue] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");

  const selected = useMemo(() => assets.find((a) => a.ticker === ticker), [assets, ticker]);

  const result = useMemo(() => {
    if (!selected || !expectedPrice) return null;
    const price = parseFloat(expectedPrice.replace(",", "."));
    if (isNaN(price) || price <= 0) return null;

    const currentShares = selected.quantity;
    const currentInvested = selected.investedAmount;
    const currentPrice = selected.currentPrice;

    let newShares: number;
    let newInvested: number;

    if (mode === "value") {
      const aporte = parseFloat(aporteValue.replace(",", "."));
      if (isNaN(aporte) || aporte <= 0) return null;
      newShares = aporte / price;
      newInvested = currentInvested + aporte;
    } else {
      const qty = parseFloat(qtyValue.replace(",", "."));
      if (isNaN(qty) || qty <= 0) return null;
      newShares = qty;
      newInvested = currentInvested + qty * price;
    }

    const totalShares = currentShares + newShares;
    const avgPrice = totalShares > 0 ? newInvested / totalShares : 0;
    const currentValue = currentShares * currentPrice;
    const newPositionValue = totalShares * price;
    const newMonthlyDividend = totalShares * selected.dividendPerShare;
    const newAnnualDividend = newMonthlyDividend * 12;
    const newPortfolioTotal = assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0) - currentValue + newPositionValue;
    const newParticipation = newPortfolioTotal > 0 ? (newPositionValue / newPortfolioTotal) * 100 : 0;
    const goalProgress = selected.targetTotal > 0 ? Math.min(100, (newInvested / selected.targetTotal) * 100) : 0;
    const goalRemaining = selected.targetTotal > 0 ? Math.max(0, selected.targetTotal - newInvested) : 0;

    return {
      totalShares: Math.round(totalShares * 100) / 100,
      avgPrice: Math.round(avgPrice * 100) / 100,
      newInvested: Math.round(newInvested * 100) / 100,
      newPositionValue: Math.round(newPositionValue * 100) / 100,
      newMonthlyDividend: Math.round(newMonthlyDividend * 100) / 100,
      newAnnualDividend: Math.round(newAnnualDividend * 100) / 100,
      newParticipation: Math.round(newParticipation * 100) / 100,
      goalProgress: Math.round(goalProgress * 100) / 100,
      goalRemaining: Math.round(goalRemaining * 100) / 100,
    };
  }, [selected, expectedPrice, aporteValue, qtyValue, mode, assets]);

  const mask = (v: number) => hideValues ? "••••" : formatCurrency(v);
  const pctMask = (v: number) => hideValues ? "••••" : formatPercent(v);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-4">Simulador de Compras</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted block mb-1">Ativo</label>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">Selecione...</option>
            {assets.map((a) => (
              <option key={a.id} value={a.ticker}>{a.ticker} — {a.type}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="grid grid-cols-2 gap-2 text-xs bg-surface rounded-xl p-3">
            <div><span className="text-muted">Atual:</span> <span className="font-medium">{selected.quantity} cotas</span></div>
            <div><span className="text-muted">Preço Médio:</span> <span className="font-medium">{mask(selected.avgPrice)}</span></div>
            <div><span className="text-muted">Cotação:</span> <span className="font-medium">{mask(selected.currentPrice)}</span></div>
            <div><span className="text-muted">Dividendo:</span> <span className="font-medium">{mask(selected.dividendPerShare)}/cota</span></div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setMode("value")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "value" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"}`}
          >
            Por Valor
          </button>
          <button
            onClick={() => setMode("qty")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "qty" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"}`}
          >
            Por Quantidade
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mode === "value" ? (
            <div>
              <label className="text-xs text-muted block mb-1">Valor do Aporte</label>
              <input
                type="text"
                value={aporteValue}
                onChange={(e) => setAporteValue(e.target.value)}
                placeholder="5000,00"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted block mb-1">Quantidade de Cotas</label>
              <input
                type="text"
                value={qtyValue}
                onChange={(e) => setQtyValue(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-muted block mb-1">Preço Esperado</label>
            <input
              type="text"
              value={expectedPrice}
              onChange={(e) => setExpectedPrice(e.target.value)}
              placeholder={selected ? String(selected.currentPrice) : "0,00"}
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {result && selected && (
          <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
            <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Resultado da Simulação</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <ResultRow label="Total de Cotas" value={String(result.totalShares)} />
              <ResultRow label="Novo Preço Médio" value={mask(result.avgPrice)} />
              <ResultRow label="Total Investido" value={mask(result.newInvested)} />
              <ResultRow label="Posição Atual" value={mask(result.newPositionValue)} />
              <ResultRow label="Dividendo/Mês" value={mask(result.newMonthlyDividend)} />
              <ResultRow label="Dividendo/Ano" value={mask(result.newAnnualDividend)} />
              <ResultRow label="Participação" value={pctMask(result.newParticipation)} />
              {selected.targetTotal > 0 && (
                <>
                  <ResultRow label="Meta Atingida" value={pctMask(result.goalProgress)} />
                  <ResultRow label="Falta p/ Meta" value={mask(result.goalRemaining)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}
