import type { Asset, PortfolioSummary } from "../types";
import { formatCurrency, formatCompact, formatPercent } from "../format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  summary: PortfolioSummary;
  assets: Asset[];
  hideValues: boolean;
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function Dashboard({ summary, assets, hideValues }: Props) {
  const typeData = Object.entries(summary.types)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const sectorData = Object.entries(summary.sectors)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const topAssets = [...assets]
    .sort((a, b) => b.currentDividend - a.currentDividend)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Investido" value={mask(summary.totalInvested, hideValues)} />
        <SummaryCard label="Dividendo Mensal" value={mask(summary.monthlyDividend, hideValues)} />
        <SummaryCard label="Dividendo Anual" value={mask(summary.annualDividend, hideValues)} />
        <SummaryCard label="Ativos" value={String(summary.assetCount)} />
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
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {typeData.map((_, i) => (
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
              {topAssets.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                    {a.ticker.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.ticker}</p>
                    <p className="text-xs text-muted">{a.type} • {a.quantity} cotas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular">{mask(a.currentDividend, hideValues)}</p>
                    <p className="text-xs text-muted tabular">mês</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <MiniCard label="Dividendo Projetado/Mês" value={mask(summary.projectedMonthlyDividend, hideValues)} />
        <MiniCard label="Dividendo Projetado/Ano" value={mask(summary.projectedAnnualDividend, hideValues)} />
        <MiniCard
          label="Rentabilidade Média"
          value={summary.totalInvested > 0
            ? formatPercent(((summary.totalCurrentValue - summary.totalInvested) / summary.totalInvested) * 100)
            : "0%"}
        />
      </div>

      {sectorData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Alocação por Setor</h3>
          <div className="flex flex-wrap gap-2">
            {sectorData.map((s) => (
              <div key={s.name} className="px-3 py-2 bg-surface rounded-xl text-xs">
                <p className="text-muted">{s.name}</p>
                <p className="font-semibold mt-0.5">{formatCompact(s.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-lg font-bold tabular">{value}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-base font-bold tabular text-primary">{value}</p>
    </div>
  );
}
