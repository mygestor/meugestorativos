import { useMemo } from "react";
import type { Asset, DividendRecord, ContributionRecord, TradeRecord } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { getDividendStats, getContributionStats } from "../store";
import { PurchaseSimulator } from "./PurchaseSimulator";
import { SmartRecommendations } from "./SmartRecommendations";
import { PortfolioRebalancing } from "./PortfolioRebalancing";
import { DividendCalendar } from "./DividendCalendar";
import { BenchmarkChart } from "./BenchmarkChart";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, AreaChart, Area } from "recharts";
import { TrendingUp, DollarSign, Target, BarChart3, PieChart as PieChartIcon, Lightbulb } from "lucide-react";

interface Props {
  assets: Asset[];
  dividends: DividendRecord[];
  contributions: ContributionRecord[];
  trades: TradeRecord[];
  hideValues: boolean;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const tooltipStyle: React.CSSProperties = {
  background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13,
};

function maskCurrency(v: number, hide: boolean) {
  return hide ? "••••" : formatCurrency(v);
}

export function PlanningPage({ assets, dividends, contributions, hideValues }: Props) {
  const totalInvested = useMemo(() => assets.reduce((s, a) => s + a.investedAmount, 0), [assets]);
  const totalValue = useMemo(() => assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0), [assets]);
  const monthlyDividend = useMemo(() => assets.reduce((s, a) => s + a.currentDividend, 0), [assets]);
  const annualDividend = monthlyDividend * 12;
  const gain = totalValue - totalInvested;
  const rentPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;
  const avgPerAsset = assets.length > 0 ? totalInvested / assets.length : 0;

  // Goal indicators
  const assetsWithGoal = assets.filter((a) => a.targetTotal > 0);
  const totalGoal = assetsWithGoal.reduce((s, a) => s + a.targetTotal, 0);
  const totalGoalInvested = assetsWithGoal.reduce((s, a) => s + a.investedAmount, 0);
  const goalProgress = totalGoal > 0 ? Math.min(100, (totalGoalInvested / totalGoal) * 100) : 0;
  const goalRemaining = Math.max(0, totalGoal - totalGoalInvested);

  // Dividend stats
  const divStats = useMemo(() => getDividendStats(dividends), [dividends]);

  // Contribution stats
  const contribStats = useMemo(() => getContributionStats(contributions), [contributions]);

  // Chart data
  const typeData = useMemo(() => {
    const byType: Record<string, number> = {};
    assets.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + a.investedAmount; });
    return Object.entries(byType).map(([n, v]) => ({ name: n, value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [assets]);

  const sectorData = useMemo(() => {
    const bySector: Record<string, number> = {};
    assets.forEach((a) => { if (a.sector) bySector[a.sector] = (bySector[a.sector] || 0) + a.investedAmount; });
    const entries = Object.entries(bySector).map(([n, v]) => ({ name: n, value: Math.round(v) })).sort((a, b) => b.value - a.value);
    const total = entries.reduce((s, d) => s + d.value, 0);
    return entries.map((d) => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }));
  }, [assets]);

  const dividendByMonth = useMemo(() => {
    return Object.entries(divStats.byMonth)
      .map(([k, v]) => ({ month: k, value: Math.round(v) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [divStats]);

  // Net worth evolution
  const netWorthData = useMemo(() => {
    const dates = new Map<string, { aportado: number; patrimonio: number }>();
    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    for (const c of sorted) {
      cumulative += c.value;
      dates.set(c.date, { aportado: cumulative, patrimonio: cumulative });
    }
    if (dates.size > 0) {
      const today = new Date().toISOString().slice(0, 10);
      dates.set(today, { aportado: cumulative, patrimonio: totalValue || cumulative });
    }
    return Array.from(dates.entries()).map(([d, v]) => ({
      date: d.slice(0, 7),
      Aportado: Math.round(v.aportado),
      Patrimônio: Math.round(v.patrimonio),
    }));
  }, [contributions, totalValue]);

  // Goal chart
  const goalChartData = useMemo(() => {
    return assetsWithGoal.map((a) => ({
      ticker: a.ticker,
      meta: Math.round(a.targetTotal),
      atual: Math.round(a.investedAmount),
      pct: a.targetTotal > 0 ? Math.min(100, (a.investedAmount / a.targetTotal) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct);
  }, [assetsWithGoal]);

  return (
    <div className="space-y-6">
      {/* Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <IndicCard icon={DollarSign} label="Patrimônio Atual" value={maskCurrency(totalValue, hideValues)} accent="emerald" />
        <IndicCard icon={Target} label="Meta Total" value={maskCurrency(totalGoal, hideValues)} accent="blue" />
        <IndicCard icon={TrendingUp} label="Falta p/ Meta" value={maskCurrency(goalRemaining, hideValues)} accent="amber" />
        <IndicCard icon={BarChart3} label="Meta Concluída" value={`${goalProgress.toFixed(1)}%`} accent="purple" />
        <IndicCard icon={DollarSign} label="Dividendo/Mês" value={maskCurrency(monthlyDividend, hideValues)} accent="emerald" />
        <IndicCard icon={DollarSign} label="Dividendo/Ano" value={maskCurrency(annualDividend, hideValues)} accent="emerald" />
        <IndicCard icon={BarChart3} label="Total Investido" value={maskCurrency(totalInvested, hideValues)} accent="slate" />
        <IndicCard icon={TrendingUp} label="Lucro Total" value={maskCurrency(gain, hideValues)} valueColor={gain >= 0 ? "text-emerald-500" : "text-red-500"} accent="amber" />
        <IndicCard icon={BarChart3} label="Rentabilidade" value={formatPercent(rentPct)} valueColor={rentPct >= 0 ? "text-emerald-500" : "text-red-500"} accent="amber" />
        <IndicCard icon={BarChart3} label="Ativos" value={String(assets.length)} accent="purple" />
        <IndicCard icon={DollarSign} label="Yield Mensal" value={totalInvested > 0 ? formatPercent((monthlyDividend / totalInvested) * 100) : "0%"} accent="emerald" />
        <IndicCard icon={DollarSign} label="Yield Anual" value={totalInvested > 0 ? formatPercent((annualDividend / totalInvested) * 100) : "0%"} accent="emerald" />
        <IndicCard icon={BarChart3} label="Médio por Ativo" value={maskCurrency(avgPerAsset, hideValues)} accent="slate" />
        {totalGoal > 0 && (
          <IndicCard icon={Target} label="Renda Projetada/Meta" value={maskCurrency(assetsWithGoal.reduce((s, a) => {
            if (a.targetTotal > 0 && a.avgPrice > 0) return s + (a.targetTotal / a.avgPrice) * a.dividendPerShare;
            return s;
          }, 0), hideValues)} accent="emerald" />
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Evolution */}
        {netWorthData.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4">Evolução do Patrimônio</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthData}>
                  <defs>
                    <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="Aportado" stroke="#3b82f6" strokeWidth={2} fill="url(#gradA)" />
                  <Area type="monotone" dataKey="Patrimônio" stroke="#10b981" strokeWidth={2} fill="url(#gradP)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Goal progress chart */}
        {goalChartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4">Meta x Atual por Ativo</h3>
            <div className="space-y-2">
              {goalChartData.map((g) => (
                <div key={g.ticker}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium">{g.ticker}</span>
                    <span className="text-muted">{g.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${g.pct}%` }} />
                    <div className="h-full bg-blue-500/40 rounded-full transition-all" style={{ width: `${Math.min(100, (g.atual / g.meta) * 100)}%`, marginLeft: -4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution by type */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Distribuição por Classe</h3>
          {typeData.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum ativo</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45}
                    label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}
                  >
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Dividends */}
        {dividendByMonth.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4">Dividendos Mensais</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Benchmark + Rebalancing Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BenchmarkChart contributions={contributions} totalValue={totalValue} />
        <PortfolioRebalancing assets={assets} />
      </div>

      {/* Dividend Calendar */}
      <DividendCalendar assets={assets} />

      {/* Bottom: Simulator + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PurchaseSimulator assets={assets} hideValues={hideValues} />
        <SmartRecommendations assets={assets} dividends={dividends} hideValues={hideValues} />
      </div>
    </div>
  );
}

function IndicCard({
  icon: Icon, label, value, accent, valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "emerald" | "blue" | "amber" | "purple" | "slate";
  valueColor?: string;
}) {
  const borderMap: Record<string, string> = {
    emerald: "border-l-emerald-500",
    blue: "border-l-blue-500",
    amber: "border-l-amber-500",
    purple: "border-l-purple-500",
    slate: "border-l-slate-500",
  };
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 border-l-2 ${borderMap[accent]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-3.5 text-muted" />
        <p className="text-[11px] text-muted leading-tight">{label}</p>
      </div>
      <p className={`text-sm font-bold tabular ${valueColor ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
