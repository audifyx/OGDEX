import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getScreener, search, getListings, Row, Listing, fmtUsd, compact, short } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import Verified from "../components/Verified";
import FeaturedBanner from "../components/FeaturedBanner";
import { Flame, Sprout, Sparkles, ArrowUpDown, Loader2, Droplets, TrendingUp, Crown, Star, Rocket, BadgeCheck } from "lucide-react";

type Tab = "trending" | "runners" | "new" | "migrated" | "organic" | "og" | "celebrity" | "listed";
const TABS: { id: Tab; label: string; icon: any; noInterval?: boolean }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "runners", label: "Daily Runners", icon: TrendingUp, noInterval: true },
  { id: "new", label: "New Tokens", icon: Sparkles, noInterval: true },
  { id: "migrated", label: "Just Migrated", icon: Rocket, noInterval: true },
  { id: "organic", label: "Top Organic", icon: Sprout },
  { id: "og", label: "OG Tokens", icon: Crown, noInterval: true },
  { id: "celebrity", label: "Celebrity", icon: Star, noInterval: true },
  { id: "listed", label: "Listed", icon: BadgeCheck, noInterval: true },
];
const INTERVALS = ["5m", "1h", "6h", "24h"];
type SortKey = "mcap" | "liquidity" | "volume" | "change" | "holderCount" | "organicScore";

export default function Screener() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [tab, setTab] = useState<Tab>("trending");
  const [interval, setInterval] = useState("24h");
  const [rows, setRows] = useState<Row[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("volume");
  const [desc, setDesc] = useState(true);
  const nav = useNavigate();
  const cur = TABS.find((t) => t.id === tab)!;

  useEffect(() => {
    let on = true; setLoading(true);
    const run = async () => {
      try {
        if (q) { const d = await search(q); if (on) setRows(d.rows || []); }
        else if (tab === "listed") { const d = await getListings(); if (on) setListings(d.rows || []); }
        else { const d = await getScreener(tab, interval, 100); if (on) setRows(d.rows || []); }
      } finally { if (on) setLoading(false); }
    };
    run();
    const auto = (q || tab === "listed" || tab === "og" || tab === "celebrity") ? null : window.setInterval(run, 25000);
    return () => { on = false; if (auto) clearInterval(auto); };
  }, [tab, interval, q]);

  const changeKey = (r: Row) =>
    interval === "5m" ? r.change5m : interval === "1h" ? r.change1h : interval === "6h" ? r.change6h : r.change24h;
  const effInt = cur.noInterval ? "24h" : interval;
  const changeKeyEff = (r: Row) => cur.noInterval ? r.change24h : changeKey(r);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (tab === "runners") return arr;
    arr.sort((a, b) => {
      const va = sort === "change" ? changeKeyEff(a) : (a as any)[sort];
      const vb = sort === "change" ? changeKeyEff(b) : (b as any)[sort];
      return ((vb ?? -Infinity) as number) - ((va ?? -Infinity) as number);
    });
    return desc ? arr : arr.reverse();
  }, [rows, sort, desc, interval, tab]);

  const setSortKey = (k: SortKey) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(true); } };

  return (
    <div>
      {!q && <FeaturedBanner />}

      {!q && (
        <div className="mb-5">
          <h1 className="text-xl font-bold tracking-tight">Solana Token Screener</h1>
          <p className="text-muted text-xs mt-0.5">Live markets · organic momentum · OG Score · 400+ tokens</p>
        </div>
      )}
      {q && <h2 className="text-lg font-semibold mb-4">Results for "{q}"</h2>}

      {!q && (
        <div className="mb-4 space-y-2">
          {/* Tab strip — single row, horizontal scroll */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex gap-1 bg-panel border border-line rounded-xl p-1 w-max min-w-full">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                      ${tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}
                  >
                    <t.icon className="w-3 h-3 shrink-0" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interval + live indicator — only when relevant */}
          <div className="flex items-center gap-2">
            {!cur.noInterval && (
              <div className="flex gap-0.5 bg-panel border border-line rounded-lg p-0.5">
                {INTERVALS.map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                      ${interval === iv ? "bg-panel2 text-white" : "text-muted hover:text-white"}`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />}
              {loading ? "loading…" : tab === "listed" ? `${listings.length} listed` : "live"}
            </div>
          </div>
        </div>
      )}

      {tab === "listed" && !q ? (
        <ListedView listings={listings} loading={loading} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-muted text-xs border-b border-line">
                  <th className="text-left font-medium px-4 py-3 w-8">#</th>
                  <th className="text-left font-medium px-2 py-3">Token</th>
                  <Th onClick={() => setSortKey("change")} active={sort === "change"}>Price ({effInt})</Th>
                  <Th onClick={() => setSortKey("mcap")} active={sort === "mcap"}>Market Cap</Th>
                  <Th onClick={() => setSortKey("liquidity")} active={sort === "liquidity"}>Liquidity</Th>
                  <Th onClick={() => setSortKey("volume")} active={sort === "volume"}>Volume</Th>
                  <Th onClick={() => setSortKey("holderCount")} active={sort === "holderCount"}>Holders</Th>
                  <Th onClick={() => setSortKey("organicScore")} active={sort === "organicScore"}>Organic</Th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 bg-panel2 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
                {sorted.map((r, i) => (
                  <tr
                    key={r.mint + i}
                    onClick={() => nav(`/token/${r.mint}`)}
                    className="border-b border-line/50 hover:bg-panel2/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <TokenLogo src={r.icon} sym={r.symbol} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate max-w-[180px] flex items-center gap-1.5">
                            {r.symbol || short(r.mint)}{r.isVerified && <Verified />}
                          </div>
                          <div className="text-muted text-xs truncate max-w-[180px]">{r.name || short(r.mint)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-medium">{fmtUsd(r.priceUsd)}</div>
                      <Change v={changeKeyEff(r)} className="text-xs" />
                    </td>
                    <td className="px-2 py-3">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                    <td className="px-2 py-3">
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-muted" />
                        {r.liquidity != null ? "$" + compact(r.liquidity) : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-3">{r.volume != null ? "$" + compact(r.volume) : "—"}</td>
                    <td className="px-2 py-3">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                    <td className="px-2 py-3">
                      {r.organicScore != null
                        ? <span className={`pill ${organicCls(r.organicScore)}`}>{Math.round(r.organicScore)}</span>
                        : "—"}
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
      )}
    </div>
  );
}

function ListedView({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  if (loading) return <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!listings.length) return (
    <div className="card p-10 text-center">
      <p className="text-muted">No community listings yet.</p>
      <Link to="/submit" className="btn bg-accent text-black font-semibold mt-3 inline-flex">List your token →</Link>
    </div>
  );
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
      {listings.map((a) => {
        const inner = (
          <div className="card p-4 flex items-center gap-3 hover:border-accent/50 transition-colors h-full">
            {a.logo_url
              ? <img src={a.logo_url} className="w-12 h-12 rounded-full object-cover border border-line shrink-0" />
              : <div className="w-12 h-12 rounded-full bg-panel2 grid place-items-center text-xs text-muted shrink-0">{(a.symbol || "?").slice(0, 3)}</div>}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate flex items-center gap-1.5">
                {a.project_name || a.symbol || "Project"}<Verified />
                <span className="pill bg-panel2 text-muted text-[10px] uppercase">{a.chain}</span>
                {a.featured && <span className="pill bg-accent2/20 text-accent2 text-[10px]">AD</span>}
              </div>
              <div className="text-xs text-muted truncate">{a.description || short(a.contract_address)}</div>
              {a.metadata?.mcap && <div className="text-xs text-muted mt-0.5">MC {fmtUsd(a.metadata.mcap, { compact: true })}</div>}
            </div>
          </div>
        );
        return a.chain === "solana"
          ? <Link key={a.id} to={`/token/${a.contract_address}`}>{inner}</Link>
          : <a key={a.id} href={a.links?.website || `https://dexscreener.com/search?q=${a.contract_address}`} target="_blank" rel="noreferrer">{inner}</a>;
      })}
    </div>
  );
}

function Th({ children, onClick, active }: { children: any; onClick?: () => void; active?: boolean }) {
  return (
    <th className="text-left font-medium px-2 py-3 select-none">
      <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-white ${active ? "text-white" : ""}`}>
        {children}<ArrowUpDown className="w-3 h-3 opacity-40" />
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
