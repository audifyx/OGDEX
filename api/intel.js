import { callFn, send, cache } from "./_lib.js";
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  cache(res, 8, 20);
  try { return send(res, 200, await callFn("ogdex-intel", { mint })); }
  catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e) }); }
}
