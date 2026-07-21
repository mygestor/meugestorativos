import { useState, useEffect, useMemo } from "react";
import type { Asset, DividendRecord, ContributionRecord, TradeRecord } from "./types";
import { getAssets, getDividends, getContributions, getTrades, calculateSummary, addAsset, clearAll, clearDividends, clearContributions, importFullBackup, importSeedData, cleanupOrphanAssets, reclassifyAssets, initFromRemoteData, exportAllData } from "./store";
import { syncAssetsFromTrades } from "./assetHelper";
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
import { TradeImport } from "./components/TradeImport";
import { PlanningPage } from "./components/PlanningPage";
import { IRPFReport } from "./components/IRPFReport";
import { DividendAlerts } from "./components/DividendAlerts";
import { DividendCalendar } from "./components/DividendCalendar";
import { UpdateToast } from "./components/UpdateToast";
import { FIIAnalysis } from "./components/FIIAnalysis";
import { TrendingUp, Plus, Upload, Download, Trash2, Eye, EyeOff, LayoutDashboard, Briefcase, HandCoins, PiggyBank, ArrowLeftRight, Target, FileText, Building2 } from "lucide-react";

type Tab = "dashboard" | "assets" | "dividendos" | "aportes" | "trades" | "planejamento" | "analise-fii";

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
  const [tradeImportOpen, setTradeImportOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<TradeRecord | null>(null);
  const [irpfOpen, setIrpfOpen] = useState(false);
  const [divSubTab, setDivSubTab] = useState<"historico" | "dashboard" | "calendario">("dashboard");
  const [hideValues, setHideValues] = useState(false);
  const [toast, setToast] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("gestor-theme");
    return saved === "light" ? "light" : "dark";
  });
  const [appName, setAppName] = useState(() => localStorage.getItem("gestor-app-name") || "Gestor de Ativos");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gestor-theme", theme);
  }, [theme]);

  const summary = useMemo(() => calculateSummary(assets, dividends), [assets, dividends]);

  function refresh() {
    syncAssetsFromTrades();
    setAssets([...getAssets()]);
    setDividends([...getDividends()]);
    setContributions([...getContributions()]);
    setTrades([...getTrades()]);
  }

  useEffect(() => {
    initFromRemoteData().then(() => refresh());
  }, []);

  // Auto-fetch dividends on load with retry
  useEffect(() => {
    if (assets.length === 0) return;
    
    const autoFetchDividends = async () => {
      try {
        const { updatePrices } = await import('./prices');
        let attempt = 0;
        const maxAttempts = 2;
        let updated = 0;
        
        while (attempt < maxAttempts && updated === 0) {
          console.log(`[Auto-fetch] Tentativa ${attempt + 1} de ${maxAttempts}`);
          updated = await updatePrices(
            assets.map(a => ({ id: a.id, ticker: a.ticker })),
            (ticker, status) => {
              console.log(`[Auto-fetch] ${ticker}: ${status}`);
            }
          );
          if (updated === 0) {
            // Se nenhum ativo foi atualizado, aguardar antes de retry
            await new Promise(r => setTimeout(r, 1000));
          }
          attempt++;
        }
        
        setTimeout(() => refresh(), 500);
        console.log(`[Auto-fetch] Finalizado: ${updated} ativos atualizados`);
      } catch (e) {
        console.error('[Auto-fetch] Erro:', e);
      }
    };
    
    // Iniciar busca após página renderizar
    const timer = setTimeout(autoFetchDividends, 1000);
    return () => clearTimeout(timer);
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
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          importFullBackup(data);
          refresh();
        } catch {
          alert("Arquivo inválido");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleSeedData() {
    if (confirm("Adicionar dados de exemplo? (16 ativos FII + AÇÃO)")) {
      importSeedData();
      refresh();
    }
  }

  function handleReclassify() {
    const changed = reclassifyAssets();
    refresh();
    alert(`${changed} ativo(s) reclassificado(s)`);
  }

  function handleCleanupOrphans() {
    if (confirm("Remover ativos com quantidade e investimento zerados?")) {
      const removed = cleanupOrphanAssets();
      refresh();
      if (removed > 0) alert(`${removed} ativo(s) removido(s)`);
      else alert("Nenhum ativo removido");
    }
  }

  async function handleUpdatePrices() {
    const { updatePrices } = await import('./prices');
    const toastId = `update-${Date.now()}`;
    
    try {
      setToast({ id: toastId, message: `Buscando preços de ${assets.length} ativo(s)...`, type: 'info' });
      
      const updated = await updatePrices(
        assets.map(a => ({ id: a.id, ticker: a.ticker })),
        (ticker, status, price) => {
          console.log(`[Preço] ${ticker}: ${status}${price ? ` (R$ ${price.toFixed(2)})` : ''}`);
        }
      );
      
      setTimeout(() => refresh(), 500);
      
      setToast({ 
        id: toastId, 
        message: `✓ ${updated} ativo(s) atualizado(s) com preços de mercado!`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Erro ao buscar preços:', error);
      setToast({ 
        id: toastId, 
        message: `✗ Erro ao buscar preços: ${error instanceof Error ? error.message : 'Desconhecido'}`, 
        type: 'error' 
      });
    }
  }

  function handleClear() {
    if (confirm("Tem certeza? Todos os dados (ativos + dividendos + aportes + trades) serão perdidos!")) {
      clearAll();
      refresh();
    }
  }

  async function handleResetAndReseed() {
    if (confirm("Limpar TODOS os dados e reimportar 16 FIIs + 2 Ações com preços reais?\n\nIsso vai resetar tudo e buscar preços da internet.")) {
      const { resetAndReseedData } = await import('./store');
      const toastId = `reseed-${Date.now()}`;
      setToast({ id: toastId, message: 'Limpando dados e reimportando...', type: 'info' });
      
      try {
        await resetAndReseedData();
        setTimeout(() => refresh(), 500);
        
        setToast({ 
          id: toastId, 
          message: '✓ Dados resetados com sucesso! Preços sendo buscados...', 
          type: 'success' 
        });
      } catch (error) {
        console.error('Erro ao resetar:', error);
        setToast({ 
          id: toastId, 
          message: `✗ Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`, 
          type: 'error' 
        });
      }
    }
  }

  function handleClearDividends() {
    if (confirm("Excluir todos os dividendos?")) {
      clearDividends();
      refresh();
    }
  }

  function handleClearContributions() {
    if (confirm("Excluir todos os aportes?")) {
      clearContributions();
      refresh();
    }
  }

  const assetTickers = useMemo(() => assets.map((a) => a.ticker), [assets]);
  const fiiAssets = useMemo(() => assets.filter((a) => a.type === "FII"), [assets]);
  const stockAssets = useMemo(() => assets.filter((a) => a.type !== "FII"), [assets]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="size-5 text-primary" />
            <div>
              {editingName ? (
                <input
                  autoFocus
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  onBlur={() => { setEditingName(false); localStorage.setItem("gestor-app-name", appName); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); localStorage.setItem("gestor-app-name", appName); } }}
                  className="font-bold text-base leading-tight bg-surface border border-border rounded-lg px-2 py-0.5 text-foreground w-56"
                />
              ) : (
                <h1
                  className="font-bold text-base leading-tight cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setEditingName(true)}
                  title="Clique para editar"
                >
                  {appName}
                </h1>
              )}
              <p className="text-xs text-muted leading-tight">Portfólio de Investimentos</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> : <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
            </button>
            <button
              onClick={() => setHideValues(!hideValues)}
              className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors"
              title="Ocultar valores"
            >
              {hideValues ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <DividendAlerts assets={assets} />
            <button onClick={handleUpdatePrices} className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-primary transition-colors hidden sm:block" title="Atualizar preços e dividendos dos FIIs">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            </button>
            <button onClick={handleSeedData} className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-primary transition-colors hidden sm:block" title="Adicionar dados de exemplo">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </button>
            <button onClick={handleImportBackup} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors" title="Importar backup">
              <Upload className="size-4" />
            </button>
            <button onClick={handleExport} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors" title="Exportar backup completo">
              <Download className="size-4" />
            </button>
            <button onClick={handleCleanupOrphans} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors hidden sm:block" title="Limpar ativos órfãos">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
            <button onClick={() => setIrpfOpen(true)} className="p-2 rounded-lg hover:bg-card-hover text-muted transition-colors hidden sm:block" title="Relatório IRPF">
              <FileText className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="relative mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard}>
            Dashboard
          </TabButton>
          <TabButton active={tab === "assets"} onClick={() => setTab("assets")} icon={Briefcase}>
            Ativos ({assets.length})
          </TabButton>
          <TabButton active={tab === "dividendos"} onClick={() => setTab("dividendos")} icon={HandCoins}>
            Dividendos ({dividends.length})
          </TabButton>
          <TabButton active={tab === "aportes"} onClick={() => setTab("aportes")} icon={PiggyBank}>
            Aportes ({contributions.length})
          </TabButton>
          <TabButton active={tab === "trades"} onClick={() => setTab("trades")} icon={ArrowLeftRight}>
            Compra/Venda ({trades.length})
          </TabButton>
          <TabButton active={tab === "analise-fii"} onClick={() => setTab("analise-fii")} icon={Building2}>
            Análise FII ({fiiAssets.length})
          </TabButton>
          <TabButton active={tab === "planejamento"} onClick={() => setTab("planejamento")} icon={Target}>
            Planejamento
          </TabButton>
          <div className="flex-1 min-w-4" />
          {tab === "assets" && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReclassify}
                className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors"
                title="Reclassificar ativos por tipo automaticamente"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21V3m0 0l-4 4m4-4l4 4m6 12V7m0 0l-4 4m4-4l4 4"/></svg>
                Reclassificar
              </button>
              <button
                onClick={() => { setEditAsset(null); setDialogOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors shrink-0"
              >
                <Plus className="size-4" /> Novo Ativo
              </button>
            </div>
          )}
          {tab === "dividendos" && <div className="flex items-center gap-2 shrink-0" />}
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
              <button
                onClick={handleClearContributions}
                className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-expense transition-colors"
                title="Limpar aportes"
              >
                <Trash2 className="size-4 text-expense" />
              </button>
            </div>
          )}
          {tab === "trades" && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setTradeImportOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-card text-muted hover:text-foreground rounded-xl text-sm font-medium border border-border transition-colors"
              >
                <Upload className="size-4" /> Importar
              </button>
              <button
                onClick={() => { setEditTrade(null); setTradeDialogOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <ArrowLeftRight className="size-4" /> Nova Operação
              </button>
            </div>
          )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent sm:hidden" />
        </div>

        {tab === "dashboard" && <Dashboard summary={summary} assets={assets} hideValues={hideValues} contributions={contributions} trades={trades} />}

        {tab === "assets" && (
          <AssetTable assets={assets} hideValues={hideValues} onEdit={handleEdit} onRefresh={refresh} />
        )}

        {tab === "dividendos" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDivSubTab("dashboard")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  divSubTab === "dashboard" ? "bg-primary text-white" : "bg-card text-muted hover:text-foreground"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setDivSubTab("historico")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  divSubTab === "historico" ? "bg-primary text-white" : "bg-card text-muted hover:text-foreground"
                }`}
              >
                Histórico
              </button>
              <button
                onClick={() => setDivSubTab("calendario")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  divSubTab === "calendario" ? "bg-primary text-white" : "bg-card text-muted hover:text-foreground"
                }`}
              >
                Calendário
              </button>
              {divSubTab === "historico" && (
                <>
                  <div className="w-px h-5 bg-border mx-1" />
                  <button onClick={() => setDivCsvOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-muted hover:text-foreground rounded-xl text-xs font-medium border border-border transition-colors">
                    <Upload className="size-3.5" /> Importar
                  </button>
                  <button onClick={() => setDivDialogOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary-dark transition-colors">
                    <HandCoins className="size-3.5" /> Novo Dividendo
                  </button>
                  <button onClick={handleClearDividends} className="p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-expense transition-colors" title="Limpar dividendos">
                    <Trash2 className="size-4 text-expense" />
                  </button>
                </>
              )}
            </div>
            {divSubTab === "dashboard" ? (
              <DividendDashboard dividends={dividends} hideValues={hideValues} onRefresh={refresh} />
            ) : divSubTab === "calendario" ? (
              <DividendCalendar assets={assets} />
            ) : (
              <DividendTable dividends={dividends} hideValues={hideValues} onRefresh={refresh} />
            )}
          </div>
        )}

        {tab === "aportes" && (
          <ContributionTable contributions={contributions} hideValues={hideValues} onRefresh={refresh} />
        )}

        {tab === "trades" && (
          <TradeTable trades={trades} hideValues={hideValues} onRefresh={refresh} onEdit={(t) => { setEditTrade(t); setTradeDialogOpen(true); }} />
        )}

        {tab === "analise-fii" && (
          <FIIAnalysis fiiAssets={fiiAssets} hideValues={hideValues}
            onEdit={(a) => { setEditAsset(a); setDialogOpen(true); }} onRefresh={refresh} />
        )}
        {tab === "planejamento" && (
          <PlanningPage assets={assets} dividends={dividends} contributions={contributions} trades={trades} hideValues={hideValues} />
        )}
      </div>

      <footer className="border-t border-border mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-muted">
          Gestor de Ativos v1.0
        </div>
      </footer>

      {dialogOpen && <AssetDialog asset={editAsset} onClose={handleClose} />}
      {csvOpen && <CSVImport onClose={() => { setCsvOpen(false); refresh(); }} />}
      {divDialogOpen && <DividendDialog onClose={() => { setDivDialogOpen(false); refresh(); }} tickers={assetTickers} />}
      {divCsvOpen && <DividendImport onClose={() => { setDivCsvOpen(false); refresh(); }} />}
      {aportDialogOpen && <ContributionDialog onClose={() => { setAportDialogOpen(false); refresh(); }} />}
      {aportCsvOpen && <ContributionImport onClose={() => { setAportCsvOpen(false); refresh(); }} />}
      {tradeDialogOpen && <TradeDialog onClose={() => { setTradeDialogOpen(false); setEditTrade(null); refresh(); }} tickers={assetTickers} editTrade={editTrade} />}
      {tradeImportOpen && <TradeImport onClose={() => { setTradeImportOpen(false); refresh(); }} />}
      {irpfOpen && <IRPFReport trades={trades} dividends={dividends} onClose={() => setIrpfOpen(false)} />}
      <UpdateToast />
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
        active ? "bg-primary text-white" : "bg-card text-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
