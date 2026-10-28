// Cálculo de TIR — Taxa Interna de Retorno (método XIRR com datas reais)
//
// Fluxos de caixa:
//   value < 0 → saída de dinheiro (ex.: aporte)
//   value > 0 → entrada de dinheiro (ex.: dividendo recebido, patrimônio atual)
//
// A TIR é a taxa que faz o VP (valor presente) dos fluxos zerar.

export interface CashFlow {
  date: string; // YYYY-MM-DD
  value: number;
}

const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

function toTime(date: string): number {
  // Interpreta como data local para evitar deslocamento de fuso
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/** Valor presente (XNPV) dos fluxos a uma dada taxa anual. */
function xnpv(rate: number, flows: CashFlow[]): number {
  const t0 = toTime(flows[0].date);
  let sum = 0;
  for (const f of flows) {
    const years = (toTime(f.date) - t0) / MS_PER_YEAR;
    sum += f.value / Math.pow(1 + rate, years);
  }
  return sum;
}

/**
 * Calcula a TIR anual e a mensal equivalente.
 * Retorna null quando não há fluxos suficientes ou nenhum sinal troca
 * (ex.: apenas aportes, sem patrimônio/dividendos).
 */
export function calcTIR(flows: CashFlow[]): { annual: number; monthly: number } | null {
  const sorted = flows
    .filter((f) => f.value !== 0 && !isNaN(toTime(f.date)))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return null;
  if (!sorted.some((f) => f.value > 0)) return null; // sem entradas
  if (!sorted.some((f) => f.value < 0)) return null; // sem saídas

  // Busca por bisseção: NPV(-1+) > 0 e NPV(alta) < 0 normalmente
  let lo = -0.999999;
  let hi = 10;

  // Garante sinal oposto em hi (amplia até o VP ficar negativo)
  let guard = 0;
  while (xnpv(hi, sorted) > 0 && guard++ < 40) hi *= 4;

  if (xnpv(lo, sorted) < 0 || xnpv(hi, sorted) > 0) return null;

  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (xnpv(mid, sorted) > 0) lo = mid;
    else hi = mid;
  }

  const annual = (lo + hi) / 2;
  const monthly = Math.pow(1 + annual, 1 / 12) - 1;
  return { annual, monthly };
}
