import { callFn, send, cache } from "./_lib.js";
import { normToken } from "./_normalize.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { error: "mint required" });
  cache(res, 10, 30);
  try {
    const [jt, scan, intel] = await Promise.all([
      callFn("jupiter-tokens", { mint }).catch(() => null),
      callFn("og-scan-token", { query: mint }).catch(() => null),
      callFn("ogdex-intel", { mint }).catch(() => null),
    ]);
    const list = jt && (Array.isArray(jt.tokens) ? jt.tokens : (jt.tokens?.tokens || []));
    const raw = (list || []).find((t) => (t.id || t.mint) === mint) || (list || [])[0] || null;
    const token = normToken(raw, "24h");
    const meta = scan?.token ?? null;
    if (token && meta) { token.isVerified = token.isVerified || !!meta.isVerifiedJup; if (token.icon == null) token.icon = meta.icon || meta.image; }
    return send(res, 200, {
      mint,
      token: token || (meta ? normMetaToken(meta) : null),
      raw, meta,
      score: scan?.score ?? null,
      flags: scan?.flags ?? null,
      verdict: scan?.verdict ?? null,
      momentum: meta?.momentum ?? null,
      momentumLabel: meta?.momentumLabel ?? null,
      intel: intel?.ok ? intel : null,
      safety: intel?.safety ?? null,
    });
  } catch (e) {
    return send(res, 200, { mint, error: String(e?.message || e) });
  }
}
function normMetaToken(m) {
  return { mint: m.mint, name: m.name, symbol: m.symbol, icon: m.icon || m.image,
    priceUsd: m.priceUsd, mcap: m.mcap, fdv: m.fdv, liquidity: m.liquidity,
    holderCount: m.holderCount, volume: (m.buyVolume24h || 0) + (m.sellVolume24h || 0),
    change24h: m.priceChange24h, isVerified: !!m.isVerifiedJup };
}
