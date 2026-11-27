import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Bell, Plus, Check, RotateCcw } from 'lucide-react';
import { IndicatorConfig, TickerData, WatchlistItem } from '../types/trading';
import { fetchBinance, fmtCompact, fmtPrice } from '../utils/binance';
import { DEFAULT_INDICATORS } from '../utils/storage';
import { CoinLogo } from './CoinLogo';

/* ==================== SYMBOL SEARCH MODAL ==================== */
interface SymbolSearchModalProps {
  open: boolean;
  onClose: () => void;
  watchlist: WatchlistItem[];
  tickerMap: Record<string, TickerData>;
  onSelectSymbol: (sym: string) => void;
  onToggleWatchlist: (sym: string) => void;
}

interface RawBinance24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  open,
  onClose,
  watchlist,
  tickerMap,
  onSelectSymbol,
  onToggleWatchlist,
}) => {
  const [query, setQuery] = useState('');
  const [allPairs, setAllPairs] = useState<RawBinance24h[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 30);

    if (allPairs.length === 0) {
      setLoading(true);
      fetchBinance<RawBinance24h[]>('/ticker/24hr')
        .then((res) => {
          if (Array.isArray(res)) {
            const usdt = res
              .filter((t) => t.symbol.endsWith('USDT') && parseFloat(t.lastPrice) > 0)
              .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
            setAllPairs(usdt);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, allPairs.length]);

  if (!open) return null;

  const q = query.trim().toUpperCase();
  const sourceList =
    allPairs.length > 0
      ? allPairs
      : watchlist.map((w) => ({
          symbol: w.sym,
          lastPrice: String(tickerMap[w.sym]?.last || 0),
          priceChangePercent: String(tickerMap[w.sym]?.pct || 0),
          quoteVolume: String(tickerMap[w.sym]?.vol || 0),
        }));

  const filtered = sourceList.filter((t) => t.symbol.includes(q)).slice(0, 60);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Binance USDT pairs (e.g. BTC, ETH, SOL, PEPE)..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-1.5 border-b border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] bg-[var(--bg-elevated)]">
          <span>Symbol · Binance Spot</span>
          <span>Last Price · 24h Chg · Vol</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y divide-[var(--border)]">
          {loading && allPairs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              Loading Binance USDT pairs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No matching pairs found for "{query}".
            </div>
          ) : (
            filtered.map((item) => {
              const pct = parseFloat(item.priceChangePercent || '0');
              const last = parseFloat(item.lastPrice || '0');
              const vol = parseFloat(item.quoteVolume || '0');
              const inWl = watchlist.some((w) => w.sym === item.symbol);

              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    onClose();
                  }}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(item.symbol);
                      }}
                      title={inWl ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      className={`w-6 h-6 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                        inWl
                          ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {inWl ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <CoinLogo symbol={item.symbol} size={22} />
                    <div>
                      <div className="font-bold text-[13px] text-[var(--text-main)]">
                        {item.symbol}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {item.symbol.replace('USDT', '')} / TetherUS · Vol ${fmtCompact(vol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono-num">
                    <div className="text-[13px] font-semibold text-[var(--text-main)]">
                      {fmtPrice(last)}
                    </div>
                    <div
                      className={`text-[11px] font-medium ${
                        pct >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'
                      }`}
                    >
                      {pct >= 0 ? '+' : ''}
                      {pct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ==================== INDICATORS CONFIG MODAL ==================== */
interface IndicatorsModalProps {
  open: boolean;
  onClose: () => void;
  config: IndicatorConfig;
  onChange: (next: IndicatorConfig) => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  open,
  onClose,
  config,
  onChange,
}) => {
  if (!open) return null;

  const update = <K extends keyof IndicatorConfig>(
    key: K,
    patch: Partial<IndicatorConfig[K]>
  ) => {
    onChange({
      ...config,
      [key]: { ...config[key], ...patch },
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-bold text-sm text-[var(--text-main)]">Technical Indicators</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange(DEFAULT_INDICATORS)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
              title="Reset to Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
          {/* EMA Fast */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emaFast.enabled}
                onChange={(e) => update('emaFast', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.emaFast.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">EMA Fast</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Length</span>
              <input
                type="number"
                min={2}
                max={500}
                value={config.emaFast.period}
                onChange={(e) =>
                  update('emaFast', { period: Math.max(2, parseInt(e.target.value, 10) || 9) })
                }
                className="w-16 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* EMA Slow */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emaSlow.enabled}
                onChange={(e) => update('emaSlow', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.emaSlow.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">EMA Slow</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Length</span>
              <input
                type="number"
                min={2}
                max={500}
                value={config.emaSlow.period}
                onChange={(e) =>
                  update('emaSlow', { period: Math.max(2, parseInt(e.target.value, 10) || 21) })
                }
                className="w-16 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* EMA Cloud */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emaCloud.enabled}
                onChange={(e) => update('emaCloud', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span className="font-semibold text-[var(--text-main)]">
                EMA Ribbon Cloud Fill (Fast / Slow)
              </span>
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">Shaded trend zone</span>
          </div>

          {/* EMA 50 */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ema50.enabled}
                onChange={(e) => update('ema50', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.ema50.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">EMA Medium</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Length</span>
              <input
                type="number"
                min={2}
                max={500}
                value={config.ema50.period}
                onChange={(e) =>
                  update('ema50', { period: Math.max(2, parseInt(e.target.value, 10) || 50) })
                }
                className="w-16 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* EMA 200 */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ema200.enabled}
                onChange={(e) => update('ema200', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.ema200.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">EMA Trend Filter</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Length</span>
              <input
                type="number"
                min={2}
                max={500}
                value={config.ema200.period}
                onChange={(e) =>
                  update('ema200', { period: Math.max(2, parseInt(e.target.value, 10) || 200) })
                }
                className="w-16 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* Bollinger Bands */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.bb.enabled}
                onChange={(e) => update('bb', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.bb.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">Bollinger Bands</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Len</span>
              <input
                type="number"
                min={5}
                max={200}
                value={config.bb.period}
                onChange={(e) =>
                  update('bb', { period: Math.max(5, parseInt(e.target.value, 10) || 20) })
                }
                className="w-14 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
              <span className="text-[var(--text-muted)]">Std</span>
              <input
                type="number"
                step={0.5}
                min={0.5}
                max={5}
                value={config.bb.stdDev}
                onChange={(e) =>
                  update('bb', { stdDev: Math.max(0.5, parseFloat(e.target.value) || 2) })
                }
                className="w-14 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* Volume + MA */}
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.volume.enabled}
                onChange={(e) => update('volume', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span className="font-semibold text-[var(--text-main)]">Volume & MA</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.volume.showMa}
                  onChange={(e) => update('volume', { showMa: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                MA
              </label>
              <input
                type="number"
                min={2}
                max={200}
                value={config.volume.maPeriod}
                onChange={(e) =>
                  update('volume', { maPeriod: Math.max(2, parseInt(e.target.value, 10) || 20) })
                }
                className="w-14 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>

          {/* RSI Oscillator Sub-Pane */}
          <div className="flex items-center justify-between py-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.rsi.enabled}
                onChange={(e) => update('rsi', { enabled: e.target.checked })}
                className="accent-[var(--accent)] w-4 h-4"
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.rsi.color }}
              />
              <span className="font-semibold text-[var(--text-main)]">
                RSI Oscillator Pane (70 / 30)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Length</span>
              <input
                type="number"
                min={2}
                max={100}
                value={config.rsi.period}
                onChange={(e) =>
                  update('rsi', { period: Math.max(2, parseInt(e.target.value, 10) || 14) })
                }
                className="w-16 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================== CREATE ALERT MODAL ==================== */
interface CreateAlertModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  lastPrice: number;
  defaultPrice?: number;
  defaultNote?: string;
  onCreateAlert: (price: number, condition: 'above' | 'below' | 'crossing', note: string) => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  open,
  onClose,
  symbol,
  lastPrice,
  defaultPrice,
  defaultNote,
  onCreateAlert,
}) => {
  const [priceStr, setPriceStr] = useState('');
  const [condition, setCondition] = useState<'above' | 'below' | 'crossing'>('crossing');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      const target = defaultPrice && defaultPrice > 0 ? defaultPrice : lastPrice;
      setPriceStr(target > 0 ? String(Number(target.toFixed(6))) : '');
      setCondition('crossing');
      setNote(defaultNote || '');
    }
  }, [open, lastPrice, defaultPrice, defaultNote]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(priceStr);
    if (!target || target <= 0) return;
    onCreateAlert(target, condition, note.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-main)]">
            <Bell className="w-4 h-4 text-[var(--amber)]" />
            <span>Create Alert · {symbol}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-[var(--text-muted)] mb-1 font-medium">Condition</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'above', label: 'Crossing Up' },
                  { id: 'below', label: 'Crossing Down' },
                  { id: 'crossing', label: 'Any Cross' },
                ] as const
              ).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCondition(c.id)}
                  className={`py-2 px-2 rounded border text-center font-semibold transition-colors cursor-pointer ${
                    condition === c.id
                      ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[var(--text-muted)] mb-1">
              <label className="font-medium">Trigger Price (USDT)</label>
              <span className="font-mono-num">Last: {fmtPrice(lastPrice)}</span>
            </div>
            <input
              type="number"
              step="any"
              required
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              className="w-full h-9 px-3 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-[var(--text-muted)] mb-1 font-medium">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Breakout level, support retest..."
              className="w-full h-9 px-3 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[var(--accent)] text-white font-semibold hover:opacity-90 cursor-pointer"
            >
              Create Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
