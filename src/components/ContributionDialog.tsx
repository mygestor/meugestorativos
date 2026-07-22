import { useState } from "react";
import { addContribution } from "../store";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function ContributionDialog({ onClose }: Props) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    value: "",
    description: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(form.value.replace(",", "."));
    if (!value) return;

    addContribution({
      date: form.date,
      value,
      description: form.description.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 mx-0">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Novo Aporte</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Data</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.value}
              onChange={(e) => update("value", e.target.value)}
              placeholder="0,00 (use - para retiradas)"
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-[11px] text-muted">Valor negativo (ex: -135,83) para retiradas</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Descrição</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="TED BCO"
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
