import { useMemo, useState } from "react";
import type { DividendRecord } from "../types";
import { formatCurrency } from "../format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface Props {
  dividends: DividendRecord[];
  hideValues: boolean;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dev"];

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function DividendDashboard({ dividends, hideValues }: Props) {
  const [filterType, setFilterType] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterTicker, setFilterTicker] = useState("");

  const availableTypes = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.type))).sort();
  }, [dividends]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.year))).sort((a, b) => b - a);
  }, [dividends]);

  const availableTickers = useMemo(() => {
    let filtered = dividends;
    if (filterType) filtered = filtered.filter((d) => d.type === filterType);
    if (filterYear) filtered = filtered.filter((d) => d.year === Number(filterYear));
    return Array.from(new Set(filtered.map((d) => d.ticker))).sort();
  }, [dividends, filterType, filterYear]);

  const filtered = useMemo(() => {
    let f = dividends;
    if (filterType) f = f.filter((d) => d.type === filterType);
    if (filterYear) f = f.filter((d) => d.year === Number(filterYear));
    if (filterTicker) f = f.filter((d) => d.ticker === filterTicker);
    return f;
  }, [dividends, filterType, filterYear, filterTicker]);

  // Summary by type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((d) => { map[d.type] = (map[d.type] ?? 0) + d.totalValue; });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [filtered]);

  const totalFiltered = byType.reduce((s, t) => s + t.value, 0);

  // By month (for selected year)
  const byMonth = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((d) => { map[d.month] = (map[d.month] ?? 0) + d.totalValue; });
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      value: Math.round((map[i + 1] ?? 0) * 100) / 100,
    }));
  }, [filtered]);

  // By year
  const byYear = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((d) => { map[d.year] = (map[d.year] ?? 0) + d.totalValue; });
    return Object.entries(map)
      .map(([year, value]) => ({ year, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => Number(a.year) - Number(b.year));
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Tipo" value={filterType} onChange={setFilterType} options={availableTypes} placeholder="Todos" />
          <FilterSelect label="Ano" value={filterYear} onChange={setFilterYear} options={availableYears.map(String)} placeholder="Todos" />
          <FilterSelect label="Ticker" value={filterTicker} onChange={setFilterTicker} options={availableTickers} placeholder="Todos" />
          <button
            onClick={() => { setFilterType(""); setFilterYear(""); setFilterTicker(""); }}
            className="px-3 py-2 bg-surface text-muted hover:text-foreground rounded-xl text-xs transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Cards by type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {byType.map((t, i) => (
          <div key={t.name} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="size-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <p className="text-xs text-muted font-medium">{t.name}</p>
            </div>
            <p className="text-lg font-bold tabular">{mask(t.value, hideValues)}</p>
          </div>
        ))}
        {byType.length === 0 && (
          <div className="col-span-full text-center py-6 text-sm text-muted">
            Nenhum dividendo encontrado com os filtros atuais
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Dividends by month */}
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-1">
              <h3 className="font-semibold text-sm mb-4">
                Dividendos por Mês {filterYear ? `(${filterYear})` : ""}
              </h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Percentage by class */}
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-1">
              <h3 className="font-semibold text-sm mb-4">% por Classe de Ativo</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={45}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {byType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Total by year */}
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-1">
              <h3 className="font-semibold text-sm mb-4">Total de Dividendos por Ano</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byYear}>
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Year-by-year detail table */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Detalhamento por Ano</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="p-2 text-left font-medium">Ano</th>
                    <th className="p-2 text-right font-medium">Total</th>
                    <th className="p-2 text-right font-medium">Média/Mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byYear.map((y) => (
                    <tr key={y.year} className="hover:bg-card-hover transition-colors">
                      <td className="p-2 font-medium">{y.year}</td>
                      <td className="p-2 text-right tabular">{mask(y.value, hideValues)}</td>
                      <td className="p-2 text-right tabular text-muted">{mask(y.value / 12, hideValues)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div className="space-y-1 min-w-28">
      <label className="text-xs text-muted font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
