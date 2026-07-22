import { useMemo, useState, useEffect } from "react";
import type { DividendRecord } from "../types";
import { formatCurrency } from "../format";
import { fetchDY12m } from "../prices";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { X, RefreshCw } from "lucide-react";
import { AssetLogo } from "./AssetLogo";

interface Props {
  dividends: DividendRecord[];
  hideValues: boolean;
  onRefresh?: () => void;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function DividendDashboard({ dividends, hideValues, onRefresh }: Props) {
  const [filterType, setFilterType] = useState("");
  const [filterYears, setFilterYears] = useState<number[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [dyData, setDyData] = useState<Map<string, { dy12m: number; price: number; last12Sum: number }>>(new Map());
  const [loadingDy, setLoadingDy] = useState(false);

  useEffect(() => {
    const tickers = [...new Set(dividends.map((d) => d.ticker))];
    if (tickers.length === 0) return;
    setLoadingDy(true);
    fetchDY12m(tickers).then((map) => {
      setDyData(map);
      setLoadingDy(false);
    });
  }, [dividends]);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.type))).sort();
  }, [dividends]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.year))).sort((a, b) => b - a);
  }, [dividends]);

  const availableTickers = useMemo(() => {
    let filtered = dividends;
    if (filterType) filtered = filtered.filter((d) => d.type === filterType);
    if (filterYears.length > 0) filtered = filtered.filter((d) => filterYears.includes(d.year));
    return Array.from(new Set(filtered.map((d) => d.ticker))).sort();
  }, [dividends, filterType, filterYears]);

  const filtered = useMemo(() => {
    let f = dividends;
    if (filterType) f = f.filter((d) => d.type === filterType);
    if (filterYears.length > 0) f = f.filter((d) => filterYears.includes(d.year));
    if (selectedTicker) f = f.filter((d) => d.ticker === selectedTicker);
    return f;
  }, [dividends, filterType, filterYears, selectedTicker]);

  const totalDividends = useMemo(() => {
    return dividends.reduce((s, d) => s + d.totalValue, 0);
  }, [dividends]);

  const totalFiltered = useMemo(() => {
    return filtered.reduce((s, d) => s + d.totalValue, 0);
  }, [filtered]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((d) => { map[d.type] = (map[d.type] ?? 0) + d.totalValue; });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((d) => { map[d.month] = (map[d.month] ?? 0) + d.totalValue; });
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      value: Math.round((map[i + 1] ?? 0) * 100) / 100,
    }));
  }, [filtered]);

  const byYear = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((d) => {
      const y = typeof d.year === "number" && !isNaN(d.year) ? d.year : 0;
      map[y] = (map[y] ?? 0) + d.totalValue;
    });
    return Object.entries(map)
      .filter(([y]) => Number(y) > 2000)
      .map(([year, value]) => ({ year: Number(year), value: Math.round(value * 100) / 100 }))
      .sort((a, b) => a.year - b.year);
  }, [filtered]);

  function toggleYear(y: number) {
    setFilterYears((prev) =>
      prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]
    );
  }

  function handleClearFilters() {
    setFilterType("");
    setFilterYears([]);
    setSelectedTicker("");
  }

  function handleClearType() {
    setFilterType("");
  }

  const hasActiveFilters = filterType || filterYears.length > 0 || selectedTicker;

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Left sidebar */}
      <div className="w-full lg:w-64 space-y-4 shrink-0">
        {/* Total card */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">
            Total de Dividendos
          </p>
          <p className="text-2xl font-bold tabular text-income">{mask(totalFiltered, hideValues)}</p>
          <p className="text-xs text-muted mt-1">do total geral {mask(totalDividends, hideValues)}</p>
        </div>

        {/* DY 12m card */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted font-medium uppercase tracking-wider">DY 12m (B3)</p>
            {loadingDy && <RefreshCw className="size-3 text-muted animate-spin" />}
          </div>
          <p className="text-2xl font-bold tabular text-primary">
            {dyData.size === 0 ? "-" : `${(Array.from(dyData.values()).reduce((s, d) => s + d.dy12m, 0) / dyData.size).toFixed(2)}%`}
          </p>
          <p className="text-xs text-muted mt-1">médio dos ativos em carteira</p>
        </div>

        {/* Filter: Tipo */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted font-medium uppercase tracking-wider">Tipo de Ativo</p>
            {filterType && (
              <button onClick={handleClearType} className="text-muted hover:text-foreground transition-colors">
                <X className="size-3" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {availableTypes.length === 0 ? (
              <p className="text-xs text-muted py-1">Nenhum tipo encontrado</p>
            ) : (
              availableTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? "" : type)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filterType === type
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Filter: Ano */}
        {availableYears.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Ano</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableYears.map((y) => (
                <label
                  key={y}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    filterYears.includes(y)
                      ? "bg-primary/5 text-primary font-medium"
                      : "hover:bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filterYears.includes(y)}
                    onChange={() => toggleYear(y)}
                    className="accent-primary size-3.5 rounded"
                  />
                  {y}
                </label>
              ))}
            </div>
            {filterYears.length > 0 && (
              <button
                onClick={() => setFilterYears([])}
                className="mt-2 text-xs text-muted hover:text-foreground transition-colors underline underline-offset-2"
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}

        {/* Ativos list */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Ativos</p>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {availableTickers.map((ticker) => {
              const dy = dyData.get(ticker.toUpperCase());
              return (
                <button
                  key={ticker}
                  onClick={() => setSelectedTicker(selectedTicker === ticker ? "" : ticker)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedTicker === ticker
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  <AssetLogo ticker={ticker} size={16} />
                  <span className="flex-1 text-left">{ticker}</span>
                  {dy && <span className="text-xs text-income tabular">{dy.dy12m.toFixed(2)}%</span>}
                </button>
              );
            })}
            {availableTickers.length === 0 && (
              <p className="text-xs text-muted py-2">Nenhum ativo encontrado</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-muted hover:text-foreground transition-colors"
          >
            Limpar todos os filtros
          </button>
        )}
        <button
          onClick={onRefresh}
          className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted">Nenhum dividendo encontrado</p>
            <p className="text-xs text-muted mt-1">Importe dividendos ou ajuste os filtros</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-muted">Filtros ativos:</span>
                {filterType && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    {filterType}
                    <button onClick={handleClearType} className="hover:text-primary/70"><X className="size-3" /></button>
                  </span>
                )}
                {filterYears.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    {filterYears.length} ano{filterYears.length > 1 ? "s" : ""}
                    <button onClick={() => setFilterYears([])} className="hover:text-primary/70"><X className="size-3" /></button>
                  </span>
                )}
                {selectedTicker && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    {selectedTicker}
                    <button onClick={() => setSelectedTicker("")} className="hover:text-primary/70"><X className="size-3" /></button>
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* % by class */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-4">Dividendos por Classe de Ativo</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byType}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={72} innerRadius={46}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dividends by month */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-4">Dividendos por Mês</h3>
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
            </div>

            {/* Dividends by year - full width below */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-4">Dividendos por Ano</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byYear}>
                    <XAxis dataKey="year" tickFormatter={(v: number) => String(v)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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

            {/* Year cards */}
            {byYear.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-4">Dividendos por Ano</h3>
                <div className="flex flex-wrap gap-2">
                  {byYear.map((y) => (
                    <div key={y.year} className="px-4 py-2 bg-surface rounded-xl text-xs">
                      <p className="text-muted">{y.year}</p>
                      <p className="font-semibold mt-0.5 tabular text-income">{mask(y.value, hideValues)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-ticker summary */}
            {(() => {
              const byTicker: Record<string, number> = {};
              filtered.forEach((d) => { byTicker[d.ticker] = (byTicker[d.ticker] ?? 0) + d.totalValue; });
              const sorted = Object.entries(byTicker).sort((a, b) => b[1] - a[1]);
              if (sorted.length === 0) return null;
              return (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-4">Dividendos por Ativo</h3>
                  <div className="flex flex-wrap gap-2">
                    {sorted.map(([ticker, value]) => (
                      <div key={ticker} className="flex items-center gap-2 px-3 py-2 bg-surface rounded-xl text-xs">
                        <AssetLogo ticker={ticker} size={16} />
                        <span className="text-muted font-medium">{ticker}</span>
                        <span className="font-semibold tabular text-income">{mask(value, hideValues)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
