import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getScreener, search, Row, fmtUsd, compact, short } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import { Flame, Sprout, Sparkles, ArrowUpDown, Loader2, Droplets } from "lucide-react";

type Tab = "trending" | "organic" | "new";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "organic", label: "Top Organic", icon: Sprout },
  { id: "new", label: "Newly Graduated", icon: Sparkles },
];
const INTERVALS = ["5m", "1h", "6h", "24h"];
type SortKey = "mcap" | "liquidity" | "volume" | "change" | "holderCount" | "organicScore";

export default function Screener() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [tab, setTab] = useState<Tab>("trending");
  const [interval, setInterval] = useState("24h");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("volume");
  const [desc, setDesc] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let on = true;
    setLoading(true);
    const run = async () => {
      try {
        if (q) {
          const d = await search(q);
          if (on) setRows(d.rows || []);
        } else {
          const d = await getScreener(tab, interval, 60);
          if (on) setRows(d.rows || []);
        }
      } finally { if (on) setLoading(false); }
    };
    run();
    const t = q ? null : window.setInterval(run, 20000);
    return () => { on = false; if (t) clearInterval(t); };
  }, [tab, interval, q]);

  const changeKey = (r: Row) =>
    interval === "5m" ? r.change5m : interval === "1h" ? r.change1h : interval === "6h" ? r.change6h : r.change24h;

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sort === "change" ? changeKey(a) : (a as any)[sort];
      const vb = sort === "change" ? changeKey(b) : (b as any)[sort];
      return ((vb ?? -Infinity) as number) - ((va ?? -Infinity) as number);
    });
    return desc ? arr : arr.reverse();
  }, [rows, sort, desc, interval]);

  const setSortKey = (k: SortKey) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(true); } };

  return (
    <div>
      {!q && (
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Solana Token Screener</h1>
          <p className="text-muted text-sm mt-1">Real-time markets ranked by trading volume, organic momentum and the OG Score. Faster signal, less noise.</p>
        </div>
      )}
      {q && <h2 className="text-lg font-semibold mb-4">Results for “{q}”</h2>}

      {!q && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1 bg-panel border border-line rounded-lg p-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`btn flex items-center gap-1.5 ${tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
          {tab !== "new" && (
            <div className="flex gap-1 bg-panel border border-line rounded-lg p-1">
              {INTERVALS.map((iv) => (
                <button key={iv} onClick={() => setInterval(iv)}
                  className={`btn ${interval === iv ? "bg-panel2 text-white" : "text-muted hover:text-white"}`}>{iv}</button>
              ))}
            </div>
          )}
          <div className="ml-auto text-xs text-muted flex items-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-up animate-pulse" />}
            {loading ? "loading" : "live · auto-refresh 20s"}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-muted text-xs border-b border-line">
                <th className="text-left font-medium px-4 py-3 w-8">#</th>
                <th className="text-left font-medium px-2 py-3">Token</th>
                <Th onClick={() => setSortKey("change")} active={sort === "change"}>Price ({tab === "new" ? "—" : interval})</Th>
                <Th onClick={() => setSortKey("mcap")} active={sort === "mcap"}>Market Cap</Th>
                <Th onClick={() => setSortKey("liquidity")} active={sort === "liquidity"}>Liquidity</Th>
                <Th onClick={() => setSortKey("volume")} active={sort === "volume"}>Volume</Th>
                <Th onClick={() => setSortKey("holderCount")} active={sort === "holderCount"}>Holders</Th>
                <Th onClick={() => setSortKey("organicScore")} active={sort === "organicScore"}>Organic</Th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td colSpan={8} className="px-4 py-3"><div className="h-6 bg-panel2 rounded animate-pulse" /></td>
                  </tr>
                ))
              )}
              {sorted.map((r, i) => (
                <tr key={r.mint} onClick={() => nav(`/token/${r.mint}`)}
                  className="border-b border-line/50 hover:bg-panel2/60 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2.5">
                      <TokenLogo src={r.icon} sym={r.symbol} />
                      <div className="min-w-0">
                        <div className="font-semibold truncate max-w-[180px] flex items-center gap-1.5">
                          {r.symbol || short(r.mint)}
                          {r.isVerified && <span className="text-accent text-[10px]" title="Verified">✓</span>}
                        </div>
                        <div className="text-muted text-xs truncate max-w-[180px]">{r.name || short(r.mint)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="font-medium">{fmtUsd(r.priceUsd)}</div>
                    <Change v={changeKey(r)} className="text-xs" />
                  </td>
                  <td className="px-2 py-3">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                  <td className="px-2 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-muted" />{r.liquidity != null ? "$" + compact(r.liquidity) : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-3">{r.volume != null ? "$" + compact(r.volume) : "—"}</td>
                  <td className="px-2 py-3">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                  <td className="px-2 py-3">
                    {r.organicScore != null ? (
                      <span className={`pill ${organicCls(r.organicScore)}`}>{Math.round(r.organicScore)}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No tokens found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active }: { children: any; onClick?: () => void; active?: boolean }) {
  return (
    <th className="text-left font-medium px-2 py-3 select-none">
      <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-white ${active ? "text-white" : ""}`}>
        {children}<ArrowUpDown className="w-3 h-3 opacity-50" />
      </button>
    </th>
  );
}
function organicCls(s: number) {
  if (s >= 70) return "bg-up/15 text-up";
  if (s >= 40) return "bg-accent/15 text-accent";
  if (s >= 20) return "bg-yellow-500/15 text-yellow-400";
  return "bg-down/15 text-down";
}
