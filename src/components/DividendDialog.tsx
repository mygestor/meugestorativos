import { useState, useMemo, useCallback } from "react";
import { addDividend, getDividends, getAssets } from "../store";
import { fetchAssetName } from "../prices";
import { X } from "lucide-react";
import type { Asset } from "../types";

interface Props {
  onClose: () => void;
  tickers: string[];
}

const DEFAULT_MOVEMENT_TYPES = ["DIVIDENDO", "JUROS S/CAPITAL", "RENDIMENTO", "AMORTIZAÇÃO", "OUTRO"];

const RENAME_MOVEMENT_TYPES: Record<string, string> = {
  "REEMBOLSO - DIVIDENDOS": "REEMBOLSO - RENDIMENTO",
};

export function DividendDialog({ onClose, tickers }: Props) {
  const existingMovementTypes = useMemo(() => {
    const dividends = getDividends();
    const types = [...new Set(dividends.map((d) => RENAME_MOVEMENT_TYPES[d.movementType] || d.movementType).filter(Boolean))];
    return types.length > 0 ? types : DEFAULT_MOVEMENT_TYPES;
  }, []);

  const assets = useMemo(() => getAssets(), []);

  const [form, setForm] = useState({
    ticker: tickers[0] ?? "",
    type: "FII",
    name: "",
    payment: new Date().toISOString().slice(0, 10),
    movementType: existingMovementTypes[0] ?? "DIVIDENDO",
    totalValue: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(field: string, value: string) {
    setErrors((prev) => {
      const next = { ...prev };
      if (field === "ticker" && !value.trim()) next.ticker = "Obrigatório";
      else if (field === "ticker") delete next.ticker;
      if (field === "totalValue") {
        const v = parseFloat(value.replace(",", "."));
        if (!value.trim()) next.totalValue = "Obrigatório";
        else if (isNaN(v) || v <= 0) next.totalValue = "Valor inválido";
        else delete next.totalValue;
      }
      return next;
    });
  }

  function update(field: string, value: string) {
    validate(field, value);
    if (field === "ticker") {
      setForm((prev) => {
        const next = { ...prev, [field]: value.toUpperCase(), name: "" };
        const asset = assets.find((a) => a.ticker.toUpperCase() === value.toUpperCase());
        if (asset) {
          next.type = asset.type || prev.type;
        }
        return next;
      });
      fetchAssetName(value).then((name) => {
        if (name) setForm((prev) => ({ ...prev, name }));
      });
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(form.totalValue.replace(",", "."));
    const newErrors: Record<string, string> = {};
    if (!form.ticker.trim()) newErrors.ticker = "Obrigatório";
    if (!form.totalValue.trim()) newErrors.totalValue = "Obrigatório";
    else if (isNaN(value) || value <= 0) newErrors.totalValue = "Valor inválido";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 mx-0">
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
                className={`w-full px-3 py-2 bg-surface border rounded-xl text-sm focus:outline-none transition-colors ${errors.ticker ? "border-expense focus:border-expense" : "border-border focus:border-primary"}`}
              />
              {errors.ticker && <p className="text-[10px] text-expense">{errors.ticker}</p>}
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
                {existingMovementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
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
              className={`w-full px-3 py-2 bg-surface border rounded-xl text-sm focus:outline-none transition-colors ${errors.totalValue ? "border-expense focus:border-expense" : "border-border focus:border-primary"}`}
            />
            {errors.totalValue && <p className="text-[10px] text-expense">{errors.totalValue}</p>}
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
