const BRAPI_BASE = "https://brapi.dev/api";

interface BrapiQuote {
  symbol: string;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  dividendYield: number | null;
  dividendPerShare: number | null;
}

interface BrapiResponse {
  results: BrapiQuote[];
  error?: string;
}

async function fetchQuotes(tickers: string[]): Promise<Map<string, BrapiQuote>> {
  if (tickers.length === 0) return new Map();

  const tickersStr = tickers.join(",");
  const url = `${BRAPI_BASE}/quote/${tickersStr}?fundamental=false&dividends=true`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data: BrapiResponse = await response.json();
  if (data.error) throw new Error(data.error);

  const map = new Map<string, BrapiQuote>();
  data.results?.forEach((q) => {
    if (q.symbol) map.set(q.symbol.toUpperCase(), q);
  });
  return map;
}

export async function updatePrices(
  assets: { id: string; ticker: string }[],
  onProgress: (ticker: string, status: 'ok' | 'error', price?: number) => void
): Promise<number> {
  const tickers = assets.map((a) => a.ticker);
  let updated = 0;

  const chunkSize = 10;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    try {
      const quotes = await fetchQuotes(chunk);

      for (const asset of assets.slice(i, i + chunkSize)) {
        const quote = quotes.get(asset.ticker.toUpperCase());
        if (quote && quote.regularMarketPrice != null && quote.regularMarketPrice > 0) {
          const { updateAsset } = await import('./store');
          const updates: Record<string, number> = {
            currentPrice: quote.regularMarketPrice,
          };

          if (quote.dividendPerShare != null && quote.dividendPerShare > 0) {
            updates.dividendPerShare = quote.dividendPerShare;
          }

          updateAsset(asset.id, updates);
          updated++;
          onProgress(asset.ticker, 'ok', quote.regularMarketPrice);
        } else {
          onProgress(asset.ticker, 'error');
        }
      }
    } catch (err) {
      for (const ticker of chunk) {
        onProgress(ticker, 'error');
      }
    }
  }

  return updated;
}

export function calcMonthlyDividendPerShare(
  dividendYield: number | null,
  price: number
): number {
  if (!dividendYield || !price) return 0;
  return (dividendYield * price) / 12;
}
