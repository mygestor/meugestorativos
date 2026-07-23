import { useMemo, useState } from "react";
import type { Asset, Lot } from "../types";
import { getLots, getTrades, addLot } from "../store";
import { formatCurrency, formatDate } from "../format";
import { Layers, Trash2, X, CircleHelp } from "lucide-react";

interface Props {
  asset: Asset;
  onClose: () => void;
}

export function LotsView({ asset, onClose }: Props) {
  const lots = useMemo(() => getLots().filter((l) => l.ticker.toUpperCase() === asset.ticker.toUpperCase()), [asset.ticker]);
  const activeLots = lots.filter((l) => l.remaining > 0);
  const consumedLots = lots.filter((l) => l.remaining <= 0);

  const totalRemaining = activeLots.reduce((s, l) => s + l.remaining, 0);
  const totalInvested = activeLots.reduce((s, l) => s + l.remaining * (l.price + l.fees / l.quantity), 0);
  const avgCost = totalRemaining > 0 ? totalInvested / totalRemaining : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto sm:mx-4 mx-0">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Lotes - {asset.ticker}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface rounded-xl px-3 py-2">
              <p className="text-[11px] text-muted">Lotes Ativos</p>
              <p className="text-sm font-bold tabular">{activeLots.length}</p>
            </div>
            <div className="bg-surface rounded-xl px-3 py-2">
              <p className="text-[11px] text-muted">Cotas Restantes</p>
              <p className="text-sm font-bold tabular">{totalRemaining}</p>
            </div>
            <div className="bg-surface rounded-xl px-3 py-2">
              <p className="text-[11px] text-muted">Preço Médio</p>
              <p className="text-sm font-bold tabular">{formatCurrency(avgCost)}</p>
            </div>
          </div>

          {/* Active lots */}
          {activeLots.length > 0 && (
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Lotes Ativos (FIFO)</p>
              <div className="space-y-1.5">
                {activeLots.map((lot) => (
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}

          {/* Consumed lots */}
          {consumedLots.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted font-medium uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-2">
                <span>Lotes Consumidos ({consumedLots.length})</span>
                <CircleHelp className="size-3" />
              </summary>
              <div className="space-y-1 mt-2">
                {consumedLots.slice(-10).reverse().map((lot) => (
                  <LotCard key={lot.id} lot={lot} consumed />
                ))}
              </div>
            </details>
          )}

          {lots.length === 0 && (
            <p className="text-xs text-muted text-center py-4">
              Nenhum lote encontrado. Lotes são criados automaticamente ao registrar compras.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LotCard({ lot, consumed }: { lot: Lot; consumed?: boolean }) {
  const costPerShare = lot.price + lot.fees / lot.quantity;
  return (
    <div className={`bg-surface rounded-xl px-3 py-2 text-xs ${consumed ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{formatDate(lot.purchaseDate)}</span>
        <span className="tabular text-muted">
          {lot.remaining}/{lot.quantity} cotas
        </span>
      </div>
      <div className="flex items-center justify-between text-muted mt-0.5">
        <span>Preço: {formatCurrency(lot.price)}</span>
        <span>Custo total: {formatCurrency(costPerShare * lot.remaining)}</span>
      </div>
      {lot.fees > 0 && (
        <p className="text-muted text-[10px]">Taxas: {formatCurrency(lot.fees)}</p>
      )}
    </div>
  );
}
