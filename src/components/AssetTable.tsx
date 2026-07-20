import type { Asset } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { deleteAsset } from "../store";
import { Pencil, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PriceUpdateDialog } from "./PriceUpdateDialog";

interface Props {
  assets: Asset[];
  hideValues: boolean;
  onEdit: (asset: Asset) => void;
  onRefresh: () => void;
}

function mask(v: number, hidden: boolean) {
  return hidden ? "R$ ••••" : formatCurrency(v);
}

export function AssetTable({ assets, hideValues, onEdit, onRefresh }: Props) {
  const [sortField, setSortField] = useState<keyof Asset>("currentDividend");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);

  const sorted = [...assets].sort((a, b) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    return sortAsc ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
  });

  function toggleSort(field: keyof Asset) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function SortHeader({ field, label, className }: { field: keyof Asset; label: string; className?: string }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 transition-colors whitespace-nowrap ${active ? "text-primary" : "hover:text-foreground"} ${className}`}>
        <span className="text-xs font-medium">{label}</span>
        {active && (sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
        {!active && <ChevronUp className="size-3 text-transparent" />}
      </button>
    );
  }

  async function handleDelete(id: string, ticker: string) {
    if (confirm(`Excluir ${ticker}?`)) {
      deleteAsset(id);
      onRefresh();
    }
  }

  function yieldColor(pct: number) {
    if (pct > 1) return "text-green-500";
    if (pct > 0.5) return "text-yellow-500";
    return "text-red-500";
  }

  if (assets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center">
        <p className="text-muted mb-2">Nenhum ativo cadastrado</p>
        <p className="text-sm text-muted">Clique em "Novo Ativo" para começar</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">{assets.length} ativos</p>
          <button
            onClick={() => setPriceOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-muted hover:text-foreground text-xs transition-colors"
            title="Atualizar cotações ao vivo"
          >
            <RefreshCw className="size-3.5" /> Atualizar Preços
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-left"><SortHeader field="ticker" label="Ativo" /></th>
                <th className="p-3 text-left hidden sm:table-cell"><SortHeader field="type" label="Tipo" /></th>
                <th className="p-3 text-right"><SortHeader field="currentPrice" label="Cotação" /></th>
                <th className="p-3 text-right"><SortHeader field="dividendPerShare" label="Dividendo" /></th>
                <th className="p-3 text-right"><SortHeader field="quantity" label="Qtd" /></th>
                <th className="p-3 text-right hidden md:table-cell"><SortHeader field="investedAmount" label="Investido" /></th>
                <th className="p-3 text-right"><SortHeader field="currentDividend" label="Dividendo/Mês" /></th>
                <th className="p-3 text-right hidden lg:table-cell"><SortHeader field="annualReturn" label="Retorno/Ano" /></th>
                <th className="p-3 text-center"><SortHeader field="goal" label="Meta" /></th>
                <th className="p-3 text-right w-20" />
              </tr>
            </thead>
            {sorted.map((a) => {
              const isExpanded = expanded === a.id;
              const yieldPct = a.currentPrice > 0 ? (a.dividendPerShare / a.currentPrice) * 100 : 0;
              const goalProgress = a.investedAmount > 0 && a.targetTotal > 0 ? Math.min(100, (a.investedAmount / a.targetTotal) * 100) : 0;
              const currentValue = a.currentPrice * a.quantity;
              const valueColor = currentValue >= a.investedAmount ? "text-income" : "text-expense";
              return (
                <tbody key={a.id} className="even:bg-surface/30">
                  <tr
                    className="hover:bg-card-hover transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : a.id)}
                  >
                    <td className="p-3">
                      <div>
                        <p className="font-semibold text-sm">{a.ticker}</p>
                        <p className="text-xs text-muted hidden sm:block">{a.sector}</p>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className="text-xs bg-surface px-2 py-1 rounded-lg">{a.type}</span>
                    </td>
                    <td className="p-3 text-right tabular font-medium">{mask(a.currentPrice, hideValues)}</td>
                    <td className="p-3 text-right tabular">
                      <p className="font-medium">{mask(a.dividendPerShare, hideValues)}</p>
                      <p className={`text-xs ${yieldPct >= 0 ? yieldColor(yieldPct) : ""}`}>{yieldPct >= 0 ? `${yieldPct.toFixed(2)}%` : ""}</p>
                    </td>
                    <td className="p-3 text-right tabular">{a.quantity}</td>
                    <td className="p-3 text-right tabular hidden md:table-cell">{mask(a.investedAmount, hideValues)}</td>
                    <td className="p-3 text-right tabular font-medium text-income">{mask(a.currentDividend, hideValues)}</td>
                    <td className="p-3 text-right tabular hidden lg:table-cell">
                      <p className="font-medium">{mask(a.annualReturn, hideValues)}</p>
                      <p className="text-xs text-muted">
                        {a.investedAmount > 0 ? formatPercent((a.annualReturn / a.investedAmount) * 100) : ""}
                      </p>
                    </td>
                    <td className="p-3 text-center">
                      <GoalBadge goal={a.goal} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(a); }}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(a.id, a.ticker); }}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-expense transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="p-4 bg-surface/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <DetailItem label="Preço Médio" value={mask(a.avgPrice, hideValues)} />
                          <DetailItem label="Total Necessário" value={mask(a.targetTotal, hideValues)} />
                          <DetailItem label="Cotas Necessárias" value={String(a.sharesNeeded)} />
                          <DetailItem label="Falta" value={mask(a.missing, hideValues)} />
                          <DetailItem label="DY (12M)" value={a.divYield12m ? `${a.divYield12m.toFixed(2)}%` : "-"} />
                          <DetailItem label="Dia Pagamento" value={a.paymentDay ? `Dia ${a.paymentDay}` : "-"} />
                          <div>
                            <p className="text-muted mb-0.5">Valor Atual</p>
                            <p className={`font-medium tabular ${valueColor}`}>{mask(currentValue, hideValues)}</p>
                          </div>
                          <DetailItem
                            label="Retorno s/ Investido"
                            value={a.investedAmount > 0
                              ? formatPercent(((currentValue - a.investedAmount) / a.investedAmount) * 100)
                              : "-"}
                          />
                        </div>
                        {a.status && (
                          <p className="text-xs text-muted mt-3">Status: {a.status}</p>
                        )}
                        {a.targetTotal > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-muted mb-1">
                              <span>Progresso</span>
                              <span>{goalProgress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
      {priceOpen && <PriceUpdateDialog assets={assets} onClose={() => setPriceOpen(false)} onComplete={onRefresh} />}
    </>
  );
}

function GoalBadge({ goal }: { goal: string }) {
  if (goal === "PAUSAR") {
    return <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-lg font-medium">PAUSAR</span>;
  }
  const num = Number(goal);
  if (!isNaN(num) && num > 0) {
    return <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg font-medium">{num}</span>;
  }
  return <span className="text-xs text-muted">-</span>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted mb-0.5">{label}</p>
      <p className="font-medium tabular">{value}</p>
    </div>
  );
}
