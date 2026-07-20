import { getAssets, addAsset, getTrades } from "./store";
import type { Asset } from "./types";

export function ensureAssetForTicker(
  ticker: string,
  tradePrice?: number
): void {
  const assets = getAssets();
  const exists = assets.some((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
  if (exists) return;

  const upper = ticker.toUpperCase();
  let type = "FII";
  let sector = "";

  if (upper.endsWith("11")) {
    type = "FII";
    sector = "A DEFINIR";
  } else if (upper.endsWith("3") || upper.endsWith("4") || upper.endsWith("5") || upper.endsWith("6")) {
    type = "AÇÃO";
    sector = "A DEFINIR";
  } else {
    type = "ETF";
    sector = "ETF";
  }

  // Calculate actual quantity and invested amount from existing trades
  const allTrades = getTrades()
    .filter((t) => t.ticker.toUpperCase() === upper)
    .sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));

  let shares = 0;
  let invested = 0;
  let avgPrice = tradePrice || 0;

  for (const t of allTrades) {
    const qty = t.quantity;
    const isBuy = qty > 0;
    const absQty = Math.abs(qty);
    const totalOp = absQty * t.price;

    if (isBuy) {
      shares += absQty;
      invested += totalOp + t.fees;
      avgPrice = shares > 0 ? invested / shares : 0;
    } else {
      const proportion = shares > 0 ? absQty / shares : 0;
      invested -= invested * proportion;
      shares = Math.max(0, shares - absQty);
      avgPrice = shares > 0 ? invested / shares : avgPrice;
    }
  }

  const price = tradePrice || avgPrice || 0;
  const currentDividend = 0; // no dividend data from trades

  const asset: Omit<Asset, "id" | "createdAt" | "updatedAt"> = {
    ticker: upper,
    type,
    subtype: "",
    sector,
    paymentDay: type === "FII" ? 14 : null,
    currentPrice: price,
    dividendPerShare: 0,
    dividendYield: 0,
    targetTotal: 0,
    sharesNeeded: 0,
    avgPrice,
    quantity: shares,
    goal: "PAUSAR",
    investedAmount: invested,
    missing: 0,
    currentDividend,
    annualReturn: 0,
    magicMonth: 0,
    magicNumber: price,
    divYield12m: null,
    representation: 0,
    percentInPortfolio: 0,
    status: "",
  };

  addAsset(asset);
}
