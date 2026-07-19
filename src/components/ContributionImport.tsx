import { useState } from "react";
import { importContributions } from "../store";
import { X, Upload, FileText, AlertTriangle, Check } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function ContributionImport({ onClose }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ date: string; value: number; description: string }[] | null>(null);
  const [error, setError] = useState("");

  function parseData(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    const results: { date: string; value: number; description: string }[] = [];

    for (const line of lines) {
      // Try CSV format: date;value;description
      if (line.includes(";")) {
        const cols = line.split(";");
        if (cols.length >= 2) {
          const date = cols[0].trim();
          const rawValue = cols[1].trim();
          const desc = cols.slice(2).join(" ").trim();
          const value = parseFloat(rawValue.replace(/\./g, "").replace(",", "."));
          if (date && !isNaN(value)) {
            results.push({ date: normalizeDate(date), value, description: desc || "TED BCO" });
            continue;
          }
        }
      }

      // Try space/tab separated: date value description
      const parts = line.trim().split(/\s{2,}|\t+|(?<=\d)\s+(?=\d)/);
      if (parts.length >= 2) {
        const date = parts[0].trim();
        const rawValue = parts[1].trim();
        const desc = parts.slice(2).join(" ").trim() || "TED BCO";
        const value = parseFloat(rawValue.replace(/\./g, "").replace(",", "."));
        if (date && !isNaN(value)) {
          results.push({ date: normalizeDate(date), value, description: desc });
          continue;
        }
      }

      // Try: DD/MM/YYYY value description
      const match = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(-?[\d.]+),?(\d*)\s+(.+)/);
      if (match) {
        const date = match[1];
        const intPart = match[2].replace(/\./g, "");
        const decPart = match[3] || "0";
        const value = parseFloat(`${intPart}.${decPart}`);
        const desc = match[4].trim();
        results.push({ date: normalizeDate(date), value, description: desc });
      }
    }

    if (results.length === 0) {
      setError("Nenhum aporte reconhecido. Formatos aceitos:\nCSV: data;valor;descrição\nOu: DD/MM/AAAA valor descrição");
      setPreview(null);
      return;
    }

    setPreview(results);
    setError("");
  }

  function normalizeDate(d: string): string {
    if (d.includes("/")) {
      const parts = d.split("/");
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    if (d.includes("-") && d.length === 10) return d;
    return new Date().toISOString().slice(0, 10);
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;
    importContributions(preview);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h2 className="font-semibold">Importar Aportes</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Cole os dados no formato: <span className="text-foreground font-medium">data;valor;descrição</span>
          </p>
          <pre className="text-xs text-muted bg-surface rounded-xl p-3">
24/10/2018;384,65;TED BCO{'\n'}
25/10/2018;200,00;TED BCO{'\n'}
18/04/2022;-135,83;TED BCO
          </pre>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseData(e.target.value); }}
            placeholder="Cole os aportes aqui..."
            className="w-full h-36 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-expense bg-expense/5 px-4 py-3 rounded-xl">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {!preview && !error && (
            <div className="bg-surface rounded-xl p-5 text-center">
              <FileText className="size-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">Cole os dados acima para ver o preview</p>
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-3">
                <Check className="size-4" />
                <span className="font-medium">{preview.length} aportes encontrados</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {preview.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1 bg-card rounded-lg">
                    <span className="tabular">{r.date}</span>
                    <span className={`font-medium tabular ${r.value >= 0 ? "text-income" : "text-expense"}`}>
                      {r.value >= 0 ? "+" : ""}{r.value.toFixed(2)}
                    </span>
                    <span className="text-muted">{r.description}</span>
                  </div>
                ))}
                {preview.length > 20 && <p className="text-muted text-center pt-1">+{preview.length - 20} outros</p>}
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                  Importar {preview.length} aportes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
