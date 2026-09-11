import { getAssets, updateAsset, addAsset, deleteAsset, getTrades, addLot, consumeLots, getLots } from "./store";
import type { Asset } from "./types";
import { detectAssetType, KNOWN_UNITS, KNOWN_ETFS } from "./detectType";
import { getKnownSector } from "./sectorFetch";

export function syncAssetsFromTrades(): void {
  const trades = getTrades();

  // Rebuild lots from trades
  const existingLots = getLots();
  const lotTickerSet = new Set(existingLots.map((l) => l.ticker.toUpperCase()));
  const sorted = [...trades].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const aIsBuy = a.quantity > 0 ? 0 : 1;
    const bIsBuy = b.quantity > 0 ? 0 : 1;
    if (aIsBuy !== bIsBuy) return aIsBuy - bIsBuy;
    return a.id.localeCompare(b.id);
  });

  // If no lots exist yet, create them from buy trades
  if (existingLots.length === 0) {
    for (const t of sorted) {
      if (t.quantity > 0) {
        addLot({
          ticker: t.ticker.toUpperCase(),
          purchaseDate: t.date,
          quantity: Math.abs(t.quantity),
          price: t.price,
          fees: t.fees,
          remaining: Math.abs(t.quantity),
        });
      }
    }
  }

  // Calculate running position per ticker from all trades (using lots for sells)
  const byTicker: Record<string, { shares: number; invested: number }> = {};
  for (const t of sorted) {
    const qty = t.quantity;
    const isBuy = qty > 0;
    const absQty = Math.abs(qty);
    const totalOp = absQty * t.price;
    const prev = byTicker[t.ticker] ?? { shares: 0, invested: 0 };

    if (isBuy) {
      byTicker[t.ticker] = { shares: prev.shares + absQty, invested: prev.invested + totalOp + t.fees };
    } else {
      const costBasis = consumeLots(t.ticker, absQty);
      byTicker[t.ticker] = {
        shares: Math.max(0, prev.shares - absQty),
        invested: prev.invested - (costBasis || prev.invested * (absQty / prev.shares)),
      };
    }
  }

  // Remove assets that have zero shares AND no current dividend (truly orphaned)
  const existing = getAssets();
  const tickersWithTrades = new Set(trades.map((t) => t.ticker.toUpperCase()));

  for (const a of existing) {
    const pos = byTicker[a.ticker.toUpperCase()];
    if (pos && pos.shares > 0) {
      // Update existing asset from trade data
      const autoInfo = detectAssetType(a.ticker);
      const knownTicker = KNOWN_UNITS.has(a.ticker.toUpperCase()) || KNOWN_ETFS.has(a.ticker.toUpperCase());
      const type = knownTicker ? autoInfo.type : ((a.type && a.type !== autoInfo.type) ? a.type : autoInfo.type);
      const sector = (a.sector && a.sector !== "A DEFINIR") ? a.sector : (getKnownSector(a.ticker) || autoInfo.sector);
      const newDividend = pos.shares * (a.dividendPerShare || 0);
      const avgPrice = a.avgPrice > 0 ? a.avgPrice : +((pos.invested / pos.shares).toFixed(2));
      const investedAmount = +(avgPrice * pos.shares).toFixed(2);
      updateAsset(a.id, {
        type,
        sector,
        avgPrice,
        quantity: pos.shares,
        investedAmount,
        currentDividend: newDividend > 0 ? newDividend : a.currentDividend,
        annualReturn: pos.shares * (a.dividendPerShare || 0) * 12,
      });
    } else if (pos && pos.shares <= 0) {
      // Sold all shares -> safe to remove
      deleteAsset(a.id);
    }
    // Keep assets that have no trades at all (manually added)
  }

  // Fix type for all known tickers (even without trades)
  const allAssets = getAssets();
  for (const a of allAssets) {
    const autoInfo = detectAssetType(a.ticker);
    const knownTicker = KNOWN_UNITS.has(a.ticker.toUpperCase()) || KNOWN_ETFS.has(a.ticker.toUpperCase());
    if (knownTicker && a.type !== autoInfo.type) {
      updateAsset(a.id, { type: autoInfo.type });
    }
  }

  // Create assets only for tickers with shares > 0 that don't exist yet
  const existingTickers = new Set(getAssets().map((a) => a.ticker.toUpperCase()));
  for (const [ticker, pos] of Object.entries(byTicker)) {
    if (pos.shares <= 0) continue;
    if (existingTickers.has(ticker.toUpperCase())) continue;

    const info = detectAssetType(ticker);
    const avgPrice = +((pos.invested / pos.shares).toFixed(2));
    const sector = getKnownSector(ticker) || info.sector;

    const asset: Omit<Asset, "id" | "createdAt" | "updatedAt"> = {
      ticker: ticker.toUpperCase(),
      type: info.type,
      subtype: "",
      sector,
      paymentDay: info.type === "FII" ? 14 : null,
      currentPrice: avgPrice,
      dividendPerShare: 0,
      dividendYield: 0,
      targetTotal: 0,
      sharesNeeded: 0,
      avgPrice,
      quantity: pos.shares,
      goal: "PAUSAR",
      investedAmount: +pos.invested.toFixed(2),
      missing: 0,
      currentDividend: 0,
      annualReturn: 0,
      magicMonth: 0,
      magicNumber: avgPrice,
      divYield12m: null,
      representation: 0,
      percentInPortfolio: 0,
      status: "",
    };
    addAsset(asset);
  }
}
