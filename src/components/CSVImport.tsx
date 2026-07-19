import { useState } from "react";
import { importAssets } from "../store";
import { X, Upload, FileText, AlertTriangle, Check } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function CSVImport({ onClose }: Props) {
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

    const header = lines[0].split(";").map((h) => h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
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

  function parseBRL(v: string): number {
    return parseFloat(v.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;

    const assets = preview.map((row) => {
      const ticker = row["DESCRIÇÃO".normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || row["ATIVO"] || "";
      const type = row["TIPO"] || "FII";
      const sector = row["SETORES"] || row["SECTOR"] || "";
      const subtype = row["SUBTIPO"] || "";
      const currentPrice = parseBRL(row["COTAÇÃO ATUAL"] || row["COTAÇÃO"] || row["PREÇO ATUAL"] || "0");
      const dividendPerShare = parseBRL(row["DIVIDENDO"] || "0");
      const avgPrice = parseBRL(row["PREÇO MÉDIO ATUAL"] || row["VALOR MÉDIO COMPRADO"] || "0");
      const quantity = parseFloat(row["COTAS ATUAIS"] || row["QUANT"] || row["QT"] || "0");
      const targetTotal = parseBRL(row["TOTAL NESSESÁRIO"] || row["TOTAL NECESSÁRIO"] || "0");
      const investedAmount = parseBRL(row["VALOR INVESTIDO"] || row["TOTAL EM COMPRA"] || "0");
      const paymentDay = parseInt(row["DIA PAGAMENTO"]) || null;
      const status = row["SITUAÇÃO"] || "";
      const goal = row["META"] || "PAUSAR";
      const divYield12m = row["DY (12M)"] ? parseFloat(row["DY (12M)"].replace("%", "").replace(",", ".")) : null;

      return {
        ticker: ticker.toUpperCase().trim(),
        type: type.toUpperCase().trim(),
        subtype,
        sector: sector.trim(),
        paymentDay,
        currentPrice,
        dividendPerShare,
        dividendYield: currentPrice > 0 ? (dividendPerShare / currentPrice) * 100 : 0,
        targetTotal,
        sharesNeeded: targetTotal > 0 && currentPrice > 0 ? Math.ceil(targetTotal / currentPrice) : 0,
        avgPrice,
        quantity,
        goal,
        investedAmount: investedAmount || (avgPrice * quantity),
        missing: Math.max(0, targetTotal - (investedAmount || (avgPrice * quantity))),
        currentDividend: quantity * dividendPerShare,
        annualReturn: quantity * dividendPerShare * 12,
        magicMonth: 0,
        magicNumber: currentPrice,
        divYield12m,
        representation: 0,
        percentInPortfolio: 0,
        status,
      };
    }).filter((a) => a.ticker);

    importAssets(assets);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h2 className="font-semibold">Importar CSV</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">
            Cole o conteúdo do CSV da sua planilha. O sistema vai extrair automaticamente os ativos.
          </p>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseCSV(e.target.value); }}
            placeholder="Cole o CSV aqui..."
            className="w-full h-40 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-expense bg-expense/5 px-4 py-3 rounded-xl">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-3">
                <Check className="size-4" />
                <span className="font-medium">{preview.length} ativos encontrados</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.slice(0, 10).map((row, i) => {
                  const ticker = row["DESCRIÇÃO"] || row["ATIVO"] || `Ativo ${i + 1}`;
                  return (
                    <span key={i} className="px-3 py-1.5 bg-card rounded-lg text-xs font-medium flex items-center gap-1.5">
                      <FileText className="size-3 text-muted" />
                      {ticker}
                    </span>
                  );
                })}
                {preview.length > 10 && (
                  <span className="px-3 py-1.5 text-xs text-muted">+{preview.length - 10} outros</span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                  Importar {preview.length} ativos
                </button>
              </div>
            </div>
          )}

          {!preview && !error && (
            <div className="bg-surface rounded-xl p-5 text-center">
              <FileText className="size-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">Cole o CSV acima para ver o preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
