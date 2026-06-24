import { jup, callFn, send, cache } from "./_lib.js";
import { normToken, num } from "./_normalize.js";
import { OG_MINTS, CELEB_MINTS, fetchMints } from "./_curated.js";

const CHAINS = ["solana","ethereum","bsc","base","polygon","arbitrum","avalanche","sui","ton"];

// Normalise a Pump.fun coin → Row shape
function normPump(t) {
  if (!t || !t.mint) return null;
  const mc = num(t.usd_market_cap);
  const progress = num(t.bonding_curve_progress); // 0–100
  return {
    mint: t.mint, name: t.name, symbol: t.symbol,
    icon: t.image_uri || t.icon || null,
    priceUsd: num(t.usd_market_cap) && num(t.total_supply) ? num(t.usd_market_cap) / num(t.total_supply) : null,
    mcap: mc, liquidity: null, holderCount: num(t.holder_count ?? t.reply_count),
    volume: num(t.volume ?? t.volume_24h), change24h: null,
    bondingPct: progress != null ? Math.min(100, Math.round(progress)) : null,
    _source: "pumpfun",
  };
}

// Normalise a GeckoTerminal pool → Row shape (multi-chain)
function normGecko(item) {
  const a = item.attributes || {};
  const baseToken = a.base_token_price_usd;
  const q = a.quote_token_name || "";
  return {
    mint: a.address || item.id,
    name: a.name ? a.name.split(" / ")[0] : null,
    symbol: a.name ? a.name.split(" / ")[0] : null,
    icon: null,
    priceUsd: num(baseToken),
    mcap: num(a.market_cap_usd ?? a.fdv_usd),
    liquidity: num(a.reserve_in_usd),
    volume: num(a.volume_usd?.h24),
    change24h: num(a.price_change_percentage?.h24),
    holderCount: null,
    chain: item.relationships?.network?.data?.id || "unknown",
    dex: a.dex_id || null,
    _source: "gecko",
  };
}

// Normalise a Moonshot token
function normMoonshot(t) {
  if (!t || !(t.mintAddress || t.mint || t.address)) return null;
  return {
    mint: t.mintAddress || t.mint || t.address,
    name: t.name, symbol: t.symbol,
    icon: t.icon || t.image || null,
    priceUsd: num(t.priceUsd ?? t.price),
    mcap: num(t.marketCap ?? t.mcap ?? t.usdMarketCap),
    liquidity: num(t.liquidity),
    volume: num(t.volume24h ?? t.volume),
    change24h: num(t.priceChange24h ?? t.change24h),
    holderCount: num(t.holderCount ?? t.holders),
    _source: "moonshot",
    isVerified: true,
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const type = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
  const chain = (url.searchParams.get("chain") || "solana").toLowerCase();
  cache(res, 15, 45);

  try {
    let rows = [];

    // ─── MULTI-CHAIN via GeckoTerminal ───────────────────────────────────────
    if (chain !== "solana" && CHAINS.includes(chain)) {
      const netMap = { ethereum:"eth", bsc:"bsc", base:"base", polygon:"polygon_pos",
        arbitrum:"arbitrum", avalanche:"avax", sui:"sui-network", ton:"ton" };
      const net = netMap[chain] || chain;
      try {
        const sort = type === "new" ? "pool_created_at" : "h24_volume_usd";
        const gt = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${net}/trending_pools?page=1`,
          { headers: { Accept: "application/json;version=20230302" } }
        ).then((r) => r.json());
        rows = (gt.data || []).map(normGecko).filter(Boolean);
      } catch {
        // fallback: dexscreener
        try {
          const ds = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/latest?chainIds=${chain}`
          ).then((r) => r.json());
          rows = (ds.pairs || ds.tokens || []).slice(0, limit).map((p) => ({
            mint: p.baseToken?.address || p.tokenAddress,
            name: p.baseToken?.name, symbol: p.baseToken?.symbol,
            icon: null, priceUsd: num(p.priceUsd), mcap: num(p.fdv ?? p.marketCap),
            liquidity: num(p.liquidity?.usd), volume: num(p.volume?.h24),
            change24h: num(p.priceChange?.h24), chain,
          })).filter((r) => r.mint);
        } catch {}
      }
      return send(res, 200, { type, interval, chain, count: rows.length, rows });
    }

    // ─── SOLANA TABS ─────────────────────────────────────────────────────────
    if (type === "moonshot") {
      try {
        const d = await fetch(
          `https://api.moonshot.cc/tokens/v1/solana/top?limit=${limit}`,
          { headers: { Accept: "application/json" } }
        ).then((r) => r.json());
        const list = d.tokens || d.results || d || [];
        rows = (Array.isArray(list) ? list : []).map(normMoonshot).filter(Boolean);
      } catch {
        // Fallback: Jupiter tag=moonshot
        try {
          const d = await jup(`/tokens/v2/tag?query=moonshot`);
          rows = (Array.isArray(d) ? d : []).map((t) => {
            const r = normToken(t, interval);
            if (r) r.isVerified = true;
            return r;
          }).filter(Boolean);
        } catch {}
      }

    } else if (type === "fomo") {
      // FOMO tokens: pump.fun top traders + high momentum but not yet trending
      try {
        const d = await callFn("pumpfun-trending", { limit });
        rows = (d.tokens || d.rows || []).map((t) => normToken(t, interval) || normPump(t)).filter(Boolean);
      } catch {
        // fallback: Jupiter top organic but short window
        const d = await jup(`/tokens/v2/toptraded/1h?limit=${limit}`);
        rows = (Array.isArray(d) ? d : []).map((t) => normToken(t, "1h")).filter(Boolean)
          .filter((r) => (r.change1h ?? 0) > 5);
      }

    } else if (type === "unbonded") {
      // Pump.fun tokens still in bonding curve
      try {
        const d = await fetch(
          `https://frontend-api.pump.fun/coins?limit=${limit}&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=false`,
          { headers: { Accept: "application/json" } }
        ).then((r) => r.json());
        rows = (Array.isArray(d) ? d : []).map(normPump).filter(Boolean);
      } catch (e) {
        return send(res, 200, { type, rows: [], error: String(e?.message || e) });
      }

    } else if (type === "new") {
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
