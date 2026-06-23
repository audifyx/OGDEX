import { callFn, send } from "./_lib.js";
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const ids = url.searchParams.get("ids") || "";
  if (!ids) return send(res, 400, { error: "ids required" });
  try {
    const d = await callFn("jupiter-price", { ids });
    return send(res, 200, d);
  } catch (e) {
    return send(res, 200, { success: false, error: String(e?.message || e) });
  }
}
