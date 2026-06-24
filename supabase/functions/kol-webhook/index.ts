// OG DEX — Helius real-time KOL webhook (push ingestion + self-registration).
// Uses runtime HELIUS_API_KEY + service role (decrypted only inside Supabase).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SERVICE_ROLE")!;
const HELIUS = (Deno.env.get("HELIUS_API_KEY") || "").trim();
const SECRET = Deno.env.get("KOL_SETUP_TOKEN") || Deno.env.get("CRON_SECRET") || "ogdex-kol";
const SOL = "So11111111111111111111111111111111111111112";
const STABLE = new Set(["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);
const J = { "Content-Type": "application/json" };

async function db(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, ...J, ...(opts.headers || {}) } });
}
async function directory(): Promise<Record<string, any>> {
  const r = await db("ogdex_kol_directory?select=address,kol_id,kol_wallet_id&is_active=is.true&kol_wallet_id=not.is.null&limit=1000");
  const rows = await r.json();
  const m: Record<string, any> = {};
  for (const x of rows) m[x.address] = x;
  return m;
}
function parseEnhanced(tx: any, owner: string) {
  const deltas: Record<string, number> = {}; let sol = 0;
  for (const t of tx.tokenTransfers || []) { const a = Number(t.tokenAmount || 0); if (t.toUserAccount === owner) deltas[t.mint] = (deltas[t.mint] || 0) + a; if (t.fromUserAccount === owner) deltas[t.mint] = (deltas[t.mint] || 0) - a; }
  for (const n of tx.nativeTransfers || []) { const a = Number(n.amount || 0) / 1e9; if (n.toUserAccount === owner) sol += a; if (n.fromUserAccount === owner) sol -= a; }
  if (deltas[SOL]) { sol += deltas[SOL]; delete deltas[SOL]; }
  let mint: string | null = null, best = 0;
  for (const [m, d] of Object.entries(deltas)) { if (STABLE.has(m)) continue; if (Math.abs(d) > Math.abs(best)) { best = d; mint = m; } }
  if (!mint || Math.abs(best) < 1e-9) return null;
  return { side: best > 0 ? "buy" : "sell", mint, tokenAmount: Math.abs(best), solAmount: Math.abs(sol), txHash: tx.signature, time: (tx.timestamp || 0) * 1000 };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // one-time / re-runnable registration
  if (url.searchParams.get("setup")) {
    if (url.searchParams.get("secret") !== SECRET) return new Response("unauthorized", { status: 401 });
    if (!HELIUS) return new Response(JSON.stringify({ ok: false, error: "no HELIUS_API_KEY" }), { headers: J });
    const dir = await directory(); const addrs = Object.keys(dir);
    const selfUrl = `${SUPABASE_URL}/functions/v1/kol-webhook`;
    const body = { webhookURL: selfUrl, transactionTypes: ["SWAP"], accountAddresses: addrs, webhookType: "enhanced", authHeader: SECRET };
    const listRes = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS}`);
    let list: any = []; try { list = await listRes.json(); } catch {}
    const existing = Array.isArray(list) ? list.find((w: any) => w.webhookURL === selfUrl) : null;
    const res = existing
      ? await fetch(`https://api.helius.xyz/v0/webhooks/${existing.webhookID}?api-key=${HELIUS}`, { method: "PUT", headers: J, body: JSON.stringify(body) })
      : await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS}`, { method: "POST", headers: J, body: JSON.stringify(body) });
    const txt = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, addresses: addrs.length, action: existing ? "updated" : "created", resp: txt.slice(0, 400) }), { headers: J });
  }

  if (req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    if (SECRET && auth !== SECRET && auth !== `Bearer ${SECRET}`) return new Response("unauthorized", { status: 401 });
    let evs: any = []; try { evs = await req.json(); } catch {}
    const dir = await directory();
    const rows: any[] = [];
    for (const tx of (Array.isArray(evs) ? evs : [])) {
      const involved = new Set<string>();
      for (const t of tx.tokenTransfers || []) { if (dir[t.fromUserAccount]) involved.add(t.fromUserAccount); if (dir[t.toUserAccount]) involved.add(t.toUserAccount); }
      for (const n of tx.nativeTransfers || []) { if (dir[n.fromUserAccount]) involved.add(n.fromUserAccount); if (dir[n.toUserAccount]) involved.add(n.toUserAccount); }
      for (const owner of involved) {
        const sw = parseEnhanced(tx, owner); if (!sw) continue;
        const k = dir[owner]; const buy = sw.side === "buy";
        rows.push({ kol_id: k.kol_id, kol_wallet_id: k.kol_wallet_id, tx_hash: sw.txHash, tx_type: sw.side, token_in: buy ? SOL : sw.mint, token_out: buy ? sw.mint : SOL, symbol_in: buy ? "SOL" : null, symbol_out: buy ? null : "SOL", amount_in: buy ? sw.solAmount : sw.tokenAmount, amount_out: buy ? sw.tokenAmount : sw.solAmount, price_usd: null, tx_status: "success", blockchain: "solana", tx_timestamp: new Date(sw.time || Date.now()).toISOString() });
      }
    }
    if (rows.length) await db("kol_transactions?on_conflict=tx_hash,kol_wallet_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(rows) });
    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), { headers: J });
  }
  return new Response(JSON.stringify({ ok: true, service: "kol-webhook" }), { headers: J });
});
