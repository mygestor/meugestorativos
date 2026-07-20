import { useMemo } from "react";
import type { Asset, PortfolioSummary, ContributionRecord, TradeRecord } from "../types";
import { formatCurrency, formatCompact, formatPercent } from "../format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import { AssetLogo } from "./AssetLogo";

interface Props {
  summary: PortfolioSummary;
  assets: Asset[];
  hideValues: boolean;
  contributions: ContributionRecord[];
  trades: TradeRecord[];
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const borderAccents: Record<string, string> = {
  blue: "border-l-blue-500",
  green: "border-l-emerald-500",
  purple: "border-l-purple-500",
};

const tooltipContentStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 12,
  fontSize: 13,
};

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    FII: "#10b981",
    Ação: "#3b82f6",
    ETF: "#f59e0b",
    BDR: "#8b5cf6",
    Tesouro: "#14b8a6",
    CDB: "#f97316",
    LCI: "#ec4899",
    LCA: "#ef4444",
  };
  return map[type] ?? "#6b7280";
}

export function Dashboard({ summary, assets, hideValues, contributions, trades }: Props) {
  const typeData = Object.entries(summary.types)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const sectorData = Object.entries(summary.sectors)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const totalSector = sectorData.reduce((s, d) => s + d.value, 0);

  const topAssets = [...assets]
    .sort((a, b) => b.currentDividend - a.currentDividend)
    .slice(0, 6);

  const maxDividend = topAssets.length > 0 ? topAssets[0].currentDividend : 0;

  const realInvested = summary.totalInvested;
  const diff = summary.totalCurrentValue - realInvested;
  const rentPct = realInvested > 0 ? (diff / realInvested) * 100 : 0;

  const { netWorthData, cumulativeAportes } = useMemo(() => {
    const dates = new Map<string, { aportado: number; patrimonio: number }>();
    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    let cumulativeAportes = 0;

    for (const c of sorted) {
      cumulativeAportes += c.value;
      dates.set(c.date, { aportado: cumulativeAportes, patrimonio: cumulativeAportes });
    }

    if (dates.size > 0) {
      const today = new Date().toISOString().slice(0, 10);
      if (!dates.has(today)) {
        dates.set(today, {
          aportado: cumulativeAportes,
          patrimonio: summary.totalCurrentValue || cumulativeAportes,
        });
      } else {
        const lastEntry = Array.from(dates.entries()).pop()!;
        dates.set(lastEntry[0], {
          ...lastEntry[1],
          patrimonio: summary.totalCurrentValue || cumulativeAportes,
        });
      }
    }

    const data = Array.from(dates.entries()).map(([date, d]) => ({
      date: date.slice(0, 7),
      Aportado: Math.round(d.aportado),
      Patrimônio: Math.round(d.patrimonio),
    }));

    return { netWorthData: data, cumulativeAportes };
  }, [contributions, summary.totalCurrentValue]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Total Investido" value={mask(realInvested, hideValues)} accent="blue" />
        <SummaryCard label="Dividendo Mensal" value={mask(summary.monthlyDividend, hideValues)} accent="green" />
        <SummaryCard label="Dividendo Anual" value={mask(summary.annualDividend, hideValues)} accent="green" />
        <SummaryCard label="Ativos" value={String(summary.assetCount)} accent="purple" />
        <div className="bg-card border border-border rounded-2xl p-4 border-l-2 border-l-amber-500">
          <p className="text-xs text-muted mb-1">Patrimônio Atual</p>
          <p className="text-lg font-bold tabular">{mask(summary.totalCurrentValue, hideValues)}</p>
          <p className="text-xs text-muted mt-0.5">(investido: {mask(realInvested, hideValues)})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Alocação por Tipo</h3>
          {typeData.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum ativo cadastrado</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
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
          )}
          <div className="mt-3 space-y-1.5">
            {typeData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted flex-1">{t.name}</span>
                <span className="font-medium">{formatCompact(t.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Dividendos por Ativo</h3>
          {topAssets.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum dividendo sendo recebido</p>
          ) : (
            <div className="space-y-3">
              {topAssets.map((a) => {
                const barPct = maxDividend > 0 ? (a.currentDividend / maxDividend) * 100 : 0;
                const avatarColor = getTypeColor(a.type);
                return (
                  <div key={a.id}>
                    <div className="flex items-center gap-3 mb-1">
                      <AssetLogo ticker={a.ticker} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.ticker}</p>
                        <p className="text-xs text-muted">{a.type} • {a.quantity} cotas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular">{mask(a.currentDividend, hideValues)}</p>
                        <p className="text-xs text-muted tabular">mês</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barPct}%`, backgroundColor: avatarColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <MiniCard label="Dividendo Projetado/Mês" value={mask(summary.projectedMonthlyDividend, hideValues)} />
        <MiniCard label="Dividendo Projetado/Ano" value={mask(summary.projectedAnnualDividend, hideValues)} />
        <MiniCard
          label="Rentabilidade Média"
          value={realInvested > 0 ? formatPercent(rentPct) : "0%"}
          valueClassName={diff >= 0 ? "text-emerald-500" : "text-red-500"}
          subValue={realInvested > 0 ? `${diff >= 0 ? "+" : ""}${mask(diff, hideValues)}` : undefined}
        />
      </div>

      {netWorthData.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Evolução do Patrimônio</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <defs>
                  <linearGradient id="gradAportado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="Aportado" stroke="#3b82f6" strokeWidth={2} fill="url(#gradAportado)" />
                <Area type="monotone" dataKey="Patrimônio" stroke="#10b981" strokeWidth={2} fill="url(#gradPatrimonio)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500" />
              <span className="text-muted">Total Aportado</span>
              <span className="font-medium tabular">{mask(cumulativeAportes, hideValues)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted">Patrimônio Atual</span>
              <span className="font-medium tabular">{mask(summary.totalCurrentValue, hideValues)}</span>
            </div>
          </div>
        </div>
      )}

      {sectorData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Alocação por Setor</h3>
          <div className="h-6 bg-surface rounded-full overflow-hidden flex">
            {sectorData.map((s, i) => {
              const pct = (s.value / totalSector) * 100;
              return (
                <div
                  key={s.name}
                  className="h-full flex items-center justify-center text-[10px] font-medium text-white transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                  title={`${s.name}: ${formatPercent(pct)}`}
                >
                  {pct > 8 ? s.name : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
            {sectorData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted">{s.name}</span>
                <span className="font-medium">{formatPercent((s.value / totalSector) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "green" | "purple";
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 border-l-2 ${borderAccents[accent]}`}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-lg font-bold tabular">{value}</p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  valueClassName = "text-primary",
  subValue,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  subValue?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-base font-bold tabular ${valueClassName}`}>{value}</p>
      {subValue && <p className="text-xs text-muted mt-0.5">{subValue}</p>}
    </div>
  );
}
