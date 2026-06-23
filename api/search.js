import { callFn, send } from "./_lib.js";
import { normToken } from "./_normalize.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams.get("q") || "";
  if (!q.trim()) return send(res, 200, { rows: [] });
  try {
    const d = await callFn("jupiter-tokens", { query: q.trim() });
    const list = Array.isArray(d.tokens) ? d.tokens : (d.tokens?.tokens || []);
    const rows = list.map((t) => normToken(t, "24h")).filter(Boolean).slice(0, 20);
    return send(res, 200, { rows });
  } catch (e) {
    return send(res, 200, { rows: [], error: String(e?.message || e) });
  }
}
