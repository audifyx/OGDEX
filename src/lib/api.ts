export interface Row {
  mint: string; name?: string; symbol?: string; icon?: string | null;
  priceUsd?: number | null; mcap?: number | null; fdv?: number | null;
  liquidity?: number | null; holderCount?: number | null; volume?: number | null;
  buyVolume?: number | null; sellVolume?: number | null;
  numBuys?: number | null; numSells?: number | null; netBuyers?: number | null;
  change5m?: number | null; change1h?: number | null; change6h?: number | null; change24h?: number | null;
  organicScore?: number | null; organicScoreLabel?: string | null;
  isVerified?: boolean; dev?: string | null; circSupply?: number | null;
  totalSupply?: number | null; decimals?: number | null; graduatedAt?: string | null;
}

export interface TokenDetailData {
  mint: string; token: Row | null; raw: any; score: any; flags: any;
  verdict: string | null; momentum: number | null; momentumLabel: string | null;
  meta: any; safety: any; error?: string;
}

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json();
}

export const getScreener = (type: string, interval: string, limit = 50) =>
  j<{ rows: Row[]; error?: string }>(`/api/screener?type=${type}&interval=${interval}&limit=${limit}`);
export const search = (q: string) => j<{ rows: Row[] }>(`/api/search?q=${encodeURIComponent(q)}`);
export const getToken = (mint: string) => j<TokenDetailData>(`/api/token?mint=${mint}`);

// formatters
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
