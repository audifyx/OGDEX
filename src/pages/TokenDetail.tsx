import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getToken, TokenDetailData, fmtUsd, compact, fmtNum, short } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import ScoreRing from "../components/ScoreRing";
import { ArrowLeft, Copy, ShieldCheck, ShieldAlert, ExternalLink, Loader2, Lock, Flame, TrendingUp } from "lucide-react";

export default function TokenDetail() {
  const { mint = "" } = useParams();
  const [d, setD] = useState<TokenDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true);
    getToken(mint).then((x) => { if (on) { setD(x); setLoading(false); } });
    return () => { on = false; };
  }, [mint]);

  if (loading) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!d || (!d.token && !d.meta)) return (
    <div className="text-center py-24">
      <p className="text-muted">Token not found.</p>
      <Link to="/" className="text-accent text-sm mt-2 inline-block">← Back to screener</Link>
    </div>
  );

  const t = d.token || ({} as any);
  const meta = d.meta || {};
  const name = t.name || meta.name || "Unknown";
  const symbol = t.symbol || meta.symbol || short(mint);
  const icon = t.icon || meta.icon || meta.image;
  const price = t.priceUsd ?? meta.priceUsd;
  const safety = d.safety;
  const copy = () => { navigator.clipboard.writeText(mint); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Screener
      </Link>

      {/* Header */}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <TokenLogo src={icon} sym={symbol} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{symbol}</h1>
              {t.isVerified && <span className="pill bg-accent/15 text-accent">Verified</span>}
              {d.verdict && <span className="pill bg-panel2 text-muted">{d.verdict}</span>}
            </div>
            <div className="text-muted text-sm">{name}</div>
          </div>
          <div className="sm:ml-auto text-right">
            <div className="text-2xl font-bold">{fmtUsd(price)}</div>
            <div className="flex gap-2 justify-end text-xs mt-1">
              <span>5m <Change v={t.change5m} /></span>
              <span>1h <Change v={t.change1h} /></span>
              <span>6h <Change v={t.change6h} /></span>
              <span>24h <Change v={t.change24h} /></span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
          <button onClick={copy} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">
            <Copy className="w-3 h-3" /> {copied ? "Copied!" : short(mint)}
          </button>
          <a href={`https://jup.ag/swap/SOL-${mint}`} target="_blank" rel="noreferrer" className="btn bg-accent/15 text-accent inline-flex items-center gap-1.5">
            Trade on Jupiter <ExternalLink className="w-3 h-3" />
          </a>
          <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">
            Solscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: chart + stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Live Chart
            </div>
            <iframe
              title="chart"
              src={`https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`}
              className="w-full" style={{ height: 460, border: 0 }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Market Cap" value={fmtUsd(t.mcap, { compact: true })} />
            <Stat label="FDV" value={fmtUsd(t.fdv, { compact: true })} />
            <Stat label="Liquidity" value={t.liquidity != null ? "$" + compact(t.liquidity) : "—"} />
            <Stat label="24h Volume" value={t.volume != null ? "$" + compact(t.volume) : "—"} />
            <Stat label="Holders" value={t.holderCount != null ? fmtNum(t.holderCount) : "—"} />
            <Stat label="Circ. Supply" value={compact(t.circSupply)} />
            <Stat label="Net Buyers" value={t.netBuyers != null ? fmtNum(t.netBuyers) : "—"} />
            <Stat label="Top 10 Hold" value={safety?.top10RealHolderPct != null ? safety.top10RealHolderPct.toFixed(1) + "%" : (meta.topHoldersPct != null ? meta.topHoldersPct.toFixed(1) + "%" : "—")} />
          </div>

          {/* Buy/Sell pressure */}
          {(t.buyVolume != null || t.sellVolume != null) && (
            <div className="card p-4">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-accent" /> 24h Buy / Sell Pressure</div>
              <Pressure buy={t.buyVolume || 0} sell={t.sellVolume || 0} />
              <div className="flex justify-between text-xs mt-2 text-muted">
                <span>Buys: <span className="text-up">{fmtNum(t.numBuys)}</span></span>
                <span>Sells: <span className="text-down">{fmtNum(t.numSells)}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Right: OG score + safety + holders */}
        <div className="space-y-4">
          <div className="card p-5 text-center glow">
            <div className="text-xs uppercase tracking-wide text-muted mb-3">OG Score</div>
            <div className="flex justify-center"><ScoreRing value={d.score?.total ?? meta.organicScore} label="/ 100" /></div>
            {(d.momentumLabel || meta.momentumLabel) && (
              <div className="mt-3 inline-flex pill bg-panel2 text-muted capitalize">Momentum: {d.momentumLabel || meta.momentumLabel}</div>
            )}
            {meta.organicScoreLabel && (
              <div className="mt-2 text-xs text-muted">Organic activity: <span className="text-accent capitalize">{meta.organicScoreLabel}</span></div>
            )}
          </div>

          {safety && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                {safety.rugged ? <ShieldAlert className="w-4 h-4 text-down" /> : <ShieldCheck className="w-4 h-4 text-up" />}
                <span className="font-semibold text-sm">Safety</span>
                <span className={`pill ml-auto ${safety.rugged ? "bg-down/15 text-down" : (safety.riskScore ?? 0) <= 20 ? "bg-up/15 text-up" : "bg-yellow-500/15 text-yellow-400"}`}>
                  Risk {safety.riskScore ?? "—"}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <Flag ok={safety.mintAuthorityRenounced} label="Mint authority renounced" />
                <Flag ok={safety.freezeAuthorityRenounced} label="Freeze authority renounced" />
                {safety.lpLockedPct != null && (
                  <div className="flex items-center justify-between"><span className="text-muted inline-flex items-center gap-1"><Lock className="w-3 h-3" /> LP locked</span><span>{safety.lpLockedPct.toFixed(0)}%</span></div>
                )}
                {safety.isPumpFun && <div className="text-muted">Launchpad: pump.fun</div>}
              </div>
              {Array.isArray(safety.risks) && safety.risks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                  {safety.risks.slice(0, 4).map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${r.level === "danger" ? "bg-down" : "bg-yellow-400"}`} />
                      <span className="text-muted">{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {Array.isArray(safety?.topHolders) && safety.topHolders.length > 0 && (
            <div className="card p-5">
              <div className="font-semibold text-sm mb-3">Top Holders</div>
              <div className="space-y-2">
                {safety.topHolders.slice(0, 8).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noreferrer" className="text-muted hover:text-accent font-mono">
                      {i + 1}. {short(h.address)}{h.insider && <span className="text-down ml-1">⚠</span>}
                    </a>
                    <span>{(h.pct ?? 0).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}
function Flag({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={ok ? "text-up" : "text-down"}>{ok ? "Yes" : "No"}</span>
    </div>
  );
}
function Pressure({ buy, sell }: { buy: number; sell: number }) {
  const total = buy + sell || 1;
  const bp = (buy / total) * 100;
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex bg-panel2">
      <div className="bg-up h-full" style={{ width: `${bp}%` }} />
      <div className="bg-down h-full" style={{ width: `${100 - bp}%` }} />
    </div>
  );
}
