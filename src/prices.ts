const BRAPI_BASE = "https://brapi.dev/api";

// Cache p/ evitar chamadas repetidas ao Yahoo (rate limit)
const yahooCache = new Map<string, Promise<{ sum12m: number; price: number } | null>>();

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

async function fetchYahooDividends(ticker: string): Promise<{ sum12m: number; price: number } | null> {
  const cached = yahooCache.get(ticker.toUpperCase());
  if (cached) return cached;
  const promise = (async () => {
    try {
      const yahooTicker = `${ticker}.SA`;
      console.log('Yahoo fetch', yahooTicker);
      const url = `https://query2.finance.yahoo.com/v7/finance/chart/${yahooTicker}?range=2y&interval=1d&events=dividends`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) { console.warn('Yahoo', ticker, 'status', res.status); return null; }
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
      console.log('Yahoo OK', yahooTicker, 'sum12m:', sum12m, 'price:', price);
      return { sum12m, price };
    } catch (e) {
      console.warn('Yahoo error', yahooTicker, e);
      return null;
    }
  })();
  yahooCache.set(ticker.toUpperCase(), promise);
  return promise;
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
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

async function fetchViaProxy(url: string, timeout = 10000): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(timeout) });
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchDividendFromInvestidor10(ticker: string): Promise<{ dividendo: number; dy: number } | null> {
  try {
    const html = await fetchViaProxy(`https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`);
    if (!html) return null;

    let dividendo = 0;
    let dy = 0;

    // Extract "Último Dividendo" value - R$ 0,90 pattern
    const divMatch = html.match(/<div[^>]*>*\s*Último\s+Dividendo\s*<\/div>\s*<div[^>]*>\s*R?\$?\s*([\d.,]+)/i)
      || html.match(/Último\s+Dividendo[^]*?R?\$?\s*([\d.,]+)/i)
      || html.match(/"lastDividend"[^>]*>\s*R?\$?\s*([\d.,]+)/i)
      || html.match(/card-dividendos[^]*?R?\$?\s*([\d.,]+)/i);
    if (divMatch) {
      const v = parseFloat(divMatch[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(v) && v > 0) dividendo = v;
    }

    // Extract "Dividend Yield" percentage - 12,34% pattern
    const dyMatch = html.match(/<div[^>]*>*\s*Dividend\s+Yield\s*<\/div>\s*<div[^>]*>\s*([\d.,]+)\s*%/i)
      || html.match(/Dividend\s+Yield[^]*?([\d.,]+)\s*%/i)
      || html.match(/dy["'\]]*[^>]*>\s*([\d.,]+)\s*%/i)
      || html.match(/"dy"[^>]*>\s*([\d.,]+)\s*%/i);
    if (dyMatch) {
      const v = parseFloat(dyMatch[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(v) && v > 0) dy = v;
    }

    if (dividendo <= 0 && dy <= 0) return null;
    return { dividendo, dy };
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
      const yh = await fetchYahooDividends(ticker);
      if (yh && yh.sum12m > 0) {
        const lastDiv = yh.sum12m / 12;
        if (lastDiv > 0) {
          const { updateAsset, getAssets } = await import('./store');
          const asset = getAssets().find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
          if (asset) {
            updateAsset(asset.id, { dividendPerShare: lastDiv });
            updated++;
            onProgress(ticker, 'ok', lastDiv);
            continue;
          }
        }
      }
      // Limpa dado obsoleto quando Yahoo falha
      const { updateAsset, getAssets } = await import('./store');
      const asset = getAssets().find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
      if (asset && asset.dividendPerShare > 0) {
        updateAsset(asset.id, { dividendPerShare: 0 });
      }
      onProgress(ticker, 'error');
    } catch {
      onProgress(ticker, 'error');
    }
  }
  return updated;
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
  const cap = 30;

  const results = await Promise.all(tickers.map((t) => fetchYahooDividends(t)));
  for (let i = 0; i < tickers.length; i++) {
    const yh = results[i];
    if (yh && yh.sum12m > 0 && yh.price > 0) {
      const dy12m = Math.min((yh.sum12m / yh.price) * 100, cap);
      result.set(tickers[i].toUpperCase(), { dy12m, price: yh.price, last12Sum: yh.sum12m });
    }
  }

  return result;
}

export async function fetchLastDividends(tickers: string[]): Promise<Map<string, number>> {
  if (tickers.length === 0) return new Map();
  const result = new Map<string, number>();

  const results = await Promise.all(tickers.map((t) => fetchYahooDividends(t)));
  for (let i = 0; i < tickers.length; i++) {
    const yh = results[i];
    if (yh && yh.sum12m > 0) {
      const lastDiv = yh.sum12m / 12;
      if (lastDiv > 0) result.set(tickers[i].toUpperCase(), lastDiv);
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
