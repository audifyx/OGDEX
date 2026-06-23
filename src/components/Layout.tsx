import { Outlet, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search, Zap } from "lucide-react";

export default function Layout() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (v.length >= 32 && !v.includes(" ")) nav(`/token/${v}`);
    else nav(`/?q=${encodeURIComponent(v)}`);
  };
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 grid place-items-center text-accent font-mono font-bold">OG</span>
            <span className="font-bold tracking-tight text-lg">OG<span className="text-accent">DEX</span></span>
          </Link>
          <form onSubmit={go} className="flex-1 max-w-xl relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search token name, ticker, or paste a mint address…"
              className="w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent/60"
            />
          </form>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
            <Zap className="w-3.5 h-3.5 text-accent" /> Powered by OG Scan
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-5"><Outlet /></main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        OG DEX · Solana token intelligence · data via Jupiter, RugCheck & OG Scan backend
      </footer>
    </div>
  );
}
