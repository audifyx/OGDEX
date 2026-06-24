import { callFn, send, cache } from "./_lib.js";
import { parseSwap } from "./_swap.js";
import { enrichTokens } from "./_market.js";

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

// Recent swap activity for a single wallet (KOL profile feed).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 12, 25);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "wallet address required" });
  cache(res, 15, 45);
  try {
    const sigs = (await rpc("getSignaturesForAddress", [address, { limit }])) || [];
    const slice = sigs.slice(0, limit);
    const txs = await Promise.all(slice.map((s) => rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
    const swaps = txs.map((t) => parseSwap(t, address)).filter(Boolean);
    const meta = await enrichTokens(swaps.map((s) => s.mint));
    const activity = swaps.map((s) => {
      const m = meta[s.mint] || {};
      return { ...s, symbol: m.symbol || null, name: m.name || null, image: m.image || null, priceUsd: m.price ?? null, mcap: m.mcap ?? null, usdValue: m.price ? s.tokenAmount * m.price : null };
    });
    return send(res, 200, { ok: true, address, activity });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e), activity: [] });
  }
}
