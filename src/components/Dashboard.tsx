import { useMemo, useState } from "react";
import type { Asset, PortfolioSummary, ContributionRecord, TradeRecord, DividendRecord } from "../types";
import { formatCurrency, formatCompact, formatPercent } from "../format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import { AssetLogo } from "./AssetLogo";
import { Wallet, TrendingUp, DollarSign, BarChart3, ChevronDown, Info } from "lucide-react";

const CARD_INFO: Record<string, string> = {
    patrimonio: "Valor atual de mercado de todos os ativos + todos os dividendos recebidos desde o início.",
  lucro: "Ganho de Capital = (Preço Atual × Quantidade) − Valor Investido. Dividendos = soma dos proventos recebidos nos últimos 12 meses. Lucro Total = Ganho + Dividendos.",
  proventos: "Soma dos dividendos e proventos recebidos nos últimos 12 meses. Total = soma de todos os proventos já recebidos.",
  rentabilidade: "Rentabilidade = ((Valor Atual + Dividendos 12M) − Valor Investido) / Valor Investido × 100.",
};

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

function InfoButton({ id, openInfo, setOpenInfo }: { id: string; openInfo: string | null; setOpenInfo: (v: string | null) => void }) {
  const isOpen = openInfo === id;
  return (
    <div className="relative ml-auto">
      <button
        onClick={(e) => { e.stopPropagation(); setOpenInfo(isOpen ? null : id); }}
        className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
        title="Como é calculado?"
      >
        <Info className="size-3.5 text-muted" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-card border border-border rounded-xl shadow-lg text-xs text-muted leading-relaxed" onClick={(e) => e.stopPropagation()}>
          {CARD_INFO[id]}
        </div>
      )}
    </div>
  );
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
    "AÇÃO": "#3b82f6",
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
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  // Filter assets by type
  const filteredAssets = useMemo(() => {
    return typeFilter === "all" ? assets : assets.filter((a) => a.type === typeFilter);
  }, [assets, typeFilter]);

  // Filter dividends by type
  const filteredDividends = useMemo(() => {
    if (!dividends) return [];
    if (typeFilter === "all") return dividends;
    return dividends.filter((d) => {
      const asset = assets.find((a) => a.ticker === d.ticker);
      return asset?.type === typeFilter;
    });
  }, [dividends, assets, typeFilter]);

  // Calculate filtered totals
  const filteredTotalValue = useMemo(() => {
    return filteredAssets.reduce((s, a) => s + a.investedAmount, 0);
  }, [filteredAssets]);

  // Current market value (price × quantity)
  const filteredMarketValue = useMemo(() => {
    return filteredAssets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
  }, [filteredAssets]);

  const filteredTotalInvested = useMemo(() => {
    return filteredAssets.reduce((s, a) => s + a.investedAmount, 0);
  }, [filteredAssets]);

  // Calculate total dividends received in last 12 months (filtered)
  const dividends12m = useMemo(() => {
    if (!filteredDividends || filteredDividends.length === 0) return 0;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return filteredDividends
      .filter((d) => d.payment >= cutoffStr && d.payment <= today)
      .reduce((s, d) => s + d.totalValue, 0);
  }, [filteredDividends]);

  // Total dividends received (only paid, filtered by type)
  const totalDividends = useMemo(() => {
    if (!filteredDividends || filteredDividends.length === 0) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return filteredDividends
      .filter((d) => d.payment <= today)
      .reduce((s, d) => s + d.totalValue, 0);
  }, [filteredDividends]);

  // Total contributed (net: aportes - resgates)
  const totalContributed = useMemo(() => {
    return contributions.reduce((s, c) => s + c.value, 0);
  }, [contributions]);

  // Calculate capital gains (filtered)
  const capitalGains = useMemo(() => {
    return filteredAssets.reduce((s, a) => s + (a.currentPrice * a.quantity - a.investedAmount), 0);
  }, [filteredAssets]);

  // Rentabilidade calculations (including dividends, filtered)
  const rentabilidade12m = useMemo(() => {
    if (filteredTotalInvested <= 0) return 0;
    const totalValue = filteredTotalValue + dividends12m;
    return ((totalValue - filteredTotalInvested) / filteredTotalInvested) * 100;
  }, [filteredTotalInvested, filteredTotalValue, dividends12m]);

  // Evolution data based on time period and type filter
  const evolutionData = useMemo(() => {
    const now = new Date();
    let monthsBack = 120;
    if (timePeriod === "12m") monthsBack = 12;
    else if (timePeriod === "24m") monthsBack = 24;
    else if (timePeriod === "60m") monthsBack = 60;
    else if (timePeriod === "120m") monthsBack = 120;
    else if (timePeriod === "all") monthsBack = 120;
    else if (timePeriod === "custom") monthsBack = 120;

    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const cutoffStr = cutoffDate.toISOString().slice(0, 7);

    // Build set of filtered tickers
    const filteredTickers = new Set(filteredAssets.map((a) => a.ticker.toUpperCase()));

    // Calculate cumulative invested from trades for filtered assets
    const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));

    // Generate all months in the period
    const allMonths: string[] = [];
    const tempDate = new Date(cutoffDate);
    while (tempDate <= now) {
      allMonths.push(tempDate.toISOString().slice(0, 7));
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // Build cumulative invested per month from trades
    let cumulativeInvested = 0;
    const investedByMonth: Record<string, number> = {};
    for (const t of sortedTrades) {
      const tm = t.date.slice(0, 7);
      if (t.operation === "COMPRA" && filteredTickers.has(t.ticker.toUpperCase())) {
        cumulativeInvested += t.totalWithFees;
      } else if (t.operation === "VENDA" && filteredTickers.has(t.ticker.toUpperCase())) {
        cumulativeInvested -= t.totalWithFees;
      }
      investedByMonth[tm] = cumulativeInvested;
    }

    // For months before the first trade, invested = 0
    // Fill in: for each month, use the last known value
    let lastInvested = 0;
    const monthInvested: Record<string, number> = {};
    for (const m of allMonths) {
      if (investedByMonth[m] !== undefined) {
        lastInvested = investedByMonth[m];
      }
      monthInvested[m] = lastInvested;
    }

    // Current gain (including dividends received)
    const currentGain = (filteredTotalValue + totalDividends) - filteredTotalInvested;

    // If no trades, fall back to contributions with fraction scaling
    const hasTrades = sortedTrades.some((t) => filteredTickers.has(t.ticker.toUpperCase()));
    const useFallback = !hasTrades && filteredTotalInvested > 0;

    const monthlyData: Record<string, {
      aportado: number;
      ganho: number;
    }> = {};

    if (useFallback) {
      // Fallback: scale contributions by type fraction
      const totalInv = assets.reduce((s, a) => s + a.investedAmount, 0);
      const fraction = totalInv > 0 ? filteredTotalInvested / totalInv : 1;
      const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));

      let cumAportado = 0;
      for (const c of sorted) {
        if (c.date < cutoffStr) cumAportado += c.value * fraction;
      }

      for (const month of allMonths) {
        for (const c of sorted) {
          if (c.date.slice(0, 7) === month && c.date >= cutoffStr) {
            cumAportado += c.value * fraction;
          }
        }
        const ganho = filteredTotalInvested > 0
          ? currentGain * (cumAportado / filteredTotalInvested)
          : 0;
        monthlyData[month] = { aportado: cumAportado, ganho: Math.max(0, ganho) };
      }
    } else {
      // Primary: use trades data
      for (const month of allMonths) {
        const aportado = Math.max(0, monthInvested[month] ?? 0);
        const ganho = filteredTotalInvested > 0 && aportado > 0
          ? currentGain * (aportado / filteredTotalInvested)
          : 0;
        monthlyData[month] = { aportado, ganho: Math.max(0, ganho) };
      }
    }

    return allMonths
      .filter((m) => monthlyData[m])
      .map((month) => ({
        month,
        "Valor aplicado": Math.round(monthlyData[month].aportado),
        "Ganho de Capital": Math.round(monthlyData[month].ganho),
      }));
  }, [trades, contributions, filteredAssets, filteredTotalValue, filteredTotalInvested, timePeriod, assets, typeFilter]);

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
    <div className="space-y-6" onClick={() => openInfo && setOpenInfo(null)}>
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Patrimônio Total */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-visible">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Wallet className="size-4 text-blue-500" />
            </div>
            <p className="text-xs text-muted font-medium">Patrimônio total</p>
            <InfoButton id="patrimonio" openInfo={openInfo} setOpenInfo={setOpenInfo} />
          </div>
          <p className="text-2xl font-bold tabular">{mask(totalContributed + totalDividends, hideValues)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium ${((totalContributed + totalDividends) - totalContributed) >= 0 ? "text-income" : "text-expense"}`}>
              {((totalContributed + totalDividends) - totalContributed) >= 0 ? "+" : ""}
              {totalContributed > 0 ? formatPercent(totalDividends / totalContributed * 100) : "0,00%"}
            </span>
            {totalDividends >= 0 ? (
              <TrendingUp className="size-3 text-income" />
            ) : (
              <TrendingUp className="size-3 text-expense rotate-180" />
            )}
          </div>
          <p className="text-xs text-muted mt-2">Valor aportado</p>
          <p className="text-sm font-medium tabular">{mask(totalContributed, hideValues)}</p>
          <p className="text-xs text-muted mt-2">Patrimônio atual</p>
          <p className={`text-sm font-medium tabular ${filteredMarketValue >= totalContributed ? "text-income" : "text-expense"}`}>
            {mask(filteredMarketValue, hideValues)}
          </p>
        </div>

        {/* Lucro Total */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-visible">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p className="text-xs text-muted font-medium">Lucro total</p>
            <InfoButton id="lucro" openInfo={openInfo} setOpenInfo={setOpenInfo} />
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
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-visible">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <DollarSign className="size-4 text-amber-500" />
            </div>
            <p className="text-xs text-muted font-medium">Proventos Recebidos (12M)</p>
            <InfoButton id="proventos" openInfo={openInfo} setOpenInfo={setOpenInfo} />
          </div>
          <p className="text-2xl font-bold tabular">{mask(dividends12m, hideValues)}</p>
          <div className="mt-2">
            <p className="text-[10px] text-muted">Total</p>
            <p className="text-xs font-medium tabular">{mask(summary.annualDividend, hideValues)}</p>
          </div>
        </div>

        {/* Rentabilidade */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-visible">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <BarChart3 className="size-4 text-purple-500" />
            </div>
            <p className="text-xs text-muted font-medium">Rentabilidade (12M)</p>
            <InfoButton id="rentabilidade" openInfo={openInfo} setOpenInfo={setOpenInfo} />
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
                  <option value="AÇÃO">Ações</option>
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
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const valorAplicado = Number(payload.find((p) => p.dataKey === "Valor aplicado")?.value) || 0;
                      const ganhoCapital = Number(payload.find((p) => p.dataKey === "Ganho de Capital")?.value) || 0;
                      const patrimonio = valorAplicado + ganhoCapital;
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
                          <p className="font-semibold text-sm mb-2">{label}</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="size-3 rounded-sm bg-blue-500" />
                              <span className="text-xs text-gray-600">Patrimônio</span>
                              <span className="text-xs font-semibold ml-auto">{formatCurrency(patrimonio)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="size-3 rounded-sm bg-emerald-500" />
                              <span className="text-xs text-gray-600">Valor aplicado</span>
                              <span className="text-xs font-semibold ml-auto">{formatCurrency(valorAplicado)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="size-3 rounded-sm bg-emerald-300" />
                              <span className="text-xs text-gray-600">Ganho de Capital</span>
                              <span className="text-xs font-semibold ml-auto">{formatCurrency(ganhoCapital)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
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
                <option value="AÇÃO">Ações</option>
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