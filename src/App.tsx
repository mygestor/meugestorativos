import { useState, useEffect, useMemo } from "react";
import type { Asset, DividendRecord, ContributionRecord, TradeRecord } from "./types";
import { getAssets, getDividends, getContributions, getTrades, calculateSummary, addAsset } from "./store";
import { createSeedData } from "./seed";
import { Dashboard } from "./components/Dashboard";
import { AssetTable } from "./components/AssetTable";
import { AssetDialog } from "./components/AssetDialog";
import { CSVImport } from "./components/CSVImport";
import { DividendTable } from "./components/DividendTable";
import { DividendDialog } from "./components/DividendDialog";
import { DividendImport } from "./components/DividendImport";
import { DividendDashboard } from "./components/DividendDashboard";
import { ContributionTable } from "./components/ContributionTable";
import { ContributionDialog } from "./components/ContributionDialog";
import { ContributionImport } from "./components/ContributionImport";
import { TradeTable } from "./components/TradeTable";
import { TradeDialog } from "./components/TradeDialog";
import { BarChart3, Plus, Upload, Download, Trash2, Eye, EyeOff, HandCoins, PiggyBank, ArrowLeftRight } from "lucide-react";

type Tab = "dashboard" | "assets" | "dividendos" | "aportes" | "trades";

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dividends, setDividends] = useState<DividendRecord[]>([]);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [divDialogOpen, setDivDialogOpen] = useState(false);
  const [divCsvOpen, setDivCsvOpen] = useState(false);
  const [aportDialogOpen, setAportDialogOpen] = useState(false);
  const [aportCsvOpen, setAportCsvOpen] = useState(false);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [divSubTab, setDivSubTab] = useState<"historico" | "dashboard">("dashboard");
  const [hideValues, setHideValues] = useState(false);

  const summary = useMemo(() => calculateSummary(assets), [assets]);

  function refresh() {
    setAssets([...getAssets()]);
    setDividends([...getDividends()]);
    setContributions([...getContributions()]);
    setTrades([...getTrades()]);
  }

  useEffect(() => {
    const existing = getAssets();
    if (existing.length === 0) {
      createSeedData().forEach((a) => addAsset(a));
    }
    refresh();
  }, []);

  function handleEdit(asset: Asset) {
    setEditAsset(asset);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditAsset(null);
    refresh();
  }

  function handleExport() {
    const payload = {
      assets: getAssets(),
      dividends: getDividends(),
      contributions: getContributions(),
      trades: getTrades(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestor-ativos-full-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    if (confirm("Tem certeza? Todos os dados (ativos + dividendos) serão perdidos!")) {
      localStorage.removeItem("gestor-ativos-data");
      localStorage.removeItem("gestor-ativos-dividendos");
      localStorage.removeItem("gestor-ativos-aportes");
      localStorage.removeItem("gestor-ativos-trades");
      refresh();
    }
  }

  const assetTickers = useMemo(() => assets.map((a) => a.ticker), [assets]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="font-bold text-base">Gestor de Ativos</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHideValues(!hideValues)}
              className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors"
              title="Ocultar valores"
            >
              {hideValues ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button onClick={handleExport} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors" title="Exportar backup completo">
              <Download className="size-4" />
            </button>
            <button onClick={handleClear} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors" title="Limpar dados">
              <Trash2 className="size-4 text-expense" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
            Dashboard
          </TabButton>
          <TabButton active={tab === "assets"} onClick={() => setTab("assets")}>
            Ativos ({assets.length})
          </TabButton>
          <TabButton active={tab === "dividendos"} onClick={() => setTab("dividendos")}>
            Dividendos ({dividends.length})
          </TabButton>
          <TabButton active={tab === "aportes"} onClick={() => setTab("aportes")}>
            Aportes ({contributions.length})
          </TabButton>
          <TabButton active={tab === "trades"} onClick={() => setTab("trades")}>
            Compra/Venda ({trades.length})
          </TabButton>
          <div className="flex-1 min-w-4" />
          {tab === "assets" && (
            <button
              onClick={() => { setEditAsset(null); setDialogOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors shrink-0"
            >
              <Plus className="size-4" /> Novo Ativo
            </button>
          )}
          {tab === "dividendos" && (
            <div className="flex items-center gap-2 shrink-0">
              {divSubTab === "historico" && (
                <>
                  <button onClick={() => setDivCsvOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors">
                    <Upload className="size-4" /> Importar
                  </button>
                  <button onClick={() => setDivDialogOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors">
                    <HandCoins className="size-4" /> Novo Dividendo
                  </button>
                </>
              )}
            </div>
          )}
          {tab === "aportes" && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAportCsvOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors"
              >
                <Upload className="size-4" /> Importar
              </button>
              <button
                onClick={() => setAportDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <PiggyBank className="size-4" /> Novo Aporte
              </button>
            </div>
          )}
          {tab === "trades" && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setTradeDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <ArrowLeftRight className="size-4" /> Nova Operação
              </button>
            </div>
          )}
          {tab === "dashboard" && (
            <button
              onClick={() => setCsvOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors shrink-0"
            >
              <Upload className="size-4" /> Importar Ativos
            </button>
          )}
        </div>

        {tab === "dashboard" && <Dashboard summary={summary} assets={assets} hideValues={hideValues} />}

        {tab === "assets" && (
          <AssetTable assets={assets} hideValues={hideValues} onEdit={handleEdit} onRefresh={refresh} />
        )}

        {tab === "dividendos" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDivSubTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  divSubTab === "dashboard" ? "bg-primary/20 text-primary" : "bg-surface text-muted hover:text-foreground"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setDivSubTab("historico")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  divSubTab === "historico" ? "bg-primary/20 text-primary" : "bg-surface text-muted hover:text-foreground"
                }`}
              >
                Histórico
              </button>
            </div>
            {divSubTab === "dashboard" ? (
              <DividendDashboard dividends={dividends} hideValues={hideValues} />
            ) : (
              <DividendTable dividends={dividends} hideValues={hideValues} onRefresh={refresh} />
            )}
          </div>
        )}

        {tab === "aportes" && (
          <ContributionTable contributions={contributions} hideValues={hideValues} onRefresh={refresh} />
        )}

        {tab === "trades" && (
          <TradeTable trades={trades} hideValues={hideValues} onRefresh={refresh} />
        )}
      </div>

      {dialogOpen && <AssetDialog asset={editAsset} onClose={handleClose} />}
      {csvOpen && <CSVImport onClose={() => { setCsvOpen(false); refresh(); }} />}
      {divDialogOpen && <DividendDialog onClose={() => { setDivDialogOpen(false); refresh(); }} tickers={assetTickers} />}
      {divCsvOpen && <DividendImport onClose={() => { setDivCsvOpen(false); refresh(); }} />}
      {aportDialogOpen && <ContributionDialog onClose={() => { setAportDialogOpen(false); refresh(); }} />}
      {aportCsvOpen && <ContributionImport onClose={() => { setAportCsvOpen(false); refresh(); }} />}
      {tradeDialogOpen && <TradeDialog onClose={() => { setTradeDialogOpen(false); refresh(); }} tickers={assetTickers} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
        active ? "bg-primary text-white" : "bg-card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
