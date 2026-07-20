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

// Fetch real dividend per share from investidor10.com.br
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

export async function fetchDividendFromInvestidor10(ticker: string): Promise<{ dividendo: number; dy: number; preco: number } | null> {
  try {
    const url = `${CORS_PROXY}${encodeURIComponent(`https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();

    // Parse dividend value from the page
    // investidor10 typically has structures like:
    // <span class="value" data-value="0.12">R$ 0,12</span>
    // or inside a card with class "card-dividendos"
    const divMatch = html.match(/"[^"]*dividend[^"]*"[^>]*>[^<]*<[^>]*>R?\$?\s*([\d.,]+)/i)
      || html.match(/R?\$?\s*([\d.,]+)\s*<\/[^>]+>[^<]*<[^>]*class="[^"]*value[^"]*"/i)
      // Generic: find price-like patterns near "dividendo" class
      || html.match(/<div[^>]*class="[^"]*value[^"]*"[^>]*>R?\$?\s*([\d.,]+)<\/div>/i)
      // Try to find the DY value (percent)
      || html.match(/yield[^>]*>[^<]*<[^>]*>([\d.,]+)%/i);

    if (!divMatch) return null;

    let value = parseFloat((divMatch[1] || "").replace(/\./g, "").replace(",", "."));
    if (isNaN(value)) return null;

    // If it's a percentage (DY), estimate from current price
    // Otherwise it's the dividend per share
    const isPercent = divMatch[0].includes("%");
    if (isPercent) {
      // Try to find the price too
      const priceMatch = html.match(/pre[çc]o[^>]*>[^<]*<[^>]*>R?\$?\s*([\d.,]+)/i)
        || html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>R?\$?\s*([\d.,]+)/i);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, "").replace(",", ".")) : 0;
      if (price > 0) {
        value = (value / 100) * price;
      }
    }

    // Also try to get price
    let preco = 0;
    const precoMatch = html.match(/cotação[^>]*>[^<]*<[^>]*>R?\$?\s*([\d.,]+)/i)
      || html.match(/pre[çc]o[^>]*>[^<]*<[^>]*>R?\$?\s*([\d.,]+)/i);
    if (precoMatch) {
      preco = parseFloat(precoMatch[1].replace(/\./g, "").replace(",", "."));
    }

    // DY
    let dy = 0;
    const dyMatch = html.match(/yield[^>]*>[^<]*<[^>]*>([\d.,]+)%/i)
      || html.match(/dividend[^y][^>]*>[^<]*<[^>]*>([\d.,]+)%/i);
    if (dyMatch) {
      dy = parseFloat(dyMatch[1].replace(",", "."));
    }

    return { dividendo: value || 0, dy, preco };
  } catch {
    return null;
  }
}

export async function updateDividendsFromInvestidor10(
  tickers: string[],
  onProgress: (ticker: string, status: 'ok' | 'error', dividendo?: number) => void
): Promise<number> {
  let updated = 0;
  for (const ticker of tickers) {
    try {
      const data = await fetchDividendFromInvestidor10(ticker);
      if (data && data.dividendo > 0) {
        const { updateAsset, getAssets } = await import('./store');
        const asset = getAssets().find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
        if (asset) {
          updateAsset(asset.id, { dividendPerShare: data.dividendo });
          updated++;
          onProgress(ticker, 'ok', data.dividendo);
          continue;
        }
      }
      onProgress(ticker, 'error');
    } catch {
      onProgress(ticker, 'error');
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
