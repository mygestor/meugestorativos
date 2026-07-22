import { useState, useMemo } from "react";
import type { DividendRecord } from "../types";
import { formatCurrency, formatDate } from "../format";
import { deleteDividend, getDividendStats } from "../store";
import { Trash2, Download, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  dividends: DividendRecord[];
  hideValues: boolean;
  onRefresh: () => void;
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function DividendTable({ dividends, hideValues, onRefresh }: Props) {
  const [sortField, setSortField] = useState<keyof DividendRecord>("payment");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterTicker, setFilterTicker] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "received" | "pending">("all");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => getDividendStats(dividends), [dividends]);

  const filteredTotal = useMemo(() => {
    let filtered = dividends;
    if (filterMonth) filtered = filtered.filter((d) => d.monthYear === filterMonth);
    if (filterYear) filtered = filtered.filter((d) => String(d.year) === filterYear);
    if (filterTicker) filtered = filtered.filter((d) => d.ticker === filterTicker);
    if (filterStatus === "received") filtered = filtered.filter((d) => d.payment <= today);
    if (filterStatus === "pending") filtered = filtered.filter((d) => d.payment > today);
    return filtered.reduce((s, d) => s + d.totalValue, 0);
  }, [dividends, filterMonth, filterYear, filterTicker, filterStatus, today]);

  const months = useMemo(() => {
    const set = new Set(dividends.map((d) => d.monthYear));
    return Array.from(set).sort((a, b) => {
      const [mA, yA] = a.split("/").map(Number);
      const [mB, yB] = b.split("/").map(Number);
      return yA - yB || mA - mB;
    });
  }, [dividends]);

  const years = useMemo(() => {
    const set = new Set(dividends.map((d) => d.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [dividends]);

  const tickers = useMemo(() => {
    const set = new Set(dividends.map((d) => d.ticker));
    return Array.from(set).sort();
  }, [dividends]);

  const sorted = useMemo(() => {
    let filtered = dividends;
    if (filterMonth) filtered = filtered.filter((d) => d.monthYear === filterMonth);
    if (filterYear) filtered = filtered.filter((d) => String(d.year) === filterYear);
    if (filterTicker) filtered = filtered.filter((d) => d.ticker === filterTicker);
    if (filterStatus === "received") filtered = filtered.filter((d) => d.payment <= today);
    if (filterStatus === "pending") filtered = filtered.filter((d) => d.payment > today);

    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? (av - bv) : (bv - av);
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [dividends, sortField, sortAsc, filterMonth, filterYear, filterTicker, filterStatus, today]);

  function toggleSort(field: keyof DividendRecord) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function SortHeader({ field, label }: { field: keyof DividendRecord; label: string }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        <span className="text-xs font-medium">{label}</span>
        {active && (sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    );
  }

  function handleExport() {
    const data = JSON.stringify(dividends, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dividendos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (confirm("Excluir este dividendo?")) {
      deleteDividend(id);
      onRefresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-1">Total</p>
          <p className="text-lg font-bold tabular text-income">{mask(filteredTotal, hideValues)}</p>
          {filterStatus !== "all" && (
            <p className="text-[10px] text-muted mt-1">
              {filterStatus === "received" ? "Recebidos" : "A receber"} ({sorted.length})
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 col-span-2">
          <p className="text-xs text-muted mb-2">Top Ativos</p>
          <div className="space-y-1">
            {Object.entries(stats.byTicker)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([ticker, value]) => (
                <div key={ticker} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{ticker}</span>
                  <span className="tabular text-income">{mask(value, hideValues)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === "all" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus("received")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === "received" ? "bg-income text-white" : "text-muted hover:text-foreground"}`}
              >
                Recebidos
              </button>
              <button
                onClick={() => setFilterStatus("pending")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === "pending" ? "bg-amber-500 text-white" : "text-muted hover:text-foreground"}`}
              >
                A receber
              </button>
            </div>
            <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-surface text-muted transition-colors" title="Exportar dividendos">
              <Download className="size-4" />
            </button>
          </div>
          <select
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Todos os ativos</option>
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Todos os meses</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>

        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted">Nenhum dividendo registrado</p>
            <p className="text-xs text-muted mt-1">Use o botão "Novo Dividendo" ou "Importar" acima</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left"><SortHeader field="ticker" label="Ticker" /></th>
                  <th className="p-3 text-left"><SortHeader field="type" label="Tipo" /></th>
                  <th className="p-3 text-left"><SortHeader field="monthYear" label="Mês/Ano" /></th>
                  <th className="p-3 text-left"><SortHeader field="name" label="Nome" /></th>
                  <th className="p-3 text-left"><SortHeader field="payment" label="Pagamento" /></th>
                  <th className="p-3 text-left"><SortHeader field="movementType" label="Movimento" /></th>
                  <th className="p-3 text-right"><SortHeader field="totalValue" label="Valor Líq." /></th>
                  <th className="p-3 text-right w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((d) => (
                  <tr key={d.id} className="hover:bg-card-hover transition-colors">
                    <td className="p-3 font-medium">{d.ticker}</td>
                    <td className="p-3 text-xs text-muted">{d.type}</td>
                    <td className="p-3 text-xs">{d.monthYear}</td>
                    <td className="p-3 text-xs text-muted max-w-32 truncate">{d.name}</td>
                    <td className="p-3 text-xs tabular">{formatDate(d.payment)}</td>
                    <td className="p-3 text-xs">
                      <MovementBadge type={d.movementType} />
                    </td>
                    <td className="p-3 text-right tabular font-medium text-income">{mask(d.totalValue, hideValues)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(d.id)}
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

function MovementBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    "DIVIDENDO": "bg-income/10 text-income",
    "JUROS S/CAPITAL": "bg-blue-500/10 text-blue-400",
    "RENDIMENTO": "bg-primary/10 text-primary",
  };
  const color = colorMap[type.toUpperCase()] ?? "bg-muted/10 text-muted";
  return <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${color}`}>{type}</span>;
}
