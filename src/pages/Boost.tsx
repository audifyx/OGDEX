import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getConfig, fmtUsd, short } from "../lib/api";
import { Zap, Star, ArrowRight, CheckCircle, Wallet, AlertTriangle, Clock, Rocket } from "lucide-react";

const BOOST_TIERS = [
  { id: "6h",  label: "6-Hour Boost",  hours: 6,  usd: 20, icon: Zap,    desc: "Appear in the boost reel for 6 hours" },
  { id: "24h", label: "24-Hour Boost", hours: 24, usd: 60, icon: Rocket, desc: "Full day featured placement + reel slot" },
];

export default function Boost() {
  const nav = useNavigate();
  const [tier, setTier] = useState<string | null>(null);
  const [mint, setMint] = useState("");
  const [txHash, setTxHash] = useState("");
  const [payerWallet, setPayerWallet] = useState("");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [step, setStep] = useState<"pick"|"pay"|"submit"|"done">("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mintInfo, setMintInfo] = useState<any>(null);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
    // Fetch SOL price
    fetch("https://lite-api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112")
      .then((r) => r.json())
      .then((d) => setSolPrice(Number(d?.data?.So11111111111111111111111111111111111111112?.price ?? 0) || null))
      .catch(() => {});
  }, []);

  const selTier = BOOST_TIERS.find((t) => t.id === tier);
  const payWallet = config?.payWallet || "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh";
  const solAmount = selTier && solPrice ? (selTier.usd / solPrice).toFixed(4) : null;

  const fetchMintInfo = async (m: string) => {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) return;
    try {
      const d = await fetch(`/api/token?mint=${m}`).then((r) => r.json());
      setMintInfo(d?.token || null);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!mint || !tier || !txHash) { setError("All fields required"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/boosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint, tier, payment_tx: txHash, payer_wallet: payerWallet,
          symbol: mintInfo?.symbol, name: mintInfo?.name, icon: mintInfo?.icon,
          chain: "solana",
        }),
      }).then((r) => r.json());
      if (!r.ok) throw new Error(r.error || "Submission failed");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-4">
      <CheckCircle className="w-14 h-14 text-up mx-auto" />
      <h2 className="text-2xl font-bold">Boost Submitted!</h2>
      <p className="text-muted">Your boost is under review and will go live shortly after payment verification.</p>
      <Link to="/" className="btn bg-accent text-black font-semibold inline-flex mt-2">← Back to Screener</Link>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-bold">Boost Your Token</h1>
        </div>
        <p className="text-muted text-sm">Get your token featured in the scrolling boost reel at the top of the screener. Seen by everyone who visits.</p>
      </div>

      {/* Step 1: Pick tier */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">1. Choose boost duration</h3>
        <div className="grid grid-cols-2 gap-3">
          {BOOST_TIERS.map((t) => (
            <button key={t.id} onClick={() => { setTier(t.id); if (step === "pick") setStep("pay"); }}
              className={`card p-4 text-left transition-all border-2
                ${tier === t.id ? "border-accent bg-accent/5" : "border-transparent hover:border-accent/30"}`}>
              <div className="flex items-center gap-2 mb-2">
                <t.icon className={`w-5 h-5 ${tier === t.id ? "text-accent" : "text-muted"}`} />
                <span className="font-bold text-white">{t.label}</span>
              </div>
              <div className="text-2xl font-black text-white">${t.usd}</div>
              <div className="text-xs text-muted mt-1">{t.desc}</div>
              {solPrice && (
                <div className="text-xs text-muted/60 mt-1">≈ {(t.usd / solPrice).toFixed(3)} SOL</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Token mint */}
      {tier && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">2. Enter token mint address</h3>
          <div className="card p-3">
            <input
              value={mint}
              onChange={(e) => { setMint(e.target.value); fetchMintInfo(e.target.value); }}
              placeholder="Token mint address (Solana)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted/50 font-mono"
            />
            {mintInfo && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line">
                {mintInfo.icon && <img src={mintInfo.icon} className="w-6 h-6 rounded-full" />}
                <span className="text-sm font-semibold">{mintInfo.symbol}</span>
                <span className="text-xs text-muted">{mintInfo.name}</span>
                {mintInfo.mcap && <span className="ml-auto text-xs text-muted">{fmtUsd(mintInfo.mcap, { compact: true })} MC</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {tier && mint.length > 30 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">3. Send payment</h3>
          <div className="card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-muted">Send exactly</div>
                <div className="text-xl font-black">{solAmount ? `${solAmount} SOL` : `$${selTier?.usd}`}</div>
                <div className="text-xs text-muted">(${selTier?.usd} USD equivalent)</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">To wallet address:</div>
              <div className="bg-panel2 rounded-lg px-3 py-2 font-mono text-xs break-all text-white/80 select-all">
                {payWallet}
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-500/5 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Send the exact amount in a single transaction, then paste the tx hash below.
            </div>
          </div>

          <div className="space-y-2">
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Transaction hash (after payment)"
              className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/50 font-mono"
            />
            <input
              value={payerWallet}
              onChange={(e) => setPayerWallet(e.target.value)}
              placeholder="Your wallet address (optional)"
              className="card w-full p-3 text-sm bg-transparent outline-none placeholder:text-muted/50 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-down text-sm bg-down/10 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !txHash || !mint}
            className="w-full btn bg-accent text-black font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Submitting…" : <>Submit Boost <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* Info box */}
      <div className="card p-4 space-y-2 text-xs text-muted">
        <div className="flex items-center gap-2 font-semibold text-white text-sm">
          <Clock className="w-4 h-4 text-accent" /> How it works
        </div>
        <p>1. Choose a boost tier and send SOL to the payment wallet.</p>
        <p>2. Paste your transaction hash — we verify payment on-chain.</p>
        <p>3. Your token appears in the boost reel within minutes after approval.</p>
        <p>4. Boosts auto-expire after the selected duration.</p>
        <p className="pt-1">Same payment flow as token listings. Questions? <a href="https://t.me/ogdex" target="_blank" rel="noreferrer" className="text-accent">Telegram</a></p>
      </div>
    </div>
  );
}
