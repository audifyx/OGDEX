// Normalize a Jupiter v2 token object to the OG DEX row shape.
export function normToken(t, interval = "24h") {
  if (!t) return null;
  const s = t[`stats${interval}`] || t.stats24h || {};
  const buy = num(s.buyVolume), sell = num(s.sellVolume);
  const vol = (buy || 0) + (sell || 0);
  return {
    mint: t.id || t.mint,
    name: t.name,
    symbol: t.symbol,
    icon: t.icon || t.image || null,
    priceUsd: num(t.usdPrice ?? t.priceUsd),
    mcap: num(t.mcap),
    fdv: num(t.fdv),
    liquidity: num(t.liquidity),
    holderCount: num(t.holderCount),
    volume: vol,
    buyVolume: buy,
    sellVolume: sell,
    numBuys: num(s.numBuys),
    numSells: num(s.numSells),
    netBuyers: num(s.numNetBuyers),
    change5m: pct(t.stats5m?.priceChange),
    change1h: pct(t.stats1h?.priceChange),
    change6h: pct(t.stats6h?.priceChange),
    change24h: pct(t.stats24h?.priceChange),
    organicScore: num(t.organicScore),
    organicScoreLabel: t.organicScoreLabel || null,
    isVerified: !!t.isVerified || !!t.isVerifiedJup,
    dev: t.dev || null,
    circSupply: num(t.circSupply),
    totalSupply: num(t.totalSupply),
    decimals: num(t.decimals),
  };
}
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pct = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
