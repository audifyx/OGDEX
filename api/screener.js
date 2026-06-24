import { jup, callFn, send, cache } from "./_lib.js";
import { normToken, num } from "./_normalize.js";
import { OG_MINTS, CELEB_MINTS, fetchMints } from "./_curated.js";

const CHAINS = ["solana","ethereum","bsc","base","polygon","arbitrum","avalanche","sui","ton"];

// ── Normalizers ───────────────────────────────────────────────────────────────

function normPump(t) {
  if (!t || !t.mint) return null;
  const total = num(t.total_supply) || 1e9;
  const progress = t.bonding_curve_progress != null
    ? Math.min(100, Math.round(Number(t.bonding_curve_progress)))
    : null;
  return {
    mint: t.mint, name: t.name, symbol: t.symbol,
    icon: t.image_uri || t.image || null,
    priceUsd: num(t.price) || (num(t.usd_market_cap) ? num(t.usd_market_cap) / total : null),
    mcap: num(t.usd_market_cap),
    liquidity: null,
    holderCount: num(t.holder_count) || num(t.reply_count),
    volume: num(t.volume ?? t.volume_24h),
    change24h: null,
    bondingPct: progress,
    _source: "pumpfun",
  };
}

// normGecko — enriched with included base_token data (logo, symbol, name, address)
function normGecko(item, tokenMap = {}) {
  if (!item) return null;
  const a = item.attributes || {};
  const rel = item.relationships || {};
  const networkId = rel.network?.data?.id || "?";

  // Use included base_token if available
  const baseTokenId = rel.base_token?.data?.id;
  const baseToken = tokenMap[baseTokenId] || {};

  // Pool name is usually "BASE / QUOTE" — grab the base
  const nameParts = (a.name || "").split(" / ");
  const baseName = nameParts[0]?.trim() || null;

  // Prefer included token data for accuracy
  const symbol = baseToken.symbol || baseName || null;
  const name   = baseToken.name   || baseName || null;
  const icon   = baseToken.image_url || null;
  // Contract address: included token address > a.address
  const mint   = baseToken.address || a.address || item.id || null;

  if (!mint) return null;

  return {
    mint,
    name,
    symbol,
    icon,
    priceUsd:  num(a.base_token_price_usd),
    mcap:      num(a.market_cap_usd ?? a.fdv_usd),
    liquidity: num(a.reserve_in_usd),
    volume:    num(a.volume_usd?.h24),
    change5m:  num(a.price_change_percentage?.m5),
    change1h:  num(a.price_change_percentage?.h1),
    change6h:  null,
    change24h: num(a.price_change_percentage?.h24),
    holderCount: null,
    chain: networkId,
    dex: a.dex_id || null,
    poolAddress: item.id || null,
    _source: "gecko",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const type     = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit    = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
  const chain    = (url.searchParams.get("chain") || "solana").toLowerCase();
  cache(res, 15, 45);

  try {
    let rows = [];

    // ── MULTI-CHAIN (non-Solana) via GeckoTerminal ──────────────────────────
    if (chain !== "solana" && CHAINS.includes(chain)) {
      const netMap = {
        ethereum: "eth", bsc: "bsc", base: "base", polygon: "polygon_pos",
        arbitrum: "arbitrum", avalanche: "avax", sui: "sui-network", ton: "ton",
      };
      const net = netMap[chain] || chain;

      // include=base_token gives us symbol, name, image_url per token
      const gt = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${net}/trending_pools?page=1&include=base_token`,
        { headers: { Accept: "application/json;version=20230302" } }
      ).then((r) => r.json());

      // Build lookup map: included token id → attributes
      const tokenMap = {};
      for (const inc of (gt.included || [])) {
        if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
      }

      rows = (gt.data || []).map((p) => normGecko(p, tokenMap)).filter(Boolean);
      return send(res, 200, { type, interval, chain, count: rows.length, rows });
    }

    // ── SOLANA TABS ──────────────────────────────────────────────────────────

    if (type === "moonshot") {
      // Jupiter tag=moonshot — verified Moonshot-launched tokens
      try {
        const d = await jup(`/tokens/v2/tag?query=moonshot`);
        const all = Array.isArray(d) ? d : [];
        rows = all
          .map((t) => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
          .filter(Boolean)
          .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
      } catch {}
      // Fallback: search "moonshot" on Jupiter
      if (!rows.length) {
        try {
          const d = await jup(`/tokens/v2/toptraded/24h?limit=${limit}`);
          rows = (Array.isArray(d) ? d : [])
            .map((t) => normToken(t, interval))
            .filter(Boolean)
            .filter((r) => r.tags?.includes("moonshot") || (r.name || "").toLowerCase().includes("moon"));
        } catch {}
      }

    } else if (type === "pumping") {
      // Pumping: high 1h gain — top traded 1h sorted by 1h price change
      const d = await jup(`/tokens/v2/toptraded/1h?limit=${limit}`);
      rows = (Array.isArray(d) ? d : [])
        .map((t) => normToken(t, "1h"))
        .filter(Boolean)
        .filter((r) => (r.change1h ?? 0) > 0 && (r.liquidity ?? 0) > 1000)
        .sort((a, b) => (b.change1h ?? -999) - (a.change1h ?? -999));

    } else if (type === "unbonded") {
      // Pump.fun coins still bonding (complete=false)
      try {
        const resp = await fetch(
          `https://frontend-api.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
          { headers: { Accept: "application/json" } }
        );
        const d = await resp.json();
        const coins = Array.isArray(d) ? d : (d.coins || []);
        rows = coins
          .filter((c) => c.complete !== true && (c.bonding_curve_progress ?? 100) < 100)
          .map(normPump)
          .filter(Boolean)
          .sort((a, b) => (b.bondingPct ?? 0) - (a.bondingPct ?? 0));
      } catch (e) {
        return send(res, 200, { type, rows: [], error: `pump.fun: ${String(e?.message || e)}` });
      }

    } else if (type === "new") {
      const data = await jup(`/tokens/v2/recent?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);

    } else if (type === "migrated") {
      // Pump.fun coins that recently completed bonding (complete=true), sorted by completion
      try {
        const resp = await fetch(
          `https://frontend-api.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
          { headers: { Accept: "application/json" } }
        );
        const d = await resp.json();
        const coins = Array.isArray(d) ? d : (d.coins || []);
        rows = coins
          .filter((c) => c.complete === true || (c.bonding_curve_progress ?? 0) >= 100)
          .map(normPump)
          .filter(Boolean)
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      } catch {
        // Fallback to edge function
        const d = await callFn("pumpfun-migrations", { limit });
        rows = (d.migrations || []).map((m) => ({
          mint: m.mint || m.address || m.id, name: m.name, symbol: m.symbol,
          icon: m.image || m.icon || m.logo || null,
          priceUsd: num(m.priceUsd ?? m.price_usd ?? m.price),
          mcap: num(m.marketCap ?? m.market_cap ?? m.mcap ?? m.usd_market_cap),
          liquidity: num(m.liquidity), holderCount: num(m.holderCount ?? m.holders),
          volume: num(m.volume24h ?? m.volume),
        })).filter((r) => r.mint);
      }

    } else if (type === "og") {
      const data = await jup(`/tokens/v2/tag?query=verified`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP"]);
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

    return send(res, 200, { type, interval, chain, count: rows.length, rows });
  } catch (e) {
    return send(res, 200, { type, rows: [], error: String(e?.message || e) });
  }
}
