const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchYahooChart(ticker, range, interval) {
  const cacheKey = `${ticker}|${range}|${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const yahooTicker = ticker.toUpperCase().replace(/\.SA$/, "") + ".SA";
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  // Build month -> close price map
  const monthPrices = {};
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const d = new Date(timestamps[i] * 1000);
    const key = d.toISOString().slice(0, 7); // YYYY-MM
    monthPrices[key] = Math.round(closes[i] * 100) / 100;
  }

  cache.set(cacheKey, { data: monthPrices, ts: Date.now() });
  return monthPrices;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET / (status)
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // GET /historical?tickers=HGLG11,KNCR11&range=5y&interval=1mo
    if (url.pathname === "/historical") {
      const tickers = (url.searchParams.get("tickers") || "")
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const range = url.searchParams.get("range") || "5y";
      const interval = url.searchParams.get("interval") || "1mo";

      if (tickers.length === 0) {
        return new Response(JSON.stringify({ error: "No tickers provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      if (tickers.length > 20) {
        return new Response(JSON.stringify({ error: "Max 20 tickers" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const results = {};
      // Fetch all tickers in parallel
      const fetches = tickers.map(async (ticker) => {
        const data = await fetchYahooChart(ticker, range, interval);
        results[ticker] = data || {};
      });
      await Promise.all(fetches);

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Fallback: proxy mode (original behavior)
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response(
        JSON.stringify({
          status: "ok",
          endpoints: [
            "GET /historical?tickers=HGLG11,KNCR11&range=5y&interval=1mo",
            "GET /?url=<encoded yahoo url> (proxy mode)",
          ],
        }),
        {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    try {
      const decoded = decodeURIComponent(target);
      const upstream = await fetch(decoded, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
};
