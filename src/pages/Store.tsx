import { useNavigate } from "react-router-dom";
import { Rocket, Zap, ArrowRight, Star } from "lucide-react";

export default function Store() {
  const nav = useNavigate();

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
          <Star className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">OG DEX Store</h1>
        <p className="text-muted text-sm mt-2">List your token or boost your visibility to thousands of traders.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* List Token */}
        <button
          onClick={() => nav("/submit")}
          className="card group p-6 text-left hover:border-accent/50 transition-all hover:bg-accent/5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 grid place-items-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Rocket className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="font-bold text-base">List Your Token</div>
              <div className="text-xs text-muted">Standard &amp; Express tiers</div>
            </div>
          </div>
          <p className="text-sm text-muted/80 leading-relaxed">
            Get your project added to OG DEX's token directory. Manually reviewed and approved — seen by all users browsing the <span className="text-white">Listed</span> tab.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-muted/70">
              <span>Standard listing</span><span className="text-white font-medium">25 SOL</span>
            </div>
            <div className="flex justify-between text-muted/70">
              <span>Express (24h review)</span><span className="text-white font-medium">75 SOL</span>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2 transition-all">
            List now <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Buy Boost */}
        <button
          onClick={() => nav("/boost")}
          className="card group p-6 text-left hover:border-yellow-500/50 transition-all hover:bg-yellow-500/5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 grid place-items-center shrink-0 group-hover:bg-yellow-500/20 transition-colors">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="font-bold text-base">Buy a Boost</div>
              <div className="text-xs text-muted">Featured reel placement</div>
            </div>
          </div>
          <p className="text-sm text-muted/80 leading-relaxed">
            Put your token in the scrolling boost reel at the top of the screener. Seen by every visitor. Pay SOL or stablecoin — we verify and activate manually.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-muted/70">
              <span>6-hour boost</span><span className="text-yellow-400 font-medium">$20</span>
            </div>
            <div className="flex justify-between text-muted/70">
              <span>24-hour boost</span><span className="text-yellow-400 font-medium">$60</span>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-yellow-400 group-hover:gap-2 transition-all">
            Get boosted <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* FAQ strip */}
      <div className="mt-8 card p-4 text-xs text-muted space-y-2">
        <p><span className="text-white font-medium">How do I pay?</span> — Send SOL (or USDC/USDT) to our payment wallet and submit your transaction hash. We verify on-chain.</p>
        <p><span className="text-white font-medium">How fast is approval?</span> — Boosts are typically activated within 1–2 hours. Standard listings within 24h, Express within 2h.</p>
        <p><span className="text-white font-medium">Questions?</span> — DM us on <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="text-accent hover:underline">Telegram</a>.</p>
      </div>
    </div>
  );
}
