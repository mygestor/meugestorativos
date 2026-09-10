import { useState, useMemo } from "react";
import type { DividendRecord } from "../types";
import { formatCurrency, formatDate } from "../format";
import { deleteDividend, updateDividend, getDividendStats } from "../store";
import { Trash2, Download, ChevronDown, ChevronUp, X, Pencil } from "lucide-react";

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
  const [editingDividend, setEditingDividend] = useState<DividendRecord | null>(null);
  const [editForm, setEditForm] = useState({ ticker: "", type: "", name: "", payment: "", movementType: "", totalValue: "" });

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

  const hasActiveFilter = filterMonth || filterYear || filterTicker || filterStatus !== "all";

  function clearFilters() {
    setFilterMonth("");
    setFilterYear("");
    setFilterTicker("");
    setFilterStatus("all");
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

  function handleEdit(dividend: DividendRecord) {
    setEditingDividend(dividend);
    setEditForm({
      ticker: dividend.ticker,
      type: dividend.type,
      name: dividend.name,
      payment: dividend.payment,
      movementType: dividend.movementType,
      totalValue: String(dividend.totalValue),
    });
  }

  function handleSaveEdit() {
    if (!editingDividend) return;
    const value = parseFloat(editForm.totalValue.replace(",", "."));
    if (!value || value <= 0) return;

    const pd = editForm.payment;
    const month = parseInt(pd.slice(5, 7));
    const year = parseInt(pd.slice(0, 4));

    updateDividend(editingDividend.id, {
      ticker: editForm.ticker.toUpperCase().trim(),
      type: editForm.type,
      name: editForm.name.trim(),
      payment: editForm.payment,
      movementType: editForm.movementType,
      monthYear: `${String(month).padStart(2, "0")}/${year}`,
      month,
      year,
      totalValue: value,
    });
    setEditingDividend(null);
    onRefresh();
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
          <div className="flex gap-2">
            <select
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            >
              <option value="">Ativo</option>
              {tickers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            >
              <option value="">Mês</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            >
              <option value="">Ano</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-xs text-muted hover:text-foreground hover:border-expense transition-colors flex items-center gap-1"
              >
                <X className="size-3" />
                Limpar
              </button>
            )}
          </div>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(d)}
                          className="p-1 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-1 rounded-lg hover:bg-surface text-muted hover:text-expense transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingDividend && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 mx-0">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold">Editar Dividendo</h2>
              <button onClick={() => setEditingDividend(null)} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Ticker</label>
                  <input type="text" value={editForm.ticker} onChange={(e) => setEditForm({ ...editForm, ticker: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Tipo</label>
                  <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    <option value="FII">FII</option>
                    <option value="AÇÃO">AÇÃO</option>
                    <option value="ETF">ETF</option>
                    <option value="OUTRO">OUTRO</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Data Pagamento</label>
                  <input type="date" value={editForm.payment} onChange={(e) => setEditForm({ ...editForm, payment: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted font-medium">Tipo Movimento</label>
                  <input type="text" value={editForm.movementType} onChange={(e) => setEditForm({ ...editForm, movementType: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-medium">Nome do Ativo</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-medium">Valor Total Líquido (R$)</label>
                <input type="text" inputMode="decimal" value={editForm.totalValue} onChange={(e) => setEditForm({ ...editForm, totalValue: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setEditingDividend(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
