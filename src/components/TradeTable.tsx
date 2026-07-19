import { useState, useMemo } from "react";
import type { TradeRecord } from "../types";
import { formatCurrency, formatDate } from "../format";
import { deleteTrade, recalculateAndSaveTrades, getTrades } from "../store";
import { Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface Props {
  trades: TradeRecord[];
  hideValues: boolean;
  onRefresh: () => void;
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function TradeTable({ trades, hideValues, onRefresh }: Props) {
  const [sortField, setSortField] = useState<keyof TradeRecord>("date");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTicker, setFilterTicker] = useState("");

  const calculated = useMemo(() => {
    const sorted = [...trades].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
    const byTicker: Record<string, { shares: number; invested: number }> = {};
    return sorted.map((t) => {
      const qty = t.quantity;
      const isBuy = qty > 0;
      const absQty = Math.abs(qty);
      const totalOp = absQty * t.price;
      const totalWithoutFees = totalOp;
      const totalWithFees = totalOp + t.fees;
      const priceWithFees = absQty > 0 ? totalWithFees / absQty : 0;

      const prev = byTicker[t.ticker] ?? { shares: 0, invested: 0 };
      let newShares: number, avgPrice: number;

      if (isBuy) {
        newShares = prev.shares + absQty;
        const newInvested = prev.invested + totalWithFees;
        avgPrice = newShares > 0 ? newInvested / newShares : 0;
        byTicker[t.ticker] = { shares: newShares, invested: newInvested };
      } else {
        newShares = Math.max(0, prev.shares - absQty);
        const proportion = prev.shares > 0 ? absQty / prev.shares : 0;
        const newInvested = prev.invested - prev.invested * proportion;
        avgPrice = newShares > 0 ? newInvested / newShares : prev.shares > 0 ? prev.invested / prev.shares : 0;
        byTicker[t.ticker] = { shares: newShares, invested: newInvested };
      }

      return {
        ...t,
        fees: t.fees || 0,
        irrf: t.irrf || (isBuy ? 0 : +(totalOp * 0.0005).toFixed(2)),
        totalWithoutFees,
        totalWithFees,
        priceWithFees: +priceWithFees.toFixed(2),
        totalShares: newShares,
        avgPrice: +avgPrice.toFixed(2),
        operation: isBuy ? "COMPRA" as const : "VENDA" as const,
      };
    });
  }, [trades]);

  const tickers = useMemo(() => {
    const set = new Set(trades.map((t) => t.ticker));
    return Array.from(set).sort();
  }, [trades]);

  const sorted = useMemo(() => {
    let filtered = calculated;
    if (filterTicker) filtered = filtered.filter((t) => t.ticker === filterTicker);

    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [calculated, sortField, sortAsc, filterTicker]);

  function toggleSort(field: keyof TradeRecord) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  }

  function SortHeader({ field, label }: { field: keyof TradeRecord; label: string }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors whitespace-nowrap">
        <span className="text-xs font-medium">{label}</span>
        {active && (sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    );
  }

  function handleDelete(id: string) {
    if (confirm("Excluir esta operação?")) {
      deleteTrade(id);
      onRefresh();
    }
  }

  function handleRecalc() {
    recalculateAndSaveTrades(getTrades());
    onRefresh();
  }

  const summary = useMemo(() => {
    const byTicker: Record<string, { shares: number; avgPrice: number }> = {};
    calculated.forEach((t) => {
      byTicker[t.ticker] = { shares: t.totalShares, avgPrice: t.avgPrice };
    });
    return Object.entries(byTicker)
      .filter(([_, v]) => v.shares > 0)
      .map(([ticker, v]) => ({ ticker, ...v }));
  }, [calculated]);

  return (
    <div className="space-y-4">
      {summary.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Posição Atual por Ativo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {summary.map((s) => (
              <div key={s.ticker} className="bg-surface rounded-xl px-3 py-2">
                <p className="font-semibold text-sm">{s.ticker}</p>
                <p className="text-xs text-muted tabular">{s.shares} cotas</p>
                <p className="text-xs tabular text-income">{mask(s.avgPrice, hideValues)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <select
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Todos os ativos</option>
            {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={handleRecalc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-muted hover:text-foreground text-xs transition-colors"
            title="Recalcular todos os trades"
          >
            <RefreshCw className="size-3.5" /> Recalcular
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted">Nenhuma operação registrada</p>
            <p className="text-xs text-muted mt-1">Use o botão "Nova Operação" para adicionar compras e vendas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left"><SortHeader field="date" label="Data" /></th>
                  <th className="p-2 text-left"><SortHeader field="ticker" label="Código" /></th>
                  <th className="p-2 text-right"><SortHeader field="operation" label="Op." /></th>
                  <th className="p-2 text-right"><SortHeader field="quantity" label="Qtde" /></th>
                  <th className="p-2 text-right"><SortHeader field="price" label="Preço" /></th>
                  <th className="p-2 text-right hidden sm:table-cell"><SortHeader field="fees" label="Taxas" /></th>
                  <th className="p-2 text-right hidden sm:table-cell"><SortHeader field="totalWithoutFees" label="Total s/ Taxas" /></th>
                  <th className="p-2 text-right hidden md:table-cell"><SortHeader field="totalWithFees" label="Total c/ Taxas" /></th>
                  <th className="p-2 text-right hidden lg:table-cell"><SortHeader field="totalShares" label="Cotas Acum." /></th>
                  <th className="p-2 text-right hidden lg:table-cell"><SortHeader field="avgPrice" label="Preço Médio" /></th>
                  <th className="p-2 text-right w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((t) => (
                  <tr key={t.id} className="hover:bg-card-hover transition-colors text-xs">
                    <td className="p-2 tabular whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-2 font-medium">{t.ticker}</td>
                    <td className="p-2 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        t.operation === "COMPRA" ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
                      }`}>
                        {t.operation === "COMPRA" ? "C" : "V"}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular">{Math.abs(t.quantity)}</td>
                    <td className="p-2 text-right tabular">{mask(t.price, hideValues)}</td>
                    <td className="p-2 text-right tabular hidden sm:table-cell">{mask(t.fees, hideValues)}</td>
                    <td className="p-2 text-right tabular hidden sm:table-cell">{mask(t.totalWithoutFees, hideValues)}</td>
                    <td className="p-2 text-right tabular hidden md:table-cell">{mask(t.totalWithFees, hideValues)}</td>
                    <td className="p-2 text-right tabular hidden lg:table-cell">{t.totalShares}</td>
                    <td className="p-2 text-right tabular hidden lg:table-cell">{mask(t.avgPrice, hideValues)}</td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1 rounded-lg hover:bg-surface text-muted hover:text-expense transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
