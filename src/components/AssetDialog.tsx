import { useState, useEffect } from "react";
import type { Asset } from "../types";
import { addAsset, updateAsset } from "../store";
import { detectAssetType } from "../detectType";
import { X } from "lucide-react";

interface Props {
  asset: Asset | null;
  onClose: () => void;
}

const EMPTY_FORM = {
  ticker: "",
  type: "FII",
  subtype: "",
  sector: "",
  paymentDay: "",
  currentPrice: "",
  dividendPerShare: "",
  targetTotal: "",
  sharesNeeded: "",
  avgPrice: "",
  quantity: "",
  goal: "PAUSAR",
  investedAmount: "0",
  missing: "0",
  currentDividend: "0",
  annualReturn: "0",
  divYield12m: "",
  representation: "0",
  percentInPortfolio: "0",
  status: "",
  magicMonth: "0",
  magicNumber: "0",
};

type FormData = typeof EMPTY_FORM;

export function AssetDialog({ asset, onClose }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (asset) {
      setForm({
        ticker: asset.ticker,
        type: asset.type,
        subtype: asset.subtype ?? "",
        sector: asset.sector ?? "",
        paymentDay: asset.paymentDay?.toString() ?? "",
        currentPrice: asset.currentPrice.toString(),
        dividendPerShare: asset.dividendPerShare.toString(),
        targetTotal: asset.targetTotal.toString(),
        sharesNeeded: asset.sharesNeeded.toString(),
        avgPrice: asset.avgPrice.toString(),
        quantity: asset.quantity.toString(),
        goal: asset.goal,
        investedAmount: asset.investedAmount.toString(),
        missing: asset.missing.toString(),
        currentDividend: asset.currentDividend.toString(),
        annualReturn: asset.annualReturn.toString(),
        divYield12m: asset.divYield12m?.toString() ?? "",
        representation: asset.representation.toString(),
        percentInPortfolio: asset.percentInPortfolio.toString(),
        status: asset.status ?? "",
        magicMonth: asset.magicMonth.toString(),
        magicNumber: asset.magicNumber.toString(),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [asset]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-calculate derived fields
      const qty = parseFloat(next.quantity) || 0;
      const price = parseFloat(next.currentPrice) || 0;
      const divPerShare = parseFloat(next.dividendPerShare) || 0;
      const avgP = parseFloat(next.avgPrice) || price;
      const totalTarget = parseFloat(next.targetTotal) || 0;
      const invested = avgP * qty;

      next.investedAmount = invested.toFixed(2);
      next.currentDividend = (qty * divPerShare).toFixed(2);
      next.annualReturn = (qty * divPerShare * 12).toFixed(2);

      if (totalTarget > 0 && price > 0) {
        next.sharesNeeded = Math.ceil(totalTarget / price).toString();
        next.missing = Math.max(0, totalTarget - invested).toFixed(2);
      }

      if (price > 0) {
        next.magicNumber = price.toString();
        next.magicMonth = (qty > 0 ? Math.ceil(price / (qty * divPerShare)) : 0).toString();
      }

      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentPrice = parseFloat(form.currentPrice) || 0;
    const dividendPerShare = parseFloat(form.dividendPerShare) || 0;
    const avgPriceValue = parseFloat(form.avgPrice) || currentPrice;
    const quantity = parseFloat(form.quantity) || 0;
    const investedAmountValue = avgPriceValue * quantity;
    const currentDividendValue = quantity * dividendPerShare;
    const annualReturnValue = currentDividendValue * 12;

    const data = {
      ticker: form.ticker.toUpperCase().trim(),
      type: form.type,
      subtype: form.subtype.trim(),
      sector: form.sector.trim(),
      paymentDay: form.paymentDay ? parseInt(form.paymentDay) : null,
      currentPrice,
      dividendPerShare,
      dividendYield: currentPrice > 0 ? (dividendPerShare / currentPrice) * 100 : 0,
      targetTotal: parseFloat(form.targetTotal) || 0,
      sharesNeeded: parseFloat(form.sharesNeeded) || 0,
      avgPrice: avgPriceValue,
      quantity,
      goal: form.goal || "PAUSAR",
      investedAmount: investedAmountValue,
      missing: parseFloat(form.missing) || Math.max(0, (parseFloat(form.targetTotal) || 0) - investedAmountValue),
      currentDividend: currentDividendValue,
      annualReturn: annualReturnValue,
      magicMonth: parseFloat(form.magicMonth) || 0,
      magicNumber: parseFloat(form.magicNumber) || 0,
      divYield12m: form.divYield12m ? parseFloat(form.divYield12m) : null,
      representation: parseFloat(form.representation) || 0,
      percentInPortfolio: parseFloat(form.percentInPortfolio) || 0,
      status: form.status.trim(),
    };

    if (asset) {
      updateAsset(asset.id, data);
    } else {
      addAsset(data);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto sm:mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{asset ? `Editar ${asset.ticker}` : "Novo Ativo"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker" value={form.ticker} onChange={(v) => {
              update("ticker", v);
              if (!asset && v.length >= 4) {
                const info = detectAssetType(v);
                update("type", info.type);
                update("sector", info.sector);
              }
            }} placeholder="ALZR11" required />
            <SelectField
              label="Tipo"
              value={form.type}
              onChange={(v) => update("type", v)}
              options={["FII", "AÇÃO", "ETF", "TESOURO", "CDB", "CRIPTO", "OUTRO"]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Setor" value={form.sector} onChange={(v) => update("sector", v)} placeholder="LOGÍSTICA" />
            <Field label="Subtipo" value={form.subtype} onChange={(v) => update("subtype", v)} placeholder="ATRELADO AO IPCA" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Cotação Atual (R$)" value={form.currentPrice} onChange={(v) => update("currentPrice", v)} type="number" />
            <Field label="Dividendo/Cota" value={form.dividendPerShare} onChange={(v) => update("dividendPerShare", v)} type="number" />
            <Field label="Dia Pagamento" value={form.paymentDay} onChange={(v) => update("paymentDay", v)} type="number" placeholder="14" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço Médio (R$)" value={form.avgPrice} onChange={(v) => update("avgPrice", v)} type="number" />
            <Field label="Quantidade" value={form.quantity} onChange={(v) => update("quantity", v)} type="number" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Necessário (R$)" value={form.targetTotal} onChange={(v) => update("targetTotal", v)} type="number" />
            <Field label="Meta" value={form.goal} onChange={(v) => update("goal", v)} placeholder="PAUSAR ou número" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="DY 12M (%)" value={form.divYield12m} onChange={(v) => update("divYield12m", v)} type="number" />
            <Field label="Status" value={form.status} onChange={(v) => update("status", v)} placeholder="Situação" />
          </div>

          <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
            <p className="text-xs text-muted font-medium uppercase tracking-wider">Calculados automaticamente</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-muted">Valor Investido:</span> <span className="font-medium tabular">{form.investedAmount}</span></p>
              <p><span className="text-muted">Dividendo/Mês:</span> <span className="font-medium tabular">{form.currentDividend}</span></p>
              <p><span className="text-muted">Retorno Anual:</span> <span className="font-medium tabular">{form.annualReturn}</span></p>
              <p><span className="text-muted">Cotas Necessárias:</span> <span className="font-medium tabular">{form.sharesNeeded}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
              {asset ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        step={type === "number" ? "any" : undefined}
        className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
