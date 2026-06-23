import { jup, callFn, send } from "./_lib.js";
import { normToken, num } from "./_normalize.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const type = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  try {
    if (type === "new") {
      const d = await callFn("pumpfun-migrations", { limit });
      const rows = (d.migrations || []).map((m) => ({
        mint: m.mint || m.address || m.id,
        name: m.name, symbol: m.symbol,
        icon: m.image || m.icon || m.logo || null,
        priceUsd: num(m.priceUsd ?? m.price_usd ?? m.price),
        mcap: num(m.marketCap ?? m.market_cap ?? m.mcap ?? m.usd_market_cap),
        liquidity: num(m.liquidity), holderCount: num(m.holderCount ?? m.holders),
        volume: num(m.volume24h ?? m.volume), graduatedAt: m.migratedAt || m.timestamp || null,
      })).filter((r) => r.mint);
      return send(res, 200, { type, source: d.source || "pumpfun", rows });
    }
    const path = type === "organic"
      ? `/tokens/v2/toporganicscore/${interval}?limit=${limit}`
      : `/tokens/v2/toptraded/${interval}?limit=${limit}`;
    const data = await jup(path);
    const rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);
    return send(res, 200, { type, interval, rows });
  } catch (e) {
    return send(res, 200, { type, rows: [], error: String(e?.message || e) });
  }
}
