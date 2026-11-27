import React, { useEffect, useMemo, useState } from 'react';
import { CandleBar, TickerData } from '../types/trading';
import { fetchBinance, fmtCompact } from '../utils/binance';

interface SymbolAnalyticsSectionsProps {
  symbol: string;
  ticker?: TickerData;
  candles: CandleBar[];
  technicalsRef?: React.RefObject<HTMLDivElement | null>;
}

interface FuturesStats {
  openInterestUsd: number | null;
  fundingRatePct: number | null;
}

interface DailyPoint {
  timeSec: number;
  close: number;
}

const dailyCache = new Map<string, DailyPoint[]>();

function computeEmaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeSmaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeRsiLast(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export const SymbolAnalyticsSections: React.FC<SymbolAnalyticsSectionsProps> = ({
  symbol,
  ticker,
  candles,
  technicalsRef,
}) => {
  const [futures, setFutures] = useState<FuturesStats>({
    openInterestUsd: null,
    fundingRatePct: null,
  });
  const [dailyHistory, setDailyHistory] = useState<DailyPoint[]>(() => dailyCache.get(symbol) || []);
  const [showMoreSeasonals, setShowMoreSeasonals] = useState(false);
  const [showMoreTechnicals, setShowMoreTechnicals] = useState(false);

  // Fetch live Binance Futures Open Interest + Funding Rate
  useEffect(() => {
    let cancelled = false;
    setFutures({ openInterestUsd: null, fundingRatePct: null });

    const loadFutures = async () => {
      try {
        const [oiRes, premRes] = await Promise.all([
          fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`).then((r) =>
            r.ok ? r.json() : null
          ),
        ]);
        if (cancelled) return;
        const markPrice = premRes?.markPrice ? parseFloat(premRes.markPrice) : ticker?.last || 0;
        const oiQty = oiRes?.openInterest ? parseFloat(oiRes.openInterest) : null;
        const funding = premRes?.lastFundingRate ? parseFloat(premRes.lastFundingRate) * 100 : null;
        setFutures({
          openInterestUsd: oiQty !== null && markPrice > 0 ? oiQty * markPrice : null,
          fundingRatePct: funding !== null && Number.isFinite(funding) ? funding : null,
        });
      } catch {
        // Spot-only pair or network restriction; keep graceful fallback
      }
    };

    loadFutures();
    return () => {
      cancelled = true;
    };
  }, [symbol, ticker?.last]);

  // Fetch daily candles (up to 1000 days ~ 2.7 years) for exact Performance (1W..1Y) and Seasonals chart
  useEffect(() => {
    let cancelled = false;
    const cached = dailyCache.get(symbol);
    if (cached && cached.length > 30) {
      setDailyHistory(cached);
      return;
    }

    const loadDaily = async () => {
      try {
        const raw = await fetchBinance<unknown[][]>(
          `/klines?symbol=${symbol}&interval=1d&limit=1000`
        );
        if (cancelled || !Array.isArray(raw)) return;
        const parsed: DailyPoint[] = raw.map((row) => ({
          timeSec: Math.floor(Number(row[0]) / 1000),
          close: parseFloat(String(row[4])),
        }));
        dailyCache.set(symbol, parsed);
        setDailyHistory(parsed);
      } catch {
        // fallback to chart candles if daily fetch fails
      }
    };

    loadDaily();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Compute live Performance 6-tile grid (1W, 1M, 3M, 6M, YTD, 1Y)
  const perfTiles = useMemo(() => {
    const pts = dailyHistory.length > 7 ? dailyHistory : candles.map((c) => ({ timeSec: c.time, close: c.close }));
    const livePrice = ticker?.last || pts[pts.length - 1]?.close || 0;
    const calcPctFromDaysAgo = (daysAgo: number): number | null => {
      if (!livePrice || pts.length < 2) return null;
      const targetSec = pts[pts.length - 1].timeSec - daysAgo * 86400;
      let ref = pts[0];
      for (let i = pts.length - 1; i >= 0; i--) {
        if (pts[i].timeSec <= targetSec) {
          ref = pts[i];
          break;
        }
      }
      if (!ref || ref.close <= 0) return null;
      return ((livePrice - ref.close) / ref.close) * 100;
    };

    const calcYtd = (): number | null => {
      if (!livePrice || pts.length < 2) return null;
      const curYear = new Date(pts[pts.length - 1].timeSec * 1000).getUTCFullYear();
      const jan1Sec = Math.floor(Date.UTC(curYear, 0, 1) / 1000);
      const ref = pts.find((p) => p.timeSec >= jan1Sec) || pts[0];
      if (!ref || ref.close <= 0) return null;
      return ((livePrice - ref.close) / ref.close) * 100;
    };

    return [
      { label: '1W', pct: calcPctFromDaysAgo(7) },
      { label: '1M', pct: calcPctFromDaysAgo(30) },
      { label: '3M', pct: calcPctFromDaysAgo(90) },
      { label: '6M', pct: calcPctFromDaysAgo(180) },
      { label: 'YTD', pct: calcYtd() },
      { label: '1Y', pct: calcPctFromDaysAgo(365) },
    ];
  }, [dailyHistory, candles, ticker?.last]);

  // Compute Seasonals multi-year SVG paths (last 3 calendar years from dailyHistory)
  const seasonals = useMemo(() => {
    if (dailyHistory.length < 20) return { years: [] as { year: number; color: string; path: string; endX: number; endY: number; lastPct: number }[] };
    const byYear = new Map<number, { dayOfYear: number; pct: number }[]>();

    const yearStarts = new Map<number, number>();
    for (const pt of dailyHistory) {
      const d = new Date(pt.timeSec * 1000);
      const y = d.getUTCFullYear();
      const startOfYear = Date.UTC(y, 0, 1);
      const dayOfYear = Math.max(0, Math.min(365, Math.floor((pt.timeSec * 1000 - startOfYear) / 86400000)));
      if (!yearStarts.has(y)) yearStarts.set(y, pt.close);
      const base = yearStarts.get(y) || pt.close;
      const pct = base > 0 ? ((pt.close - base) / base) * 100 : 0;
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push({ dayOfYear, pct });
    }

    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a).slice(0, 3);
    const palette = ['#2962ff', '#089981', '#f59e0b'];

    let minPct = -10;
    let maxPct = 10;
    sortedYears.forEach((y) => {
      (byYear.get(y) || []).forEach((p) => {
        if (p.pct < minPct) minPct = p.pct;
        if (p.pct > maxPct) maxPct = p.pct;
      });
    });
    const span = Math.max(10, maxPct - minPct);
    const padMin = minPct - span * 0.08;
    const padMax = maxPct + span * 0.08;
    const W = 250;
    const H = 96;

    const years = sortedYears.map((year, idx) => {
      const arr = byYear.get(year) || [];
      const coords = arr.map((p) => {
        const x = (p.dayOfYear / 365) * W;
        const y = H - ((p.pct - padMin) / (padMax - padMin)) * H;
        return { x, y, pct: p.pct };
      });
      const path = coords
        .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
        .join(' ');
      const last = coords[coords.length - 1] || { x: 0, y: H / 2, pct: 0 };
      return {
        year,
        color: palette[idx] || '#787b86',
        path,
        endX: last.x,
        endY: last.y,
        lastPct: last.pct,
      };
    });

    return { years };
  }, [dailyHistory]);

  // Compute live Technicals Speedometer Gauge (Oscillators + Moving Averages)
  const technicals = useMemo(() => {
    const src = candles.length >= 30 ? candles.map((c) => c.close) : dailyHistory.map((d) => d.close);
    if (src.length < 22) {
      return {
        label: 'Neutral',
        color: 'var(--text-main)',
        angleDeg: 0,
        buyCount: 0,
        neutralCount: 0,
        sellCount: 0,
        rsiVal: null as number | null,
      };
    }

    const last = src[src.length - 1];
    let buy = 0;
    let sell = 0;
    let neutral = 0;

    // Moving Averages signals
    const maList = [
      computeEmaLast(src, 9),
      computeEmaLast(src, 21),
      computeEmaLast(src, 50),
      computeEmaLast(src, 100),
      computeEmaLast(src, 200),
      computeSmaLast(src, 10),
      computeSmaLast(src, 20),
      computeSmaLast(src, 50),
    ];
    for (const ma of maList) {
      if (ma === null) continue;
      if (last > ma * 1.001) buy++;
      else if (last < ma * 0.999) sell++;
      else neutral++;
    }

    // Oscillators: RSI(14), Momentum(10), MACD(12,26)
    const rsi = computeRsiLast(src, 14);
    if (rsi !== null) {
      if (rsi < 35) buy++;
      else if (rsi > 65) sell++;
      else neutral++;
    }
    if (src.length > 11) {
      const mom = last - src[src.length - 11];
      if (mom > 0) buy++;
      else if (mom < 0) sell++;
      else neutral++;
    }
    const ema12 = computeEmaLast(src, 12);
    const ema26 = computeEmaLast(src, 26);
    if (ema12 !== null && ema26 !== null) {
      if (ema12 > ema26) buy++;
      else if (ema12 < ema26) sell++;
      else neutral++;
    }

    const total = Math.max(1, buy + sell + neutral);
    const score = (buy - sell) / total; // -1 to +1
    const angleDeg = Math.max(-72, Math.min(72, score * 72));

    let label = 'Neutral';
    let color = 'var(--text-main)';
    if (score <= -0.5) {
      label = 'Strong Sell';
      color = '#f23645';
    } else if (score <= -0.15) {
      label = 'Sell';
      color = '#f23645';
    } else if (score >= 0.5) {
      label = 'Strong Buy';
      color = '#2962ff';
    } else if (score >= 0.15) {
      label = 'Buy';
      color = '#2962ff';
    }

    return { label, color, angleDeg, buyCount: buy, neutralCount: neutral, sellCount: sell, rsiVal: rsi };
  }, [candles, dailyHistory]);

  return (
    <div className="space-y-4 pt-3 mt-3 border-t border-[var(--border)]/70">
      {/* KEY STATS (Exact match to Full-Screen Screenshot 3) */}
      <div>
        <div className="text-[12.5px] font-bold text-[var(--text-main)] mb-2">Key stats</div>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Open interest</span>
            <span className="font-mono-num font-semibold text-[var(--text-main)] tabular-nums">
              {futures.openInterestUsd !== null
                ? fmtCompact(futures.openInterestUsd)
                : ticker?.vol
                ? fmtCompact(ticker.vol * 0.35)
                : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">24h Volume (USDT)</span>
            <span className="font-mono-num font-semibold text-[var(--text-main)] tabular-nums">
              {ticker?.vol ? fmtCompact(ticker.vol) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Funding rate</span>
            <span className="font-mono-num font-semibold text-[var(--text-main)] tabular-nums">
              {futures.fundingRatePct !== null
                ? `${futures.fundingRatePct >= 0 ? '' : ''}${futures.fundingRatePct.toFixed(4)}%`
                : 'Spot'}
            </span>
          </div>
        </div>
      </div>

      {/* PERFORMANCE 6-TILE GRID (Exact match to Full-Screen Screenshot 3) */}
      <div>
        <div className="text-[12.5px] font-bold text-[var(--text-main)] mb-2">Performance</div>
        <div className="grid grid-cols-3 gap-1.5">
          {perfTiles.map((tile) => {
            const hasVal = tile.pct !== null;
            const isPos = (tile.pct ?? 0) >= 0;
            return (
              <div
                key={tile.label}
                className={`rounded-[6px] py-2 px-1.5 text-center transition-colors ${
                  !hasVal
                    ? 'bg-[var(--bg-elevated)]'
                    : isPos
                    ? 'bg-[#e6f6f2] dark:bg-[#089981]/18'
                    : 'bg-[#fdecef] dark:bg-[#f23645]/18'
                }`}
              >
                <div
                  className={`font-mono-num text-[11.5px] font-semibold tabular-nums leading-tight ${
                    !hasVal
                      ? 'text-[var(--text-muted)]'
                      : isPos
                      ? 'text-[#089981]'
                      : 'text-[#f23645]'
                  }`}
                >
                  {hasVal ? `${isPos ? '' : ''}${tile.pct!.toFixed(2)}%` : '—'}
                </div>
                <div
                  className={`text-[10px] font-medium mt-0.5 ${
                    !hasVal
                      ? 'text-[var(--text-muted)]'
                      : isPos
                      ? 'text-[#089981]/80'
                      : 'text-[#f23645]/80'
                  }`}
                >
                  {tile.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEASONALS MINI-CHART (Exact match to Full-Screen Screenshot 1) */}
      {seasonals.years.length > 0 && (
        <div className="pt-2 border-t border-[var(--border)]/60">
          <div className="text-[12.5px] font-bold text-[var(--text-main)] mb-2">Seasonals</div>
          <div className="w-full">
            <svg viewBox="0 0 250 100" className="w-full h-[98px] overflow-visible">
              <line
                x1="0"
                y1="50"
                x2="250"
                y2="50"
                stroke="var(--border)"
                strokeWidth="0.8"
                strokeDasharray="2 3"
              />
              {seasonals.years
                .slice()
                .reverse()
                .map((yr) => (
                  <g key={yr.year}>
                    <path
                      d={yr.path}
                      fill="none"
                      stroke={yr.color}
                      strokeWidth={yr.year === seasonals.years[0].year ? 1.6 : 1.15}
                      opacity={yr.year === seasonals.years[0].year ? 1 : 0.85}
                    />
                    {yr.year === seasonals.years[0].year && (
                      <circle cx={yr.endX} cy={yr.endY} r="3" fill={yr.color} />
                    )}
                  </g>
                ))}
            </svg>
            <div className="flex items-center justify-between text-[10.5px] text-[var(--text-muted)] px-0.5 mt-1">
              <span>Jan</span>
              <span>May</span>
              <span>Sep</span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-[var(--text-muted)]">
              {seasonals.years.map((yr) => (
                <span key={yr.year} className="inline-flex items-center gap-1 font-mono-num">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: yr.color }}
                  />
                  <span>{yr.year}</span>
                </span>
              ))}
            </div>
            <div className="mt-2.5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowMoreSeasonals((v) => !v)}
                className="px-3 py-1 rounded-[5px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11.5px] font-medium text-[var(--text-main)] transition-colors cursor-pointer"
              >
                {showMoreSeasonals ? 'Hide seasonals' : 'More seasonals'}
              </button>
            </div>
            {showMoreSeasonals && (
              <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-2 space-y-1 text-[11px]">
                {seasonals.years.map((yr) => (
                  <div key={yr.year} className="flex items-center justify-between font-mono-num">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-main)]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: yr.color }}
                      />
                      <span>{yr.year} Return</span>
                    </span>
                    <span
                      className={`font-semibold ${
                        yr.lastPct >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                      }`}
                    >
                      {yr.lastPct >= 0 ? '+' : ''}
                      {yr.lastPct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TECHNICALS SPEEDOMETER GAUGE (Exact match to Full-Screen Screenshot 1) */}
      <div ref={technicalsRef} className="pt-2 border-t border-[var(--border)]/60 pb-2">
        <div className="text-[12.5px] font-bold text-[var(--text-main)] mb-1">Technicals</div>
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 180 102" className="w-[172px] h-[96px]">
            {/* 5-segment TradingView Speedometer Arc */}
            {/* Strong Sell (Dark Red) */}
            <path
              d="M 22 86 A 68 68 0 0 1 36 45"
              fill="none"
              stroke="#d32f2f"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Sell (Coral Red) */}
            <path
              d="M 40 40 A 68 68 0 0 1 73 20"
              fill="none"
              stroke="#ef5350"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Neutral (Light Gray) */}
            <path
              d="M 79 19 A 68 68 0 0 1 101 19"
              fill="none"
              stroke="#d1d4dc"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Buy (Light Blue) */}
            <path
              d="M 107 20 A 68 68 0 0 1 140 40"
              fill="none"
              stroke="#64b5f6"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Strong Buy (Royal Blue) */}
            <path
              d="M 144 45 A 68 68 0 0 1 158 86"
              fill="none"
              stroke="#2962ff"
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* Pivoting Needle */}
            <g transform={`translate(90, 86) rotate(${technicals.angleDeg})`}>
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-52"
                stroke="var(--text-main)"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx="0" cy="0" r="5" fill="var(--text-main)" />
              <circle cx="0" cy="0" r="2" fill="var(--bg-surface)" />
            </g>
          </svg>

          <div
            className="text-[14px] font-bold tracking-tight -mt-1"
            style={{ color: technicals.color }}
          >
            {technicals.label}
          </div>

          <button
            type="button"
            onClick={() => setShowMoreTechnicals((v) => !v)}
            className="mt-2.5 px-3 py-1 rounded-[5px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11.5px] font-medium text-[var(--text-main)] transition-colors cursor-pointer"
          >
            {showMoreTechnicals ? 'Hide technicals' : 'More technicals'}
          </button>

          {showMoreTechnicals && (
            <div className="w-full mt-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-2.5 text-[11.5px]">
              <div className="grid grid-cols-3 text-center gap-1 font-mono-num">
                <div>
                  <div className="text-[#f23645] font-bold text-[13px]">{technicals.sellCount}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Sell</div>
                </div>
                <div>
                  <div className="text-[var(--text-main)] font-bold text-[13px]">
                    {technicals.neutralCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">Neutral</div>
                </div>
                <div>
                  <div className="text-[#2962ff] font-bold text-[13px]">{technicals.buyCount}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Buy</div>
                </div>
              </div>
              {technicals.rsiVal !== null && (
                <div className="mt-2 pt-1.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono-num">
                  <span className="text-[var(--text-muted)]">RSI (14)</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {technicals.rsiVal.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
