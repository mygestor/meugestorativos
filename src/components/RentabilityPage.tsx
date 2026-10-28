import { useMemo } from "react";
import type { Asset, ContributionRecord, DividendRecord, TradeRecord } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { calcTIR, calcTIRAsset, type CashFlow } from "../tir";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Percent, TrendingUp, Wallet, Info, ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";

interface Props {
  assets: Asset[];
  dividends: DividendRecord[];
  contributions: ContributionRecord[];
  trades: TradeRecord[];
  hideValues: boolean;
}

const tooltipStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 12,
  fontSize: 13,
};

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return formatPercent(v * 100);
}

function colorOf(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "text-muted";
  return v >= 0 ? "text-income" : "text-expense";
}

export function RentabilityPage({ assets, dividends, contributions, trades, hideValues }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // -------------------------------------------------------------------------
  // Patrimônio ESTIMADO em uma data.
  // Não temos histórico de preços: usamos a cotação atual sobre as cotas
  // acumuladas até a data (via operações). Ativos sem operação são
  // considerados desde o início.
  // -------------------------------------------------------------------------
  const vmAt = useMemo(() => {
    const byTicker = new Map<string, TradeRecord[]>();
    for (const t of trades) {
      const k = t.ticker.toUpperCase();
      const arr = byTicker.get(k);
      if (arr) arr.push(t);
      else byTicker.set(k, [t]);
    }
    return (date: string): number => {
      let total = 0;
      for (const a of assets) {
        const tks = byTicker.get(a.ticker.toUpperCase());
        if (tks && tks.length > 0) {
          let net = 0;
          for (const t of tks) {
            if (t.date > date) continue;
            net += t.operation === "COMPRA" ? Math.abs(t.quantity) : -Math.abs(t.quantity);
          }
          total += Math.max(0, net) * a.currentPrice;
        } else {
          total += a.quantity * a.currentPrice;
        }
      }
      return total;
    };
  }, [assets, trades]);

  // -------------------------------------------------------------------------
  // Fluxos de caixa da carteira (aportes = saída, dividendos = entrada)
  // -------------------------------------------------------------------------
  const paidDividends = useMemo(
    () => dividends.filter((d) => d.payment && d.payment <= today),
    [dividends, today],
  );

  const portfolioFlows = useMemo(() => {
    const flows: CashFlow[] = contributions
      .filter((c) => c.date && c.value)
      .map((c) => ({ date: c.date, value: -c.value }));
    for (const d of paidDividends) {
      if (d.totalValue) flows.push({ date: d.payment, value: d.totalValue });
    }
    const marketValue = assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
    if (marketValue > 0) flows.push({ date: today, value: marketValue });
    return flows;
  }, [contributions, paidDividends, assets, today]);

  const tirAcumulada = useMemo(() => calcTIR(portfolioFlows), [portfolioFlows]);

  // -------------------------------------------------------------------------
  // Resumo
  // -------------------------------------------------------------------------
  const resumo = useMemo(() => {
    const totalAportado = contributions.reduce((s, c) => s + c.value, 0);
    const aportesPositivos = contributions.reduce((s, c) => s + (c.value > 0 ? c.value : 0), 0);
    const retiradas = contributions.reduce((s, c) => s + (c.value < 0 ? -c.value : 0), 0);
    const dividendos = paidDividends.reduce((s, d) => s + d.totalValue, 0);
    const investido = assets.reduce((s, a) => s + a.investedAmount, 0);
    const patrimonio = assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
    const lucro = patrimonio - investido + dividendos;
    const rentSimples = totalAportado > 0
      ? ((patrimonio + dividendos - totalAportado) / totalAportado) * 100
      : 0;

    const datas = [
      ...contributions.map((c) => c.date),
      ...paidDividends.map((d) => d.payment),
      ...trades.map((t) => t.date),
    ].filter(Boolean).sort();
    const primeira = datas[0] ?? "";
    const anos = primeira
      ? Math.max(0, (new Date(today).getTime() - new Date(primeira).getTime()) / (365 * 24 * 3600 * 1000))
      : 0;

    return { totalAportado, aportesPositivos, retiradas, dividendos, investido, patrimonio, lucro, rentSimples, primeira, anos };
  }, [contributions, paidDividends, assets, trades, today]);

  // -------------------------------------------------------------------------
  // Ano a ano: TIR do ano e TIR acumulada até o fim do ano
  // -------------------------------------------------------------------------
  const anoRows = useMemo(() => {
    if (!resumo.primeira) return [];
    const anoInicial = Number(resumo.primeira.slice(0, 4));
    const anoAtual = Number(today.slice(0, 4));
    if (!anoInicial || anoAtual < anoInicial) return [];

    const rows: {
      year: number;
      aportes: number;
      dividendos: number;
      patrimonio: number;
      tirAno: number | null;
      tirAcum: number | null;
    }[] = [];

    for (let y = anoInicial; y <= anoAtual; y++) {
      const isCurrent = y === anoAtual;
      const inicio = `${y}-01-01`;
      const fim = isCurrent ? today : `${y}-12-31`;

      const aportesAno = contributions.filter((c) => c.date >= inicio && c.date <= fim);
      const divsAno = paidDividends.filter((d) => d.payment >= inicio && d.payment <= fim);
      const somaAportes = aportesAno.reduce((s, c) => s + c.value, 0);
      const somaDivs = divsAno.reduce((s, d) => s + d.totalValue, 0);
      const vmFim = vmAt(fim);
      const vmInicio = vmAt(`${y - 1}-12-31`);

      const temAtividade = somaAportes !== 0 || somaDivs > 0 || vmFim > 0;
      if (!temAtividade) continue;

      // TIR do ano: patrimônio no início (saída) + aportes/dividendos do ano + patrimônio no fim (entrada)
      const fluxosAno: CashFlow[] = [];
      if (vmInicio > 0) fluxosAno.push({ date: inicio, value: -vmInicio });
      for (const c of aportesAno) if (c.value) fluxosAno.push({ date: c.date, value: -c.value });
      for (const d of divsAno) if (d.totalValue) fluxosAno.push({ date: d.payment, value: d.totalValue });
      if (vmFim > 0) fluxosAno.push({ date: fim, value: vmFim });
      const tirAno = calcTIR(fluxosAno);

      // TIR acumulada: todos os fluxos até o fim do ano + patrimônio estimado
      const fluxosAcum: CashFlow[] = portfolioFlows.filter((f) => f.date <= fim);
      if (!fluxosAcum.some((f) => f.date === fim && f.value === vmFim) && vmFim > 0) {
        fluxosAcum.push({ date: fim, value: vmFim });
      }
      const tirAcum = calcTIR(fluxosAcum);

      rows.push({
        year: y,
        aportes: somaAportes,
        dividendos: somaDivs,
        patrimonio: vmFim,
        tirAno: tirAno ? tirAno.annual : null,
        tirAcum: tirAcum ? tirAcum.annual : null,
      });
    }
    return rows;
  }, [resumo.primeira, today, contributions, paidDividends, vmAt, portfolioFlows]);

  // -------------------------------------------------------------------------
  // TIR por ativo
  // -------------------------------------------------------------------------
  const assetRows = useMemo(() => {
    return assets
      .map((a) => {
        const tir = calcTIRAsset(a, trades, dividends);
        const divs = dividends
          .filter((d) => d.ticker.toUpperCase() === a.ticker.toUpperCase() && d.payment <= today)
          .reduce((s, d) => s + d.totalValue, 0);
        const ops = trades.filter((t) => t.ticker.toUpperCase() === a.ticker.toUpperCase()).length;
        return {
          asset: a,
          tirAnual: tir ? tir.annual : null,
          tirMes: tir ? tir.monthly : null,
          dividendos: divs,
          operacoes: ops,
        };
      })
      .sort((x, y) => {
        if (x.tirAnual == null && y.tirAnual == null) return y.asset.investedAmount - x.asset.investedAmount;
        if (x.tirAnual == null) return 1;
        if (y.tirAnual == null) return -1;
        return y.tirAnual - x.tirAnual;
      });
  }, [assets, trades, dividends, today]);

  const comTIR = assetRows.filter((r) => r.tirAnual != null).length;

  const chartData = anoRows.map((r) => ({
    year: String(r.year),
    "TIR do Ano": r.tirAno != null ? Math.round(r.tirAno * 10000) / 100 : null,
    "TIR Acumulada": r.tirAcum != null ? Math.round(r.tirAcum * 10000) / 100 : null,
  }));

  const chartPatrimonio = anoRows.map((r) => ({
    year: String(r.year),
    Patrimônio: Math.round(r.patrimonio),
    Aportado: Math.round(r.aportes),
    Dividendos: Math.round(r.dividendos),
  }));

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Percent className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-base">Rentabilidade & TIR</h1>
          <p className="text-xs text-muted">
            Taxa Interna de Retorno da carteira, ano a ano e por ativo — com a base de cálculo explicada
          </p>
        </div>
      </div>

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          icon={<Percent className="size-3.5" />}
          label="TIR Acumulada (a.a.)"
          value={pct(tirAcumulada?.annual)}
          color={colorOf(tirAcumulada?.annual)}
          hint={resumo.anos > 0 ? `período de ${resumo.anos.toFixed(1)} anos` : "—"}
        />
        <Card
          icon={<TrendingUp className="size-3.5" />}
          label="TIR Mensal Equivalente"
          value={pct(tirAcumulada?.monthly)}
          color={colorOf(tirAcumulada?.monthly)}
          hint="mesma taxa, em base mensal"
        />
        <Card
          icon={<Wallet className="size-3.5" />}
          label="Rentabilidade Simples"
          value={formatPercent(resumo.rentSimples)}
          color={resumo.rentSimples >= 0 ? "text-income" : "text-expense"}
          hint="(patrimônio + dividendos − aportado)"
        />
        <Card
          icon={<Calendar className="size-3.5" />}
          label="Período Analisado"
          value={resumo.primeira ? `${resumo.anos.toFixed(1)} anos` : "—"}
          color="text-foreground"
          hint={resumo.primeira ? `desde ${resumo.primeira.split("-").reverse().join("/")}` : "registre aportes"}
        />
        <Card
          icon={<ArrowDownRight className="size-3.5" />}
          label="Total Aportado"
          value={mask(resumo.aportesPositivos, hideValues)}
          color="text-foreground"
          hint={resumo.retiradas > 0 ? `retiradas: ${mask(resumo.retiradas, hideValues)}` : "soma dos aportes"}
        />
        <Card
          icon={<ArrowUpRight className="size-3.5" />}
          label="Dividendos Recebidos"
          value={mask(resumo.dividendos, hideValues)}
          color="text-income"
          hint="proventos pagos até hoje"
        />
        <Card
          icon={<Wallet className="size-3.5" />}
          label="Patrimônio Atual"
          value={mask(resumo.patrimonio, hideValues)}
          color="text-foreground"
          hint={`investido: ${mask(resumo.investido, hideValues)}`}
        />
        <Card
          icon={<TrendingUp className="size-3.5" />}
          label="Lucro Total"
          value={mask(resumo.lucro, hideValues)}
          color={resumo.lucro >= 0 ? "text-income" : "text-expense"}
          hint="ganho de capital + dividendos"
        />
      </div>

      {/* Gráfico TIR por ano */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm">TIR por Ano</h3>
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-blue-500" /> TIR do Ano</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-emerald-500" /> TIR Acumulada</span>
          </div>
        </div>
        <p className="text-[11px] text-muted mb-4">
          "TIR do Ano" = retorno do dinheiro investido naquele ano. "TIR Acumulada" = retorno total desde o primeiro aporte até 31/12 do ano.
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Nenhum dado de aportes/operações para calcular</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [v != null ? `${v.toFixed(2)}%` : "—", name]}
                />
                <Bar dataKey="TIR do Ano" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={(d["TIR do Ano"] ?? 0) >= 0 ? "#3b82f6" : "#ef4444"} />
                  ))}
                </Bar>
                <Bar dataKey="TIR Acumulada" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={(d["TIR Acumulada"] ?? 0) >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela ano a ano */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Ano a Ano</h3>
          <p className="text-[11px] text-muted mt-0.5">
            Valores do patrimônio de anos anteriores são estimados com as cotações atuais (não há histórico de preços).
          </p>
        </div>
        {anoRows.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Nenhum dado disponível</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs">
                  <th className="p-3 text-left font-medium">Ano</th>
                  <th className="p-3 text-right font-medium">Aportes</th>
                  <th className="p-3 text-right font-medium">Dividendos</th>
                  <th className="p-3 text-right font-medium hidden sm:table-cell">Patrimônio (31/12)</th>
                  <th className="p-3 text-right font-medium">TIR do Ano</th>
                  <th className="p-3 text-right font-medium">TIR Acumulada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {anoRows.map((r) => (
                  <tr key={r.year} className="hover:bg-card-hover transition-colors text-xs">
                    <td className="p-3 font-medium tabular">
                      {r.year}
                      {Number(today.slice(0, 4)) === r.year && (
                        <span className="ml-1.5 text-[10px] text-muted font-normal">parcial</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular">{mask(r.aportes, hideValues)}</td>
                    <td className="p-3 text-right tabular text-income">{mask(r.dividendos, hideValues)}</td>
                    <td className="p-3 text-right tabular hidden sm:table-cell">{mask(r.patrimonio, hideValues)}</td>
                    <td className={`p-3 text-right tabular font-medium ${colorOf(r.tirAno)}`}>{pct(r.tirAno)}</td>
                    <td className={`p-3 text-right tabular font-medium ${colorOf(r.tirAcum)}`}>{pct(r.tirAcum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TIR por ativo */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">TIR por Ativo</h3>
          <p className="text-[11px] text-muted mt-0.5">
            {comTIR} de {assetRows.length} ativo(s) com operações suficientes para calcular — ordenado do maior para o menor.
          </p>
        </div>
        {assetRows.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Nenhum ativo cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs">
                  <th className="p-3 text-left font-medium">Ativo</th>
                  <th className="p-3 text-right font-medium hidden sm:table-cell">Investido</th>
                  <th className="p-3 text-right font-medium hidden sm:table-cell">Valor Atual</th>
                  <th className="p-3 text-right font-medium hidden md:table-cell">Dividendos</th>
                  <th className="p-3 text-right font-medium">TIR (a.a.)</th>
                  <th className="p-3 text-right font-medium">TIR (mês)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assetRows.map(({ asset: a, tirAnual, tirMes, dividendos, operacoes }) => (
                  <tr key={a.id} className="hover:bg-card-hover transition-colors text-xs">
                    <td className="p-3">
                      <p className="font-medium">{a.ticker}</p>
                      <p className="text-[10px] text-muted">{a.type} · {operacoes} operação(ões)</p>
                    </td>
                    <td className="p-3 text-right tabular hidden sm:table-cell">{mask(a.investedAmount, hideValues)}</td>
                    <td className="p-3 text-right tabular hidden sm:table-cell">{mask(a.currentPrice * a.quantity, hideValues)}</td>
                    <td className="p-3 text-right tabular text-income hidden md:table-cell">{mask(dividendos, hideValues)}</td>
                    <td className={`p-3 text-right tabular font-medium ${colorOf(tirAnual)}`}>{pct(tirAnual)}</td>
                    <td className={`p-3 text-right tabular font-medium ${colorOf(tirMes)}`}>{pct(tirMes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patrimônio x Aportes por ano */}
      {chartPatrimonio.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-1">Patrimônio x Aportes por Ano</h3>
          <p className="text-[11px] text-muted mb-4">Para entender de onde vem o dinheiro que gera a TIR.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPatrimonio} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="Patrimônio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Aportado" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dividendos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-blue-500" /> Patrimônio</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-emerald-500" /> Aportado</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-amber-500" /> Dividendos</span>
          </div>
        </div>
      )}

      {/* Como interpretar */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Como Interpretar a TIR</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted leading-relaxed">
          <div className="space-y-2">
            <p><span className="text-foreground font-medium">O que é:</span> a TIR (Taxa Interna de Retorno) é a taxa que equilibra todos os seus fluxos — aportes (saídas), dividendos (entradas) e o patrimônio atual (valor final). Ela responde: <em>"a que taxa meu dinheiro realmente cresceu?"</em></p>
            <p><span className="text-foreground font-medium">Por que é melhor que a rentabilidade simples:</span> a TIR considera <em>quando</em> você aportou. Aportar R$ 1.000 todo mês por 2 anos não é a mesma coisa que aportar R$ 24.000 de uma só vez — a TIR reflete isso.</p>
            <p><span className="text-foreground font-medium">Base de cálculo desta página:</span> aportes da aba Aportes (saídas), dividendos pagos (entradas) e o patrimônio atual (valor final), usando a data real de cada evento (método XIRR).</p>
          </div>
          <div className="space-y-2">
            <p><span className="text-foreground font-medium">Como ler os números:</span></p>
            <ul className="space-y-1 list-disc pl-4">
              <li><span className="text-income font-medium">TIR &gt; 10% a.a.</span> — acima do CDI: retorno bom/consistente</li>
              <li><span className="text-foreground font-medium">TIR entre 6% e 10% a.a.</span> — rendimento razoável</li>
              <li><span className="text-yellow-500 font-medium">TIR entre 0% e 6% a.a.</span> — abaixo do CDI: talvez revisar</li>
              <li><span className="text-expense font-medium">TIR negativa</span> — prejuízo no período analisado</li>
            </ul>
            <p className="pt-1"><span className="text-foreground font-medium">Aviso:</span> para anos anteriores usamos a cotação atual como estimativa do patrimônio histórico (não há histórico de preços), então a TIR de anos passados é uma <em>aproximação</em>. A TIR acumulada até hoje é exata.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon, label, value, color, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 border-l-2 border-l-primary/60">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted">{icon}</span>
        <p className="text-[11px] text-muted leading-tight">{label}</p>
      </div>
      <p className={`text-lg font-bold tabular ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
