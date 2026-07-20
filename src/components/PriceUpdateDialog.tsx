import { useState } from "react";
import { updatePrices } from "../prices";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";

interface Props {
  assets: { id: string; ticker: string }[];
  onClose: () => void;
  onComplete: () => void;
}

interface UpdateStatus {
  ticker: string;
  status: 'pending' | 'ok' | 'error';
  price?: number;
}

export function PriceUpdateDialog({ assets, onClose, onComplete }: Props) {
  const [statuses, setStatuses] = useState<UpdateStatus[]>(
    assets.map((a) => ({ ticker: a.ticker, status: 'pending' as const }))
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpdate() {
    setRunning(true);
    await updatePrices(assets, (ticker, status, price) => {
      setStatuses((prev) =>
        prev.map((s) => (s.ticker === ticker ? { ...s, status, price } : s))
      );
    });
    setRunning(false);
    setDone(true);
  }

  const okCount = statuses.filter((s) => s.status === 'ok').length;
  const errorCount = statuses.filter((s) => s.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md mx-4">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Atualizar Cotações</h2>
          <p className="text-xs text-muted mt-1">Buscando preços ao vivo via brapi.dev</p>
        </div>

        <div className="p-5 max-h-72 overflow-y-auto space-y-1">
          {statuses.map((s) => (
            <div key={s.ticker} className="flex items-center justify-between py-1.5 text-sm">
              <span className="font-medium">{s.ticker}</span>
              <span className="flex items-center gap-1.5 text-xs">
                {s.status === 'pending' && <RefreshCw className="size-3.5 text-muted animate-spin" />}
                {s.status === 'ok' && <><Check className="size-3.5 text-income" /> {s.price != null && `R$ ${s.price.toFixed(2)}`}</>}
                {s.status === 'error' && <><AlertTriangle className="size-3.5 text-expense" /> Não encontrado</>}
              </span>
            </div>
          ))}
        </div>

        <div className="p-5 pt-0 flex items-center gap-3">
          {!done ? (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={running}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {running ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {running ? "Atualizando..." : `Atualizar ${assets.length} ativos`}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                Fechar
              </button>
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                {okCount > 0 ? `${okCount} ativos atualizados` : "Concluir"}
              </button>
            </>
          )}
        </div>
        {errorCount > 0 && done && (
          <p className="px-5 pb-4 text-xs text-muted">
            {errorCount} ativo(s) não encontrado(s) na API. Pode ser ticker incorreto ou fora do horário de negociação.
          </p>
        )}
      </div>
    </div>
  );
}
