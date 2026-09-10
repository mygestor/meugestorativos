import { useMemo, useState } from "react";
import type { Asset, PortfolioSummary, ContributionRecord, TradeRecord, DividendRecord } from "../types";
import { formatCurrency, formatCompact, formatPercent } from "../format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import { AssetLogo } from "./AssetLogo";
import { Wallet, TrendingUp, DollarSign, BarChart3, ChevronDown } from "lucide-react";

interface Props {
  summary: PortfolioSummary;
  assets: Asset[];
  hideValues: boolean;
  contributions: ContributionRecord[];
  trades: TradeRecord[];
  dividends?: DividendRecord[];
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const tooltipContentStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 13,
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
};

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    FII: "#10b981",
    "Ação": "#3b82f6",
    ETF: "#f59e0b",
    BDR: "#8b5cf6",
    Tesouro: "#14b8a6",
    CDB: "#f97316",
    LCI: "#ec4899",
    LCA: "#ef4444",
    RendaFixa: "#3b82f6",
  };
  return map[type] ?? "#6b7280";
}

type TimePeriod = "all" | "12m" | "24m" | "60m" | "120m" | "custom";

export function Dashboard({ summary, assets, hideValues, contributions, trades, dividends }: Props) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("12m");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Calculate total dividends received in last 12 months
  const dividends12m = useMemo(() => {
    if (!dividends) return 0;
    const now = new Date();
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return dividends
      .filter((d) => d.payment >= cutoffStr)
      .reduce((s, d) => s + d.totalValue, 0);
  }, [dividends]);

  // Calculate capital gains
  const capitalGains = useMemo(() => {
    return assets.reduce((s, a) => s + (a.currentPrice * a.quantity - a.investedAmount), 0);
  }, [assets]);

  // Rentabilidade calculations (including dividends)
  const rentabilidade12m = useMemo(() => {
    const totalInvested = summary.totalInvested;
    const totalValue = summary.totalCurrentValue + dividends12m;
    if (totalInvested <= 0) return 0;
    return ((totalValue - totalInvested) / totalInvested) * 100;
  }, [summary, dividends12m]);

  // Evolution data based on time period
  const evolutionData = useMemo(() => {
    const now = new Date();
    let monthsBack = 120; // Default to 10 years
    if (timePeriod === "12m") monthsBack = 12;
    else if (timePeriod === "24m") monthsBack = 24;
    else if (timePeriod === "60m") monthsBack = 60;
    else if (timePeriod === "120m") monthsBack = 120;
    else if (timePeriod === "all") monthsBack = 120;
    else if (timePeriod === "custom") monthsBack = 120; // For now, use 10 years for custom

    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const cutoffStr = cutoffDate.toISOString().slice(0, 7);

    // Calculate cumulative dividends by month
    const dividendsByMonth: Record<string, number> = {};
    let cumulativeDividends = 0;
    if (dividends) {
      const sortedDivs = [...dividends].sort((a, b) => a.payment.localeCompare(b.payment));
      for (const d of sortedDivs) {
        const month = d.payment.slice(0, 7);
        cumulativeDividends += d.totalValue;
        dividendsByMonth[month] = cumulativeDividends;
      }
    }

    // Group contributions by month
    const monthlyData: Record<string, {
      aportado: number;
      patrimonio: number;
      dividendos: number;
    }> = {};
    let cumulativeAportado = 0;

    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    for (const c of sorted) {
      const month = c.date.slice(0, 7);
      if (month < cutoffStr) {
        cumulativeAportado += c.value;
        continue;
      }
      cumulativeAportado += c.value;
      const divsForMonth = dividendsByMonth[month] ?? cumulativeDividends;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          aportado: cumulativeAportado,
          patrimonio: cumulativeAportado + divsForMonth,
          dividendos: divsForMonth,
        };
      } else {
        monthlyData[month].aportado = cumulativeAportado;
        monthlyData[month].patrimonio = cumulativeAportado + divsForMonth;
        monthlyData[month].dividendos = divsForMonth;
      }
    }

    // Add current month with real patrimônio (market value + dividends received)
    const currentMonth = now.toISOString().slice(0, 7);
    const totalPatrimonio = summary.totalCurrentValue + cumulativeDividends;
    if (!monthlyData[currentMonth]) {
      monthlyData[currentMonth] = {
        aportado: cumulativeAportado,
        patrimonio: totalPatrimonio,
        dividendos: cumulativeDividends,
      };
    } else {
      monthlyData[currentMonth].patrimonio = totalPatrimonio;
      monthlyData[currentMonth].dividendos = cumulativeDividends;
    }

    // Calculate values for chart
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        "Valor aplicado": Math.round(data.aportado),
        "Ganho de Capital": Math.max(0, Math.round(data.patrimonio - data.aportado)),
      }));
  }, [contributions, dividends, summary.totalCurrentValue, timePeriod]);

  // Assets by type for donut chart
  const typeData = useMemo(() => {
    const filtered = typeFilter === "all" ? assets : assets.filter((a) => a.type === typeFilter);
    const map: Record<string, number> = {};
    for (const a of filtered) {
      const type = a.type || "Outros";
      map[type] = (map[type] ?? 0) + (a.currentPrice * a.quantity);
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percent: total > 0 ? ((value / total) * 100).toFixed(2) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [assets, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Patrimônio Total */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Wallet className="size-4 text-blue-500" />
            </div>
            <p className="text-xs text-muted font-medium">Patrimônio total</p>
          </div>
          <p className="text-2xl font-bold tabular">{mask(summary.totalCurrentValue + dividends12m, hideValues)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-emerald-500 font-medium">
              {rentabilidade12m >= 0 ? "+" : ""}{formatPercent(rentabilidade12m)}
            </span>
            {rentabilidade12m >= 0 ? (
              <TrendingUp className="size-3 text-emerald-500" />
            ) : (
              <TrendingUp className="size-3 text-red-500 rotate-180" />
            )}
          </div>
          <p className="text-xs text-muted mt-2">Valor investido</p>
          <p className="text-sm font-medium tabular">{mask(summary.totalInvested, hideValues)}</p>
        </div>

        {/* Lucro Total */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p className="text-xs text-muted font-medium">Lucro total</p>
          </div>
          <p className="text-2xl font-bold tabular text-emerald-500">
            {hideValues ? "R$ ••••" : formatCurrency(capitalGains + dividends12m)}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div>
              <p className="text-[10px] text-muted">Ganho de Capital</p>
              <p className="text-xs font-medium tabular">{mask(capitalGains, hideValues)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted">Dividendos Recebidos</p>
              <p className="text-xs font-medium tabular">{mask(dividends12m, hideValues)}</p>
            </div>
          </div>
        </div>

        {/* Proventos Recebidos (12M) */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <DollarSign className="size-4 text-amber-500" />
            </div>
            <p className="text-xs text-muted font-medium">Proventos Recebidos (12M)</p>
          </div>
          <p className="text-2xl font-bold tabular">{mask(dividends12m, hideValues)}</p>
          <div className="mt-2">
            <p className="text-[10px] text-muted">Total</p>
            <p className="text-xs font-medium tabular">{mask(summary.annualDividend, hideValues)}</p>
          </div>
        </div>

        {/* Rentabilidade */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <BarChart3 className="size-4 text-purple-500" />
            </div>
            <p className="text-xs text-muted font-medium">Rentabilidade (12M)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold tabular ${rentabilidade12m >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatPercent(rentabilidade12m)}
            </span>
            {rentabilidade12m >= 0 ? (
              <TrendingUp className="size-5 text-emerald-500" />
            ) : (
              <TrendingUp className="size-5 text-red-500 rotate-180" />
            )}
          </div>
          <div className="mt-2">
            <p className="text-[10px] text-muted">Rentabilidade Total</p>
            <p className={`text-sm font-bold tabular ${rentabilidade12m >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatPercent(rentabilidade12m)}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart - 2 columns */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Evolução do Patrimônio</h3>
            <div className="flex items-center gap-2">
              {/* Time Period Filter */}
              <div className="relative">
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                  className="appearance-none px-3 py-1.5 pr-8 bg-surface border border-border rounded-xl text-xs font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="all">Desde o início</option>
                  <option value="12m">12 Meses</option>
                  <option value="24m">2 Anos</option>
                  <option value="60m">5 Anos</option>
                  <option value="120m">10 Anos</option>
                  <option value="custom">Data personalizada</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted pointer-events-none" />
              </div>
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none px-3 py-1.5 pr-8 bg-surface border border-border rounded-xl text-xs font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="Ação">Ações</option>
                  <option value="FII">FIIs</option>
                  <option value="ETF">ETFs</option>
                  <option value="BDR">BDRs</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted">Valor aplicado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-emerald-300" />
              <span className="text-xs text-muted">Ganho de Capital</span>
            </div>
          </div>

          {evolutionData.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum dado de evolução disponível</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionData} barGap={2}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Bar dataKey="Valor aplicado" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Ganho de Capital" stackId="a" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Assets Donut - 1 column */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Ativos na Carteira</h3>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 bg-surface border border-border rounded-xl text-xs font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="all">Todos os tipos</option>
                <option value="Ação">Ações</option>
                <option value="FII">FIIs</option>
                <option value="ETF">ETFs</option>
                <option value="BDR">BDRs</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted pointer-events-none" />
            </div>
          </div>

          {typeData.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum ativo cadastrado</p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-2 mt-4">
                {typeData.map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular">{formatCompact(t.value)}</span>
                      <span className="text-muted w-12 text-right">{t.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}