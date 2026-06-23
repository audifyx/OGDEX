import { jup, callFn, send, cache } from "./_lib.js";
import { normToken, num } from "./_normalize.js";
import { OG_MINTS, CELEB_MINTS, fetchMints } from "./_curated.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const type = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 100);
  cache(res, 15, 45);
  try {
    let rows = [];
    if (type === "new") {
      const data = await jup(`/tokens/v2/recent?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);
    } else if (type === "migrated") {
      const d = await callFn("pumpfun-migrations", { limit });
      rows = (d.migrations || []).map((m) => ({
        mint: m.mint || m.address || m.id, name: m.name, symbol: m.symbol,
        icon: m.image || m.icon || m.logo || null,
        priceUsd: num(m.priceUsd ?? m.price_usd ?? m.price),
        mcap: num(m.marketCap ?? m.market_cap ?? m.mcap ?? m.usd_market_cap),
        liquidity: num(m.liquidity), holderCount: num(m.holderCount ?? m.holders),
        volume: num(m.volume24h ?? m.volume),
      })).filter((r) => r.mint);
    } else if (type === "og") {
      // Verified universe — hundreds of established, Jupiter-verified tokens.
      const data = await jup(`/tokens/v2/tag?query=verified`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","JITOSOL","HSOL","JUP"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => !DENY.has(String(t.symbol || "").toUpperCase()))
        .filter((t) => (t.mcap ?? 0) > 200000)
        .map((t) => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
        .filter(Boolean)
        .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
        .slice(0, 300);
    } else if (type === "celebrity") {
      rows = await fetchMints(CELEB_MINTS);
      rows.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
    } else if (type === "runners") {
      // Daily gainers: top traded, ranked by 24h price change.
      const data = await jup(`/tokens/v2/toptraded/24h?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, "24h")).filter(Boolean)
        .filter((r) => (r.liquidity ?? 0) > 5000)
        .sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));
    } else if (type === "organic") {
      const data = await jup(`/tokens/v2/toporganicscore/${interval}?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);
    } else {
      // trending = top traded
      const data = await jup(`/tokens/v2/toptraded/${interval}?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);
    }
    return send(res, 200, { type, interval, count: rows.length, rows });
  } catch (e) {
    return send(res, 200, { type, rows: [], error: String(e?.message || e) });
  }
}
