import { callFn, send } from "./_lib.js";
import { normToken } from "./_normalize.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { error: "mint required" });
  try {
    const [jt, scan, safety] = await Promise.all([
      callFn("jupiter-tokens", { mint }).catch(() => null),
      callFn("og-scan-token", { query: mint }).catch(() => null),
      callFn("token-safety", { mint }).catch(() => null),
    ]);
    const list = jt && (Array.isArray(jt.tokens) ? jt.tokens : (jt.tokens?.tokens || []));
    const raw = (list || []).find((t) => (t.id || t.mint) === mint) || (list || [])[0] || null;
    const token = normToken(raw, "24h");
    return send(res, 200, {
      mint,
      token: token || (scan?.token ?? null),
      raw,
      score: scan?.score ?? null,
      flags: scan?.flags ?? null,
      verdict: scan?.verdict ?? null,
      momentum: scan?.token?.momentum ?? null,
      momentumLabel: scan?.token?.momentumLabel ?? null,
      meta: scan?.token ?? null,
      safety: safety && safety.ok ? safety : null,
    });
  } catch (e) {
    return send(res, 200, { mint, error: String(e?.message || e) });
  }
}
