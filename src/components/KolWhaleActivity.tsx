import { useMemo } from "react";
import { Link } from "react-router-dom";
import { KolDirEntry } from "../lib/kol";
import KolBadge from "./KolBadge";
import WalletLink from "./WalletLink";
import { fmtUsd, compact, short, TokenDetailData } from "../lib/api";
import { timeAgo } from "../lib/format";
import { ArrowUpRight, ArrowDownRight, ExternalLink, Crown, Radio, BadgeCheck } from "lucide-react";

// Token-level KOL & Whale feed: cross-references this token's recent trades against
// the KOL directory and its whale holders.
export default function KolWhaleActivity({ d, dir }: { d: TokenDetailData; dir: Record<string, KolDirEntry> }) {
  const intel: any = (d as any).intel || {};
  const trades: any[] = intel.trades || [];
  const holders: any[] = intel.holders || [];
  const whaleSet = useMemo(() => new Set(holders.filter((h) => h.label === "whale").map((h) => h.owner)), [holders]);

  const rows = useMemo(() => trades.map((t) => {
    const kol = t.owner ? dir[t.owner] : null;
    const whale = t.owner ? whaleSet.has(t.owner) : false;
    return kol || whale ? { ...t, kol, whale } : null;
  }).filter(Boolean) as any[], [trades, dir, whaleSet]);

  const kolHolders = useMemo(() => holders.filter((h) => dir[h.owner]), [holders, dir]);
  const kolBuys = rows.filter((r) => r.kol && r.side === "buy").length;
  const kolCount = new Set(rows.filter((r) => r.kol).map((r) => r.kol.address)).size;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Summary label="KOLs in recent trades" value={String(kolCount)} sub={`${kolBuys} buys`} />
        <Summary label="KOLs holding" value={String(kolHolders.length)} sub={kolHolders.length ? "see holders tab" : "none detected"} />
        <Summary label="Whale trades (feed)" value={String(rows.filter((r) => r.whale).length)} sub="from live feed" />
      </div>

      {kolHolders.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-accent" /> KOLs holding this token</div>
          <div className="flex flex-wrap gap-2">
            {kolHolders.map((h) => (
              <Link key={h.owner} to={`/kol/${h.owner}`} className="pill bg-panel2 hover:bg-panel2/60 inline-flex items-center gap-1.5">
                <BadgeCheck className="w-3 h-3 text-accent" /><span className="text-white">{dir[h.owner].name}</span><span className="text-muted text-[10px]">{h.pct != null ? h.pct.toFixed(2) + "%" : ""}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-accent" /> KOL & Whale Trades <span className="pill bg-up/10 text-up text-[10px] inline-flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span></div>
        {rows.length ? (
          <div className="divide-y divide-line/60">
            {rows.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/30">
                <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${t.side === "buy" ? "bg-up/15" : "bg-down/15"}`}>{t.side === "buy" ? <ArrowUpRight className="w-4 h-4 text-up" /> : <ArrowDownRight className="w-4 h-4 text-down" />}</div>
                <div className="min-w-0 flex-1">
                  {t.kol ? <KolBadge kol={t.kol} /> : <span className="inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-purple-300" /><WalletLink address={t.owner} icon={false} className="text-xs" /><span className="pill bg-purple-500/15 text-purple-300 text-[9px] !px-1.5 !py-0">Whale</span></span>}
                  <div className="text-xs text-muted mt-0.5">{t.side === "buy" ? "bought" : "sold"} · {compact(t.tokenAmount)} · {fmtUsd(t.volumeUsd, { compact: true })}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted">{timeAgo(t.time)} ago</div>
                  {t.txHash && <a href={`https://solscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent/70 hover:text-accent inline-flex items-center gap-0.5">tx <ExternalLink className="w-3 h-3" /></a>}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="p-10 text-center text-muted text-sm">No tracked KOL or whale trades in the recent feed for this token.</div>}
      </div>
    </div>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="card p-4"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div><div className="text-2xl font-bold mt-1">{value}</div>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>;
}
