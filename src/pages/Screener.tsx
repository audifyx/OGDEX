import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getScreener, search, getListings, Row, Listing, fmtUsd, compact, short } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import Verified from "../components/Verified";
import FeaturedBanner from "../components/FeaturedBanner";
import {
  Flame, Sprout, Sparkles, ArrowUpDown, Loader2, Droplets, TrendingUp, Crown,
  Star, Rocket, BadgeCheck, Moon, Zap, Unlink, Globe, ChevronDown, Activity
} from "lucide-react";

type Tab = "trending"|"runners"|"new"|"migrated"|"organic"|"moonshot"|"og"|"celebrity"|"unbonded"|"listed"|"multichain";
const TABS: { id: Tab; label: string; icon: any; chainOnly?: boolean; noInterval?: boolean }[] = [
  { id: "trending",    label: "Trending",    icon: Flame },
  { id: "runners",     label: "Runners",     icon: TrendingUp,  noInterval: true },
  { id: "new",         label: "New",         icon: Sparkles,    noInterval: true },
  { id: "moonshot",    label: "Moonshot",    icon: Moon,        noInterval: true },
  { id: "unbonded",    label: "Unbonded",    icon: Activity,    noInterval: true },
  { id: "migrated",    label: "Migrated",    icon: Rocket,      noInterval: true },
  { id: "organic",     label: "Organic",     icon: Sprout },
  { id: "og",          label: "OG",          icon: Crown,       noInterval: true },
  { id: "celebrity",   label: "Celebrity",   icon: Star,        noInterval: true },
  { id: "listed",      label: "Listed",      icon: BadgeCheck,  noInterval: true },
  { id: "multichain",  label: "Multi-chain", icon: Globe,       noInterval: true },
];

const INTERVALS = ["5m","1h","6h","24h"];
const CHAINS = [
  { id: "ethereum", label: "Ethereum", color: "text-blue-400" },
  { id: "bsc",      label: "BNB Chain", color: "text-yellow-400" },
  { id: "base",     label: "Base",     color: "text-blue-500" },
  { id: "polygon",  label: "Polygon",  color: "text-purple-400" },
  { id: "arbitrum", label: "Arbitrum", color: "text-cyan-400" },
  { id: "avalanche",label: "Avax",     color: "text-red-400" },
  { id: "sui",      label: "SUI",      color: "text-sky-400" },
  { id: "ton",      label: "TON",      color: "text-blue-300" },
];

type SortKey = "mcap"|"liquidity"|"volume"|"change"|"holderCount"|"organicScore";

export default function Screener() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [tab, setTab] = useState<Tab>("trending");
  const [interval, setInterval] = useState("24h");
  const [chain, setChain] = useState("ethereum");
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
        if (q) {
          const d = await search(q);
          if (on) setRows(d.rows || []);
        } else if (tab === "listed") {
          const d = await getListings();
          if (on) setListings(d.rows || []);
        } else if (tab === "multichain") {
          const d = await getScreener("trending", interval, 100, chain);
          if (on) setRows(d.rows || []);
        } else {
          const d = await getScreener(tab, interval, 100);
          if (on) setRows(d.rows || []);
        }
      } finally { if (on) setLoading(false); }
    };
    run();
    const skip = q || tab === "listed" || cur.noInterval || tab === "multichain";
    const auto = skip ? null : window.setInterval(run, 25000);
    return () => { on = false; if (auto) clearInterval(auto); };
  }, [tab, interval, q, chain]);

  const changeKeyEff = (r: Row) => {
    if (cur.noInterval) return r.change24h;
    return interval === "5m" ? r.change5m : interval === "1h" ? r.change1h : interval === "6h" ? r.change6h : r.change24h;
  };

  const sorted = useMemo(() => {
    if (tab === "runners" || tab === "unbonded") return [...rows];
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sort === "change" ? changeKeyEff(a) : (a as any)[sort];
      const vb = sort === "change" ? changeKeyEff(b) : (b as any)[sort];
      return ((vb ?? -Infinity) as number) - ((va ?? -Infinity) as number);
    });
    return desc ? arr : arr.reverse();
  }, [rows, sort, desc, interval, tab]);

  const setSortKey = (k: SortKey) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(true); } };
  const isUnbonded = tab === "unbonded";

  return (
    <div>
      {!q && <FeaturedBanner />}

      {!q && (
        <div className="mb-1">
          <h1 className="text-xl font-bold tracking-tight">Token Screener</h1>
          <p className="text-muted text-xs mt-0.5">Solana · Multi-chain · Moonshot · Pump.fun · Live</p>
        </div>
      )}
      {q && <h2 className="text-lg font-semibold mb-4">Results for "{q}"</h2>}

      {!q && (
        <div className="mb-4 space-y-2 mt-3">
          {/* Tab strip */}
          <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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

          {/* Sub-controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {!cur.noInterval && tab !== "multichain" && (
              <div className="flex gap-0.5 bg-panel border border-line rounded-lg p-0.5">
                {INTERVALS.map((iv) => (
                  <button key={iv} onClick={() => setInterval(iv)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                      ${interval === iv ? "bg-panel2 text-white" : "text-muted hover:text-white"}`}>
                    {iv}
                  </button>
                ))}
              </div>
            )}
            {tab === "multichain" && (
              <div className="flex gap-1 flex-wrap">
                {CHAINS.map((c) => (
                  <button key={c.id} onClick={() => setChain(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                      ${chain === c.id
                        ? `border-accent/50 bg-accent/10 ${c.color}`
                        : "border-line text-muted hover:text-white hover:border-white/20"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse inline-block" />}
              {loading ? "loading…"
                : tab === "listed" ? `${listings.length} listed`
                : tab === "multichain" ? `${rows.length} pools · ${CHAINS.find(c=>c.id===chain)?.label}`
                : `${rows.length} tokens`}
            </div>
          </div>
        </div>
      )}

      {/* Listed = card grid */}
      {tab === "listed" && !q ? (
        <ListedView listings={listings} loading={loading} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: isUnbonded ? 700 : 900 }}>
              <thead>
                <tr className="text-muted text-xs border-b border-line">
                  <th className="text-left font-medium px-4 py-3 w-8">#</th>
                  <th className="text-left font-medium px-2 py-3">Token</th>
                  {isUnbonded ? (
                    <>
                      <th className="text-left font-medium px-2 py-3">Market Cap</th>
                      <th className="text-left font-medium px-2 py-3 w-48">Bonding Progress</th>
                      <th className="text-left font-medium px-2 py-3">Holders</th>
                    </>
                  ) : (
                    <>
                      <Th onClick={() => setSortKey("change")} active={sort === "change"}>
                        Price ({cur.noInterval ? "24h" : interval})
                      </Th>
                      <Th onClick={() => setSortKey("mcap")} active={sort === "mcap"}>MCap</Th>
                      <Th onClick={() => setSortKey("liquidity")} active={sort === "liquidity"}>Liq</Th>
                      <Th onClick={() => setSortKey("volume")} active={sort === "volume"}>Vol</Th>
                      <Th onClick={() => setSortKey("holderCount")} active={sort === "holderCount"}>Holders</Th>
                      {tab !== "multichain" && (
                        <Th onClick={() => setSortKey("organicScore")} active={sort === "organicScore"}>Organic</Th>
                      )}
                    </>
                  )}
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
                {sorted.map((r: any, i) => (
                  <tr key={r.mint + i}
                    onClick={() => r.chain && r.chain !== "solana" ? null : nav(`/token/${r.mint}`)}
                    className={`border-b border-line/50 transition-colors
                      ${r.chain && r.chain !== "solana" ? "cursor-default" : "hover:bg-panel2/60 cursor-pointer"}`}>
                    <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <TokenLogo src={r.icon} sym={r.symbol} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate max-w-[160px] flex items-center gap-1.5">
                            {r.symbol || short(r.mint)}
                            {r.isVerified && <Verified />}
                            {r.chain && r.chain !== "solana" && (
                              <span className="pill bg-panel2 text-muted text-[9px] uppercase !px-1.5 !py-0">{r.chain}</span>
                            )}
                          </div>
                          <div className="text-muted text-xs truncate max-w-[160px]">{r.name || short(r.mint)}</div>
                        </div>
                      </div>
                    </td>
                    {isUnbonded ? (
                      <>
                        <td className="px-2 py-3">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                        <td className="px-2 py-3">
                          <BondingBar pct={r.bondingPct} />
                        </td>
                        <td className="px-2 py-3">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                      </>
                    ) : (
                      <>
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
                        {tab !== "multichain" && (
                          <td className="px-2 py-3">
                            {r.organicScore != null
                              ? <span className={`pill ${organicCls(r.organicScore)}`}>{Math.round(r.organicScore)}</span>
                              : "—"}
                          </td>
                        )}
                      </>
                    )}
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

function BondingBar({ pct }: { pct: number | null | undefined }) {
  const p = pct ?? 0;
  const cls = p >= 80 ? "bg-up" : p >= 50 ? "bg-accent" : p >= 25 ? "bg-yellow-500" : "bg-panel2";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden max-w-[100px]">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-muted w-8 text-right">{p}%</span>
    </div>
  );
}

function ListedView({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  if (loading) return (
    <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
  );
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
                {a.project_name || a.symbol || "Project"}
                <Verified />
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
          : <a key={a.id} href={a.links?.website || `https://dexscreener.com/search?q=${a.contract_address}`}
              target="_blank" rel="noreferrer">{inner}</a>;
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
