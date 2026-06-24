import { callFn, send, cache, dbSelect, dbInsert } from "./_lib.js";
import { parseSwap } from "./_swap.js";
import { enrichTokens } from "./_market.js";

const SOL = "So11111111111111111111111111111111111111112";
async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

// Global KOL live feed. Reads cached kol_transactions; lazily ingests a rotating
// batch of active KOL wallets each call so the feed self-populates (poll-based MVP).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 120);
  const side = url.searchParams.get("side"); // buy|sell
  const kolId = url.searchParams.get("kolId");
  const ingest = url.searchParams.get("ingest") !== "0";
  cache(res, 5, 20);

  if (ingest) { try { await ingestBatch(url); } catch {} }

  try {
    let q = `select=*&order=tx_timestamp.desc&limit=${limit}`;
    if (side) q += `&tx_type=eq.${side}`;
    if (kolId) q += `&kol_id=eq.${kolId}`;
    const rows = await dbSelect("ogdex_kol_feed", q);
    // resolve symbols/images for traded mints lazily
    return send(res, 200, { ok: true, count: rows.length, feed: rows.map(fmt) });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e), feed: [] });
  }
}

function fmt(r) {
  const buy = r.tx_type === "buy";
  const mint = buy ? r.token_out : r.token_in;
  const symbol = buy ? r.symbol_out : r.symbol_in;
  return {
    id: r.id, side: r.tx_type, kolId: r.kol_id, kolAddress: r.kol_address, name: r.name, twitter: r.x_handle, tags: r.tags || [], avatar: r.image_url, kolStatus: r.kol_status,
    mint, symbol, tokenAmount: buy ? r.amount_out : r.amount_in, solAmount: buy ? r.amount_in : r.amount_out,
    priceUsd: r.price_usd, usdValue: (r.price_usd && (buy ? r.amount_out : r.amount_in)) ? r.price_usd * (buy ? r.amount_out : r.amount_in) : null,
    time: r.tx_timestamp ? new Date(r.tx_timestamp).getTime() : null, txHash: r.tx_hash,
  };
}

async function ingestBatch(url) {
  const BATCH = 5;
  const offset = Number(url.searchParams.get("offset")) || Math.floor(Date.now() / 60000) % 10;
  const wallets = await dbSelect("ogdex_kol_directory", "select=address,kol_id,is_active&is_active=is.true&limit=500");
  if (!wallets.length) return;
  const start = (offset * BATCH) % wallets.length;
  const slice = wallets.slice(start, start + BATCH);
  const swapsAll = [];
  for (const w of slice) {
    try {
      const sigs = (await rpc("getSignaturesForAddress", [w.address, { limit: 4 }])) || [];
      const hashes = sigs.map((s) => s.signature);
      if (!hashes.length) continue;
      const existing = await dbSelect("kol_transactions", `select=tx_hash&tx_hash=in.(${hashes.join(",")})`).catch(() => []);
      const seen = new Set(existing.map((e) => e.tx_hash));
      const fresh = hashes.filter((h) => !seen.has(h)).slice(0, 2);
      for (const h of fresh) {
        const tx = await rpc("getTransaction", [h, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
        const sw = parseSwap(tx, w.address);
        if (sw) swapsAll.push({ ...sw, kol_id: w.kol_id });
      }
    } catch {}
  }
  if (!swapsAll.length) return;
  const meta = await enrichTokens(swapsAll.map((s) => s.mint));
  for (const s of swapsAll) {
    const m = meta[s.mint] || {};
    const buy = s.side === "buy";
    const row = {
      kol_id: s.kol_id, tx_hash: s.txHash, tx_type: s.side,
      token_in: buy ? SOL : s.mint, token_out: buy ? s.mint : SOL,
      symbol_in: buy ? "SOL" : (m.symbol || null), symbol_out: buy ? (m.symbol || null) : "SOL",
      amount_in: buy ? s.solAmount : s.tokenAmount, amount_out: buy ? s.tokenAmount : s.solAmount,
      price_usd: m.price ?? null, tx_status: "success", blockchain: "solana",
      tx_timestamp: new Date(s.time || Date.now()).toISOString(),
    };
    try { await dbInsert("kol_transactions", row); } catch {}
  }
}
