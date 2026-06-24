import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtUsd, compact, short } from "../lib/api";
import { Zap, Star, ChevronRight, Rocket } from "lucide-react";
import TokenLogo from "./TokenLogo";

interface Boost {
  id: string; mint: string; symbol?: string; name?: string; icon?: string;
  chain?: string; tier?: string; status?: string; expires_at?: string;
}
interface FeaturedListing {
  id: string; contract_address: string; chain: string; project_name?: string;
  symbol?: string; logo_url?: string; banner_url?: string; description?: string;
  links?: Record<string, string>; metadata?: any;
}

export default function FeaturedBanner() {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [featured, setFeatured] = useState<FeaturedListing[]>([]);
  const [highlight, setHighlight] = useState<FeaturedListing | null>(null);
  const [pos, setPos] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    fetch("/api/boosts").then((r) => r.json()).then((d) => setBoosts(d.boosts || [])).catch(() => {});
    fetch("/api/listings?featured=1").then((r) => r.json()).then((d) => {
      const rows: FeaturedListing[] = d.rows || [];
      setFeatured(rows);
      if (rows.length) setHighlight(rows[0]);
    }).catch(() => {});
  }, []);

  // Auto-scroll the boost rail
  useEffect(() => {
    if (!boosts.length) return;
    const id = setInterval(() => {
      setPos((p) => {
        const el = railRef.current;
        if (!el) return p;
        const next = p + 1 >= boosts.length ? 0 : p + 1;
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [boosts.length]);

  // Scroll the rail element to show current pos
  useEffect(() => {
    const el = railRef.current;
    if (!el || !boosts.length) return;
    const chip = el.children[pos] as HTMLElement | undefined;
    if (chip) chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [pos, boosts.length]);

  if (!boosts.length && !featured.length) return null;

  return (
    <div className="mb-5 space-y-3">
      {/* ── Boost Reel ─────────────────────────────────────────────── */}
      {boosts.length > 0 && (
        <div className="card border border-accent/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
            <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-xs font-semibold text-accent tracking-wide uppercase">Boosted Tokens</span>
            <Link to="/boost" className="ml-auto text-[10px] text-muted hover:text-white transition-colors flex items-center gap-0.5">
              Get boost <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {/* Scrolling pill strip */}
          <div
            ref={railRef}
            className="flex gap-2 px-3 pb-3 overflow-x-auto"
            style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          >
            {boosts.map((b, i) => (
              <button
                key={b.id}
                onClick={() => b.chain === "solana" || !b.chain ? nav(`/token/${b.mint}`) : undefined}
                style={{ scrollSnapAlign: "center" }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all
                  ${i === pos
                    ? "border-accent/60 bg-accent/10 scale-[1.03]"
                    : "border-line bg-panel2/50 hover:border-accent/30"}`}
              >
                <TokenLogo src={b.icon} sym={b.symbol} size={24} />
                <span className="text-xs font-semibold text-white">{b.symbol || short(b.mint)}</span>
                <span className="pill bg-accent/15 text-accent text-[9px] !px-1.5 !py-0">
                  <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                  {b.tier === "24h" ? "24h" : "6h"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured / Highlighted Token ───────────────────────────── */}
      {highlight && (
        <div
          className="relative overflow-hidden rounded-2xl border border-line cursor-pointer group"
          onClick={() =>
            highlight.chain === "solana"
              ? nav(`/token/${highlight.contract_address}`)
              : window.open(highlight.links?.website || `https://dexscreener.com/search?q=${highlight.contract_address}`, "_blank")
          }
          style={{
            background: highlight.banner_url
              ? `linear-gradient(to right, rgba(0,0,0,0.85) 40%, transparent), url(${highlight.banner_url}) center/cover`
              : "var(--color-panel)",
          }}
        >
          <div className="flex items-center gap-4 p-4">
            <div className="shrink-0">
              {highlight.logo_url
                ? <img src={highlight.logo_url} className="w-14 h-14 rounded-full border-2 border-white/20 object-cover" />
                : <div className="w-14 h-14 rounded-full bg-panel2 grid place-items-center text-lg font-bold text-muted">
                    {(highlight.symbol || "?").slice(0, 2)}
                  </div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">{highlight.project_name || highlight.symbol || "Token"}</span>
                <span className="pill bg-panel2 text-muted text-[10px] uppercase">{highlight.chain}</span>
                <span className="pill bg-yellow-500/20 text-yellow-400 text-[10px] inline-flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5" /> Featured
                </span>
              </div>
              <p className="text-sm text-muted/80 mt-0.5 line-clamp-1">{highlight.description || "Explore this token"}</p>
              {highlight.metadata?.mcap && (
                <div className="text-xs text-muted mt-1">
                  MC {fmtUsd(highlight.metadata.mcap, { compact: true })}
                  {highlight.metadata?.priceUsd && <span className="ml-2">{fmtUsd(highlight.metadata.priceUsd)}</span>}
                </div>
              )}
            </div>
            {featured.length > 1 && (
              <div className="flex flex-col gap-1 shrink-0">
                {featured.slice(0, 4).map((f, i) => (
                  <button
                    key={f.id}
                    onClick={(e) => { e.stopPropagation(); setHighlight(f); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${f.id === highlight.id ? "bg-accent" : "bg-muted/40"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
