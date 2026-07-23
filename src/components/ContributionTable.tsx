import { useState, useMemo } from "react";
import type { ContributionRecord } from "../types";
import { formatCurrency, formatDate } from "../format";
import { deleteContribution, getContributionStats } from "../store";
import { Trash2, Download, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  contributions: ContributionRecord[];
  hideValues: boolean;
  onRefresh: () => void;
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function ContributionTable({ contributions, hideValues, onRefresh }: Props) {
  const [sortField, setSortField] = useState<keyof ContributionRecord>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterYear, setFilterYear] = useState("");

  const stats = useMemo(() => getContributionStats(contributions), [contributions]);

  const years = useMemo(() => {
    const set = new Set(contributions.map((c) => c.date.slice(0, 4)));
    return Array.from(set).sort();
  }, [contributions]);

  const sorted = useMemo(() => {
    let filtered = contributions;
    if (filterYear) filtered = filtered.filter((c) => c.date.startsWith(filterYear));

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
  }, [contributions, sortField, sortAsc, filterYear]);

  function toggleSort(field: keyof ContributionRecord) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function SortHeader({ field, label }: { field: keyof ContributionRecord; label: string }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        <span className="text-xs font-medium">{label}</span>
        {active && (sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    );
  }

  function handleDelete(id: string) {
    if (confirm("Excluir este aporte?")) {
      deleteContribution(id);
      onRefresh();
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(contributions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aportes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-1">Total Aportado</p>
          <p className="text-lg font-bold tabular text-income">{mask(stats.totalIn, hideValues)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-1">Total Retirado</p>
          <p className="text-lg font-bold tabular text-expense">{mask(stats.totalOut, hideValues)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-1">Líquido</p>
          <p className={`text-lg font-bold tabular ${stats.net >= 0 ? "text-income" : "text-expense"}`}>
            {mask(stats.net, hideValues)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-1">Total de Aportes</p>
          <p className="text-lg font-bold tabular">{contributions.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-surface text-muted transition-colors" title="Exportar aportes">
            <Download className="size-4" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted">Nenhum aporte registrado</p>
            <p className="text-xs text-muted mt-1">Use o botão "Novo Aporte" ou importe CSV</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left"><SortHeader field="date" label="Data" /></th>
                  <th className="p-3 text-right"><SortHeader field="value" label="Valor" /></th>
                  <th className="p-3 text-left"><SortHeader field="description" label="Descrição" /></th>
                  <th className="p-3 text-right w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((c) => {
                  const isIn = c.value >= 0;
                  return (
                    <tr key={c.id} className="hover:bg-card-hover transition-colors">
                      <td className="p-3 text-xs tabular">{formatDate(c.date)}</td>
                      <td className="p-3 text-right tabular font-medium">
                        <span className={`flex items-center justify-end gap-1 ${isIn ? "text-income" : "text-expense"}`}>
                          {isIn ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                          {mask(Math.abs(c.value), hideValues)}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted">{c.description}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1 rounded-lg hover:bg-surface text-muted hover:text-expense transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {years.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Aportes por Ano</h3>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <div key={y} className="px-4 py-2 bg-surface rounded-xl text-xs">
                <p className="text-muted">{y}</p>
                <p className="font-semibold mt-0.5 tabular text-income">{mask(stats.byYear[y] ?? 0, hideValues)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
