import { useMemo } from "react";
import type { Asset, DividendRecord, ContributionRecord } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { getDividendStats } from "../store";

interface Props {
  assets: Asset[];
  dividends: DividendRecord[];
  hideValues: boolean;
}

export function SmartRecommendations({ assets, dividends, hideValues }: Props) {
  const analysis = useMemo(() => {
    const tips: { type: "info" | "success" | "warning" | "danger"; title: string; text: string }[] = [];

    if (assets.length === 0) {
      tips.push({ type: "info", title: "Sem ativos", text: "Cadastre ou importe ativos para receber recomendações." });
      return tips;
    }

    const totalInvested = assets.reduce((s, a) => s + a.investedAmount, 0);
    const totalValue = assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);

    // Ativos abaixo da meta
    const belowGoal = assets.filter((a) => a.targetTotal > 0 && a.investedAmount < a.targetTotal);
    if (belowGoal.length > 0) {
      const sorted = belowGoal.sort((a, b) => (b.targetTotal - b.investedAmount) - (a.targetTotal - a.investedAmount));
      tips.push({
        type: "warning",
        title: "Ativos abaixo da meta",
        text: `${sorted.length} ativo(s) ainda não atingiram a meta. Destaque: ${sorted.slice(0, 3).map((a) => `${a.ticker} (falta ${formatCurrency(a.targetTotal - a.investedAmount)})`).join(", ")}.`,
      });
    }

    // Ativos que atingiram a meta
    const atGoal = assets.filter((a) => a.targetTotal > 0 && a.investedAmount >= a.targetTotal);
    if (atGoal.length > 0) {
      tips.push({
        type: "success",
        title: "Metas concluídas",
        text: `${atGoal.length} ativo(s) já atingiram a meta: ${atGoal.map((a) => a.ticker).join(", ")}. Considere redirecionar aportes para outros ativos.`,
      });
    }

    // Melhores dividendos
    const withDividend = assets.filter((a) => a.currentDividend > 0).sort((a, b) => b.currentDividend - a.currentDividend);
    if (withDividend.length > 0) {
      tips.push({
        type: "info",
        title: "Maiores pagadores de dividendos",
        text: `${withDividend[0].ticker} (${formatCurrency(withDividend[0].currentDividend)}/mês), ${withDividend[1]?.ticker ?? ""} (${withDividend[1] ? formatCurrency(withDividend[1].currentDividend) : ""}/mês).`,
      });
    }

    // Diversificação por tipo
    const byType: Record<string, number> = {};
    assets.forEach((a) => {
      byType[a.type] = (byType[a.type] || 0) + a.investedAmount;
    });
    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    if (typeEntries.length > 0) {
      const top = typeEntries[0];
      const topPct = totalInvested > 0 ? (top[1] / totalInvested) * 100 : 0;
      if (topPct > 70) {
        tips.push({
          type: "danger",
          title: "Concentração alta",
          text: `${top[0]} representa ${topPct.toFixed(0)}% da carteira. Considere diversificar para reduzir riscos.`,
        });
      }
    }

    // Diversificação por setor
    const bySector: Record<string, number> = {};
    assets.forEach((a) => {
      if (a.sector) bySector[a.sector] = (bySector[a.sector] || 0) + a.investedAmount;
    });
    const singleSector = Object.keys(bySector).length <= 1 && assets.length > 2;
    if (singleSector) {
      tips.push({
        type: "warning",
        title: "Pouca diversificação setorial",
        text: "Sua carteira está concentrada em poucos setores. Avalie expandir para outros segmentos.",
      });
    }

    // Rentabilidade
    const gain = totalValue - totalInvested;
    const rentPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;
    if (totalInvested > 0) {
      tips.push({
        type: rentPct >= 0 ? "success" : "danger",
        title: rentPct >= 0 ? "Rentabilidade positiva" : "Rentabilidade negativa",
        text: rentPct >= 0
          ? `Carteira valorizou ${formatPercent(rentPct)} (${formatCurrency(gain)}).`
          : `Carteira desvalorizou ${formatPercent(rentPct)} (${formatCurrency(Math.abs(gain))}).`,
      });
    }

    // Yield médio
    const totalMonthlyDividend = assets.reduce((s, a) => s + a.currentDividend, 0);
    const annualDividend = totalMonthlyDividend * 12;
    const yieldPct = totalInvested > 0 ? (annualDividend / totalInvested) * 100 : 0;
    if (yieldPct > 0) {
      tips.push({
        type: "info",
        title: "Yield médio da carteira",
        text: `${formatPercent(yieldPct)} ao ano sobre o total investido.`,
      });
    }

    // Dividendos recebidos
    const divStats = getDividendStats(dividends);
    if (divStats.total > 0) {
      tips.push({
        type: "success",
        title: "Total de dividendos recebidos",
        text: `Já recebeu ${formatCurrency(divStats.total)} em dividendos no período.`,
      });
    }

    // Ativos sem meta
    const noGoal = assets.filter((a) => !a.targetTotal || a.targetTotal <= 0);
    if (noGoal.length > 0) {
      tips.push({
        type: "warning",
        title: "Ativos sem meta",
        text: `${noGoal.length} ativo(s) não possuem meta definida: ${noGoal.slice(0, 5).map((a) => a.ticker).join(", ")}. Definir metas ajuda no planejamento.`,
      });
    }

    return tips;
  }, [assets, dividends]);

  const typeColors: Record<string, string> = {
    info: "border-l-blue-500 bg-blue-500/5",
    success: "border-l-emerald-500 bg-emerald-500/5",
    warning: "border-l-amber-500 bg-amber-500/5",
    danger: "border-l-red-500 bg-red-500/5",
  };

  const dotColors: Record<string, string> = {
    info: "bg-blue-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-4">Recomendações Inteligentes</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {analysis.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">Nenhuma recomendação disponível</p>
        ) : (
          analysis.map((tip, i) => (
            <div key={i} className={`border-l-2 rounded-xl px-4 py-3 ${typeColors[tip.type]}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`size-2 rounded-full shrink-0 ${dotColors[tip.type]}`} />
                <p className="text-xs font-medium">{tip.title}</p>
              </div>
              <p className="text-xs text-muted ml-4">{tip.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
