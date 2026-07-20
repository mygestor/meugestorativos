const BRAPI_BASE = "https://brapi.dev/api";

interface BrapiDividend {
  value: number;
  date: string;
  type: string;
  yield?: number;
}

interface BrapiQuote {
  symbol: string;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  dividendYield: number | null;
  dividendPerShare: number | null;
  dividendsData?: BrapiDividend[];
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
          // Try last entry in dividendsData (most accurate)
          let divValue = 0;
          if (quote.dividendsData && quote.dividendsData.length > 0) {
            const last = quote.dividendsData[quote.dividendsData.length - 1];
            if (last.value > 0) divValue = last.value;
          }
          if (divValue > 0) {
            updates.dividendPerShare = divValue;
          } else if (quote.dividendPerShare != null && quote.dividendPerShare > 0) {
            updates.dividendPerShare = quote.dividendPerShare;
          }
          updateAsset(asset.id, updates);
          updated++;
          onProgress(asset.ticker, 'ok', quote.regularMarketPrice);
        } else {
          onProgress(asset.ticker, 'error');
        }
      }
    } catch {
      for (const ticker of chunk) {
        onProgress(ticker, 'error');
      }
    }
  }
  return updated;
}

// Fetch dividend per share from brapi.dev (primary source)
export async function fetchDividendFromBrapi(ticker: string): Promise<{ dividendo: number; yield: number; preco: number } | null> {
  try {
    const quotes = await fetchQuotes([ticker]);
    const quote = quotes.get(ticker.toUpperCase());
    if (!quote) return null;

    // priority 1: last actual dividend from dividendsData array
    if (quote.dividendsData && quote.dividendsData.length > 0) {
      const last = quote.dividendsData[quote.dividendsData.length - 1];
      if (last.value > 0) {
        return {
          dividendo: last.value,
          yield: (quote.dividendYield ?? 0) * 100,
          preco: quote.regularMarketPrice ?? 0,
        };
      }
    }

    return {
      dividendo: quote.dividendPerShare ?? 0,
      yield: (quote.dividendYield ?? 0) * 100,
      preco: quote.regularMarketPrice ?? 0,
    };
  } catch {
    return null;
  }
}

// Fetch dividend per share from investidor10.com.br (fallback)
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

export async function fetchDividendFromInvestidor10(ticker: string): Promise<{ dividendo: number } | null> {
  try {
    const url = `${CORS_PROXY}${encodeURIComponent(`https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();

    // Try multiple patterns to find "Último Dividendo" value
    let value = 0;

    // Pattern 1: "Último Dividendo" followed by a value
    const patterns = [
      /Último\s*Dividendo[^]*?R?\$?\s*([\d.,]+)/i,
      /Dividendo[^]*?R?\$?\s*([\d.,]+)/i,
      /card-dividendos[^]*?R?\$?\s*([\d.,]+)/i,
      /"value"[^>]*>R?\$?\s*([\d.,]+)</i,
      /R?\$?\s*([\d.,]+)\s*<\/[^>]*>\s*<[^>]*class="[^"]*(?:value|dividend)[^"]*"/i,
      /data-value="([\d.]+)"/i,
    ];

    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const v = parseFloat((m[1] || "").replace(/\./g, "").replace(",", "."));
        if (!isNaN(v) && v > 0) {
          value = v;
          break;
        }
      }
    }

    if (value <= 0) return null;
    return { dividendo: value };
  } catch {
    return null;
  }
}

export async function updateDividendsFromBrapi(
  tickers: string[],
  onProgress: (ticker: string, status: 'ok' | 'error', dividendo?: number) => void
): Promise<number> {
  let updated = 0;
  for (const ticker of tickers) {
    try {
      const data = await fetchDividendFromBrapi(ticker);
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
      // Fallback to investidor10
      const fallback = await fetchDividendFromInvestidor10(ticker);
      if (fallback) {
        const { updateAsset, getAssets } = await import('./store');
        const asset = getAssets().find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
        if (asset) {
          updateAsset(asset.id, { dividendPerShare: fallback.dividendo });
          updated++;
          onProgress(ticker, 'ok', fallback.dividendo);
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

async function fetchYahooDividends(ticker: string): Promise<{ sum12m: number; price: number } | null> {
  try {
    const yahooTicker = `${ticker}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=2y&interval=1d&events=dividends`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const price = result.meta?.regularMarketPrice ?? 0;
    const dividends = result.events?.dividends;
    if (!dividends) return { sum12m: 0, price };
    const now = Date.now() / 1000;
    const oneYearAgo = now - 365 * 24 * 3600;
    let sum12m = 0;
    for (const key of Object.keys(dividends)) {
      const d = dividends[key];
      if (d.date >= oneYearAgo) sum12m += d.amount;
    }
    return { sum12m, price };
  } catch {
    return null;
  }
}

async function fetchStatusInvestDividends(ticker: string): Promise<{ sum12m: number; price: number } | null> {
  try {
    const url = `https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const html = await res.text();
    // Extract current price from the page
    const priceMatch = html.match(/"currentPrice":\s*"?(\d+[.,]\d+)"?/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : 0;
    // Extract last 12 dividends from proventos section
    const provMatch = html.match(/"proventos"\s*:\s*\[([\s\S]*?)\]/);
    if (!provMatch) return { sum12m: 0, price };
    let sum12m = 0;
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    try {
      const proventos = JSON.parse(`[${provMatch[1]}]`);
      for (const p of proventos) {
        if (p.dataPagamento) {
          const dt = new Date(p.dataPagamento);
          if (dt >= oneYearAgo) sum12m += p.valor || 0;
        }
      }
    } catch { /* ignore parse errors */ }
    return { sum12m, price };
  } catch {
    return null;
  }
}

export async function fetchDY12m(tickers: string[]): Promise<Map<string, { dy12m: number; price: number; last12Sum: number }>> {
  if (tickers.length === 0) return new Map();
  const result = new Map<string, { dy12m: number; price: number; last12Sum: number }>();
  const chunkSize = 10;

  // Try brapi.dev first
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    try {
      const quotes = await fetchQuotes(chunk);
      for (const [ticker, quote] of quotes) {
        const price = quote.regularMarketPrice ?? 0;
        let last12Sum = 0;
        if (quote.dividendsData && quote.dividendsData.length > 0) {
          const last12 = quote.dividendsData.slice(-12);
          last12Sum = last12.reduce((s, d) => s + d.value, 0);
        }
        const dy12m = price > 0 && last12Sum > 0 ? (last12Sum / price) * 100 : 0;
        result.set(ticker, { dy12m, price, last12Sum });
      }
    } catch {
      // ignore
    }
  }

  // Fallback for tickers not found by brapi
  for (const ticker of tickers) {
    if (result.has(ticker) && result.get(ticker)!.last12Sum > 0) continue;
    const res = await fetchYahooDividends(ticker);
    if (res && res.sum12m > 0) {
      const dy12m = res.price > 0 ? (res.sum12m / res.price) * 100 : 0;
      if (!result.has(ticker)) result.set(ticker, { dy12m, price: res.price, last12Sum: res.sum12m });
      else if (result.get(ticker)!.last12Sum <= 0) {
        result.set(ticker, { dy12m, price: res.price, last12Sum: res.sum12m });
      }
    } else {
      const res2 = await fetchStatusInvestDividends(ticker);
      if (res2 && res2.sum12m > 0) {
        const dy12m = res2.price > 0 ? (res2.sum12m / res2.price) * 100 : 0;
        if (!result.has(ticker)) result.set(ticker, { dy12m, price: res2.price, last12Sum: res2.sum12m });
        else if (result.get(ticker)!.last12Sum <= 0) {
          result.set(ticker, { dy12m, price: res2.price, last12Sum: res2.sum12m });
        }
      }
    }
  }

  return result;
}

export async function fetchLastDividends(tickers: string[]): Promise<Map<string, number>> {
  if (tickers.length === 0) return new Map();
  const result = new Map<string, number>();
  const chunkSize = 10;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    try {
      const quotes = await fetchQuotes(chunk);
      for (const [ticker, quote] of quotes) {
        let lastDiv = 0;
        if (quote.dividendsData && quote.dividendsData.length > 0) {
          lastDiv = quote.dividendsData[quote.dividendsData.length - 1].value;
        }
        if (lastDiv <= 0 && quote.dividendPerShare != null && quote.dividendPerShare > 0) {
          lastDiv = quote.dividendPerShare;
        }
        result.set(ticker, lastDiv);
      }
    } catch {
      // ignore
    }
  }
  return result;
}

// Legacy - kept for backward compat
export async function updateDividendsFromInvestidor10(
  tickers: string[],
  onProgress: (ticker: string, status: 'ok' | 'error', dividendo?: number) => void
): Promise<number> {
  return updateDividendsFromBrapi(tickers, onProgress);
}

export function calcMonthlyDividendPerShare(
  dividendYield: number | null,
  price: number
): number {
  if (!dividendYield || !price) return 0;
  return (dividendYield * price) / 12;
}
