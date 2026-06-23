// Shared backend client — reuses the OG Scan (Soltools) Supabase backend.
export const SUPA_FN = process.env.SUPABASE_FN_URL || "https://ffjipnkhcebjvttliptb.supabase.co/functions/v1";
export const ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.aXu8bbpVVwc8KOJf1-lHqO3cz_0GZD10_TE0GlKQ1BI";
export const JUP = "https://lite-api.jup.ag";

export function send(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  const payload = JSON.stringify(data);
  if (typeof res.status === "function") { res.status(status).send(payload); }
  else { res.statusCode = status; res.end(payload); }
}

export async function callFn(name, body) {
  const r = await fetch(`${SUPA_FN}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify(body || {}),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { ok: false, raw: txt }; }
}

export async function jup(path) {
  const r = await fetch(`${JUP}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`jupiter ${r.status}`);
  return r.json();
}

export function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) { resolve(typeof req.body === "string" ? safe(req.body) : req.body); return; }
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(safe(d)));
  });
}
function safe(s) { try { return JSON.parse(s); } catch { return {}; } }
