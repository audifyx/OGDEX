import { jup, callFn, send, cache } from "./_lib.js";
import { normToken, num } from "./_normalize.js";
import { CELEB_MINTS, fetchMints } from "./_curated.js";

const CHAINS = ["solana","ethereum","bsc","base","polygon","arbitrum","avalanche","sui","ton"];

// ── Pump.fun normalizer ───────────────────────────────────────────────────────
function normPump(t) {
  if (!t || !t.mint) return null;
  // bonding progress from real_quote_reserves (graduation = 85 SOL = 85e9 lamports)
  const complete = !!t.complete;
  const rqr = num(t.real_quote_reserves) || num(t.real_sol_reserves) || 0;
  const bondingPct = complete ? 100 : Math.min(100, Math.round((rqr / 85_000_000_000) * 100));
  const total = num(t.total_supply) || 1_000_000_000;
  const mcap  = num(t.usd_market_cap);
  return {
    mint: t.mint, name: t.name, symbol: t.symbol,
    icon: t.image_uri || t.image || null,
    priceUsd: mcap && total ? mcap / total : null,
    mcap,
    liquidity: null,
    holderCount: num(t.holder_count) || num(t.reply_count) || null,
    volume: num(t.volume ?? t.volume_24h) ?? null,
    change24h: null,
    bondingPct,
    complete,
    athMcap: num(t.ath_market_cap) || null,
    createdAt: t.created_timestamp ? new Date(t.created_timestamp).toISOString() : null,
    ageDays: t.created_timestamp ? Math.round((Date.now() - t.created_timestamp) / 864e5) : null,
    _source: "pumpfun",
  };
}

// ── GeckoTerminal normalizer ──────────────────────────────────────────────────
function normGecko(item, tokenMap = {}) {
  if (!item) return null;
  const a   = item.attributes || {};
  const rel = item.relationships || {};
  const netId     = rel.network?.data?.id || "solana";
  const baseTokenId = rel.base_token?.data?.id;
  const bt  = tokenMap[baseTokenId] || {};
  const mint = bt.address || null;
  if (!mint) return null;
  const sym  = bt.symbol || (a.name || "").split(" / ")[0].trim() || null;
  return {
    mint, name: bt.name || sym, symbol: sym,
    icon: bt.image_url || null,
    priceUsd:  num(a.base_token_price_usd),
    mcap:      num(a.market_cap_usd ?? a.fdv_usd),
    liquidity: num(a.reserve_in_usd),
    volume:    num(a.volume_usd?.h24),
    change5m:  num(a.price_change_percentage?.m5),
    change1h:  num(a.price_change_percentage?.h1),
    change24h: num(a.price_change_percentage?.h24),
    holderCount: null,
    chain: netId, poolAddress: item.id || null,
    createdAt: a.pool_created_at || null,
    _source: "gecko",
  };
}

// ── Pump.fun API fetch (v3 only — confirmed working) ─────────────────────────
async function fetchPump(sortBy, limit, filterFn = null) {
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
  const url = `https://frontend-api-v3.pump.fun/coins?limit=${limit}&offset=0&sort=${sortBy}&order=DESC&includeNsfw=false`;
  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = await resp.json();
    const coins = Array.isArray(data) ? data : (data.coins || []);
    return filterFn ? coins.filter(filterFn) : coins;
  } catch (e) {
    console.error("pump.fun fetch failed:", e.message);
    return [];
  }
}

// ── DexScreener pair fallback for migrated ────────────────────────────────────
async function fetchDexMigrated(limit) {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=pump&chainId=solana`,
      { headers: { Accept: "application/json" } }
    );
    const d = await r.json();
    return (d.pairs || [])
      .filter((p) => p.chainId === "solana" && (p.dexId === "pumpswap" || p.dexId === "raydium"))
      .slice(0, limit)
      .map((p) => ({
        mint: p.baseToken?.address || null,
        name: p.baseToken?.name || null,
        symbol: p.baseToken?.symbol || null,
        icon: p.info?.imageUrl || null,
        priceUsd: num(p.priceUsd),
        mcap: num(p.marketCap),
        liquidity: num(p.liquidity?.usd),
        volume: num(p.volume?.h24),
        change24h: num(p.priceChange?.h24),
        change1h: num(p.priceChange?.h1),
        holderCount: null,
        bondingPct: 100, complete: true,
        athMcap: null,
        _source: "dexscreener",
      }))
      .filter((r) => r.mint);
  } catch {
    return [];
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const url  = new URL(req.url, "http://x");
  const type     = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit    = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
  const chain    = (url.searchParams.get("chain") || "solana").toLowerCase();
  cache(res, 15, 45);

  try {
    let rows = [];

    // ── Multi-chain (GeckoTerminal) ───────────────────────────────────────────
    if (chain !== "solana" && CHAINS.includes(chain)) {
      const netMap = {
        ethereum: "eth", bsc: "bsc", base: "base", polygon: "polygon_pos",
        arbitrum: "arbitrum", avalanche: "avax", sui: "sui-network", ton: "ton",
      };
      const net = netMap[chain] || chain;
      const gt = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${net}/trending_pools?page=1&include=base_token`,
        { headers: { Accept: "application/json;version=20230302" } }
      ).then((r) => r.json());
      const tokenMap = {};
      for (const inc of (gt.included || [])) {
        if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
      }
      rows = (gt.data || []).map((p) => normGecko(p, tokenMap)).filter(Boolean);
      return send(res, 200, { type, interval, chain, count: rows.length, rows });
    }

    // ── Solana tabs ───────────────────────────────────────────────────────────

    if (type === "unbonded") {
      // sort=created_timestamp gives all fresh new (non-complete) tokens
      const coins = await fetchPump("created_timestamp", limit);
      rows = coins
        .filter((c) => !c.complete)
        .map(normPump)
        .filter(Boolean)
        .sort((a, b) => (b.bondingPct ?? 0) - (a.bondingPct ?? 0));

    } else if (type === "migrated") {
      // sort=last_trade_timestamp, filter complete=true
      const coins = await fetchPump("last_trade_timestamp", limit, (c) => c.complete === true);
      rows = coins.map(normPump).filter(Boolean).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      // Fallback to DexScreener pumpswap if pump.fun returns nothing
      if (!rows.length) {
        rows = await fetchDexMigrated(limit);
      }

    } else if (type === "moonshot") {
      // Filter Jupiter toptraded for tokens tagged "moonshot-verified" or "moonshot"
      const data = await jup(`/tokens/v2/toptraded/24h?limit=200`);
      const all = Array.isArray(data) ? data : [];
      rows = all
        .filter((t) => Array.isArray(t.tags) && t.tags.some((tag) => String(tag).toLowerCase().includes("moonshot")))
        .map((t) => { const r = normToken(t, "24h"); if (r) r.isMoonshot = true; return r; })
        .filter(Boolean)
        .sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0));
      // Fallback: GeckoTerminal new_pools (freshly launched = moonshot candidates)
      if (!rows.length) {
        const gt = await fetch(
          "https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1&include=base_token",
          { headers: { Accept: "application/json;version=20230302" } }
        ).then((r) => r.json()).catch(() => null);
        if (gt) {
          const tokenMap = {};
          for (const inc of (gt.included || [])) {
            if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
          }
          rows = (gt.data || []).map((p) => normGecko(p, tokenMap)).filter(Boolean)
            .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        }
      }

    } else if (type === "fomo") {
      // Jupiter toptraded/1h sorted by 1h price change — highest gainers
      const data = await jup(`/tokens/v2/toptraded/1h?limit=200`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","JUP"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => !DENY.has(String(t.symbol || "").toUpperCase()))
        .map((t) => normToken(t, "1h"))
        .filter(Boolean)
        .filter((r) => (r.liquidity ?? 0) > 1000)
        .sort((a, b) => (b.change1h ?? -999) - (a.change1h ?? -999))
        .slice(0, limit);

    } else if (type === "jupiter") {
      // Jupiter-verified tokens with best organic score, no stablecoins
      const data = await jup(`/tokens/v2/toptraded/24h?limit=200`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => (t.isVerified || (t.organicScore ?? 0) > 40) && !DENY.has(String(t.symbol || "").toUpperCase()))
        .map((t) => { const r = normToken(t, "24h"); if (r) r.isVerified = !!t.isVerified; return r; })
        .filter(Boolean)
        .sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0))
        .slice(0, 100);

    } else if (type === "new") {
      const data = await jup(`/tokens/v2/recent?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);

    } else if (type === "og") {
      const data = await jup(`/tokens/v2/tag?query=verified`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => !DENY.has(String(t.symbol || "").toUpperCase()) && (t.mcap ?? 0) > 200_000)
        .map((t) => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
        .filter(Boolean)
        .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
        .slice(0, 300);

    } else if (type === "celebrity") {
      rows = await fetchMints(CELEB_MINTS);
      rows.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));

    } else if (type === "runners") {
      const data = await jup(`/tokens/v2/toptraded/24h?limit=${limit}`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => !DENY.has(String(t.symbol || "").toUpperCase()))
        .map((t) => normToken(t, "24h"))
        .filter(Boolean)
        .filter((r) => (r.liquidity ?? 0) > 5000)
        .sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));

    } else if (type === "organic") {
      const data = await jup(`/tokens/v2/toporganicscore/${interval}?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);

    } else if (type === "multichain") {
      // GeckoTerminal trending Solana if called directly
      const gt = await fetch(
        "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token",
        { headers: { Accept: "application/json;version=20230302" } }
      ).then((r) => r.json()).catch(() => null);
      if (gt) {
        const tokenMap = {};
        for (const inc of (gt.included || [])) {
          if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
        }
        rows = (gt.data || []).map((p) => normGecko(p, tokenMap)).filter(Boolean);
      }

    } else if (type === "social") {
      // Social trending — inlined (no separate trending-social.js to stay within Hobby 12-function limit)
      cache(res, 90, 180);
      const compact = (v) => {
        if (v == null) return null;
        if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
        if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
        if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
        return String(Math.round(v));
      };
      const [gecko, cgTrend, dexBoosts] = await Promise.all([
        fetch("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token",
          { headers: { Accept: "application/json;version=20230302" } })
          .then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.coingecko.com/api/v3/search/trending",
          { headers: { Accept: "application/json" } })
          .then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.dexscreener.com/token-boosts/top/v1",
          { headers: { Accept: "application/json" } })
          .then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      const items = [];
      const seen = new Set();
      if (gecko) {
        const tokenMap = {};
        for (const inc of (gecko.included || [])) { if (inc.type === "token") tokenMap[inc.id] = inc.attributes; }
        for (const pool of (gecko.data || []).slice(0, 15)) {
          const a = pool.attributes || {};
          const baseId = pool.relationships?.base_token?.data?.id;
          const bt = tokenMap[baseId] || {};
          const mint = bt.address || null;
          if (!mint || seen.has(mint)) continue;
          seen.add(mint);
          const ch1  = num(a.price_change_percentage?.h1)  || 0;
          const ch24 = num(a.price_change_percentage?.h24) || 0;
          const vol  = num(a.volume_usd?.h24) || 0;
          const liq  = num(a.reserve_in_usd) || 0;
          const reasons = [];
          if (ch1 > 30)           reasons.push(`🚀 +${ch1.toFixed(0)}% in last 1h`);
          else if (ch1 > 10)      reasons.push(`📈 +${ch1.toFixed(0)}% in 1h`);
          if (ch24 > 100)         reasons.push(`🔥 +${ch24.toFixed(0)}% today`);
          else if (ch24 > 30)     reasons.push(`📊 +${ch24.toFixed(0)}% in 24h`);
          if (vol > 5_000_000)    reasons.push(`⚡ $${compact(vol)} volume today`);
          else if (vol > 500_000) reasons.push(`💧 $${compact(vol)} volume`);
          if (liq > 1_000_000)    reasons.push(`🏦 $${compact(liq)} liquidity`);
          reasons.push("🔥 Trending on GeckoTerminal");
          items.push({ mint, symbol: bt.symbol || (a.name||"").split(" / ")[0], name: bt.name || null,
            icon: bt.image_url || null, priceUsd: num(a.base_token_price_usd),
            mcap: num(a.market_cap_usd ?? a.fdv_usd), change1h: ch1, change24h: ch24,
            volume: vol, liquidity: liq, reason: reasons[0] || "🔥 Trending",
            reasons: reasons.slice(0,3), source: "geckoterminal", chain: "solana", poolAddress: pool.id || null });
        }
      }
      if (cgTrend?.coins) {
        for (const { item } of cgTrend.coins.slice(0, 10)) {
          const solanaMint = item.platforms?.solana || item.data?.platforms?.solana || null;
          if (!solanaMint || seen.has(solanaMint)) continue;
          seen.add(solanaMint);
          const rank = (item.market_cap_rank || item.score + 1 || "?");
          const pctChange = item.data?.price_change_percentage_24h?.usd;
          const reasons = [`🏆 #${rank} trending on CoinGecko`,
            pctChange > 0 ? `📈 +${Number(pctChange).toFixed(1)}% in 24h`
              : pctChange < 0 ? `📉 ${Number(pctChange).toFixed(1)}% in 24h`
              : "💬 Community buzz",
            "🔎 High search volume"].filter(Boolean);
          items.push({ mint: solanaMint, symbol: item.symbol, name: item.name,
            icon: item.large || item.thumb || null, priceUsd: num(item.data?.price),
            mcap: null, change24h: pctChange ? num(pctChange) : null,
            reason: reasons[0], reasons: reasons.slice(0,3), source: "coingecko", chain: "solana", cgId: item.id });
        }
      }
      if (Array.isArray(dexBoosts)) {
        for (const b of dexBoosts.filter((b) => b.chainId === "solana").slice(0, 8)) {
          const mint = b.tokenAddress || null;
          if (!mint || seen.has(mint)) continue;
          seen.add(mint);
          const reasons = ["🎯 Trending on DexScreener",
            b.description ? `💬 "${b.description.slice(0,60)}"` : "📢 Boosted project",
            "👀 High community attention"];
          items.push({ mint, symbol: null, name: b.description || null,
            icon: b.icon || b.header || null, priceUsd: null, mcap: null,
            reason: reasons[0], reasons, source: "dexscreener", chain: "solana", url: b.url || null });
        }
      }
      return send(res, 200, { count: items.length, items, sources: ["geckoterminal","coingecko","dexscreener"] });

    } else {
      // Default: trending = top traded by interval
      const data = await jup(`/tokens/v2/toptraded/${interval}?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);
    }

    return send(res, 200, { type, interval, chain, count: rows.length, rows });
  } catch (e) {
    console.error("screener error:", type, e);
    return send(res, 200, { type, rows: [], error: String(e?.message || e) });
  }
}
