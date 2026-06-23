import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { getChart, Candle } from "../lib/api";
import { Loader2, CandlestickChart, AreaChart as AreaIcon } from "lucide-react";

const INTERVALS: [string, string][] = [["5m", "5m"], ["15m", "15m"], ["1h", "1H"], ["4h", "4H"], ["1d", "1D"]];

export default function PriceChart({ mint, chain = "solana", symbol }: { mint: string; chain?: string; symbol?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick" | "Area"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [interval, setIntervalSel] = useState("1h");
  const [kind, setKind] = useState<"candles" | "area">("candles");
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [meta, setMeta] = useState<{ dex?: string | null; poolName?: string | null }>({});

  // create chart once
  useEffect(() => {
    if (!wrap.current) return;
    const chart = createChart(wrap.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b93a7", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.08, bottom: 0.28 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart; volRef.current = vol;
    return () => { chart.remove(); chartRef.current = null; priceRef.current = null; volRef.current = null; };
  }, []);

  // (re)build the price series when chart kind changes
  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    if (priceRef.current) { try { chart.removeSeries(priceRef.current); } catch {} priceRef.current = null; }
    priceRef.current = kind === "candles"
      ? chart.addCandlestickSeries({ upColor: "#16c784", downColor: "#ea3943", borderVisible: false, wickUpColor: "#16c784", wickDownColor: "#ea3943" })
      : chart.addAreaSeries({ lineColor: "#22d3a6", topColor: "rgba(34,211,166,0.25)", bottomColor: "rgba(34,211,166,0.01)", lineWidth: 2 });
    setReload((n) => n + 1);
  }, [kind]);

  const [reload, setReload] = useState(0);

  // load data on interval / mint / kind change
  useEffect(() => {
    let on = true; setLoading(true); setEmpty(false);
    getChart(mint, interval, 300, chain).then((d) => {
      if (!on) return;
      const candles: Candle[] = d.candles || [];
      setMeta({ dex: d.dex, poolName: d.poolName });
      if (!candles.length || !priceRef.current) { setEmpty(true); setLoading(false); return; }
      if (kind === "candles") {
        priceRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })) as any);
      } else {
        priceRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })) as any);
      }
      volRef.current?.setData(candles.map((c) => ({
        time: c.time as UTCTimestamp, value: c.volume,
        color: c.close >= c.open ? "rgba(22,199,132,0.4)" : "rgba(234,57,67,0.4)",
      })) as any);
      chartRef.current?.timeScale().fitContent();
      setLoading(false);
    }).catch(() => { if (on) { setEmpty(true); setLoading(false); } });
    return () => { on = false; };
  }, [mint, interval, chain, reload]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CandlestickChart className="w-4 h-4 text-accent" /> {symbol || "Price"} Chart
          {meta.dex && <span className="pill bg-panel2 text-muted capitalize text-[10px]">{meta.poolName || meta.dex}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-panel2 rounded-lg p-0.5">
            {INTERVALS.map(([id, label]) => (
              <button key={id} onClick={() => setIntervalSel(id)} className={`px-2 py-1 text-xs rounded-md ${interval === id ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-white"}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-0.5 bg-panel2 rounded-lg p-0.5">
            <button onClick={() => setKind("candles")} title="Candlesticks" className={`px-1.5 py-1 rounded-md ${kind === "candles" ? "bg-accent/20 text-accent" : "text-muted hover:text-white"}`}><CandlestickChart className="w-3.5 h-3.5" /></button>
            <button onClick={() => setKind("area")} title="Area" className={`px-1.5 py-1 rounded-md ${kind === "area" ? "bg-accent/20 text-accent" : "text-muted hover:text-white"}`}><AreaIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
      <div className="relative">
        <div ref={wrap} className="w-full h-[340px]" />
        {loading && <div className="absolute inset-0 grid place-items-center bg-panel/40 backdrop-blur-[1px]"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>}
        {empty && !loading && <div className="absolute inset-0 grid place-items-center text-muted text-sm">No chart data available for this token.</div>}
      </div>
    </div>
  );
}
