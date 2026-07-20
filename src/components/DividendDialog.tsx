import { useState } from "react";
import { addDividend } from "../store";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  tickers: string[];
}

const MOVEMENT_TYPES = ["DIVIDENDO", "JUROS S/CAPITAL", "RENDIMENTO", "AMORTIZAÇÃO", "OUTRO"];

export function DividendDialog({ onClose, tickers }: Props) {
  const [form, setForm] = useState({
    ticker: tickers[0] ?? "",
    type: "FII",
    name: "",
    payment: new Date().toISOString().slice(0, 10),
    movementType: "DIVIDENDO",
    totalValue: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(form.totalValue.replace(",", "."));
    if (!value || value <= 0) return;

    const pd = form.payment;
    const month = parseInt(pd.slice(5, 7));
    const year = parseInt(pd.slice(0, 4));

    addDividend({
      ticker: form.ticker.toUpperCase().trim(),
      type: form.type,
      monthYear: `${String(month).padStart(2, "0")}/${year}`,
      month,
      year,
      name: form.name.trim(),
      payment: form.payment,
      movementType: form.movementType,
      totalValue: value,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Novo Dividendo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Ticker</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => update("ticker", e.target.value)}
                list="ticker-list"
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <datalist id="ticker-list">
                {tickers.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="FII">FII</option>
                <option value="AÇÃO">AÇÃO</option>
                <option value="ETF">ETF</option>
                <option value="OUTRO">OUTRO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Data Pagamento</label>
              <input
                type="date"
                value={form.payment}
                onChange={(e) => update("payment", e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Tipo Movimento</label>
              <select
                value={form.movementType}
                onChange={(e) => update("movementType", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Nome do Ativo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="ALZR11"
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Valor Total Líquido (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.totalValue}
              onChange={(e) => update("totalValue", e.target.value)}
              placeholder="0,00"
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
