import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { importContributions } from "../store";
import { X, Upload, FileText, AlertTriangle, Check, FileSpreadsheet, Download } from "lucide-react";

interface Props {
  onClose: () => void;
}

type RowData = Record<string, string>;

export function ContributionImport({ onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ date: string; value: number; description: string }[] | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState("");

  function normalizeHeader(h: string) {
    return h.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s./]+/g, "_");
  }

  function parseBRL(v: string): number {
    const s = v.replace("R$", "").trim();
    if (/^\d+\.\d+$/.test(s)) return parseFloat(s) || 0;
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  }

  function normalizeDate(d: string): string {
    if (d.includes("/")) {
      const parts = d.split("/");
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    if (d.includes("-") && d.length === 10) return d;
    return new Date().toISOString().slice(0, 10);
  }

  function isDateCol(header: string) {
    const h = header.toUpperCase();
    return h.includes("DATA") || h.includes("PAGAMENTO") || h.includes("PAGTO") || h.includes("OPERACAO") || h.includes("OPERAÇÃO");
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
    if (isDateCol(header) && typeof cell === "number") return excelSerialToDate(cell);
    if (typeof cell === "number") return cell.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(cell ?? "").trim();
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

  function parseRows(headers: string[], data: string[][]) {
    const rows: RowData[] = [];
    for (const line of data) {
      if (line.length < 2) continue;
      const row: RowData = {};
      headers.forEach((h, idx) => { row[h] = (line[idx] ?? "").toString().trim(); });
      rows.push(row);
    }
    return rows;
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
        const parsed = processRows(rows);
        if (parsed.length === 0) { setError("Nenhum aporte reconhecido. Colunas: OPERAÇÃO, VALOR, DESCRIÇÃO"); setPreview(null); return; }
        setPreview(parsed); setError(""); setFileName(file.name);
      } catch { setError("Erro ao ler o arquivo"); setPreview(null); }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseCSV(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { setError("CSV precisa ter cabeçalho + pelo menos 1 linha"); setPreview(null); return; }
    const headers = lines[0].split(";").map(normalizeHeader);
    const data = lines.slice(1).map((l) => l.split(";"));
    const rows = parseRows(headers, data);
    const parsed = processRows(rows);
    if (parsed.length === 0) { setError("Nenhum aporte reconhecido. Colunas: OPERAÇÃO, VALOR, DESCRIÇÃO"); setPreview(null); return; }
    setPreview(parsed); setError("");
  }

  function processRows(rows: RowData[]): { date: string; value: number; description: string }[] {
    return rows.map((row) => {
      const op = findCol(row, "OPERACAO", "OPERAÇÃO", "DATA");
      const valor = findCol(row, "VALOR", "VLR");
      const desc = findCol(row, "DESCRICAO", "DESCRIÇÃO", "DESC", "HISTORICO", "HISTÓRICO");

      let date: string;
      let value: number;

      // Try to parse operation column as date first
      if (op.includes("/") || op.includes("-")) {
        date = normalizeDate(op);
        value = parseBRL(valor);
      } else {
        date = new Date().toISOString().slice(0, 10);
        const isRetirada = op.toUpperCase().trim() === "RETIRADA" || op.toUpperCase().trim() === "SAQUE" || op.toUpperCase().trim() === "R";
        value = parseBRL(valor);
        if (value > 0 && isRetirada) value = -value;
      }

      return {
        date,
        value,
        description: desc || "APORTE",
      };
    }).filter((r) => r.value !== 0);
  }

  function handleImport() {
    if (!preview || preview.length === 0) return;
    importContributions(preview);
    setResult(`${preview.length} aportes importados`);
  }

  function downloadTemplate() {
    const headers = ["OPERAÇÃO", "VALOR", "DESCRIÇÃO"];
    const example = ["24/10/2018", "5000,00", "TED BCO"];
    const example2 = ["18/04/2022", "1000,00", "SAQUE"];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example, example2]);
    XLSX.utils.book_append_sheet(wb, ws, "Aportes");
    XLSX.writeFile(wb, "modelo-aportes.xlsx");
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
              >
                <Download className="size-4 text-muted" />
                Modelo
              </button>
            </div>
            <p className="text-xs text-muted mt-2">Colunas: OPERAÇÃO (APORTE/RETIRADA ou data), VALOR, DESCRIÇÃO</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">ou cole CSV</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); parseCSV(e.target.value); }}
            placeholder="OPERAÇÃO;VALOR;DESCRIÇÃO"
            className="w-full h-28 px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-expense bg-expense/5 px-4 py-3 rounded-xl">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="bg-surface rounded-xl p-4 text-center">
              <Check className="size-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">{result}</p>
              <button onClick={onClose} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                Fechar
              </button>
            </div>
          )}

          {!result && !preview && !error && (
            <div className="bg-surface rounded-xl p-5 text-center">
              <FileText className="size-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">Selecione um arquivo Excel ou cole CSV para ver o preview</p>
            </div>
          )}

          {!result && preview && preview.length > 0 && (
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
