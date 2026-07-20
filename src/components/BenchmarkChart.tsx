import { useState, useEffect } from "react";
import { formatCurrency, formatPercent } from "../format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  contributions: { date: string; value: number }[];
  totalValue: number;
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 13,
};

export function BenchmarkChart({ contributions, totalValue }: Props) {
  const [data, setData] = useState<{ date: string; Carteira: number; CDI: number; IBOV: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contributions.length === 0) return;
    setLoading(true);

    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    const monthlyTotals: Record<string, number> = {};
    for (const c of sorted) {
      cumulative += c.value;
      const month = c.date.slice(0, 7);
      monthlyTotals[month] = cumulative;
    }

    // Add current month
    const today = new Date().toISOString().slice(0, 7);
    if (!monthlyTotals[today]) {
      monthlyTotals[today] = cumulative;
    }

    const months = Object.keys(monthlyTotals).sort();
    const portfolioStart = months[0];

    Promise.all([
      fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${portfolioStart}-01&dataFinal=${today}-01`).then(r => r.json()),
      fetch(`https://brapi.dev/api/quote/^BVSP?range=1y&interval=1mo&fundamental=false&dividends=false`).then(r => r.json()),
    ]).then(([cdiData, ibovData]) => {
      const cdiByMonth: Record<string, number> = {};
      if (Array.isArray(cdiData)) {
        let cdiAccum = 1;
        for (const item of cdiData) {
          const month = item.data.slice(3, 10);
          const val = parseFloat(item.valor.replace(",", "."));
          cdiAccum *= (1 + val / 100);
          cdiByMonth[month] = (cdiAccum - 1) * 100;
        }
      }

      const ibovByMonth: Record<string, number> = {};
      if (ibovData?.results?.[0]?.historicalDataPrice) {
        const hist = ibovData.results[0].historicalDataPrice;
        const grouped: Record<string, number[]> = {};
        for (const h of hist) {
          const d = new Date(h.date * 1000);
          const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!grouped[month]) grouped[month] = [];
          grouped[month].push(h.close);
        }
        let firstClose = grouped[months[0]]?.[0] || 1;
        for (const [m, prices] of Object.entries(grouped)) {
          ibovByMonth[m] = ((prices[prices.length - 1] / firstClose) - 1) * 100;
        }
      }

      const firstAporte = monthlyTotals[months[0]] || 1;
      const chartData = months.map((m) => ({
        date: m,
        Carteira: Math.round((((monthlyTotals[m] / firstAporte) - 1) * 100) * 100) / 100,
        CDI: Math.round((cdiByMonth[m] || 0) * 100) / 100,
        IBOV: Math.round((ibovByMonth[m] || 0) * 100) / 100,
      }));

      setData(chartData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [contributions]);

  if (loading) return <div className="bg-card border border-border rounded-2xl p-5"><p className="text-sm text-muted text-center py-8">Carregando benchmarks...</p></div>;
  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-4">Comparação com Benchmarks</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Area type="monotone" dataKey="Carteira" stroke="#10b981" strokeWidth={2} fill="#10b98120" />
            <Area type="monotone" dataKey="CDI" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b20" />
            <Area type="monotone" dataKey="IBOV" stroke="#3b82f6" strokeWidth={2} fill="#3b82f620" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs">
        <Legend color="#10b981" label="Carteira" />
        <Legend color="#f59e0b" label="CDI" />
        <Legend color="#3b82f6" label="IBOV" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted">{label}</span>
    </div>
  );
}
