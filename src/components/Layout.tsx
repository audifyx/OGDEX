import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Search, Zap, Rocket } from "lucide-react";
import { track } from "../lib/api";

export default function Layout() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { track("page_view", { path: loc.pathname }); }, [loc.pathname]);
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
        <div className="max-w-[1500px] mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 grid place-items-center text-accent font-mono font-bold">OG</span>
            <span className="font-bold tracking-tight text-lg hidden sm:block">OG<span className="text-accent">DEX</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link to="/" className="btn text-muted hover:text-white">Coins</Link>
          </nav>
          <form onSubmit={go} className="flex-1 max-w-xl relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ticker, or paste a mint…"
              className="w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent/60" />
          </form>
          <Link to="/submit" className="btn bg-accent text-black font-semibold hover:bg-accent/90 inline-flex items-center gap-1.5 shrink-0">
            <Rocket className="w-3.5 h-3.5" /> <span className="hidden sm:inline">List Your Token</span><span className="sm:hidden">List</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 py-5"><Outlet /></main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-accent" /> Powered by OG Scan</span>
          <Link to="/submit" className="hover:text-accent">List your token</Link>
          <a href="https://t.me/ogscanofficial" target="_blank" rel="noreferrer" className="hover:text-accent">Telegram</a>
        </div>
      </footer>
    </div>
  );
}
