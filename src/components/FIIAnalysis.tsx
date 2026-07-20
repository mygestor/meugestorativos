import { useMemo, useState, useCallback } from "react";
import type { Asset, DividendRecord, TradeRecord } from "../types";
import { formatCurrency, formatPercent, formatCompact } from "../format";
import { getDividends, getTrades, updateAsset } from "../store";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, AreaChart, Area } from "recharts";
import { Settings, ChevronDown, ChevronUp, SlidersHorizontal, TrendingUp, DollarSign, Target, BarChart3, Lightbulb, Search, RefreshCw, Check, AlertTriangle } from "lucide-react";

interface Props {
  fiiAssets: Asset[];
  hideValues: boolean;
  onEdit: (asset: Asset) => void;
  onRefresh: () => void;
}

interface FIIRow {
  asset: Asset;
  dividends12m: DividendRecord[];
  totalDividends12m: number;
  realDivPerShare: number;
  realMonthlyDiv: number;
  divYieldMensal: number;
  avgYield12m: number;
  goalShares: number;
  goalValue: number;
  investedValue: number;
  missingValue: number;
  currentValue: number;
  gainLoss: number;
  gainPct: number;
  monthsToTarget: number;
  magicNumber: number;
  magicPrice: number;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#ef4444", "#6366f1", "#84cc16"];
const DESIRED_KEY = "gestor-fii-desired-per-asset";
const SETTINGS_KEY = "gestor-fii-settings";

interface Settings {
  desiredDividend: number;
  maxPerAsset: number;
  maxPerSegment: number;
  targetYield: number;
}

function loadSettings(): Settings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return { desiredDividend: 100, maxPerAsset: 15, maxPerSegment: 30, targetYield: 0.8 };
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function FIIAnalysis({ fiiAssets, hideValues, onEdit }: Props) {
  const allDividends = getDividends();
  const allTrades = getTrades();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<string>("todos");
  const [sortField, setSortField] = useState<string>("currentDividend");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchStatus, setFetchStatus] = useState<Record<string, 'pending' | 'ok' | 'error'>>({});
  const [fetchingDividendos, setFetchingDividendos] = useState(false);

  const fetchDividendosReais = useCallback(async () => {
    if (fiiAssets.length === 0) return;
    setFetchingDividendos(true);
    const status: Record<string, 'pending' | 'ok' | 'error'> = {};
    fiiAssets.forEach((a) => { status[a.ticker] = 'pending'; });
    setFetchStatus(status);

    const { updateDividendsFromBrapi } = await import("../prices");
    await updateDividendsFromBrapi(
      fiiAssets.map((a) => a.ticker),
      (ticker, s, dividendo) => {
        setFetchStatus((prev) => ({ ...prev, [ticker]: s }));
        if (s === 'ok' && dividendo) {
          const asset = fiiAssets.find((a) => a.ticker === ticker);
          if (asset) {
            updateAsset(asset.id, { dividendPerShare: dividendo });
          }
        }
      }
    );
    setFetchingDividendos(false);
    setTimeout(() => setFetchStatus({}), 5000);
  }, [fiiAssets]);

  // Calculate rows
  const rows = useMemo(() => {
    return fiiAssets.map((a) => {
      // Use real dividend records to calculate monthly dividend
      const allDivs = allDividends
        .filter((d) => d.ticker === a.ticker)
        .sort((a, b) => b.payment.localeCompare(a.payment));
      const divs12m = allDivs.slice(0, 12);
      const totalDivs12m = divs12m.reduce((s, d) => s + d.totalValue, 0);

      // Dividend per share: prefer the stored value (updated by API), fallback to records
      const divPerShare = (a.dividendPerShare || 0) > 0
        ? a.dividendPerShare
        : (divs12m.length > 0 ? totalDivs12m / divs12m.length / (a.quantity || 1) : 0);

      // Monthly dividend
      const realMonthlyDiv = divPerShare > 0
        ? divPerShare * a.quantity
        : (divs12m.length > 0 ? totalDivs12m / Math.min(divs12m.length, 12) : 0);

      const divYieldMensal = a.currentPrice > 0 && divPerShare > 0 ? (divPerShare / a.currentPrice) * 100 : 0;
      const avgYield12m = a.currentPrice > 0 && a.quantity > 0 ? (totalDivs12m / (a.quantity || 1) / a.currentPrice) * 100 : 0;

      const goalShares = Number(a.goal) || 0;
      const goalValue = goalShares > 0 ? goalShares * a.avgPrice : a.targetTotal;
      const investedValue = a.investedAmount;
      const missingValue = Math.max(0, goalValue - investedValue);
      const currentValue = a.currentPrice * a.quantity;
      const gainLoss = currentValue - investedValue;
      const gainPct = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

      const monthsToTarget = realMonthlyDiv > 0 && settings.desiredDividend > realMonthlyDiv
        ? Math.ceil((settings.desiredDividend - realMonthlyDiv) / realMonthlyDiv)
        : 0;
      const magicNumber = divPerShare > 0 ? Math.ceil(settings.desiredDividend / divPerShare) : 0;
      const magicPrice = a.avgPrice > 0 ? a.avgPrice : a.currentPrice;

      return {
        asset: a,
        dividends12m: divs12m,
        totalDividends12m: totalDivs12m,
        realDivPerShare: divPerShare,
        realMonthlyDiv: realMonthlyDiv,
        divYieldMensal,
        avgYield12m,
        goalShares,
        goalValue,
        investedValue,
        missingValue,
        currentValue,
        gainLoss,
        gainPct,
        monthsToTarget,
        magicNumber,
        magicPrice,
      };
    });
  }, [fiiAssets, allDividends, settings.desiredDividend]);

  // Summary calculations
  const summary = useMemo(() => {
    const totalInvested = rows.reduce((s, r) => s + r.investedValue, 0);
    const totalCurrent = rows.reduce((s, r) => s + r.currentValue, 0);
    const monthlyDivs = rows.reduce((s, r) => s + r.realMonthlyDiv, 0);
    const totalGoal = rows.reduce((s, r) => s + r.goalValue, 0);
    const totalMissing = rows.reduce((s, r) => s + r.missingValue, 0);
    const annualDivs = monthlyDivs * 12;
    const monthlyYield = totalInvested > 0 ? (monthlyDivs / totalInvested) * 100 : 0;
    const annualYield = monthlyYield * 12;
    return { totalInvested, totalCurrent, monthlyDivs, annualDivs, totalGoal, totalMissing, monthlyYield, annualYield, count: rows.length };
  }, [rows]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...rows];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter((r) => r.asset.ticker.toLowerCase().includes(s));
    }
    switch (filter) {
      case "papel": list = list.filter((r) => r.asset.type === "FII" && r.asset.subtype === "Papel"); break;
      case "tijolo": list = list.filter((r) => r.asset.type === "FII" && r.asset.subtype === "Tijolo"); break;
      case "hibrido": list = list.filter((r) => r.asset.type === "FII" && r.asset.subtype === "Híbrido"); break;
      case "dy_alto": list = list.filter((r) => r.divYieldMensal > 1); break;
      case "meta_feita": list = list.filter((r) => r.missingValue <= 0); break;
      case "precisa_aporte": list = list.filter((r) => r.missingValue > 0); break;
      case "maior_dy": list.sort((a, b) => b.divYieldMensal - a.divYieldMensal); break;
      case "menor_dy": list.sort((a, b) => a.divYieldMensal - b.divYieldMensal); break;
    }
    list.sort((a, b) => {
      let av: number, bv: number;
      switch (sortField) {
        case "ticker": return sortAsc ? a.asset.ticker.localeCompare(b.asset.ticker) : b.asset.ticker.localeCompare(a.asset.ticker);
        case "dy": av = a.divYieldMensal; bv = b.divYieldMensal; break;
        case "dividendo": av = a.realDivPerShare; bv = b.realDivPerShare; break;
        case "cotacao": av = a.asset.currentPrice; bv = b.asset.currentPrice; break;
        case "quantidade": av = a.asset.quantity; bv = b.asset.quantity; break;
        case "investido": av = a.investedValue; bv = b.investedValue; break;
        case "meta": av = a.goalValue; bv = b.goalValue; break;
        case "falta": av = a.missingValue; bv = b.missingValue; break;
        case "dividendo_mensal": av = a.realMonthlyDiv; bv = b.realMonthlyDiv; break;
        case "dividendo_anual": av = a.realMonthlyDiv * 12; bv = b.realMonthlyDiv * 12; break;
        default: av = a.realMonthlyDiv; bv = b.realMonthlyDiv;
      }
      return sortAsc ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
    });
    return list;
  }, [rows, filter, sortField, sortAsc, searchTerm]);

  function toggleSort(field: string) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  // Chart data
  const typeDist = useMemo(() => {
    const byType: Record<string, number> = {};
    fiiAssets.forEach((a) => {
      const key = a.subtype || a.type;
      byType[key] = (byType[key] || 0) + a.investedAmount;
    });
    return Object.entries(byType).map(([n, v]) => ({ name: n, value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [fiiAssets]);

  const topDividendPayers = useMemo(() => {
    return [...rows].sort((a, b) => (b.asset.currentDividend || 0) - (a.asset.currentDividend || 0)).slice(0, 8);
  }, [rows]);

  const divByMonth = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const d of allDividends) {
      if (fiiAssets.some((a) => a.ticker === d.ticker)) {
        const key = d.monthYear;
        byMonth[key] = (byMonth[key] || 0) + d.totalValue;
      }
    }
    return Object.entries(byMonth).map(([k, v]) => ({ month: k, value: Math.round(v) })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [allDividends, fiiAssets]);

  const mask$ = (v: number) => hideValues ? "••••" : formatCurrency(v);

  const yieldColor = (pct: number) => pct > 1.2 ? "text-green-500" : pct > 0.7 ? "text-yellow-500" : "text-red-500";
  const progressColor = (missing: number) => missing <= 0 ? "bg-green-500" : missing < 5000 ? "bg-amber-500" : "bg-red-500";

  const segmentPct = useMemo(() => {
    const total = summary.totalInvested || 1;
    return rows.map((r) => ({
      ticker: r.asset.ticker,
      pct: (r.investedValue / total) * 100,
      invested: r.investedValue,
      type: r.asset.subtype || r.asset.type,
    }));
  }, [rows, summary.totalInvested]);

  if (fiiAssets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center">
        <TrendingUp className="size-8 text-muted mx-auto mb-2" />
        <p className="text-muted mb-1">Nenhum FII cadastrado</p>
        <p className="text-sm text-muted">Adicione ativos do tipo FII para ver a análise</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-5 space-y-4">
            <h3 className="font-semibold">Configurações</h3>
            <label className="block text-sm">
              <span className="text-muted text-xs">Valor desejado por ativo (R$/mês)</span>
              <input type="number" value={settings.desiredDividend} onChange={(e) => setSettings({ ...settings, desiredDividend: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-border text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-muted text-xs">Percentual máximo por ativo (%)</span>
              <input type="number" value={settings.maxPerAsset} onChange={(e) => setSettings({ ...settings, maxPerAsset: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-border text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-muted text-xs">Percentual máximo por segmento (%)</span>
              <input type="number" value={settings.maxPerSegment} onChange={(e) => setSettings({ ...settings, maxPerSegment: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-border text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-muted text-xs">Rentabilidade alvo mensal (%)</span>
              <input type="number" step="0.1" value={settings.targetYield} onChange={(e) => setSettings({ ...settings, targetYield: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-surface border border-border text-sm" />
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSettingsOpen(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={() => { saveSettings(settings); setSettingsOpen(false); }} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Valor Desejado/Ativo" value={mask$(settings.desiredDividend)} accent="blue" editable
          onClick={() => setSettingsOpen(true)} />
        <Card label="Ativos" value={String(summary.count)} accent="purple" />
        <Card label="Meta Total" value={mask$(summary.totalGoal)} accent="amber" />
        <Card label="Total Investido" value={mask$(summary.totalInvested)} accent="emerald" />
        <Card label="Dividendo/Mês" value={mask$(summary.monthlyDivs)} accent="emerald"
          sub={summary.totalInvested > 0 ? `${formatPercent(summary.monthlyYield)} a.m.` : undefined} />
        <Card label="Dividendo/Ano" value={mask$(summary.annualDivs)} accent="emerald"
          sub={summary.totalInvested > 0 ? `${formatPercent(summary.annualYield)} a.a.` : undefined} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="size-3.5 text-muted" />
        <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>Todos</FilterChip>
        <FilterChip active={filter === "papel"} onClick={() => setFilter("papel")}>Papel</FilterChip>
        <FilterChip active={filter === "tijolo"} onClick={() => setFilter("tijolo")}>Tijolo</FilterChip>
        <FilterChip active={filter === "hibrido"} onClick={() => setFilter("hibrido")}>Híbrido</FilterChip>
        <FilterChip active={filter === "dy_alto"} onClick={() => setFilter("dy_alto")}>DY &gt; 1%</FilterChip>
        <FilterChip active={filter === "meta_feita"} onClick={() => setFilter("meta_feita")}>Meta OK</FilterChip>
        <FilterChip active={filter === "precisa_aporte"} onClick={() => setFilter("precisa_aporte")}>Precisa Aporte</FilterChip>
        <div className="relative ml-auto">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text" placeholder="Buscar ticker..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-border text-xs w-36 focus:w-48 transition-all"
          />
        </div>
        <button
          onClick={fetchDividendosReais}
          disabled={fetchingDividendos}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface text-muted hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
          title="Buscar valor real do dividendo no Investidor10"
        >
          {fetchingDividendos ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-income" />}
          {fetchingDividendos ? "Buscando..." : "Dividendo Real"}
        </button>
        <button onClick={() => setSettingsOpen(true)} className="p-1.5 rounded-lg hover:bg-card-hover text-muted transition-colors">
          <Settings className="size-4" />
        </button>
      </div>

      {/* Fetch status */}
      {Object.keys(fetchStatus).length > 0 && !fetchingDividendos && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries(fetchStatus).map(([ticker, status]) => (
            <span key={ticker} className={`px-2 py-0.5 rounded-lg flex items-center gap-1 ${
              status === 'ok' ? 'bg-income/10 text-income' : status === 'error' ? 'bg-expense/10 text-expense' : 'bg-surface text-muted'
            }`}>
              {status === 'ok' ? <Check className="size-3" /> : status === 'error' ? <AlertTriangle className="size-3" /> : <RefreshCw className="size-3 animate-spin" />}
              {ticker}
            </span>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <SortH label="Ativo" field="ticker" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="Tipo" field="" current="" asc={false} onClick={() => {}} className="hidden lg:table-cell" />
                <SortH label="Pag" field="" current="" asc={false} onClick={() => {}} className="hidden lg:table-cell" />
                <SortH label="Cotação" field="cotacao" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="Dividendo/Cota" field="dividendo" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="DY" field="dy" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="Qtd" field="quantidade" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="Meta" field="meta" current={sortField} asc={sortAsc} onClick={toggleSort} className="hidden lg:table-cell" />
                <SortH label="Investido" field="investido" current={sortField} asc={sortAsc} onClick={toggleSort} className="hidden md:table-cell" />
                <SortH label="Falta" field="falta" current={sortField} asc={sortAsc} onClick={toggleSort} />
                <SortH label="Div/Mês" field="dividendo_mensal" current={sortField} asc={sortAsc} onClick={toggleSort} className="hidden lg:table-cell" />
                <th className="p-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isExpanded = expanded === r.asset.id;
                return (
                  <tr key={r.asset.id} className="border-b border-border hover:bg-card-hover transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : r.asset.id)}>
                    <td className="p-2 font-semibold">{r.asset.ticker}</td>
                    <td className="p-2 text-muted hidden lg:table-cell">{r.asset.subtype || r.asset.type}</td>
                    <td className="p-2 text-muted hidden lg:table-cell">{r.asset.paymentDay ? `Dia ${r.asset.paymentDay}` : "-"}</td>
                    <td className="p-2 tabular font-medium">{mask$(r.asset.currentPrice)}</td>
                    <td className="p-2 tabular">{mask$(r.asset.dividendPerShare)}</td>
                    <td className={`p-2 tabular font-medium ${yieldColor(r.divYieldMensal)}`}>{formatPercent(r.divYieldMensal)}</td>
                    <td className="p-2 tabular">{r.asset.quantity}</td>
                    <td className="p-2 tabular hidden lg:table-cell">{r.goalShares > 0 ? r.goalShares : "-"}</td>
                    <td className="p-2 tabular hidden md:table-cell">{mask$(r.investedValue)}</td>
                    <td className="p-2 tabular">
                      {r.missingValue > 0 ? (
                        <span className="text-red-500 font-medium">{mask$(r.missingValue)}</span>
                      ) : (
                        <span className="text-green-500">OK</span>
                      )}
                    </td>
                    <td className="p-2 tabular text-income font-medium hidden lg:table-cell">{mask$(r.realMonthlyDiv)}</td>
                    <td className="p-2">
                      <div className={`h-1.5 rounded-full ${progressColor(r.missingValue)}`} style={{ width: `${r.goalValue > 0 ? Math.min(100, (r.investedValue / r.goalValue) * 100) : 0}%` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded details + Dividend column */}
      {expanded && (() => {
        const r = rows.find((row) => row.asset.id === expanded);
        if (!r) return null;
        const pctCarteira = summary.totalInvested > 0 ? (r.investedValue / summary.totalInvested) * 100 : 0;
        return (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{r.asset.ticker}</h3>
              <button onClick={() => onEdit(r.asset)} className="text-xs text-primary hover:underline">Editar Meta</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniBox label="Valor Pago/Cota" value={mask$(r.asset.dividendPerShare)} color="text-income" />
              <MiniBox label="Dividendo/Mês" value={mask$(r.realMonthlyDiv)} color="text-income" />
              <MiniBox label="Retorno Anual" value={mask$(r.realMonthlyDiv * 12)} color="text-income" />
              <MiniBox label="DY Mensal" value={formatPercent(r.divYieldMensal)} color={yieldColor(r.divYieldMensal)} />
              <MiniBox label="DY 12M" value={formatPercent(r.avgYield12m)} color={yieldColor(r.avgYield12m)} />
              <MiniBox label="Valor Atual" value={mask$(r.currentValue)}
                color={r.gainLoss >= 0 ? "text-income" : "text-expense"} />
              <MiniBox label="Ganho/Perda" value={mask$(r.gainLoss)}
                color={r.gainLoss >= 0 ? "text-income" : "text-expense"} />
              <MiniBox label="% Carteira" value={formatPercent(pctCarteira)} />
              <MiniBox label="Dias para Render" value={r.asset.paymentDay ? `${r.asset.paymentDay}º dia` : "-"} />
              <MiniBox label="Anos p/ R$ 100/mês" value={r.realMonthlyDiv > 0 ? (settings.desiredDividend / r.realMonthlyDiv / 12).toFixed(1) : "-"} />
              <MiniBox label="Número Mágico" value={String(r.magicNumber)} />
              <MiniBox label="Magic Price" value={mask$(r.magicPrice)} />
              <MiniBox label="Falta p/ Meta" value={mask$(r.missingValue)} color={r.missingValue > 0 ? "text-expense" : "text-income"} />
            </div>

            {/* Dividends received */}
            {r.dividends12m.length > 0 && (
              <div>
                <p className="text-xs text-muted font-medium mb-2">Últimos 12 Dividendos</p>
                <div className="flex flex-wrap gap-2">
                  {r.dividends12m.map((d) => (
                    <span key={d.id} className="text-xs bg-surface px-2 py-1 rounded-lg">
                      {d.payment.slice(0, 7)}: <span className="text-income font-medium">{mask$(d.totalValue)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Goal progress */}
            {r.goalValue > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Progresso da Meta ({r.asset.goal})</span>
                  <span>{r.goalValue > 0 ? `${Math.min(100, (r.investedValue / r.goalValue) * 100).toFixed(0)}%` : "0%"}</span>
                </div>
                <div className="h-2.5 bg-surface rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progressColor(r.missingValue)}`}
                    style={{ width: `${r.goalValue > 0 ? Math.min(100, (r.investedValue / r.goalValue) * 100) : 0}%` }} />
                </div>
                {r.missingValue > 0 && (
                  <p className="text-xs text-muted mt-1">
                    Faltam <span className="text-red-500 font-medium">{mask$(r.missingValue)}</span> para atingir a meta
                    {r.monthsToTarget > 0 && ` (≈ ${r.monthsToTarget} meses ao ritmo atual)`}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution by type */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Distribuição por Segmento</h3>
          {typeDist.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Nenhum dado</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} innerRadius={50}
                    label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}>
                    {typeDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                    formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly dividends chart */}
        {divByMonth.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4">Dividendos por Mês</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={divByMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, fontSize: 13 }}
                    formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top dividend payers */}
      {topDividendPayers.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">Maiores Pagadores de Dividendos</h3>
          <div className="space-y-3">
            {topDividendPayers.map((r) => {
              const maxDiv = topDividendPayers[0] ? topDividendPayers[0].realMonthlyDiv : 1;
              const barPct = maxDiv > 0 ? (r.realMonthlyDiv / maxDiv) * 100 : 0;
              return (
                <div key={r.asset.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{r.asset.ticker}</span>
                    <span className="text-income font-medium tabular">{mask$(r.realMonthlyDiv)}</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Intelligence / Recommendations */}
      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="size-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Recomendações</h3>
          </div>
          <div className="space-y-2">
            {(() => {
              const tips: { text: string; type: "success" | "warning" | "info" | "error" }[] = [];
              const atTarget = rows.filter((r) => r.missingValue <= 0);
              const needingAporte = rows.filter((r) => r.missingValue > 0).sort((a, b) => b.missingValue - a.missingValue);
              const highDY = rows.filter((r) => r.divYieldMensal > 1.2).sort((a, b) => b.divYieldMensal - a.divYieldMensal);
              const lowDY = rows.filter((r) => r.divYieldMensal < 0.5 && r.investedValue > 0);
              const belowAvg = rows.filter((r) => r.asset.currentPrice < r.asset.avgPrice && r.investedValue > 0);
              const overweight = segmentPct.filter((s) => s.pct > settings.maxPerSegment);

              if (atTarget.length > 0) tips.push({ text: `${atTarget.length} fundo(s) com meta atingida. Ótimo trabalho!`, type: "success" });
              if (needingAporte.length > 0) {
                const top = needingAporte[0];
                tips.push({ text: `Priorize aporte em ${top.asset.ticker}. Faltam ${formatCurrency(top.missingValue)} para atingir a meta.`, type: "warning" });
              }
              if (highDY.length > 0) {
                const top = highDY[0];
                tips.push({ text: `${top.asset.ticker} tem o maior DY (${formatPercent(top.divYieldMensal)} a.m.). Considere aumentar posição.`, type: "success" });
              }
              if (lowDY.length > 0) {
                const top = lowDY[0];
                tips.push({ text: `${top.asset.ticker} está com DY baixo (${formatPercent(top.divYieldMensal)}). Avalie se vale manter.`, type: "warning" });
              }
              if (belowAvg.length > 0) {
                tips.push({ text: `${belowAvg.length} fundo(s) cotados abaixo do preço médio. Momento de compra?`, type: "info" });
              }
              if (overweight.length > 0) {
                tips.push({ text: `Segmento ${overweight[0].type} está com ${formatPercent(overweight[0].pct)} da carteira (max: ${settings.maxPerSegment}%). Considere diversificar.`, type: "error" });
              }
              if (summary.totalMissing > 0 && summary.monthlyDivs > 0) {
                const monthsToGoal = summary.totalMissing / summary.monthlyDivs;
                tips.push({ text: `Mantendo o ritmo atual, faltam ${Math.ceil(monthsToGoal)} meses para atingir a meta de ${formatCurrency(summary.totalGoal)}.`, type: "info" });
              }
              if (tips.length === 0) tips.push({ text: "Carteira equilibrada. Continue acompanhando!", type: "success" });

              return tips.map((tip, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-2.5 rounded-xl ${
                  tip.type === "success" ? "bg-green-500/10 text-green-500" :
                  tip.type === "warning" ? "bg-amber-500/10 text-amber-500" :
                  tip.type === "error" ? "bg-red-500/10 text-red-500" :
                  "bg-blue-500/10 text-blue-500"
                }`}>
                  <span className="mt-0.5 shrink-0">{tip.type === "success" ? "✓" : tip.type === "warning" ? "⚠" : tip.type === "error" ? "✗" : "ℹ"}</span>
                  <span>{tip.text}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents
function Card({ label, value, accent, sub, editable, onClick }: {
  label: string; value: string; accent: string; sub?: string; editable?: boolean; onClick?: () => void;
}) {
  const borderMap: Record<string, string> = { blue: "border-l-blue-500", purple: "border-l-purple-500", amber: "border-l-amber-500", emerald: "border-l-emerald-500" };
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 border-l-2 ${borderMap[accent] || "border-l-slate-500"} ${editable ? "cursor-pointer hover:bg-card-hover transition-colors" : ""}`}
      onClick={onClick}>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-bold tabular text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SortH({ label, field, current, asc, onClick, className }: {
  label: string; field: string; current: string; asc: boolean; onClick: (f: string) => void; className?: string;
}) {
  const active = current === field;
  return (
    <th className={`p-2 text-left ${className || ""}`}>
      <button onClick={() => onClick(field)} className={`flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${active ? "text-primary" : "text-muted hover:text-foreground"}`}>
        {label}
        {active && (asc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    </th>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      active ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"
    }`}>
      {children}
    </button>
  );
}

function MiniBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-sm font-bold tabular ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}
