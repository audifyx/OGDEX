import { send, cache, dbSelect, dbInsert, readBody, ADMIN_PASS } from "./_lib.js";
import { readFileSync } from "fs";

let SEED = { kols: [] };
try { SEED = JSON.parse(readFileSync(new URL("./_kols.json", import.meta.url), "utf8")); } catch {}

const pub = (p) => ({
  kolId: p.kol_id || p.id || null,
  name: p.name,
  twitter: p.x_handle || null,
  twitterUrl: p.x_url || (p.x_handle ? `https://x.com/${String(p.x_handle).replace(/^@/, "")}` : null),
  avatar: p.image_url || null,
  address: p.address || p.wallet_address,
  tags: p.tags || [],
  status: p.status || "active",
  notes: p.notes || null,
  pnl: p.pnl ?? null,
  winRate: p.win_rate ?? null,
  followers: p.followers_count ?? null,
  isActive: p.is_active ?? (p.status !== "disputed"),
});

function seedDirectory() {
  const map = {};
  for (const k of SEED.kols) map[k.address] = { name: k.name, twitter: k.twitter, tags: k.tags, status: k.status, notes: k.notes, address: k.address };
  return map;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") return add(req, res);

  // directory: address -> kol info (for holder labeling)
  if (url.searchParams.get("directory")) {
    cache(res, 60, 300);
    try {
      const rows = await dbSelect("ogdex_kol_directory", "select=address,name,x_handle,x_url,image_url,tags,status,notes,pnl,win_rate,kol_id&limit=2000");
      const map = {};
      for (const r of rows) map[r.address] = pub(r);
      return send(res, 200, { ok: true, count: Object.keys(map).length, directory: map });
    } catch (e) {
      return send(res, 200, { ok: true, fromSeed: true, directory: seedDirectory(), error: String(e?.message || e) });
    }
  }

  // single profile by wallet address
  const address = url.searchParams.get("address");
  if (address) {
    cache(res, 30, 120);
    try {
      const dir = await dbSelect("ogdex_kol_directory", `select=*&address=eq.${address}&limit=1`);
      if (!dir.length) return send(res, 200, { ok: false, error: "not a tracked KOL" });
      const kolId = dir[0].kol_id;
      const [prof, wallets] = await Promise.all([
        dbSelect("kol_profiles", `id=eq.${kolId}&limit=1`),
        dbSelect("kol_wallets", `kol_id=eq.${kolId}&select=wallet_address,label,is_primary`),
      ]);
      const p = prof[0] || dir[0];
      return send(res, 200, { ok: true, kol: pub({ ...p, kol_id: kolId }), wallets: wallets.map((w) => ({ address: w.wallet_address, label: w.label, primary: w.is_primary })) });
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e?.message || e) });
    }
  }

  // list / leaderboard
  cache(res, 30, 120);
  try {
    const rows = await dbSelect("kol_profiles", "select=*&order=is_active.desc,followers_count.desc.nullslast,name.asc&limit=1000");
    return send(res, 200, { ok: true, count: rows.length, kols: rows.map(pub) });
  } catch (e) {
    return send(res, 200, { ok: true, fromSeed: true, kols: SEED.kols.map((k) => pub({ ...k, x_handle: k.twitter, wallet_address: k.address })), error: String(e?.message || e) });
  }
}

async function add(req, res) {
  try {
    const b = await readBody(req);
    if (!b.pass || String(b.pass) !== String(ADMIN_PASS)) return send(res, 401, { ok: false, error: "unauthorized" });
    const address = String(b.address || "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "valid Solana address required" });
    const row = {
      name: b.name || address.slice(0, 6),
      x_handle: b.twitter || null,
      x_url: b.twitter ? `https://x.com/${String(b.twitter).replace(/^@/, "")}` : null,
      wallet_address: address, blockchain: "solana",
      tags: Array.isArray(b.tags) ? b.tags : ["KOL"],
      status: b.status || "active", notes: b.notes || null,
      is_active: b.status !== "disputed", source: "admin",
    };
    const ins = await dbInsert("kol_profiles", row);
    const kol = ins[0] || row;
    if (kol.id) { try { await dbInsert("kol_wallets", { kol_id: kol.id, wallet_address: address, blockchain: "solana", label: "Primary", is_primary: true }); } catch {} }
    return send(res, 200, { ok: true, kol: pub(kol) });
  } catch (e) {
    return send(res, 400, { ok: false, error: String(e?.message || e) });
  }
}
