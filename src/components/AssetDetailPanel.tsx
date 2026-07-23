import { useMemo } from "react";
import type { Asset, DividendRecord, TradeRecord } from "../types";
import { formatCurrency, formatDate, formatPercent } from "../format";
import { X } from "lucide-react";

interface Props {
  asset: Asset;
  dividends: DividendRecord[];
  trades: TradeRecord[];
  onClose: () => void;
}

export function AssetDetailPanel({ asset, dividends, trades, onClose }: Props) {
  const assetDividends = useMemo(() => dividends.filter((d) => d.ticker === asset.ticker), [dividends, asset.ticker]);
  const assetTrades = useMemo(() => trades.filter((t) => t.ticker === asset.ticker).sort((a, b) => b.date.localeCompare(a.date)), [trades, asset.ticker]);

  const totalDividendsReceived = assetDividends.reduce((s, d) => s + d.totalValue, 0);
  const currentValue = asset.currentPrice * asset.quantity;
  const gain = currentValue - asset.investedAmount;
  const rentPct = asset.investedAmount > 0 ? (gain / asset.investedAmount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto sm:mx-4 mx-0">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{asset.ticker}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <DetailCard label="Tipo" value={asset.type} />
            <DetailCard label="Setor" value={asset.sector || "—"} />
            <DetailCard label="Quantidade" value={String(asset.quantity)} />
            <DetailCard label="Preço Médio" value={formatCurrency(asset.avgPrice)} />
            <DetailCard label="Cotação Atual" value={formatCurrency(asset.currentPrice)} />
            <DetailCard label="Valor Investido" value={formatCurrency(asset.investedAmount)} />
            <DetailCard label="Valor Atual" value={formatCurrency(currentValue)} valueColor={gain >= 0 ? "text-income" : "text-expense"} />
            <DetailCard label="Lucro/Prejuízo" value={formatCurrency(gain)} valueColor={gain >= 0 ? "text-income" : "text-expense"} />
            <DetailCard label="Rentabilidade" value={formatPercent(rentPct)} valueColor={rentPct >= 0 ? "text-income" : "text-expense"} />
            <DetailCard label="Dividendo/Cota" value={formatCurrency(asset.dividendPerShare)} />
            <DetailCard label="Dividendo/Mês" value={formatCurrency(asset.currentDividend)} />
            <DetailCard label="Dividendo/Ano" value={formatCurrency(asset.annualReturn)} />
            <DetailCard label="DY Atual" value={asset.currentPrice > 0 ? formatPercent((asset.dividendPerShare / asset.currentPrice) * 100) : "0%"} />
            {asset.divYield12m != null && <DetailCard label="DY 12M" value={formatPercent(asset.divYield12m)} />}
            <DetailCard label="Meta" value={asset.goal || "—"} />
            {asset.targetTotal > 0 && <DetailCard label="Valor Meta" value={formatCurrency(asset.targetTotal)} />}
            {asset.targetTotal > 0 && <DetailCard label="% Meta" value={formatPercent(Math.min(100, (asset.investedAmount / asset.targetTotal) * 100))} />}
          </div>

          {/* Dividends received */}
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Dividendos Recebidos</p>
            {assetDividends.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">Nenhum dividendo registrado</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {assetDividends.slice(0, 30).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-xs px-2 py-1 bg-surface rounded-lg">
                    <span className="text-muted">{formatDate(d.payment)}</span>
                    <span className="font-medium tabular text-income">+{formatCurrency(d.totalValue)}</span>
                  </div>
                ))}
              </div>
            )}
            {totalDividendsReceived > 0 && (
              <p className="text-xs text-muted mt-2 text-right">Total: <span className="font-medium text-income">{formatCurrency(totalDividendsReceived)}</span></p>
            )}
          </div>

          {/* Recent trades */}
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Últimas Operações</p>
            {assetTrades.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">Nenhuma operação registrada</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {assetTrades.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs px-2 py-1 bg-surface rounded-lg">
                    <span className="text-muted">{formatDate(t.date)}</span>
                    <span className={t.operation === "COMPRA" ? "text-income" : "text-expense"}>{t.operation}</span>
                    <span className="tabular">{Math.abs(t.quantity)} x {formatCurrency(t.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-sm font-medium tabular ${valueColor ?? ""}`}>{value}</p>
    </div>
  );
}
