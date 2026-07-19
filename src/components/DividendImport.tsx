import { useState } from "react";
import { importDividends } from "../store";
import { X, Upload, FileText, AlertTriangle, Check } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function DividendImport({ onClose }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState("");

  function parseCSV(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      setError("CSV precisa ter cabeçalho + pelo menos 1 linha");
      setPreview(null);
      return;
    }

    const header = lines[0].split(";").map((h) =>
      h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s./]+/g, "_")
    );

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < 2) continue;
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = (cols[idx] ?? "").trim();
      });
      rows.push(row);
    }

    if (rows.length === 0) {
      setError("Nenhuma linha de dados encontrada");
      setPreview(null);
      return;
    }

    setPreview(rows);
    setError("");
  }

  function findCol(row: Record<string, string>, ...names: string[]): string {
    for (const name of names) {
      const n = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s./]+/g, "_");
      const val = Object.entries(row).find(([k]) => k.includes(n));
      if (val) return val[1];
    }
    return "";
  }

  function parseBRL(v: string): number {
    return parseFloat(v.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;

    const rows = preview.map((row) => {
      const ticker = findCol(row, "TICKER", "ATIVO", "TICKER ");
      const type = findCol(row, "TIPO", "TIPO ");
      const monthYear = findCol(row, "MES_ANO", "MÊS/ANO", "MESANO", "COMPETENCIA");
      const month = findCol(row, "MES", "MÊS", "MES ");
      const year = findCol(row, "ANO", "ANO ");
      const name = findCol(row, "NOME", "NOME ");
      const payment = findCol(row, "PAGAMENTO", "DATA", "DATA_PAGAMENTO", "DATA PAGAMENTO");
      const movementType = findCol(row, "TIPO_DE_MOVIMENTO", "TIPO MOVIMENTO", "MOVIMENTO", "TIPO_DE_MOVIMENTO ");
      const totalValue = findCol(row, "VALOR_TOTAL_LIQ", "VALOR TOTAL LIQ.", "VALOR LIQ", "VALOR", "VALOR_TOTAL_LIQ_");

      let m = parseInt(month);
      let y = parseInt(year);

      // Try to parse from monthYear if month/year not separate
      if ((!m || !y) && monthYear) {
        const parts = monthYear.split(/[/-]/);
        if (parts.length >= 2) {
          m = parseInt(parts[0]);
          y = parseInt(parts[1]);
          if (y < 100) y += 2000;
        }
      }

      return {
        ticker: ticker.toUpperCase().trim(),
        type: type || "FII",
        monthYear: `${String(m).padStart(2, "0")}/${y}`,
        month: m || 1,
        year: y || new Date().getFullYear(),
        name: name || ticker,
        payment: payment || new Date().toISOString().slice(0, 10),
        movementType: movementType.toUpperCase().trim() || "DIVIDENDO",
        totalValue: parseBRL(totalValue),
      };
    }).filter((r) => r.ticker && r.totalValue > 0);

    importDividends(rows);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h2 className="font-semibold">Importar Dividendos (CSV)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Cole o CSV com colunas: TICKER, TIPO, MÊS/ANO, MÊS, ANO, NOME, PAGAMENTO, TIPO DE MOVIMENTO, VALOR TOTAL LIQ.
          </p>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseCSV(e.target.value); }}
            placeholder="TICKER;TIPO;MÊS/ANO;MÊS;ANO;NOME;PAGAMENTO;TIPO DE MOVIMENTO;VALOR TOTAL LIQ."
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
              <p className="text-sm text-muted">Cole o CSV acima para ver o preview</p>
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-3">
                <Check className="size-4" />
                <span className="font-medium">{preview.length} registros encontrados</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {preview.slice(0, 20).map((row, i) => {
                  const ticker = findCol(row, "TICKER", "ATIVO") || `#${i + 1}`;
                  const val = findCol(row, "VALOR_TOTAL_LIQ", "VALOR", "VALOR LIQ");
                  return (
                    <div key={i} className="flex items-center justify-between px-2 py-1 bg-card rounded-lg">
                      <span className="font-medium">{ticker}</span>
                      <span className="text-muted">{val || "-"}</span>
                    </div>
                  );
                })}
                {preview.length > 20 && (
                  <p className="text-muted text-center pt-1">+{preview.length - 20} outros</p>
                )}
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                  Importar {preview.length} registros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
