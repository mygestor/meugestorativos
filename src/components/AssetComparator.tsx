import { useState, useEffect, useMemo } from "react";
import type { Asset } from "../types";
import { formatCurrency, formatPercent } from "../format";
import { fetchFundamentals, type FundamentalData } from "../prices";
import { AssetLogo } from "./AssetLogo";
import { Plus, X, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  assets: Asset[];
  hideValues: boolean;
}

interface AssetWithFundamentals extends Asset {
  fundamentals: FundamentalData | null;
}

export function AssetComparator({ assets, hideValues }: Props) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [assetsData, setAssetsData] = useState<Map<string, AssetWithFundamentals>>(new Map());
  const [loading, setLoading] = useState(false);

  const filteredAssets = useMemo(() => {
    if (!searchTerm) return assets.filter((a) => !selectedTickers.includes(a.ticker));
    return assets.filter(
      (a) =>
        !selectedTickers.includes(a.ticker) &&
        (a.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.sector?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [assets, selectedTickers, searchTerm]);

  useEffect(() => {
    if (selectedTickers.length === 0) {
      setAssetsData(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      const newData = new Map<string, AssetWithFundamentals>();
      for (const ticker of selectedTickers) {
        const asset = assets.find((a) => a.ticker === ticker);
        if (!asset) continue;

        const fundamentals = await fetchFundamentals(ticker);
        if (!cancelled) {
          newData.set(ticker, { ...asset, fundamentals });
        }
      }
      if (!cancelled) {
        setAssetsData(newData);
        setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [selectedTickers, assets]);

  function addTicker(ticker: string) {
    if (!selectedTickers.includes(ticker) && selectedTickers.length < 5) {
      setSelectedTickers([...selectedTickers, ticker]);
      setSearchTerm("");
    }
  }

  function removeTicker(ticker: string) {
    setSelectedTickers(selectedTickers.filter((t) => t !== ticker));
  }

  const indicators = [
    { key: "currentPrice", label: "Cotação", format: (v: number) => formatCurrency(v) },
    { key: "dividendPerShare", label: "Dividendo/Cota", format: (v: number) => formatCurrency(v) },
    { key: "divYield12m", label: "DY 12M", format: (v: number | null) => v != null ? formatPercent(v) : "—" },
    { key: "pe", label: "P/L", format: (v: number | null) => v != null ? `${v.toFixed(1)}x` : "—" },
    { key: "priceToBook", label: "P/VP", format: (v: number | null) => v != null ? `${v.toFixed(1)}x` : "—" },
    { key: "roe", label: "ROE", format: (v: number | null) => v != null ? formatPercent(v) : "—" },
    { key: "evToEbitda", label: "EV/EBITDA", format: (v: number | null) => v != null ? `${v.toFixed(1)}x` : "—" },
    { key: "netMargin", label: "Margem Líquida", format: (v: number | null) => v != null ? formatPercent(v) : "—" },
    { key: "investedAmount", label: "Investido", format: (v: number) => formatCurrency(v) },
    { key: "quantity", label: "Quantidade", format: (v: number) => String(v) },
    { key: "avgPrice", label: "Preço Médio", format: (v: number) => formatCurrency(v) },
  ];

  function getBestValue(key: string): number | null {
    const values = selectedTickers
      .map((t) => {
        const data = assetsData.get(t);
        if (!data) return null;
        if (key.startsWith("pe") || key === "evToEbitda") {
          return data.fundamentals?.[key as keyof FundamentalData] as number ?? null;
        }
        return (data as any)[key] ?? null;
      })
      .filter((v): v is number => v != null && !isNaN(v));

    if (values.length === 0) return null;

    // For P/L and EV/EBITDA, lower is better
    if (key === "pe" || key === "evToEbitda") {
      return Math.min(...values);
    }
    // For most others, higher is better
    return Math.max(...values);
  }

  function getWorstValue(key: string): number | null {
    const values = selectedTickers
      .map((t) => {
        const data = assetsData.get(t);
        if (!data) return null;
        if (key.startsWith("pe") || key === "evToEbitda") {
          return data.fundamentals?.[key as keyof FundamentalData] as number ?? null;
        }
        return (data as any)[key] ?? null;
      })
      .filter((v): v is number => v != null && !isNaN(v));

    if (values.length === 0) return null;

    if (key === "pe" || key === "evToEbitda") {
      return Math.max(...values);
    }
    return Math.min(...values);
  }

  return (
    <div className="space-y-4">
      {/* Asset Selector */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-3">Selecionar Ativos para Comparar</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedTickers.map((ticker) => (
            <span
              key={ticker}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
            >
              <AssetLogo ticker={ticker} size={16} />
              {ticker}
              <button
                onClick={() => removeTicker(ticker)}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {selectedTickers.length < 5 && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ativo..."
              className="px-3 py-1.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors min-w-[120px]"
            />
          )}
        </div>
        {searchTerm && filteredAssets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredAssets.slice(0, 10).map((a) => (
              <button
                key={a.ticker}
                onClick={() => addTicker(a.ticker)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface/80 rounded-xl text-sm transition-colors"
              >
                <Plus className="size-3" />
                {a.ticker}
              </button>
            ))}
          </div>
        )}
        {selectedTickers.length === 0 && (
          <p className="text-xs text-muted">Selecione pelo menos 2 ativos para comparar</p>
        )}
      </div>

      {/* Comparison Table */}
      {selectedTickers.length >= 2 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted">Carregando indicadores...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="p-3 text-left text-xs font-medium">Indicador</th>
                    {selectedTickers.map((ticker) => (
                      <th key={ticker} className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <AssetLogo ticker={ticker} size={20} />
                          <span className="font-medium text-xs">{ticker}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indicators.map((ind) => {
                    const bestVal = getBestValue(ind.key);
                    const worstVal = getWorstValue(ind.key);
                    return (
                      <tr key={ind.key} className="border-b border-border/50 hover:bg-surface/30 transition-colors">
                        <td className="p-3 text-xs font-medium text-muted">{ind.label}</td>
                        {selectedTickers.map((ticker) => {
                          const data = assetsData.get(ticker);
                          if (!data) return <td key={ticker} className="p-3 text-center">—</td>;

                          let value: any;
                          if (ind.key.startsWith("pe") || ind.key === "evToEbitda" || ind.key === "roe" || ind.key === "netMargin") {
                            value = data.fundamentals?.[ind.key as keyof FundamentalData] ?? null;
                          } else {
                            value = (data as any)[ind.key] ?? null;
                          }

                          const isBest = bestVal !== null && value === bestVal && selectedTickers.length > 1;
                          const isWorst = worstVal !== null && value === worstVal && selectedTickers.length > 1 && bestVal !== worstVal;

                          return (
                            <td
                              key={ticker}
                              className={`p-3 text-center tabular font-medium ${
                                isBest ? "text-green-500" : isWorst ? "text-red-500" : ""
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {ind.format(value)}
                                {isBest && <TrendingUp className="size-3 text-green-500" />}
                                {isWorst && <TrendingDown className="size-3 text-red-500" />}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedTickers.length < 2 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted mb-2">Selecione pelo menos 2 ativos para comparar</p>
          <p className="text-xs text-muted">Você pode selecionar até 5 ativos</p>
        </div>
      )}
    </div>
  );
}