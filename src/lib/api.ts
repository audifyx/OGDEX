export interface Row {
  mint: string; name?: string; symbol?: string; icon?: string | null;
  priceUsd?: number | null; mcap?: number | null; fdv?: number | null;
  liquidity?: number | null; holderCount?: number | null; volume?: number | null;
  buyVolume?: number | null; sellVolume?: number | null;
  numBuys?: number | null; numSells?: number | null; netBuyers?: number | null;
  change5m?: number | null; change1h?: number | null; change6h?: number | null; change24h?: number | null;
  organicScore?: number | null; organicScoreLabel?: string | null;
  isVerified?: boolean; dev?: string | null; circSupply?: number | null;
  totalSupply?: number | null; decimals?: number | null;
}
export interface Listing {
  id: string; contract_address: string; chain: string; project_name?: string;
  symbol?: string; logo_url?: string; banner_url?: string; description?: string;
  links?: Record<string, string>; tier: string; status: string; featured?: boolean;
  featured_rank?: number; metadata?: any; views?: number; created_at?: string; approved_at?: string;
}
export interface TokenDetailData {
  mint: string; token: Row | null; raw: any; score: any; flags: any;
  verdict: string | null; momentum: number | null; momentumLabel: string | null;
  meta: any; safety: any; intel?: any; error?: string;
}
export interface AppConfig {
  payWallet: string;
  pricing: { tier: string; price: number; sla: string; label: string }[];
  chains: string[]; telegram: string; community: any;
}

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  return r.json();
}
const postJson = (url: string, body: any) =>
  j(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getScreener = (type: string, interval: string, limit = 100) =>
  j<{ rows: Row[]; count?: number; error?: string }>(`/api/screener?type=${type}&interval=${interval}&limit=${limit}`);
export const search = (q: string) => j<{ rows: Row[] }>(`/api/search?q=${encodeURIComponent(q)}`);
export const getToken = (mint: string) => j<TokenDetailData>(`/api/token?mint=${mint}`);
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
export interface ChartData { ok: boolean; candles: Candle[]; pool?: string | null; poolName?: string | null; dex?: string | null; interval?: string; error?: string; note?: string; }
export const getChart = (mint: string, interval = "1h", limit = 200, chain = "solana") =>
  j<ChartData>(`/api/chart?mint=${mint}&interval=${interval}&limit=${limit}&chain=${chain}`);
export const getConfig = () => j<AppConfig>(`/api/config`);
export const getListings = (featuredOnly = false) =>
  j<{ rows: Listing[] }>(`/api/listings${featuredOnly ? "?featured=1" : ""}`);
export const submitListing = (data: any) => postJson(`/api/listings`, data) as Promise<{ ok: boolean; listing?: Listing; error?: string }>;
export const track = (type: string, extra: any = {}) => {
  try { navigator.sendBeacon?.("/api/track", JSON.stringify({ type, ...extra })); }
  catch { fetch("/api/track", { method: "POST", body: JSON.stringify({ type, ...extra }), keepalive: true }); }
};
export const adminGet = (pass: string) => j<any>(`/api/admin?pass=${encodeURIComponent(pass)}`);
export const adminAction = (pass: string, action: string, id?: string, extra: any = {}) =>
  postJson(`/api/admin`, { pass, action, id, ...extra }) as Promise<{ ok: boolean; error?: string }>;

export function fmtUsd(n?: number | null, opts: { compact?: boolean } = {}): string {
  if (n == null || !isFinite(n)) return "—";
  if (opts.compact) return "$" + compact(n);
  if (n < 0.000001 && n > 0) return "$" + n.toExponential(2);
  if (n < 1) return "$" + n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export function compact(n?: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}
export function fmtNum(n?: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString();
}
export function fmtPct(n?: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}
export function short(addr?: string | null): string {
  if (!addr) return "—";
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}
