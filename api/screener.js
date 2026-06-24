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

function normGecko(item, tokenMap = {}) {
  if (!item) return null;
  const a = item.attributes || {};
  const rel = item.relationships || {};
  const networkId = rel.network?.data?.id || "?";
  const baseTokenId = rel.base_token?.data?.id;
  const baseToken = tokenMap[baseTokenId] || {};
  const nameParts = (a.name || "").split(" / ");
  const baseName = nameParts[0]?.trim() || null;
  const symbol = baseToken.symbol || baseName || null;
  const name   = baseToken.name   || baseName || null;
  const icon   = baseToken.image_url || null;
  const mint   = baseToken.address || a.address || item.id || null;
  if (!mint) return null;
  return {
    mint, name, symbol, icon,
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

// Pump.fun API with multiple fallback endpoints
async function fetchPumpCoins(limit = 100, filter = null) {
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
  const endpoints = [
    `https://frontend-api-v3.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
    `https://frontend-api-v2.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
    `https://frontend-api.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
  ];
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!resp.ok) continue;
      const d = await resp.json();
      const coins = Array.isArray(d) ? d : (d.coins || []);
      if (!coins.length) continue;
      return filter ? coins.filter(filter) : coins;
    } catch {}
  }
  return [];
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

    // ── SOLANA TABS ──────────────────────────────────────────────────────────

    if (type === "moonshot") {
      // Try Jupiter moonshot tag first
      try {
        const d = await jup(`/tokens/v2/tag?query=moonshot`);
        const all = Array.isArray(d) ? d : [];
        rows = all
          .map((t) => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
          .filter(Boolean)
          .sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
      } catch {}
      // Fallback: GeckoTerminal for moonshot.money launchpad tokens
      if (!rows.length) {
        try {
          const gt = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token`,
            { headers: { Accept: "application/json;version=20230302" } }
          ).then((r) => r.json());
          const tokenMap = {};
          for (const inc of (gt.included || [])) {
            if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
          }
          rows = (gt.data || [])
            .filter((p) => (p.attributes?.name || "").toLowerCase().includes("moon"))
            .map((p) => normGecko(p, tokenMap))
            .filter(Boolean);
        } catch {}
      }

    } else if (type === "fomo") {
      // FOMO: top 1h gainers with positive momentum
      const d = await jup(`/tokens/v2/toptraded/1h?limit=${limit}`);
      rows = (Array.isArray(d) ? d : [])
        .map((t) => normToken(t, "1h"))
        .filter(Boolean)
        .filter((r) => (r.change1h ?? 0) > 5 && (r.liquidity ?? 0) > 1000)
        .sort((a, b) => (b.change1h ?? -999) - (a.change1h ?? -999));

    } else if (type === "jupiter") {
      // Jupiter tab: recently listed / Jupiter-verified tokens sorted by organic score
      const [recent, verified] = await Promise.all([
        jup(`/tokens/v2/recent?limit=${limit}`).catch(() => []),
        jup(`/tokens/v2/tag?query=verified`).catch(() => []),
      ]);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP"]);
      const combined = [...(Array.isArray(recent) ? recent : []), ...(Array.isArray(verified) ? verified : [])];
      const seen = new Set();
      rows = combined
        .filter((t) => { if (!t || DENY.has((t.symbol||"").toUpperCase()) || seen.has(t.id||t.mint)) return false; seen.add(t.id||t.mint); return true; })
        .map((t) => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
        .filter(Boolean)
        .sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0))
        .slice(0, 100);

    } else if (type === "unbonded") {
      const coins = await fetchPumpCoins(limit, (c) => c.complete !== true && (c.bonding_curve_progress ?? 100) < 100);
      rows = coins.map(normPump).filter(Boolean)
        .sort((a, b) => (b.bondingPct ?? 0) - (a.bondingPct ?? 0));

    } else if (type === "migrated") {
      const coins = await fetchPumpCoins(limit, (c) => c.complete === true || (c.bonding_curve_progress ?? 0) >= 100);
      rows = coins.map(normPump).filter(Boolean)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      // If pump.fun API is empty, fallback to DexScreener raydium pairs
      if (!rows.length) {
        try {
          const d = await fetch(
            `https://api.dexscreener.com/latest/dex/pairs/solana/raydium?page=1`,
            { headers: { Accept: "application/json" } }
          ).then((r) => r.json());
          rows = (d.pairs || []).slice(0, limit).map((p) => ({
            mint: p.baseToken?.address || null,
            name: p.baseToken?.name || null,
            symbol: p.baseToken?.symbol || null,
            icon: p.info?.imageUrl || null,
            priceUsd: num(p.priceUsd),
            mcap: num(p.marketCap),
            liquidity: num(p.liquidity?.usd),
            volume: num(p.volume?.h24),
            change24h: num(p.priceChange?.h24),
            holderCount: null,
            bondingPct: 100,
            _source: "dexscreener",
          })).filter((r) => r.mint);
        } catch {}
      }

    } else if (type === "new") {
      const data = await jup(`/tokens/v2/recent?limit=${limit}`);
      rows = (Array.isArray(data) ? data : []).map((t) => normToken(t, interval)).filter(Boolean);

    } else if (type === "og") {
      const data = await jup(`/tokens/v2/tag?query=verified`);
      const DENY = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP"]);
      rows = (Array.isArray(data) ? data : [])
        .filter((t) => !DENY.has(String(t.symbol || "").toUpperCase()) && (t.mcap ?? 0) > 200000)
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
