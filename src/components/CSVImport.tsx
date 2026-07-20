import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { importAssets } from "../store";
import { detectAssetType } from "../detectType";
import { X, Upload, FileText, AlertTriangle, Check, FileSpreadsheet, Download } from "lucide-react";

interface Props {
  onClose: () => void;
}

type RowData = Record<string, string>;

export function CSVImport({ onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<RowData[] | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

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
    if (/^\d+\.\d+$/.test(s)) return parseFloat(s) || 0;
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;

    const assets = preview.map((row) => {
      const ticker = findCol(row, "CODIGO", "CÓDIGO", "TICKER", "ATIVO", "DESCRICAO");
      const type = findCol(row, "TIPO");
      const sector = findCol(row, "SETOR", "SETORES", "SECTOR");
      const subtype = findCol(row, "SUBTIPO");
      const currentPrice = parseBRL(findCol(row, "COTACAO_ATUAL", "COTACAO", "PRECO_ATUAL", "PRECO"));
      const dividendPerShare = parseBRL(findCol(row, "DIVIDENDO"));
      const avgPrice = parseBRL(findCol(row, "PRECO_MEDIO_ATUAL", "PRECO_MEDIO", "VALOR_MEDIO_COMPRADO"));
      const quantity = parseFloat(findCol(row, "COTAS_ATUAIS", "QUANT", "QT", "QTD", "QUANTIDADE").replace(",", ".")) || 0;
      const targetTotal = parseBRL(findCol(row, "TOTAL_NECESSARIO", "TOTAL_NECESSARIO", "TOTAL"));
      const investedAmount = parseBRL(findCol(row, "VALOR_INVESTIDO", "TOTAL_EM_COMPRA", "INVESTIDO"));
      const paymentDay = parseInt(findCol(row, "DIA_PAGAMENTO", "DIA")) || null;
      const status = findCol(row, "SITUACAO", "STATUS");
      const goal = findCol(row, "META") || "PAUSAR";
      const divYield12m = findCol(row, "DY_12M", "DY12M", "DIV_YIELD_12M");
      const divYieldNumeric = divYield12m ? parseFloat(divYield12m.replace("%", "").replace(",", ".")) : null;

      const tickerUpper = ticker.toUpperCase().trim();
      if (!tickerUpper) return null;

      const info = detectAssetType(tickerUpper);
      return {
        ticker: tickerUpper,
        type: (type || info.type).toUpperCase().trim(),
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
        divYield12m: divYieldNumeric,
        representation: 0,
        percentInPortfolio: 0,
        status,
      };
    }).filter((a): a is NonNullable<typeof a> => a !== null && !!a.ticker);

    if (assets.length === 0) { setError("Nenhum ativo válido encontrado"); return; }
    importAssets(assets);
    onClose();
  }

  function downloadTemplate() {
    const headers = ["CÓDIGO", "TIPO", "SETOR", "SUBTIPO", "COTAÇÃO ATUAL", "DIVIDENDO", "PREÇO MÉDIO ATUAL", "COTAS ATUAIS", "TOTAL NECESSÁRIO", "VALOR INVESTIDO", "DIA PAGAMENTO", "META"];
    const fii = ["ALZR11", "FII", "LAJES CORPORATIVAS", "LAJES CORPORATIVAS", "97,50", "0,85", "95,00", "100", "12000", "9500", "15", "ACUMULAR"];
    const stock = ["PETR4", "AÇÃO", "PETRÓLEO E GÁS", "PETRÓLEO E GÁS", "38,25", "2,10", "36,50", "200", "8000", "7300", "25", "ACUMULAR"];
    const etf = ["BOVA11", "ETF", "ÍNDICE", "ÍNDICE", "125,30", "0", "120,00", "50", "7000", "6000", "5", "ACUMULAR"];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, fii, stock, etf]);
    XLSX.utils.book_append_sheet(wb, ws, "Ativos");
    XLSX.writeFile(wb, "modelo-importacao-ativos.xlsx");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h2 className="font-semibold">Importar Ativos</h2>
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
            <p className="text-xs text-muted mt-2">Colunas: CÓDIGO, TIPO, SETOR, SUBTIPO, COTAÇÃO ATUAL, DIVIDENDO, PREÇO MÉDIO ATUAL, COTAS ATUAIS, TOTAL NECESSÁRIO, VALOR INVESTIDO, DIA PAGAMENTO, META</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">ou cole CSV</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseCSV(e.target.value); }}
            placeholder="CÓDIGO;TIPO;SETOR;SUBTIPO;COTAÇÃO ATUAL;DIVIDENDO;PREÇO MÉDIO ATUAL;COTAS ATUAIS;TOTAL NECESSÁRIO;VALOR INVESTIDO;DIA PAGAMENTO;META"
            className="w-full h-40 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
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

          {preview && preview.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-primary mb-3">
                <Check className="size-4" />
                <span className="font-medium">{preview.length} ativos encontrados</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.slice(0, 10).map((row, i) => {
                  const ticker = findCol(row, "CODIGO", "TICKER", "ATIVO", "DESCRICAO") || `Ativo ${i + 1}`;
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
        </div>
      </div>
    </div>
  );
}
