import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getListings, Listing, fmtUsd } from "../lib/api";
import { Megaphone, ExternalLink } from "lucide-react";
import Verified from "./Verified";

export default function FeaturedBanner() {
  const [ads, setAds] = useState<Listing[]>([]);
  useEffect(() => { getListings(true).then((d) => setAds(d.rows || [])); }, []);
  if (!ads.length) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
        <Megaphone className="w-3.5 h-3.5 text-accent2" /> Featured · Sponsored
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(280px,1fr))` }}>
        {ads.map((a) => {
          const inner = (
            <div className="card p-3 flex items-center gap-3 hover:border-accent2/50 transition-colors h-full bg-gradient-to-r from-accent2/10 to-transparent">
              {a.logo_url
                ? <img src={a.logo_url} className="w-11 h-11 rounded-full object-cover border border-line shrink-0" />
                : <div className="w-11 h-11 rounded-full bg-panel2 grid place-items-center text-xs text-muted shrink-0">{(a.symbol || "?").slice(0, 3)}</div>}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {a.project_name || a.symbol || "Project"}<Verified />
                  <span className="pill bg-accent2/20 text-accent2 text-[10px] uppercase">{a.chain}</span>
                </div>
                <div className="text-xs text-muted truncate">
                  {a.metadata?.priceUsd ? fmtUsd(a.metadata.priceUsd) + " · " : ""}{a.description || a.symbol || a.contract_address.slice(0, 10) + "…"}
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted shrink-0" />
            </div>
          );
          return a.chain === "solana"
            ? <Link key={a.id} to={`/token/${a.contract_address}`}>{inner}</Link>
            : <a key={a.id} href={a.links?.website || `https://dexscreener.com/search?q=${a.contract_address}`} target="_blank" rel="noreferrer">{inner}</a>;
        })}
      </div>
    </div>
  );
}
