import { send, cache } from "./_lib.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const compact = (v) => {
  if (v == null) return null;
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(Math.round(v));
};

export default async function handler(req, res) {
  cache(res, 90, 180);

  try {
    // Fetch all sources in parallel
    const [gecko, cgTrend, dexBoosts] = await Promise.all([
      // GeckoTerminal trending Solana pools (with token metadata included)
      fetch(
        "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token",
        { headers: { Accept: "application/json;version=20230302" } }
      ).then((r) => r.ok ? r.json() : null).catch(() => null),

      // CoinGecko trending (global — filter to Solana tokens)
      fetch("https://api.coingecko.com/api/v3/search/trending", {
        headers: { Accept: "application/json" },
      }).then((r) => r.ok ? r.json() : null).catch(() => null),

      // DexScreener token boosts (paid promotional, useful for social momentum signal)
      fetch("https://api.dexscreener.com/token-boosts/top/v1", {
        headers: { Accept: "application/json" },
      }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    const items = [];
    const seen = new Set();

    // ── GeckoTerminal trending Solana pools ─────────────────────────────────
    if (gecko) {
      const tokenMap = {};
      for (const inc of (gecko.included || [])) {
        if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
      }

      for (const pool of (gecko.data || []).slice(0, 15)) {
        const a = pool.attributes || {};
        const baseId = pool.relationships?.base_token?.data?.id;
        const bt = tokenMap[baseId] || {};
        const sym = bt.symbol || (a.name || "").split(" / ")[0];
        const mint = bt.address || null;
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        const ch1  = num(a.price_change_percentage?.h1)  || 0;
        const ch24 = num(a.price_change_percentage?.h24) || 0;
        const vol  = num(a.volume_usd?.h24) || 0;
        const liq  = num(a.reserve_in_usd) || 0;

        // Build "why trending" reasons
        const reasons = [];
        if (ch1 > 30)        reasons.push(`🚀 +${ch1.toFixed(0)}% in last 1h`);
        else if (ch1 > 10)   reasons.push(`📈 +${ch1.toFixed(0)}% in 1h`);
        if (ch24 > 100)      reasons.push(`🔥 +${ch24.toFixed(0)}% today`);
        else if (ch24 > 30)  reasons.push(`📊 +${ch24.toFixed(0)}% in 24h`);
        if (vol > 5_000_000) reasons.push(`⚡ $${compact(vol)} volume today`);
        else if (vol > 500_000) reasons.push(`💧 $${compact(vol)} volume`);
        if (liq > 1_000_000) reasons.push(`🏦 $${compact(liq)} liquidity`);
        reasons.push("🔥 Trending on GeckoTerminal");

        items.push({
          mint,
          symbol:   sym,
          name:     bt.name || sym,
          icon:     bt.image_url || null,
          priceUsd: num(a.base_token_price_usd),
          mcap:     num(a.market_cap_usd ?? a.fdv_usd),
          change1h:  ch1,
          change24h: ch24,
          volume:   vol,
          liquidity: liq,
          reason:   reasons[0] || "🔥 Trending",
          reasons:  reasons.slice(0, 3),
          source:   "geckoterminal",
          chain:    "solana",
          poolAddress: pool.id || null,
        });
      }
    }

    // ── CoinGecko trending (Solana tokens) ──────────────────────────────────
    if (cgTrend?.coins) {
      for (const { item } of cgTrend.coins.slice(0, 10)) {
        const solanaMint = item.platforms?.solana || item.data?.platforms?.solana || null;
        if (!solanaMint || seen.has(solanaMint)) continue;
        seen.add(solanaMint);

        const rank = (item.market_cap_rank || item.score + 1 || "?");
        const pctChange = item.data?.price_change_percentage_24h?.usd;

        const reasons = [
          `🏆 #${rank} trending on CoinGecko`,
          pctChange > 0
            ? `📈 +${Number(pctChange).toFixed(1)}% in 24h`
            : pctChange < 0
            ? `📉 ${Number(pctChange).toFixed(1)}% in 24h`
            : "💬 Community buzz",
          "🔎 High search volume",
        ].filter(Boolean);

        items.push({
          mint:   solanaMint,
          symbol: item.symbol,
          name:   item.name,
          icon:   item.large || item.thumb || null,
          priceUsd: num(item.data?.price),
          mcap:     null,
          change24h: pctChange ? num(pctChange) : null,
          reason: reasons[0],
          reasons: reasons.slice(0, 3),
          source: "coingecko",
          chain:  "solana",
          cgId:   item.id,
        });
      }
    }

    // ── DexScreener boosts (Solana) ─────────────────────────────────────────
    if (Array.isArray(dexBoosts)) {
      for (const b of dexBoosts.filter((b) => b.chainId === "solana").slice(0, 8)) {
        const mint = b.tokenAddress || null;
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        const reasons = [
          "🎯 Trending on DexScreener",
          b.description ? `💬 "${b.description.slice(0, 60)}"` : "📢 Boosted project",
          "👀 High community attention",
        ];

        items.push({
          mint,
          symbol:   null,
          name:     b.description || null,
          icon:     b.icon || b.header || null,
          priceUsd: null,
          mcap:     null,
          reason:   reasons[0],
          reasons,
          source:   "dexscreener",
          chain:    "solana",
          url:      b.url || null,
        });
      }
    }

    return send(res, 200, { count: items.length, items, sources: ["geckoterminal", "coingecko", "dexscreener"] });
  } catch (e) {
    return send(res, 200, { count: 0, items: [], error: String(e?.message || e) });
  }
}
