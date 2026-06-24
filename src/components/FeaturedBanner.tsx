import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtUsd, compact, short } from "../lib/api";
import { Zap, Star, ChevronRight, TrendingUp } from "lucide-react";
import TokenLogo from "./TokenLogo";

interface Boost {
  id: string; mint: string; symbol?: string; name?: string; icon?: string;
  chain?: string; tier?: string; status?: string; expires_at?: string;
}
interface Listing {
  id: string; contract_address: string; chain: string; project_name?: string;
  symbol?: string; logo_url?: string; banner_url?: string; description?: string;
  links?: Record<string, string>; metadata?: any; featured?: boolean;
}

export default function FeaturedBanner() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    fetch("/api/boosts").then((r) => r.json()).then((d) => setBoosts(d.boosts || [])).catch(() => {});
    fetch("/api/listings?featured=1").then((r) => r.json()).then((d) => setFeatured(d.rows || [])).catch(() => {});
  }, []);

  // Auto-scroll boost reel
  useEffect(() => {
    if (!boosts.length) return;
    const id = setInterval(() => setActiveIdx((p) => (p + 1 >= boosts.length ? 0 : p + 1)), 2200);
    return () => clearInterval(id);
  }, [boosts.length]);

  useEffect(() => {
    const el = railRef.current;
    if (!el || !boosts.length) return;
    const chip = el.children[activeIdx] as HTMLElement | undefined;
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx, boosts.length]);

  const hasBoosts = boosts.length > 0;
  const hasFeatured = featured.length > 0;
  if (!hasBoosts && !hasFeatured) return null;

  const hero = featured[0];

  return (
    <div className="mb-5 space-y-3">
      {/* ── Boost Reel ─────────────────────────────────────────────── */}
      {hasBoosts && (
        <div className="card border border-accent/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-accent tracking-wide uppercase">Boosted Tokens</span>
            <Link to="/store" className="ml-auto text-[10px] text-muted hover:text-white transition-colors flex items-center gap-0.5">
              Boost yours <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div
            ref={railRef}
            className="flex gap-2 px-3 pb-3 overflow-x-auto"
            style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          >
            {boosts.map((b, i) => (
              <button
                key={b.id}
                onClick={() => !b.chain || b.chain === "solana" ? nav(`/token/${b.mint}`) : undefined}
                style={{ scrollSnapAlign: "center" }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all cursor-pointer
                  ${i === activeIdx
                    ? "border-accent/60 bg-accent/10 scale-[1.03] shadow-[0_0_12px_rgba(var(--accent-rgb),0.2)]"
                    : "border-line bg-panel2/60 hover:border-accent/30"}`}
              >
                <TokenLogo src={b.icon} sym={b.symbol} size={22} />
                <span className="text-xs font-bold text-white">{b.symbol || short(b.mint)}</span>
                <span className="text-[9px] text-accent font-semibold uppercase tracking-wide">
                  {b.tier === "24h" ? "24h" : "6h"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured Daily Section ─────────────────────────────────── */}
      {hasFeatured && (
        <div className="card border border-yellow-500/15 overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs font-semibold text-yellow-400 tracking-wide uppercase">Featured Daily</span>
            <Link to="/store" className="ml-auto text-[10px] text-muted hover:text-white transition-colors flex items-center gap-0.5">
              Get featured <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Hero (first featured) */}
          {hero && (
            <div
              className="mx-3 mb-2 relative overflow-hidden rounded-xl cursor-pointer group"
              onClick={() =>
                hero.chain === "solana"
                  ? nav(`/token/${hero.contract_address}`)
                  : window.open(hero.links?.website || `https://dexscreener.com/search?q=${hero.contract_address}`, "_blank")
              }
              style={{
                background: hero.banner_url
                  ? `linear-gradient(to right, rgba(0,0,0,0.88) 45%, rgba(0,0,0,0.3)), url(${hero.banner_url}) center/cover`
                  : "var(--color-panel2)",
              }}
            >
              <div className="flex items-center gap-3 p-3">
                <div className="shrink-0">
                  {hero.logo_url
                    ? <img src={hero.logo_url} className="w-12 h-12 rounded-full border border-white/20 object-cover" />
                    : <div className="w-12 h-12 rounded-full bg-panel grid place-items-center text-sm font-bold text-muted">
                        {(hero.symbol || "?").slice(0, 2)}
                      </div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                    {hero.project_name || hero.symbol}
                    <span className="pill bg-panel2/60 text-muted text-[9px] uppercase">{hero.chain}</span>
                    <span className="pill bg-yellow-500/20 text-yellow-400 text-[9px]">★ Featured</span>
                  </div>
                  <p className="text-xs text-muted/80 mt-0.5 line-clamp-1">{hero.description || "Community featured token"}</p>
                  {hero.metadata?.mcap && (
                    <div className="text-xs text-muted/60 mt-0.5">
                      MC {fmtUsd(hero.metadata.mcap, { compact: true })}
                      {hero.metadata.priceUsd && <span className="ml-1.5">{fmtUsd(hero.metadata.priceUsd)}</span>}
                    </div>
                  )}
                </div>
                <TrendingUp className="w-4 h-4 text-yellow-400/60 shrink-0 group-hover:text-yellow-400 transition-colors" />
              </div>
            </div>
          )}

          {/* Rest of featured list */}
          {featured.length > 1 && (
            <div className="px-3 pb-3 grid gap-1.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {featured.slice(1).map((f) => (
                <button
                  key={f.id}
                  onClick={() =>
                    f.chain === "solana"
                      ? nav(`/token/${f.contract_address}`)
                      : window.open(f.links?.website || `https://dexscreener.com/search?q=${f.contract_address}`, "_blank")
                  }
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-panel2/80 transition-colors text-left"
                >
                  {f.logo_url
                    ? <img src={f.logo_url} className="w-7 h-7 rounded-full border border-line object-cover shrink-0" />
                    : <div className="w-7 h-7 rounded-full bg-panel2 grid place-items-center text-[10px] text-muted shrink-0">
                        {(f.symbol || "?").slice(0, 2)}
                      </div>}
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{f.symbol || f.project_name}</div>
                    <div className="text-[10px] text-muted truncate">{f.project_name || short(f.contract_address)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
