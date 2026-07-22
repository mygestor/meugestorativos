import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { addTrade } from "../store";
import { X, Upload, FileText, AlertTriangle, Check, FileSpreadsheet, Download } from "lucide-react";

interface Props {
  onClose: () => void;
}

type RowData = Record<string, string>;

export function TradeImport({ onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<RowData[] | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState("");

  function normalizeHeader(h: string) {
    return h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s./]+/g, "_");
  }

  function parseRows(headers: string[], data: string[][]) {
    const rows: RowData[] = [];
    for (const line of data) {
      if (line.length < 2) continue;
      const row: RowData = {};
      headers.forEach((h, idx) => {
        row[h] = (line[idx] ?? "").toString().trim();
      });
      rows.push(row);
    }
    return rows;
  }

  function parseCSV(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { setError("CSV precisa ter cabeçalho + pelo menos 1 linha"); setPreview(null); return; }
    const headers = lines[0].split(";").map(normalizeHeader);
    const data = lines.slice(1).map((l) => l.split(";"));
    const rows = parseRows(headers, data);
    if (rows.length === 0) { setError("Nenhuma linha de dados encontrada"); setPreview(null); return; }
    setPreview(rows); setError("");
  }

  function isDateCol(header: string) {
    const h = header.toUpperCase();
    return h.includes("DATA") || h.includes("PAGAMENTO") || h.includes("PAGTO");
  }

  function excelSerialToDate(serial: number): string {
    const utc = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
    const d = utc.getUTCDate(), m = utc.getUTCMonth() + 1, y = utc.getUTCFullYear();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function cellToString(cell: unknown, header: string): string {
    if (cell instanceof Date) {
      const d = cell.getDate(), m = cell.getMonth() + 1, y = cell.getFullYear();
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (isDateCol(header) && typeof cell === "number") {
      return excelSerialToDate(cell);
    }
    if (typeof cell === "number") return String(cell);
    return String(cell ?? "").trim();
  }

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(buf, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        if (json.length < 2) { setError("Planilha precisa ter cabeçalho + pelo menos 1 linha"); setPreview(null); return; }
        const headers = (json[0] as string[]).map(normalizeHeader);
        const rowsData = json.slice(1)
          .filter((r: unknown) => (r as unknown[]).length >= 2)
          .map((r: unknown) => {
            const row = r as unknown[];
            return row.map((cell, idx) => cellToString(cell, headers[idx] ?? ""));
          }) as string[][];
        const rows = parseRows(headers, rowsData);
        if (rows.length === 0) { setError("Nenhuma linha de dados encontrada"); setPreview(null); return; }
        setPreview(rows); setError(""); setFileName(file.name);
      } catch { setError("Erro ao ler o arquivo Excel"); setPreview(null); }
    };
    reader.readAsArrayBuffer(file);
  }

  function findCol(row: RowData, ...names: string[]): string {
    for (const name of names) {
      const n = normalizeHeader(name);
      for (const k of Object.keys(row)) {
        if (k.includes(n)) return row[k] ?? "";
      }
    }
    return "";
  }

  function parseBRL(v: string): number {
    const s = v.replace("R$", "").trim();
    const isNegative = s.startsWith("(") && s.endsWith(")");
    const cleaned = isNegative ? s.slice(1, -1) : s;
    if (/^\d+\.\d+$/.test(cleaned)) return (isNegative ? -1 : 1) * (parseFloat(cleaned) || 0);
    const result = parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    return isNegative ? -result : result;
  }

  function parseQty(v: string): number {
    const s = v.trim();
    const isNegative = s.startsWith("(") && s.endsWith(")") || s.startsWith("-");
    const cleaned = isNegative ? s.replace(/^\(?/, "").replace(/\)?$/, "") : s;
    if (/^-?\d+\.?\d*$/.test(cleaned) || /^\d+\.?\d*$/.test(cleaned)) return (isNegative ? -1 : 1) * (parseFloat(cleaned) || 0);
    const result = parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    return isNegative ? -result : result;
  }

  function parseDate(d: string): string {
    if (!d) return new Date().toISOString().slice(0, 10);
    const parts = d.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    if (d.includes("-") && d.length === 10) return d;
    return new Date().toISOString().slice(0, 10);
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;

    let imported = 0, skipped = 0, skippedNoTicker = 0, skippedQty = 0, skippedPrice = 0;

    preview.forEach((row) => {
      const date = findCol(row, "DATA");
      const ticker = findCol(row, "CODIGO", "CÓDIGO", "TICKER", "ATIVO", "CODNEG");
      const qtyRaw = findCol(row, "QTDE", "QUANTIDADE", "QTD", "QT");
      const priceRaw = findCol(row, "PRECO", "PREÇO");
      const opRaw = findCol(row, "OPERACAO", "OPERAÇÃO", "TIPO", "MOVIMENTO", "MOV", "TP");

      const qty = parseQty(qtyRaw);
      const rawPrice = parseBRL(priceRaw);
      const price = Math.abs(rawPrice);
      const op = opRaw.toUpperCase().trim();
      const isVenda = op === "VENDA" || op === "V" || qty < 0;

      if (!ticker) { skipped++; skippedNoTicker++; console.log("IGNORADO (sem ticker):", { date, qtyRaw, priceRaw, opRaw }); return; }
      if (qty === 0) { skipped++; skippedQty++; console.log("IGNORADO (Qtd=0):", { date, ticker, qtyRaw, priceRaw, opRaw }); return; }
      if (price <= 0) { skipped++; skippedPrice++; console.log("IGNORADO (Preço=0):", { date, ticker, qtyRaw, priceRaw, opRaw }); return; }

      const absQty = Math.abs(qty);
      const finalQty = isVenda ? -absQty : absQty;
      const totalOp = absQty * price;
      const irrf = isVenda ? +(totalOp * 0.0005).toFixed(2) : 0;

      imported++;
      addTrade({
        date: parseDate(date),
        ticker: ticker.toUpperCase().trim(),
        quantity: finalQty,
        price,
        fees: 0,
        irrf,
        totalWithoutFees: totalOp,
        totalWithFees: totalOp,
        priceWithFees: price,
        totalShares: 0,
        avgPrice: 0,
        operation: isVenda ? "VENDA" : "COMPRA",
      });
    });

    const totalLinhas = preview.length;
    const msg = `Importadas ${imported} de ${totalLinhas} linhas. Ignoradas: ${skipped} (${skippedNoTicker} sem ticker, ${skippedQty} Qtd=0, ${skippedPrice} Preço=0).`;
    setResult(msg);
  }

  function downloadTemplate() {
    const headers = ["DATA", "CÓDIGO", "QTDE", "PREÇO", "OPERAÇÃO"];
    const example = ["01/01/2026", "ALZR11", "100", "9,97", "COMPRA"];
    const example2 = ["15/06/2026", "ALZR11", "-50", "10,50", "VENDA"];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example, example2]);
    XLSX.utils.book_append_sheet(wb, ws, "Operações");
    XLSX.writeFile(wb, "modelo-compra-venda.xlsx");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto sm:mx-4 mx-0">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h2 className="font-semibold">Importar Operações</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-surface rounded-xl p-4 border border-border border-dashed">
            <p className="text-sm font-medium mb-3">Importar arquivo Excel (.xlsx)</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { if (e.target.files?.[0]) parseExcel(e.target.files[0]); }}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-xl text-sm hover:bg-card-hover transition-colors border border-border flex-1 justify-center"
              >
                <FileSpreadsheet className="size-4 text-primary" />
                {fileName || "Selecionar arquivo"}
              </button>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-xl text-sm hover:bg-card-hover transition-colors border border-border"
                title="Baixar modelo Excel"
              >
                <Download className="size-4 text-muted" />
                Modelo
              </button>
            </div>
            <p className="text-xs text-muted mt-2">Colunas: DATA, CÓDIGO, QTDE, PREÇO, OPERAÇÃO</p>
            <p className="text-xs text-muted">OPERAÇÃO: COMPRA (qtde positiva) ou VENDA (qtde negativa)</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">ou cole CSV</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseCSV(e.target.value); }}
            placeholder="DATA;CÓDIGO;QTDE;PREÇO;OPERAÇÃO"
            className="w-full h-28 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
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
              <p className="text-sm text-muted">Selecione um arquivo Excel ou cole CSV para ver o preview</p>
            </div>
          )}

          {result && (
            <div className="bg-surface rounded-xl p-4 text-center">
              <Check className="size-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">{result}</p>
              <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                Fechar
              </button>
            </div>
          )}

          {!result && preview && preview.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-3">
                <Check className="size-4" />
                <span className="font-medium">{preview.length} operações encontradas</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {preview.slice(0, 20).map((row, i) => {
                  const ticker = findCol(row, "CODIGO", "TICKER", "ATIVO") || `#${i + 1}`;
                  const qty = findCol(row, "QTDE", "QUANTIDADE");
                  return (
                    <div key={i} className="flex items-center justify-between px-2 py-1 bg-card rounded-lg">
                      <span className="font-medium">{ticker}</span>
                      <span className="text-muted">{qty || "-"}</span>
                    </div>
                  );
                })}
                {preview.length > 20 && <p className="text-muted text-center pt-1">+{preview.length - 20} outros</p>}
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                  Importar {preview.length} operações
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
