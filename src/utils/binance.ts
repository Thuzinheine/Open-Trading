import { CandleBar, LinePoint, Timeframe, VolumeBar, WatchlistItem } from '../types/trading';

export const REST_MIRRORS = [
  'https://data-api.binance.vision/api/v3',
  'https://api.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
];

export const WS_MIRRORS = [
  'wss://data-stream.binance.vision',
  'wss://stream.binance.com:443',
  'wss://stream.binance.com:9443',
];

export const WS_BASE = WS_MIRRORS[0];

export interface ManagedBinanceSocket {
  close: () => void;
}

/**
 * Resilient Binance WebSocket connection that automatically fails over across
 * WS_MIRRORS (starting with global data-stream.binance.vision), detects hung
 * CONNECTING states via a watchdog, and reconnects automatically on drop.
 */
export function createBinanceSocket(
  path: string,
  handlers: {
    onOpen?: () => void;
    onMessage: (data: string) => void;
    onError?: () => void;
    onClose?: () => void;
  }
): ManagedBinanceSocket {
  let closed = false;
  let mirrorIdx = 0;
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let connectWatchdog: number | null = null;

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (connectWatchdog !== null) {
      window.clearTimeout(connectWatchdog);
      connectWatchdog = null;
    }
  };

  const connect = () => {
    if (closed) return;
    clearTimers();

    const base = WS_MIRRORS[mirrorIdx % WS_MIRRORS.length];
    let opened = false;

    try {
      ws = new WebSocket(`${base}${path}`);
    } catch {
      mirrorIdx = (mirrorIdx + 1) % WS_MIRRORS.length;
      handlers.onError?.();
      reconnectTimer = window.setTimeout(connect, 1200);
      return;
    }

    const currentWs = ws;

    // Watchdog in case a blocked/firewalled endpoint stalls in CONNECTING
    connectWatchdog = window.setTimeout(() => {
      if (!closed && !opened && currentWs.readyState !== WebSocket.OPEN) {
        try {
          currentWs.close();
        } catch {}
      }
    }, 4200);

    currentWs.onopen = () => {
      if (closed) {
        try {
          currentWs.close();
        } catch {}
        return;
      }
      opened = true;
      if (connectWatchdog !== null) {
        window.clearTimeout(connectWatchdog);
        connectWatchdog = null;
      }
      handlers.onOpen?.();
    };

    currentWs.onmessage = (evt) => {
      if (closed) return;
      if (typeof evt.data === 'string') {
        handlers.onMessage(evt.data);
      }
    };

    currentWs.onerror = () => {
      if (closed) return;
      handlers.onError?.();
    };

    currentWs.onclose = () => {
      if (closed) return;
      if (connectWatchdog !== null) {
        window.clearTimeout(connectWatchdog);
        connectWatchdog = null;
      }
      handlers.onClose?.();
      if (!opened) {
        // Rotate to next mirror quickly if this endpoint couldn't connect
        mirrorIdx = (mirrorIdx + 1) % WS_MIRRORS.length;
        reconnectTimer = window.setTimeout(connect, 900);
      } else {
        reconnectTimer = window.setTimeout(connect, 1800);
      }
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearTimers();
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {}
        ws = null;
      }
    },
  };
}

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { sym: 'BTCUSDT', name: 'Bitcoin / TetherUS', color: '#f7931a', letter: '₿' },
  { sym: 'ETHUSDT', name: 'Ethereum / TetherUS', color: '#627eea', letter: 'Ξ' },
  { sym: 'BNBUSDT', name: 'BNB / TetherUS', color: '#f3ba2f', letter: 'B' },
  { sym: 'SOLUSDT', name: 'Solana / TetherUS', color: '#14b88a', letter: 'S' },
  { sym: 'XRPUSDT', name: 'XRP / TetherUS', color: '#334155', letter: 'X' },
  { sym: 'TAOUSDT', name: 'Bittensor / TetherUS', color: '#1e293b', letter: 'τ' },
  { sym: 'SUIUSDT', name: 'Sui / TetherUS', color: '#4da2ff', letter: 'S' },
  { sym: 'LINKUSDT', name: 'Chainlink / TetherUS', color: '#2a5ada', letter: 'L' },
  { sym: 'LTCUSDT', name: 'Litecoin / TetherUS', color: '#345d9d', letter: 'Ł' },
  { sym: 'RENDERUSDT', name: 'Render / TetherUS', color: '#e1382c', letter: 'R' },
  { sym: 'UNIUSDT', name: 'Uniswap / TetherUS', color: '#ff007a', letter: 'U' },
  { sym: 'PENDLEUSDT', name: 'Pendle / TetherUS', color: '#152c44', letter: 'P' },
  { sym: 'ONDOUSDT', name: 'Ondo / TetherUS', color: '#0f172a', letter: 'O' },
  { sym: 'CAKEUSDT', name: 'PancakeSwap / TetherUS', color: '#1fc7d4', letter: 'C' },
  { sym: 'INJUSDT', name: 'Injective / TetherUS', color: '#00a3ff', letter: 'I' },
  { sym: 'JUPUSDT', name: 'Jupiter / TetherUS', color: '#19d298', letter: 'J' },
  { sym: 'FETUSDT', name: 'FET / TetherUS', color: '#1d2951', letter: 'F' },
  { sym: 'ADAUSDT', name: 'Cardano / TetherUS', color: '#0033ad', letter: 'A' },
  { sym: 'DOGEUSDT', name: 'Dogecoin / TetherUS', color: '#c2a633', letter: 'Ð' },
  { sym: 'ENAUSDT', name: 'Ethena / TetherUS', color: '#374151', letter: 'E' },
];

export const INTERVAL_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
};

export async function fetchBinance<T = unknown>(
  pathWithQuery: string,
  options?: { fresh?: boolean }
): Promise<T> {
  let lastErr: unknown = null;
  for (const base of REST_MIRRORS) {
    try {
      const res = await fetch(`${base}${pathWithQuery}`, options?.fresh ? { cache: 'no-store' } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Binance mirrors unavailable');
}

export function getPrecision(price: number): number {
  const abs = Math.abs(price);
  if (abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 10) return 2;
  if (abs >= 1) return 3;
  if (abs >= 0.05) return 4;
  if (abs >= 0.001) return 5;
  return 6;
}

export function fmtPrice(num: number | undefined | null, forcePrec?: number): string {
  if (num === undefined || num === null || Number.isNaN(num)) return '-';
  const p = forcePrec !== undefined ? forcePrec : getPrecision(num);
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
  });
}

export function fmtCompact(num: number | undefined | null): string {
  if (num === undefined || num === null || Number.isNaN(num)) return '-';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return Number(num).toFixed(2);
}

export function parseKlines(raw: unknown[][]): { candles: CandleBar[]; volumes: VolumeBar[] } {
  const candles: CandleBar[] = [];
  const volumes: VolumeBar[] = [];
  for (const k of raw) {
    const t = Math.floor(Number(k[0]) / 1000);
    const o = parseFloat(String(k[1]));
    const h = parseFloat(String(k[2]));
    const l = parseFloat(String(k[3]));
    const cl = parseFloat(String(k[4]));
    candles.push({ time: t, open: o, high: h, low: l, close: cl });
    volumes.push({
      time: t,
      value: parseFloat(String(k[5])),
      color: cl >= o ? 'rgba(8, 153, 129, 0.48)' : 'rgba(242, 54, 69, 0.48)',
    });
  }
  return { candles, volumes };
}

export function toHeikinAshi(candles: CandleBar[]): CandleBar[] {
  if (!candles.length) return [];
  const result: CandleBar[] = [];
  let prevOpen = candles[0].open;
  let prevClose = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({
      time: c.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return result;
}

export function computeEMA(data: CandleBar[], period: number): LinePoint[] {
  if (!data.length || period < 1) return [];
  const k = 2 / (period + 1);
  let ema = data[0].close;
  return data.map((d) => {
    ema = d.close * k + ema * (1 - k);
    return { time: d.time, value: ema };
  });
}

export function computeVolumeSMA(vols: VolumeBar[], period: number): LinePoint[] {
  if (!vols.length || period < 1) return [];
  const res: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < vols.length; i++) {
    sum += vols[i].value;
    if (i >= period) sum -= vols[i - period].value;
    res.push({ time: vols[i].time, value: sum / Math.min(i + 1, period) });
  }
  return res;
}

export function computeBollingerBands(
  data: CandleBar[],
  period: number,
  stdDevMult: number
): { upper: LinePoint[]; middle: LinePoint[]; lower: LinePoint[] } {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  if (data.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    const mean = sum / period;

    let sqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j].close - mean;
      sqDiff += diff * diff;
    }
    const sd = Math.sqrt(sqDiff / period);
    const t = data[i].time;
    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + stdDevMult * sd });
    lower.push({ time: t, value: mean - stdDevMult * sd });
  }
  return { upper, middle, lower };
}

export function computeRSI(data: CandleBar[], period = 14): LinePoint[] {
  if (data.length <= period) return [];
  const res: LinePoint[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  res.push({ time: data[period].time, value: firstRsi });

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    res.push({ time: data[i].time, value: rsi });
  }
  return res;
}

export function playAlertChime(volume01 = 0.7) {
  try {
    const clamped = Math.max(0, Math.min(1, volume01));
    if (clamped <= 0.005) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const peakGain = Math.max(0.01, 0.18 * clamped);
    [880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
  } catch {
    // Ignore autoplay blocks
  }
}
