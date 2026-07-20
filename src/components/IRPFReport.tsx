import { useMemo } from "react";
import type { TradeRecord, DividendRecord, Asset } from "../types";
import { formatCurrency, formatDate } from "../format";
import { getAssets } from "../store";
import { Download, X, FileSpreadsheet } from "lucide-react";

interface Props {
  trades: TradeRecord[];
  dividends: DividendRecord[];
  onClose: () => void;
}

interface MonthSummary {
  buyTotal: number;
  sellTotal: number;
  sellGain: number;
  irrfTotal: number;
  dayTradeGain: number;
  count: number;
}

interface YearData {
  buyTotal: number;
  sellTotal: number;
  sellGain: number;
  irrfTotal: number;
  dayTradeGain: number;
  divTotal: number;
  divByType: Record<string, number>;
  byType: Record<string, { buyTotal: number; sellTotal: number; sellGain: number; count: number }>;
  byMonth: Record<string, MonthSummary>;
  byMonthByType: Record<string, Record<string, MonthSummary>>;
  trades: TradeRecord[];
  dividends: DividendRecord[];
}

export function IRPFReport({ trades, dividends, onClose }: Props) {
  const assets = getAssets();

  // Group trades by year, type, month; detect day-trades
  const yearlyData = useMemo(() => {
    const years: Record<string, YearData> = {};

    // Day-trade detection: find same-date buy+sell per ticker
    const dayTradeDates = new Set<string>();
    const tradesByDateTicker: Record<string, string[]> = {};
    for (const t of trades) {
      const key = `${t.date}-${t.ticker}`;
      if (!tradesByDateTicker[key]) tradesByDateTicker[key] = [];
      tradesByDateTicker[key].push(t.operation);
    }
    for (const [key, ops] of Object.entries(tradesByDateTicker)) {
      if (ops.includes("COMPRA") && ops.includes("VENDA")) {
        dayTradeDates.add(key);
      }
    }

    for (const t of trades) {
      const year = t.date.slice(0, 4);
      const month = t.date.slice(0, 7);
      const dtKey = `${t.date}-${t.ticker}`;
      const isDayTrade = dayTradeDates.has(dtKey);
      const type = (assets.find((a) => a.ticker === t.ticker)?.type) || "AÇÃO";

      if (!years[year]) years[year] = {
        buyTotal: 0, sellTotal: 0, sellGain: 0, irrfTotal: 0, dayTradeGain: 0,
        divTotal: 0, divByType: {},
        byType: {}, byMonth: {}, byMonthByType: {}, trades: [], dividends: [],
      };
      years[year].trades.push(t);

      const gain = t.operation === "VENDA" ? t.totalWithFees - t.avgPrice * Math.abs(t.quantity) : 0;
      if (t.operation === "COMPRA") {
        years[year].buyTotal += t.totalWithFees;
      } else {
        years[year].sellTotal += t.totalWithFees;
        years[year].sellGain += gain;
        if (isDayTrade) years[year].dayTradeGain += gain;
      }
      years[year].irrfTotal += t.irrf;

      // By type
      if (!years[year].byType[type]) years[year].byType[type] = { buyTotal: 0, sellTotal: 0, sellGain: 0, count: 0 };
      years[year].byType[type].count++;
      if (t.operation === "COMPRA") years[year].byType[type].buyTotal += t.totalWithFees;
      else {
        years[year].byType[type].sellTotal += t.totalWithFees;
        years[year].byType[type].sellGain += t.totalWithFees - t.avgPrice * Math.abs(t.quantity);
      }

      // By month
      if (!years[year].byMonth[month]) years[year].byMonth[month] = { buyTotal: 0, sellTotal: 0, sellGain: 0, irrfTotal: 0, dayTradeGain: 0, count: 0 };
      years[year].byMonth[month].count++;
      if (t.operation === "COMPRA") years[year].byMonth[month].buyTotal += t.totalWithFees;
      else {
        years[year].byMonth[month].sellTotal += t.totalWithFees;
        years[year].byMonth[month].sellGain += t.totalWithFees - t.avgPrice * Math.abs(t.quantity);
        if (isDayTrade) years[year].byMonth[month].dayTradeGain += gain;
      }
      years[year].byMonth[month].irrfTotal += t.irrf;

      // By month + type (critical: R$20k rule is only for Ações, not FII)
      if (!years[year].byMonthByType[month]) years[year].byMonthByType[month] = {};
      if (!years[year].byMonthByType[month][type]) {
        years[year].byMonthByType[month][type] = { buyTotal: 0, sellTotal: 0, sellGain: 0, irrfTotal: 0, dayTradeGain: 0, count: 0 };
      }
      years[year].byMonthByType[month][type].count++;
      if (t.operation === "COMPRA") years[year].byMonthByType[month][type].buyTotal += t.totalWithFees;
      else {
        years[year].byMonthByType[month][type].sellTotal += t.totalWithFees;
        years[year].byMonthByType[month][type].sellGain += t.totalWithFees - t.avgPrice * Math.abs(t.quantity);
        if (isDayTrade) years[year].byMonthByType[month][type].dayTradeGain += gain;
      }
      years[year].byMonthByType[month][type].irrfTotal += t.irrf;
    }

    for (const d of dividends) {
      const year = d.payment.slice(0, 4);
      if (!years[year]) years[year] = {
        buyTotal: 0, sellTotal: 0, sellGain: 0, irrfTotal: 0, dayTradeGain: 0,
        divTotal: 0, divByType: {},
        byType: {}, byMonth: {}, byMonthByType: {}, trades: [], dividends: [],
      };
      years[year].dividends.push(d);
      years[year].divTotal += d.totalValue;
      const type = d.movementType || "DIVIDENDO";
      years[year].divByType[type] = (years[year].divByType[type] || 0) + d.totalValue;
    }

    return Object.entries(years).sort(([a], [b]) => b.localeCompare(a));
  }, [trades, dividends, assets]);

  // Bens e Direitos atuais
  const bensAtuais = useMemo(() => {
    const grupos: Record<string, Asset[]> = {};
    for (const a of assets) {
      const grupo = grupoBensMap[a.type] || "99 - Outros";
      if (!grupos[grupo]) grupos[grupo] = [];
      grupos[grupo].push(a);
    }
    return grupos;
  }, [assets]);

  function getIRPFCodigo(type: string): string {
    const map: Record<string, string> = {
      AÇÃO: "31 - Ações (inclusive FIIs listados em Bolsa)",
      FII: "31 - Ações (inclusive FIIs listados em Bolsa)",
      ETF: "31 - Ações (inclusive FIIs listados em Bolsa)",
      BDR: "31 - Ações (inclusive FIIs listados em Bolsa)",
    };
    return map[type] || "99 - Outros bens e direitos";
  }

  function generateReport() {
    const lines: string[] = [];
    const now = new Date();
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("  RELATÓRIO IRPF 2025 - GESTOR DE ATIVOS");
    lines.push("  Para declaração do Imposto de Renda Pessoa Física");
    lines.push(`  Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`);
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("");

    // =========================================
    // 1. BENS E DIREITOS
    // =========================================
    lines.push("┌─────────────────────────────────────────────────────┐");
    lines.push("│ 1. BENS E DIREITOS (posição atual)                 │");
    lines.push("└─────────────────────────────────────────────────────┘");
    lines.push("");

    let totalBens = 0;
    for (const [grupo, ativos] of Object.entries(bensAtuais)) {
      const grupTotal = ativos.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
      totalBens += grupTotal;
      lines.push(`  Código: ${grupo}`);
      lines.push(`  ${"─".repeat(60)}`);
      lines.push("  Ticker  │  Qtd  │  Preço Médio  │  Total (31/12)");
      lines.push(`  ${"─".repeat(60)}`);
      for (const a of ativos) {
        const total = a.currentPrice * a.quantity;
        lines.push(`  ${a.ticker.padEnd(7)}│ ${String(a.quantity).padStart(5)}│ ${formatCurrency(a.avgPrice).padStart(13)}│ ${formatCurrency(total).padStart(13)}`);
      }
      lines.push(`  ${"─".repeat(60)}`);
      lines.push(`  Subtotal: ${formatCurrency(grupTotal)}`);
      lines.push("");
    }

    lines.push(`  TOTAL BENS E DIREITOS: ${formatCurrency(totalBens)}`);
    lines.push("");

    // =========================================
    // 2. RENDA VARIÁVEL - Operações
    // =========================================
    lines.push("┌─────────────────────────────────────────────────────┐");
    lines.push("│ 2. RENDA VARIÁVEL - Operações em Bolsa             │");
    lines.push("└─────────────────────────────────────────────────────┘");
    lines.push("");

    for (const [year, data] of yearlyData) {
      if (data.trades.length === 0) continue;
      lines.push(`  ANO ${year}${"─".repeat(50)}`);
      lines.push("");

      // Monthly summary
      const months = Object.entries(data.byMonth).sort(([a], [b]) => a.localeCompare(b));
      for (const [month, mData] of months) {
        const monthName = new Date(month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const totalSold = mData.sellTotal;
        const netGain = mData.sellGain;
        const isExempt = totalSold <= 20000;
        const isLoss = netGain < 0;

        lines.push(`  Mês: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`);
        lines.push(`  ${"·".repeat(45)}`);
        lines.push(`    Total de Vendas:     ${formatCurrency(totalSold)}`);
        lines.push(`    Total de Compras:    ${formatCurrency(mData.buyTotal)}`);
        lines.push(`    Ganho Líquido:       ${netGain >= 0 ? "+" : ""}${formatCurrency(netGain)}`);
        lines.push(`    IRRF Retido na Fonte: ${formatCurrency(mData.irrfTotal)}`);
        lines.push(`    ${isExempt ? "✓ Isento (vendas ≤ R$ 20.000)" : "✗ Tributável (vendas > R$ 20.000)"}`);
        if (isExempt) {
          lines.push(`      Ações: ISENTO - vendas no mês abaixo de R$ 20.000`);
        } else if (isLoss) {
          lines.push(`      Prejuízo - não há imposto a pagar. Compensar em meses futuros.`);
        }
        lines.push("");
      }

      // Annual summary by type
      lines.push(`  Resumo por Tipo de Ativo (${year}):`);
      lines.push(`  ${"─".repeat(50)}`);
      lines.push("  Tipo  │  Compras  │  Vendas  │  Ganho/Perda  │  Qtd Operações");
      lines.push(`  ${"─".repeat(50)}`);
      for (const [type, typeData] of Object.entries(data.byType)) {
        lines.push(`  ${type.padEnd(6)}│ ${formatCurrency(typeData.buyTotal).padStart(9)}│ ${formatCurrency(typeData.sellTotal).padStart(9)}│ ${(typeData.sellGain >= 0 ? "+" : "").padStart(1)}${formatCurrency(typeData.sellGain).padStart(11)}│ ${String(typeData.count).padStart(5)}`);
      }
      lines.push(`  ${"─".repeat(50)}`);
      lines.push(`  TOTAL:   ${formatCurrency(data.buyTotal).padStart(8)}  ${formatCurrency(data.sellTotal).padStart(9)}  ${(data.sellGain >= 0 ? "+" : "")}${formatCurrency(data.sellGain)}  IRRF: ${formatCurrency(data.irrfTotal)}`);
      lines.push("");

      // Detailed trades
      lines.push(`  Detalhamento de Operações (${year}):`);
      lines.push(`  ${"─".repeat(80)}`);
      const sortedTrades = [...data.trades].sort((a, b) => a.date.localeCompare(b.date));
      for (const t of sortedTrades) {
        const assetType = assets.find((a) => a.ticker === t.ticker)?.type || "AÇÃO";
        lines.push(`  ${formatDate(t.date)} │ ${t.ticker.padEnd(7)}│ ${t.operation.padEnd(7)}│ ${String(Math.abs(t.quantity)).padStart(5)}│ ${formatCurrency(t.price).padStart(9)}│ ${formatCurrency(t.totalWithFees).padStart(11)}│ ${assetType}`);
      }
      lines.push("");
    }

    // =========================================
    // 3. DIVIDENDOS - Rendimentos Isentos
    // =========================================
    lines.push("┌─────────────────────────────────────────────────────┐");
    lines.push("│ 3. RENDIMENTOS ISENTOS / NÃO TRIBUTÁVEIS           │");
    lines.push("│    Dividendos, JCP, Rendimentos de FII             │");
    lines.push("└─────────────────────────────────────────────────────┘");
    lines.push("");

    for (const [year, data] of yearlyData) {
      if (data.dividends.length === 0) continue;

      lines.push(`  ANO ${year}${"─".concat("─".repeat(50))}`);
      lines.push(`  Total de Rendimentos: ${formatCurrency(data.divTotal)}`);
      lines.push("");

      // By type
      if (Object.keys(data.divByType).length > 0) {
        lines.push("  Por Tipo:");
        for (const [type, total] of Object.entries(data.divByType)) {
          lines.push(`    ${type.padEnd(25)} ${formatCurrency(total)}`);
        }
        lines.push("");
      }

      // Detail
      lines.push("  Detalhamento:");
      lines.push(`  ${"─".repeat(65)}`);
      lines.push("  Data       │ Ticker    │ Valor       │ Tipo");
      lines.push(`  ${"─".repeat(65)}`);
      const sortedDivs = [...data.dividends].sort((a, b) => a.payment.localeCompare(b.payment));
      for (const d of sortedDivs) {
        lines.push(`  ${formatDate(d.payment).padEnd(11)}│ ${d.ticker.padEnd(9)}│ ${formatCurrency(d.totalValue).padStart(10)}│ ${(d.movementType || "DIVIDENDO")}`);
      }
      lines.push("");
    }

    // =========================================
    // 4. INFORMAÇÕES ADICIONAIS
    // =========================================
    lines.push("┌─────────────────────────────────────────────────────┐");
    lines.push("│ 4. INFORMAÇÕES ADICIONAIS                          │");
    lines.push("└─────────────────────────────────────────────────────┘");
    lines.push("");
    lines.push("  ⚠ Este relatório é um auxílio para a declaração.");
    lines.push("  ⚠ Consulte um contador ou a Receita Federal para");
    lines.push("     validação dos valores declarados.");
    lines.push("  ⚠ Ações/FIIs listados em Bolsa: código 31 na ficha");
    lines.push("     de Bens e Direitos.");
    lines.push("  ⚠ Dividendos e JCP: Rendimentos Isentos e Não");
    lines.push("     Tributáveis (Linha 9 - Lucros e Dividendos).");
    lines.push("  ⚠ Rendimentos de FII: tributados exclusivamente");
    lines.push("     na fonte (come-cotas).");
    lines.push("");

    // Final
    lines.push("═══════════════════════════════════════════════════════");
    lines.push("  Fim do Relatório");
    lines.push("═══════════════════════════════════════════════════════");

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `irpf-gestor-ativos-${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function generateCSV() {
    const lines: string[] = [];
    // Headers
    lines.push("Tipo;Ano;Data;Ticker;Operação;Quantidade;Preço;Total;Taxas;IRRF;Categoria");

    // Trades
    for (const [year, data] of yearlyData) {
      for (const t of data.trades) {
        const tipo = assets.find((a) => a.ticker === t.ticker)?.type || "AÇÃO";
        lines.push([
          "Trade", year, formatDate(t.date), t.ticker,
          t.operation, Math.abs(t.quantity), t.price,
          t.totalWithFees, t.fees, t.irrf, tipo,
        ].join(";"));
      }
    }

    // Dividends
    for (const [, data] of yearlyData) {
      for (const d of data.dividends) {
        lines.push([
          "Dividendo", d.payment.slice(0, 4), formatDate(d.payment), d.ticker,
          d.movementType || "DIVIDENDO", "", "",
          d.totalValue, "", "", "",
        ].join(";"));
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `irpf-dados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Relatório IRPF</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Gere um relatório completo para auxiliar na declaração do Imposto de Renda, incluindo:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoCard number="1" title="Bens e Direitos" desc="Posição atual dos ativos com código IRPF (31 - Ações/FIIs)" />
            <InfoCard number="2" title="Renda Variável" desc="Operações mensais com apuração de ganho/perda e IRRF" />
            <InfoCard number="3" title="Rendimentos Isentos" desc="Dividendos, JCP e outros proventos por ano" />
            <InfoCard number="4" title="Importar para Excel" desc="CSV com todos os trades e dividendos para análise" />
          </div>

          {yearlyData.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">Nenhum trade ou dividendo registrado</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Dados disponíveis</p>
              {yearlyData.map(([year, data]) => (
                <div key={year} className="bg-surface rounded-xl px-3 py-2 text-xs">
                  <p className="font-medium mb-0.5">{year}</p>
                  <p className="text-muted">
                    {data.trades.length} operações • {data.dividends.length} dividendos •
                    Vendas: {formatCurrency(data.sellTotal)} • IRRF: {formatCurrency(data.irrfTotal)} •
                    Rendimentos: {formatCurrency(data.divTotal)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={generateReport}
              disabled={yearlyData.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <Download className="size-4" /> Baixar Relatório (.txt)
            </button>
            <button
              onClick={generateCSV}
              disabled={yearlyData.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-card text-foreground border border-border hover:bg-card-hover transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="size-4" /> Exportar CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const grupoBensMap: Record<string, string> = {
  AÇÃO: "31 - Ações (inclusive FIIs listados em Bolsa)",
  FII: "31 - Ações (inclusive FIIs listados em Bolsa)",
  ETF: "31 - Ações (inclusive FIIs listados em Bolsa)",
  BDR: "31 - Ações (inclusive FIIs listados em Bolsa)",
  Tesouro: "41 - Títulos públicos e privados",
  CDB: "41 - Títulos públicos e privados",
  LCI: "41 - Títulos públicos e privados",
  LCA: "41 - Títulos públicos e privados",
};

function InfoCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2.5 flex items-start gap-3">
      <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
        {number}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
    </div>
  );
}
