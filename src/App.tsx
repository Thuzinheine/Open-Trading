import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import {
  CandleBar,
  ChartSettings,
  ChartSettingsTab,
  ChartSettingsTemplate,
  ChartType,
  DrawingObject,
  DrawingTemplate,
  DrawingTool,
  IndicatorConfig,
  IndicatorSettingsTarget,
  MagnetMode,
  PaperAccountState,
  PriceAlert,
  RightPanelTab,
  TickerData,
  Timeframe,
  ToastMessage,
  VolumeBar,
  WatchlistCollection,
  WatchlistItem,
  WatchlistViewPrefs,
} from './types/trading';
import {
  createBinanceSocket,
  fetchBinance,
  fmtPrice,
  ManagedBinanceSocket,
  parseKlines,
  playAlertChime,
} from './utils/binance';
import {
  DEFAULT_PAPER_ACCOUNT,
  loadActiveWatchlistId,
  loadAlerts,
  loadAllDrawings,
  loadChartSettings,
  loadChartTemplates,
  loadDrawingTemplates,
  loadFavoriteTools,
  loadIndicators,
  loadLastChartState,
  loadPaperAccount,
  loadSymbolNotes,
  loadTheme,
  loadToolPrefs,
  loadWatchlistCollections,
  loadWatchlistPrefs,
  saveActiveWatchlistId,
  saveAlerts,
  saveAllDrawings,
  saveChartSettings,
  saveChartTemplates,
  saveDrawingTemplates,
  saveFavoriteTools,
  saveIndicators,
  saveLastChartState,
  savePaperAccount,
  saveSymbolNotes,
  saveTheme,
  saveToolPrefs,
  saveWatchlistCollections,
  saveWatchlistPrefs,
} from './utils/storage';
import { ALL_TOOLS_MAP } from './utils/drawingToolsCatalog';
import { TopBar, SnapshotAction } from './components/TopBar';
import { LeftToolbar } from './components/LeftToolbar';
import { ChartWorkspace, ChartWorkspaceHandle } from './components/ChartWorkspace';
import { RightSidebar } from './components/RightSidebar';
import { TradeDrawer } from './components/TradeDrawer';
import { CreateAlertModal, IndicatorsModal, SymbolSearchModal } from './components/Modals';
import { DrawingSettingsModal, SettingsTab } from './components/DrawingSettingsModal';
import { ChartSettingsModal } from './components/ChartSettingsModal';
import { IndicatorSettingsModal } from './components/IndicatorSettingsModal';
import { FLAG_COLORS } from './components/CoinLogo';

interface RawTicker24h {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export default function App() {
  // Persisted workspace preferences
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => loadTheme());
  const [watchlists, setWatchlists] = useState<WatchlistCollection[]>(() =>
    loadWatchlistCollections()
  );
  const [activeListId, setActiveListId] = useState<string>(() => loadActiveWatchlistId());
  const [watchlistPrefs, setWatchlistPrefs] = useState<WatchlistViewPrefs>(() =>
    loadWatchlistPrefs()
  );
  const [symbolNotes, setSymbolNotes] = useState<Record<string, string>>(() => loadSymbolNotes());
  const [openListModalTrigger, setOpenListModalTrigger] = useState<number>(0);

  const activeWatchlist = useMemo(
    () => watchlists.find((l) => l.id === activeListId) || watchlists[0],
    [watchlists, activeListId]
  );
  const watchlist = useMemo(
    () => (activeWatchlist?.items || []).filter((i) => !i.isSection),
    [activeWatchlist]
  );

  const [indicators, setIndicators] = useState<IndicatorConfig>(() => loadIndicators());
  const [drawingsMap, setDrawingsMap] = useState<Record<string, DrawingObject[]>>(() =>
    loadAllDrawings()
  );
  const [redoMap, setRedoMap] = useState<Record<string, DrawingObject[]>>({});
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const [paperAccount, setPaperAccount] = useState<PaperAccountState>(() => loadPaperAccount());
  const [favoriteTools, setFavoriteTools] = useState<DrawingTool[]>(() => loadFavoriteTools());
  const [drawingTemplates, setDrawingTemplates] = useState<DrawingTemplate[]>(() =>
    loadDrawingTemplates()
  );
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => loadChartSettings());
  const [chartTemplates, setChartTemplates] = useState<ChartSettingsTemplate[]>(() =>
    loadChartTemplates()
  );

  const initialToolPrefs = useMemo(() => loadToolPrefs(), []);
  const [magnetMode, setMagnetMode] = useState<MagnetMode>(initialToolPrefs.magnetMode);
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [lockDrawings, setLockDrawings] = useState<boolean>(initialToolPrefs.lockDrawings);

  // Chart state (restores URL ?symbol=&interval= if shared, otherwise last opened coin & timeframe)
  const initialChart = useMemo(() => {
    const saved = loadLastChartState();
    try {
      const params = new URLSearchParams(window.location.search);
      const qSym = params.get('symbol')?.trim().toUpperCase();
      const qTf = params.get('interval')?.trim() as Timeframe | null;
      const validTfs: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      return {
        symbol: qSym && /^[A-Z0-9]{4,16}$/.test(qSym) ? qSym : saved.symbol,
        interval: qTf && validTfs.includes(qTf) ? qTf : saved.interval,
      };
    } catch {
      return saved;
    }
  }, []);
  const [currentSymbol, setCurrentSymbol] = useState<string>(initialChart.symbol);
  const [interval, setIntervalState] = useState<Timeframe>(initialChart.interval);
  const [chartDataMeta, setChartDataMeta] = useState<{ sym: string; tf: Timeframe }>({
    sym: initialChart.symbol,
    tf: initialChart.interval,
  });
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [volumes, setVolumes] = useState<VolumeBar[]>([]);
  const [candleCloseMs, setCandleCloseMs] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'live' | 'connecting' | 'error'>('connecting');

  // Tickers map
  const [tickerMap, setTickerMap] = useState<Record<string, TickerData>>({});

  // Drawing tools state
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [drawColor, setDrawColor] = useState<string>('#2962ff');
  const [drawingsHidden, setDrawingsHidden] = useState<boolean>(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [settingsDrawingId, setSettingsDrawingId] = useState<string | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('style');

  // Panels & Modals
  const [rightVisible, setRightVisible] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>('watchlist');
  const [isTradeOpen, setIsTradeOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState<boolean>(false);
  const [indSettingsTarget, setIndSettingsTarget] = useState<IndicatorSettingsTarget | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [alertPrefill, setAlertPrefill] = useState<{ price?: number; note?: string } | null>(null);
  const [chartSettingsOpen, setChartSettingsOpen] = useState<boolean>(false);
  const [chartSettingsTab, setChartSettingsTab] = useState<ChartSettingsTab>('symbol');

  // Bar Replay state
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(2);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs for async safety
  const chartWorkspaceRef = useRef<ChartWorkspaceHandle>(null);
  const loadGenRef = useRef<number>(0);
  const isChartLoadingRef = useRef<boolean>(false);
  const loadedChartRef = useRef<{ sym: string; tf: Timeframe } | null>(null);
  const chartCacheRef = useRef<
    Map<
      string,
      {
        candles: CandleBar[];
        volumes: VolumeBar[];
        closeMs: number;
        cachedAt: number;
        hasMore: boolean;
      }
    >
  >(new Map());
  const inFlightChartRef = useRef<
    Map<
      string,
      Promise<{
        candles: CandleBar[];
        volumes: VolumeBar[];
        closeMs: number;
        hasMore: boolean;
      } | null>
    >
  >(new Map());
  const warmTimersRef = useRef<number[]>([]);
  const isFetchingHistoryRef = useRef<boolean>(false);
  const hasMoreHistoryRef = useRef<boolean>(true);
  const klineWsRef = useRef<ManagedBinanceSocket | null>(null);
  const tickerWsRef = useRef<ManagedBinanceSocket | null>(null);
  const lastChartTickMsRef = useRef<number>(0);
  const lastWatchlistTickMsRef = useRef<number>(0);
  const pendingTradePriceRef = useRef<{ sym: string; price: number } | null>(null);
  const tradeFlushTimerRef = useRef<number | null>(null);
  const chartPollBusyRef = useRef<boolean>(false);
  const tickerPollBusyRef = useRef<boolean>(false);
  const candleCloseMsRef = useRef<number>(0);
  candleCloseMsRef.current = candleCloseMs;
  const candlesRef = useRef<CandleBar[]>([]);
  candlesRef.current = candles;
  const volumesRef = useRef<VolumeBar[]>([]);
  volumesRef.current = volumes;
  const currentSymRef = useRef(currentSymbol);
  currentSymRef.current = currentSymbol;
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  const isReplayRef = useRef(isReplayMode);
  isReplayRef.current = isReplayMode;
  const prevPriceMapRef = useRef<Record<string, number>>({});
  const chartSettingsRef = useRef<ChartSettings>(chartSettings);
  chartSettingsRef.current = chartSettings;

  const pushToast = useCallback(
    (title: string, detail?: string, tone: ToastMessage['tone'] = 'info') => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, detail, tone }].slice(-4));
      if (chartSettingsRef.current.alerts.autoHideToasts) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
      }
    },
    []
  );

  // Sync dark mode & persisted settings
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    saveTheme(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => saveWatchlistCollections(watchlists), [watchlists]);
  useEffect(() => saveActiveWatchlistId(activeListId), [activeListId]);
  useEffect(() => saveWatchlistPrefs(watchlistPrefs), [watchlistPrefs]);
  useEffect(() => saveSymbolNotes(symbolNotes), [symbolNotes]);
  useEffect(() => saveIndicators(indicators), [indicators]);
  useEffect(() => saveAllDrawings(drawingsMap), [drawingsMap]);
  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => savePaperAccount(paperAccount), [paperAccount]);
  useEffect(() => saveFavoriteTools(favoriteTools), [favoriteTools]);
  useEffect(() => saveDrawingTemplates(drawingTemplates), [drawingTemplates]);
  useEffect(() => saveChartSettings(chartSettings), [chartSettings]);
  useEffect(() => saveChartTemplates(chartTemplates), [chartTemplates]);
  useEffect(() => {
    saveToolPrefs({ magnetMode, stayInDrawingMode, lockDrawings });
  }, [magnetMode, stayInDrawingMode, lockDrawings]);

  // Evaluate Price Alerts, Limit Orders, and TP/SL on live ticks
  const evaluatePriceTriggers = useCallback(
    (sym: string, newPrice: number) => {
      const prevPrice = prevPriceMapRef.current[sym];
      prevPriceMapRef.current[sym] = newPrice;
      if (prevPrice === undefined || prevPrice === newPrice) return;

      setAlerts((prev) => {
        let changed = false;
        const next = prev.map((al) => {
          if (!al.active || al.symbol !== sym) return al;
          const crossedUp = prevPrice < al.price && newPrice >= al.price;
          const crossedDown = prevPrice > al.price && newPrice <= al.price;
          const hit =
            (al.condition === 'above' && crossedUp) ||
            (al.condition === 'below' && crossedDown) ||
            (al.condition === 'crossing' && (crossedUp || crossedDown));

          if (hit) {
            changed = true;
            const alertCfg = chartSettingsRef.current.alerts;
            if (alertCfg.alertVolumeEnabled) {
              playAlertChime(alertCfg.alertVolume / 100);
            }
            pushToast(
              `Alert Triggered: ${sym} @ $${fmtPrice(newPrice)}`,
              al.note || `Crossed target $${fmtPrice(al.price)}`,
              'warning'
            );
            return { ...al, active: false, triggeredAt: Date.now() };
          }
          return al;
        });
        return changed ? next : prev;
      });

      setPaperAccount((acc) => {
        let updated = false;
        let balance = acc.balance;
        let realizedPnl = acc.realizedPnl;
        const positions = [...acc.positions];
        const remainingOrders = [];
        const newHistory = [...acc.history];

        for (const ord of acc.limitOrders) {
          if (ord.symbol !== sym) {
            remainingOrders.push(ord);
            continue;
          }
          const shouldFill =
            (ord.side === 'BUY' && newPrice <= ord.limitPrice) ||
            (ord.side === 'SELL' && newPrice >= ord.limitPrice);

          if (shouldFill) {
            updated = true;
            positions.unshift({
              id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              symbol: ord.symbol,
              side: ord.side,
              qty: ord.qty,
              entryPrice: ord.limitPrice,
              takeProfit: ord.takeProfit,
              stopLoss: ord.stopLoss,
              openedAt: Date.now(),
            });
            const tradeCfg = chartSettingsRef.current.trading;
            if (tradeCfg.executionSound) {
              playAlertChime(tradeCfg.executionSoundVolume / 100);
            }
            if (!tradeCfg.onlyRejectionNotifications) {
              pushToast(
                `Limit Order Filled: ${ord.side} ${ord.qty} ${sym}`,
                `Executed @ $${fmtPrice(ord.limitPrice)}`,
                'success'
              );
            }
          } else {
            remainingOrders.push(ord);
          }
        }

        const survivingPositions = [];
        for (const pos of positions) {
          if (pos.symbol !== sym) {
            survivingPositions.push(pos);
            continue;
          }
          let closeReason: 'Take Profit' | 'Stop Loss' | null = null;
          if (pos.side === 'BUY') {
            if (pos.takeProfit && newPrice >= pos.takeProfit) closeReason = 'Take Profit';
            else if (pos.stopLoss && newPrice <= pos.stopLoss) closeReason = 'Stop Loss';
          } else {
            if (pos.takeProfit && newPrice <= pos.takeProfit) closeReason = 'Take Profit';
            else if (pos.stopLoss && newPrice >= pos.stopLoss) closeReason = 'Stop Loss';
          }

          if (closeReason) {
            updated = true;
            const exitPrice =
              closeReason === 'Take Profit' ? pos.takeProfit || newPrice : pos.stopLoss || newPrice;
            const pnl =
              (pos.side === 'BUY' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) *
              pos.qty;
            balance += pnl;
            realizedPnl += pnl;
            newHistory.unshift({
              id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              symbol: pos.symbol,
              side: pos.side,
              qty: pos.qty,
              entryPrice: pos.entryPrice,
              exitPrice,
              pnl,
              reason: closeReason,
              closedAt: Date.now(),
            });
            const tradeCfg = chartSettingsRef.current.trading;
            if (tradeCfg.executionSound) {
              playAlertChime(tradeCfg.executionSoundVolume / 100);
            }
            if (!tradeCfg.onlyRejectionNotifications) {
              pushToast(
                `${closeReason} Hit: ${pos.symbol}`,
                `Closed @ $${fmtPrice(exitPrice)} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`,
                pnl >= 0 ? 'success' : 'danger'
              );
            }
          } else {
            survivingPositions.push(pos);
          }
        }

        if (!updated) return acc;
        return {
          balance,
          realizedPnl,
          positions: survivingPositions,
          limitOrders: remainingOrders,
          history: newHistory.slice(0, 100),
        };
      });
    },
    [pushToast]
  );

  // Prepend older historical candles on left scroll
  const prependOlderCandles = useCallback(async (expectedGen?: number) => {
    const gen = expectedGen ?? loadGenRef.current;
    if (
      isFetchingHistoryRef.current ||
      !hasMoreHistoryRef.current ||
      candlesRef.current.length === 0
    ) {
      return;
    }
    isFetchingHistoryRef.current = true;
    try {
      const oldestMs = candlesRef.current[0].time * 1000 - 1;
      const rawOlder = await fetchBinance<unknown[][]>(
        `/klines?symbol=${currentSymRef.current}&interval=${intervalRef.current}&limit=1000&endTime=${oldestMs}`
      );
      if (gen !== loadGenRef.current) return;
      if (!Array.isArray(rawOlder) || rawOlder.length === 0) {
        hasMoreHistoryRef.current = false;
        return;
      }

      const parsed = parseKlines(rawOlder);
      const oldestTime = candlesRef.current[0].time;
      const freshC: CandleBar[] = [];
      const freshV: VolumeBar[] = [];

      for (let i = 0; i < parsed.candles.length; i++) {
        if (parsed.candles[i].time < oldestTime) {
          freshC.push(parsed.candles[i]);
          freshV.push(parsed.volumes[i]);
        }
      }

      if (freshC.length === 0) {
        hasMoreHistoryRef.current = false;
        return;
      }

      setCandles((prev) => freshC.concat(prev));
      setVolumes((prev) => freshV.concat(prev));

      if (rawOlder.length < 1000) hasMoreHistoryRef.current = false;
    } catch {
      // ignore transient pagination error
    } finally {
      isFetchingHistoryRef.current = false;
    }
  }, []);

  // Sync a sub-second live trade tick into both the active candle and tickerMap in lockstep
  const applyLiveTradePrice = useCallback(
    (sym: string, price: number) => {
      if (!Number.isFinite(price) || price <= 0) return;

      setTickerMap((prev) => {
        const cur = prev[sym];
        if (!cur) {
          return {
            ...prev,
            [sym]: {
              symbol: sym,
              last: price,
              chg: 0,
              pct: 0,
              high: price,
              low: price,
              vol: 0,
              baseVol: 0,
              prevLast: price,
            },
          };
        }
        const open24h = cur.last - cur.chg;
        const chg = open24h > 0 ? price - open24h : cur.chg;
        const pct = open24h > 0 ? (chg / open24h) * 100 : cur.pct;
        return {
          ...prev,
          [sym]: {
            ...cur,
            last: price,
            chg,
            pct,
            high: cur.high > 0 ? Math.max(cur.high, price) : price,
            low: cur.low > 0 ? Math.min(cur.low, price) : price,
            prevLast: price !== cur.last ? cur.last : cur.prevLast,
          },
        };
      });

      evaluatePriceTriggers(sym, price);

      if (
        isReplayRef.current ||
        isChartLoadingRef.current ||
        !loadedChartRef.current ||
        loadedChartRef.current.sym !== sym ||
        sym !== currentSymRef.current
      ) {
        return;
      }

      let candleDirectionChanged = false;
      let isBullNow = true;

      setCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        const nextHigh = Math.max(last.high, price);
        const nextLow = Math.min(last.low, price);
        if (last.close === price && last.high === nextHigh && last.low === nextLow) {
          return prev;
        }
        const wasBull = last.close >= last.open;
        isBullNow = price >= last.open;
        candleDirectionChanged = wasBull !== isBullNow;
        const next = prev.slice();
        next[next.length - 1] = {
          ...last,
          high: nextHigh,
          low: nextLow,
          close: price,
        };
        return next;
      });

      if (candleDirectionChanged) {
        setVolumes((prev) => {
          if (!prev.length) return prev;
          const next = prev.slice();
          const lastV = next[next.length - 1];
          next[next.length - 1] = {
            ...lastV,
            color: isBullNow ? 'rgba(8, 153, 129, 0.48)' : 'rgba(242, 54, 69, 0.48)',
          };
          return next;
        });
      }
    },
    [evaluatePriceTriggers]
  );

  // Merge authoritative kline bars (from @kline WS or 1s REST heartbeat)
  const applyKlineBars = useCallback(
    (
      sym: string,
      tf: Timeframe,
      incomingCandles: CandleBar[],
      incomingVolumes: VolumeBar[],
      closeTimeMs: number
    ) => {
      if (
        !incomingCandles.length ||
        isChartLoadingRef.current ||
        !loadedChartRef.current ||
        loadedChartRef.current.sym !== sym ||
        loadedChartRef.current.tf !== tf ||
        sym !== currentSymRef.current
      ) {
        return;
      }
      const latestBar = incomingCandles[incomingCandles.length - 1];
      if (closeTimeMs > 0) setCandleCloseMs(closeTimeMs);

      setTickerMap((prev) => {
        const cur = prev[sym];
        if (!cur) return prev;
        const price = latestBar.close;
        const open24h = cur.last - cur.chg;
        const chg = open24h > 0 ? price - open24h : cur.chg;
        const pct = open24h > 0 ? (chg / open24h) * 100 : cur.pct;
        return {
          ...prev,
          [sym]: {
            ...cur,
            last: price,
            chg,
            pct,
            high: cur.high > 0 ? Math.max(cur.high, price) : price,
            low: cur.low > 0 ? Math.min(cur.low, price) : price,
            prevLast: price !== cur.last ? cur.last : cur.prevLast,
          },
        };
      });

      evaluatePriceTriggers(sym, latestBar.close);

      if (isReplayRef.current) return;

      setCandles((prev) => {
        if (!prev.length) return incomingCandles;
        const next = prev.slice();
        let mutated = false;
        for (const bar of incomingCandles) {
          const last = next[next.length - 1];
          if (bar.time < last.time) continue;
          if (bar.time === last.time) {
            if (
              last.open !== bar.open ||
              last.high !== bar.high ||
              last.low !== bar.low ||
              last.close !== bar.close
            ) {
              next[next.length - 1] = bar;
              mutated = true;
            }
          } else {
            next.push(bar);
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });

      setVolumes((prev) => {
        if (!prev.length) return incomingVolumes;
        const next = prev.slice();
        let mutated = false;
        for (const volBar of incomingVolumes) {
          const last = next[next.length - 1];
          if (volBar.time < last.time) continue;
          if (volBar.time === last.time) {
            if (last.value !== volBar.value || last.color !== volBar.color) {
              next[next.length - 1] = volBar;
              mutated = true;
            }
          } else {
            next.push(volBar);
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });
    },
    [evaluatePriceTriggers]
  );

  // Connect live Combined Kline + AggTrade WebSocket (sub-second live price & candle updates)
  const connectKlineSocket = useCallback(
    (sym: string, tf: Timeframe, expectedGen: number) => {
      if (klineWsRef.current) {
        klineWsRef.current.close();
        klineWsRef.current = null;
      }
      if (tradeFlushTimerRef.current !== null) {
        window.clearTimeout(tradeFlushTimerRef.current);
        tradeFlushTimerRef.current = null;
      }
      pendingTradePriceRef.current = null;

      setWsStatus('connecting');
      const lower = sym.toLowerCase();
      const sock = createBinanceSocket(
        `/stream?streams=${lower}@kline_${tf}/${lower}@aggTrade`,
        {
          onOpen: () => {
            if (expectedGen !== loadGenRef.current) return;
            setWsStatus('live');
          },
          onMessage: (raw) => {
            if (expectedGen !== loadGenRef.current) return;
            try {
              const payload = JSON.parse(raw);
              const stream: string = payload.stream || '';
              const msg = payload.data || payload;

              if (stream.includes('@aggTrade') || msg.e === 'aggTrade') {
                if (msg.s !== currentSymRef.current) return;
                const tradePrice = parseFloat(msg.p);
                if (!Number.isFinite(tradePrice)) return;
                lastChartTickMsRef.current = Date.now();
                setWsStatus('live');

                // Coalesce rapid trade bursts smoothly (~5 updates/sec max)
                pendingTradePriceRef.current = { sym: msg.s, price: tradePrice };
                if (tradeFlushTimerRef.current === null) {
                  tradeFlushTimerRef.current = window.setTimeout(() => {
                    tradeFlushTimerRef.current = null;
                    if (expectedGen !== loadGenRef.current) return;
                    const pending = pendingTradePriceRef.current;
                    pendingTradePriceRef.current = null;
                    if (pending) {
                      applyLiveTradePrice(pending.sym, pending.price);
                    }
                  }, 180);
                }
                return;
              }

              if (msg.k && msg.s === currentSymRef.current) {
                const k = msg.k;
                lastChartTickMsRef.current = Date.now();
                setWsStatus('live');
                const tSec = Math.floor(k.t / 1000);
                const bar: CandleBar = {
                  time: tSec,
                  open: parseFloat(k.o),
                  high: parseFloat(k.h),
                  low: parseFloat(k.l),
                  close: parseFloat(k.c),
                };
                const volBar: VolumeBar = {
                  time: tSec,
                  value: parseFloat(k.v),
                  color:
                    bar.close >= bar.open
                      ? 'rgba(8, 153, 129, 0.48)'
                      : 'rgba(242, 54, 69, 0.48)',
                };
                applyKlineBars(sym, tf, [bar], [volBar], k.T);
              }
            } catch {}
          },
          onError: () => {
            if (expectedGen === loadGenRef.current) setWsStatus('connecting');
          },
          onClose: () => {
            if (expectedGen === loadGenRef.current) setWsStatus('connecting');
          },
        }
      );

      klineWsRef.current = sock;
    },
    [applyKlineBars, applyLiveTradePrice]
  );

  // Shared fast kline fetcher (limit=300 for 3-4x faster initial render, deduplicated across hover/click)
  const fetchChartBatch = useCallback(async (sym: string, tf: Timeframe) => {
    const cacheKey = `${sym}_${tf}`;
    const existing = inFlightChartRef.current.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const raw = await fetchBinance<unknown[][]>(
          `/klines?symbol=${sym}&interval=${tf}&limit=300`,
          { fresh: true }
        );
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const parsed = parseKlines(raw);
        const closeMs = Number(raw[raw.length - 1][6]);
        const entry = {
          candles: parsed.candles,
          volumes: parsed.volumes,
          closeMs,
          cachedAt: Date.now(),
          hasMore: raw.length === 300,
        };
        chartCacheRef.current.set(cacheKey, entry);
        // Keep cache bounded to 48 recent charts
        if (chartCacheRef.current.size > 48) {
          const oldestKey = chartCacheRef.current.keys().next().value;
          if (oldestKey) chartCacheRef.current.delete(oldestKey);
        }
        return entry;
      } catch {
        return null;
      } finally {
        inFlightChartRef.current.delete(cacheKey);
      }
    })();

    inFlightChartRef.current.set(cacheKey, promise);
    return promise;
  }, []);

  // Silent hover/background prefetcher so clicking a coin or H1/H4/D/W is 0ms instant
  const prefetchChart = useCallback(
    (sym: string, tf: Timeframe) => {
      const cacheKey = `${sym}_${tf}`;
      const cached = chartCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < 90_000) return;
      if (inFlightChartRef.current.has(cacheKey)) return;
      void fetchChartBatch(sym, tf);
    },
    [fetchChartBatch]
  );

  // Schedule gentle background warmup of sibling timeframes (15m, 1h, 4h, 1d, 1w) for the active coin
  const scheduleSiblingWarmup = useCallback(
    (sym: string, activeTf: Timeframe, expectedGen: number) => {
      warmTimersRef.current.forEach((t) => window.clearTimeout(t));
      warmTimersRef.current = [];

      const siblingTfs: Timeframe[] = (['1h', '4h', '1d', '15m', '1w'] as Timeframe[]).filter(
        (t) => t !== activeTf
      );
      siblingTfs.forEach((tf, idx) => {
        const timer = window.setTimeout(() => {
          if (expectedGen !== loadGenRef.current) return;
          prefetchChart(sym, tf);
        }, 280 + idx * 140);
        warmTimersRef.current.push(timer);
      });
    },
    [prefetchChart]
  );

  // Load Symbol + Timeframe history (instant 0ms on cache hit, fast 300-bar load + background history backfill on miss)
  const loadSymbolChart = useCallback(
    async (sym: string, tf: Timeframe) => {
      loadGenRef.current += 1;
      const myGen = loadGenRef.current;

      if (klineWsRef.current) {
        klineWsRef.current.close();
        klineWsRef.current = null;
      }
      if (tradeFlushTimerRef.current !== null) {
        window.clearTimeout(tradeFlushTimerRef.current);
        tradeFlushTimerRef.current = null;
      }
      pendingTradePriceRef.current = null;

      // Save current loaded chart into cache before leaving it
      if (loadedChartRef.current && candlesRef.current.length > 0 && !isChartLoadingRef.current) {
        const prevKey = `${loadedChartRef.current.sym}_${loadedChartRef.current.tf}`;
        chartCacheRef.current.set(prevKey, {
          candles: candlesRef.current,
          volumes: volumesRef.current,
          closeMs: candleCloseMsRef.current,
          cachedAt: Date.now(),
          hasMore: hasMoreHistoryRef.current,
        });
      }

      setCurrentSymbol(sym);
      setIntervalState(tf);
      saveLastChartState({ symbol: sym, interval: tf });
      setSelectedDrawingId(null);
      setIsReplayMode(false);
      setIsReplayPlaying(false);
      isFetchingHistoryRef.current = false;
      setLoadingText(null);

      const cacheKey = `${sym}_${tf}`;
      const cached = chartCacheRef.current.get(cacheKey);
      const cacheAgeMs = cached ? Date.now() - cached.cachedAt : Infinity;

      if (cached && cached.candles.length > 0) {
        // 0ms INSTANT SWITCH!
        isChartLoadingRef.current = false;
        loadedChartRef.current = { sym, tf };
        hasMoreHistoryRef.current = cached.hasMore;
        setChartDataMeta({ sym, tf });
        setCandles(cached.candles);
        setVolumes(cached.volumes);
        setCandleCloseMs(cached.closeMs);
        lastChartTickMsRef.current = Date.now();
        prevPriceMapRef.current[sym] = cached.candles[cached.candles.length - 1].close;

        // Immediately connect live WebSocket for real-time ticks
        connectKlineSocket(sym, tf, myGen);
        scheduleSiblingWarmup(sym, tf, myGen);

        // If cache is still reasonably fresh (< 5 min), only fetch the latest 5 bars (~400 bytes!) to catch up
        if (cacheAgeMs < 300_000) {
          fetchBinance<unknown[][]>(`/klines?symbol=${sym}&interval=${tf}&limit=5`, { fresh: true })
            .then((rawRecent) => {
              if (myGen !== loadGenRef.current || !Array.isArray(rawRecent) || !rawRecent.length) {
                return;
              }
              const parsed = parseKlines(rawRecent);
              lastChartTickMsRef.current = Date.now();
              applyKlineBars(
                sym,
                tf,
                parsed.candles,
                parsed.volumes,
                Number(rawRecent[rawRecent.length - 1][6])
              );
            })
            .catch(() => {});

          if (cached.candles.length < 500 && cached.hasMore) {
            window.setTimeout(() => prependOlderCandles(myGen), 180);
          }
          return;
        }
      } else {
        // Block any live price ticks from mutating the previous coin's candles while fetching!
        isChartLoadingRef.current = true;
        hasMoreHistoryRef.current = true;
      }

      try {
        const entry = await fetchChartBatch(sym, tf);
        if (myGen !== loadGenRef.current) return;
        if (!entry || entry.candles.length === 0) throw new Error('Empty klines');

        loadedChartRef.current = { sym, tf };
        isChartLoadingRef.current = false;
        hasMoreHistoryRef.current = entry.hasMore;

        setChartDataMeta({ sym, tf });
        setCandles(entry.candles);
        setVolumes(entry.volumes);
        setCandleCloseMs(entry.closeMs);
        lastChartTickMsRef.current = Date.now();
        setLoadingText(null);

        const lastClose = entry.candles[entry.candles.length - 1].close;
        prevPriceMapRef.current[sym] = lastClose;

        connectKlineSocket(sym, tf, myGen);
        scheduleSiblingWarmup(sym, tf, myGen);

        // Silently backfill older 1000 historical candles after the initial fast chart is already visible
        if (entry.hasMore) {
          window.setTimeout(() => prependOlderCandles(myGen), 140);
        }
      } catch (err) {
        if (myGen !== loadGenRef.current) return;
        isChartLoadingRef.current = false;
        setWsStatus('error');
        setLoadingText(
          `Failed to load ${sym} (${err instanceof Error ? err.message : 'API error'})`
        );
      }
    },
    [applyKlineBars, connectKlineSocket, fetchChartBatch, prependOlderCandles, scheduleSiblingWarmup]
  );

  // Boot initial chart + gently pre-warm top 5 watchlist coins in background
  useEffect(() => {
    loadSymbolChart(initialChart.symbol, initialChart.interval);
    const topWarmTimers: number[] = [];
    const topSyms = watchlist
      .slice(0, 6)
      .map((w) => w.sym)
      .filter((s) => s !== initialChart.symbol);
    topSyms.forEach((sym, idx) => {
      topWarmTimers.push(
        window.setTimeout(() => {
          prefetchChart(sym, intervalRef.current);
        }, 950 + idx * 220)
      );
    });
    return () => {
      topWarmTimers.forEach((t) => window.clearTimeout(t));
      warmTimersRef.current.forEach((t) => window.clearTimeout(t));
      if (klineWsRef.current) {
        klineWsRef.current.close();
      }
      if (tradeFlushTimerRef.current !== null) {
        window.clearTimeout(tradeFlushTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watchlist batch ticker REST + Combined Live WebSocket across all watchlists
  const allWatchlistSymbols = useMemo(() => {
    const set = new Set<string>();
    watchlists.forEach((wl) => {
      wl.items.forEach((it) => {
        if (!it.isSection) set.add(it.sym);
      });
    });
    set.add(currentSymbol);
    return Array.from(set);
  }, [watchlists, currentSymbol]);

  const watchlistSymbolsKey = useMemo(() => allWatchlistSymbols.join(','), [allWatchlistSymbols]);

  const fetchWatchlistTickers = useCallback(async () => {
    const syms = watchlistSymbolsKey.split(',').filter(Boolean);
    if (!syms.length || tickerPollBusyRef.current) return;
    tickerPollBusyRef.current = true;
    try {
      const param = encodeURIComponent(JSON.stringify(syms));
      const data = await fetchBinance<RawTicker24h[]>(`/ticker/24hr?symbols=${param}`, {
        fresh: true,
      });
      if (Array.isArray(data)) {
        lastWatchlistTickMsRef.current = Date.now();
        setTickerMap((prev) => {
          const next = { ...prev };
          data.forEach((t) => {
            const last = parseFloat(t.lastPrice);
            const old = prev[t.symbol];
            next[t.symbol] = {
              symbol: t.symbol,
              last,
              chg: parseFloat(t.priceChange),
              pct: parseFloat(t.priceChangePercent),
              high: parseFloat(t.highPrice),
              low: parseFloat(t.lowPrice),
              vol: parseFloat(t.quoteVolume),
              baseVol: parseFloat(t.volume),
              prevLast: old && old.last !== last ? old.last : old?.prevLast,
            };
          });
          return next;
        });
      }
    } catch {
      // ignore transient network blip
    } finally {
      tickerPollBusyRef.current = false;
    }
  }, [watchlistSymbolsKey]);

  useEffect(() => {
    fetchWatchlistTickers();

    if (tickerWsRef.current) {
      tickerWsRef.current.close();
      tickerWsRef.current = null;
    }
    const syms = watchlistSymbolsKey.split(',').filter(Boolean);
    if (!syms.length) return;

    const streams = syms.map((s) => `${s.toLowerCase()}@ticker`).join('/');
    const sock = createBinanceSocket(`/stream?streams=${streams}`, {
      onMessage: (raw) => {
        try {
          const payload = JSON.parse(raw);
          const d = payload.data;
          if (!d || !d.s) return;
          const last = parseFloat(d.c);
          if (!Number.isFinite(last)) return;
          lastWatchlistTickMsRef.current = Date.now();

          setTickerMap((prev) => {
            const old = prev[d.s];
            return {
              ...prev,
              [d.s]: {
                symbol: d.s,
                last,
                chg: parseFloat(d.p),
                pct: parseFloat(d.P),
                high: parseFloat(d.h),
                low: parseFloat(d.l),
                vol: parseFloat(d.q),
                baseVol: parseFloat(d.v),
                prevLast: old && old.last !== last ? old.last : old?.prevLast,
              },
            };
          });

          if (d.s !== currentSymRef.current) {
            evaluatePriceTriggers(d.s, last);
          } else if (
            !isChartLoadingRef.current &&
            loadedChartRef.current?.sym === d.s &&
            Date.now() - lastChartTickMsRef.current > 900
          ) {
            applyLiveTradePrice(d.s, last);
          }
        } catch {}
      },
    });
    tickerWsRef.current = sock;

    return () => {
      sock.close();
    };
  }, [watchlistSymbolsKey, fetchWatchlistTickers, evaluatePriceTriggers, applyLiveTradePrice]);

  // Guaranteed 1-second live REST heartbeat fallback (keeps candles & watchlist ticking every second even if WS stalls or is blocked)
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (document.hidden) return;
      const now = Date.now();

      // 1. Active chart live candle heartbeat if WS hasn't pushed in >1.6s or bar just rolled over
      const barRolledOver = candleCloseMsRef.current > 0 && now >= candleCloseMsRef.current + 350;
      if (
        !isChartLoadingRef.current &&
        loadedChartRef.current &&
        candlesRef.current.length > 0 &&
        !chartPollBusyRef.current &&
        (now - lastChartTickMsRef.current > 1600 || barRolledOver)
      ) {
        const sym = loadedChartRef.current.sym;
        const tf = loadedChartRef.current.tf;
        const gen = loadGenRef.current;
        chartPollBusyRef.current = true;
        try {
          const raw = await fetchBinance<unknown[][]>(
            `/klines?symbol=${sym}&interval=${tf}&limit=2`,
            { fresh: true }
          );
          if (gen === loadGenRef.current && Array.isArray(raw) && raw.length > 0) {
            const parsed = parseKlines(raw);
            lastChartTickMsRef.current = Date.now();
            setWsStatus('live');
            applyKlineBars(sym, tf, parsed.candles, parsed.volumes, Number(raw[raw.length - 1][6]));
          }
        } catch {
          // ignore transient poll error
        } finally {
          chartPollBusyRef.current = false;
        }
      }

      // 2. Watchlist live price heartbeat if ticker WS hasn't pushed in >2.0s
      if (now - lastWatchlistTickMsRef.current > 2000) {
        fetchWatchlistTickers();
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [applyKlineBars, fetchWatchlistTickers]);

  // Bar Replay auto-step timer
  useEffect(() => {
    if (!isReplayMode || !isReplayPlaying) return;
    const delayMs = replaySpeed === 5 ? 180 : replaySpeed === 2 ? 450 : 900;
    const id = setInterval(() => {
      setReplayIndex((idx) => {
        if (idx >= candlesRef.current.length) {
          setIsReplayPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, delayMs);
    return () => clearInterval(id);
  }, [isReplayMode, isReplayPlaying, replaySpeed]);

  // Drawings CRUD + Undo/Redo
  const currentDrawings = drawingsMap[currentSymbol] || [];
  const currentRedo = redoMap[currentSymbol] || [];

  const handleAddDrawing = useCallback(
    (drawing: DrawingObject) => {
      setDrawingsMap((prev) => ({
        ...prev,
        [currentSymbol]: [...(prev[currentSymbol] || []), drawing],
      }));
      setRedoMap((prev) => ({ ...prev, [currentSymbol]: [] }));
    },
    [currentSymbol]
  );

  const handleUpdateDrawing = useCallback(
    (id: string, updater: (d: DrawingObject) => DrawingObject) => {
      setDrawingsMap((prev) => ({
        ...prev,
        [currentSymbol]: (prev[currentSymbol] || []).map((d) => (d.id === id ? updater(d) : d)),
      }));
    },
    [currentSymbol]
  );

  const handleDeleteDrawing = useCallback(
    (id: string) => {
      setDrawingsMap((prev) => {
        const list = prev[currentSymbol] || [];
        const removed = list.find((d) => d.id === id);
        if (removed) {
          setRedoMap((r) => ({ ...r, [currentSymbol]: [...(r[currentSymbol] || []), removed] }));
        }
        return { ...prev, [currentSymbol]: list.filter((d) => d.id !== id) };
      });
      setSelectedDrawingId((cur) => (cur === id ? null : cur));
    },
    [currentSymbol]
  );

  const handleCloneDrawing = useCallback(
    (id: string) => {
      const list = drawingsMap[currentSymbol] || [];
      const orig = list.find((d) => d.id === id);
      if (!orig) return;
      const copy: DrawingObject = JSON.parse(JSON.stringify(orig));
      copy.id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const priceShift = (candlesRef.current[candlesRef.current.length - 1]?.close || 100) * 0.008;
      if (copy.price !== undefined) copy.price += priceShift;
      if (copy.p1) copy.p1.price += priceShift;
      if (copy.p2) copy.p2.price += priceShift;
      if (copy.p3) copy.p3.price += priceShift;
      if (copy.targetPrice !== undefined) copy.targetPrice += priceShift;
      if (copy.stopPrice !== undefined) copy.stopPrice += priceShift;
      if (copy.points) copy.points = copy.points.map((p) => ({ ...p, price: p.price + priceShift }));
      handleAddDrawing(copy);
      setSelectedDrawingId(copy.id);
    },
    [currentSymbol, drawingsMap, handleAddDrawing]
  );

  const handleClearDrawings = useCallback(() => {
    setDrawingsMap((prev) => ({ ...prev, [currentSymbol]: [] }));
    setRedoMap((prev) => ({ ...prev, [currentSymbol]: [] }));
    setSelectedDrawingId(null);
  }, [currentSymbol]);

  const handleUndo = useCallback(() => {
    setDrawingsMap((prev) => {
      const list = prev[currentSymbol] || [];
      if (!list.length) return prev;
      const popped = list[list.length - 1];
      setRedoMap((r) => ({ ...r, [currentSymbol]: [...(r[currentSymbol] || []), popped] }));
      return { ...prev, [currentSymbol]: list.slice(0, -1) };
    });
    setSelectedDrawingId(null);
  }, [currentSymbol]);

  const handleRedo = useCallback(() => {
    setRedoMap((prev) => {
      const list = prev[currentSymbol] || [];
      if (!list.length) return prev;
      const popped = list[list.length - 1];
      setDrawingsMap((d) => ({ ...d, [currentSymbol]: [...(d[currentSymbol] || []), popped] }));
      return { ...prev, [currentSymbol]: list.slice(0, -1) };
    });
  }, [currentSymbol]);

  const handleToggleFavoriteTool = useCallback((tool: DrawingTool) => {
    setFavoriteTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }, []);

  const handleSaveTemplate = useCallback(
    (tpl: DrawingTemplate) => {
      setDrawingTemplates((prev) => [tpl, ...prev.filter((x) => x.name !== tpl.name)]);
      pushToast('Template Saved', `"${tpl.name}" added to drawing templates.`, 'success');
    },
    [pushToast]
  );

  const handleDeleteTemplate = useCallback((id: string) => {
    setDrawingTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleReorderDrawing = useCallback(
    (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => {
      setDrawingsMap((prev) => {
        const list = prev[currentSymbol] || [];
        const idx = list.findIndex((d) => d.id === id);
        if (idx === -1) return prev;
        const target = list[idx];
        if (dir === 'front') {
          const rest = list.filter((d) => d.id !== id);
          return { ...prev, [currentSymbol]: [...rest, { ...target, zOrder: 'front' as const }] };
        }
        if (dir === 'back') {
          const rest = list.filter((d) => d.id !== id);
          return { ...prev, [currentSymbol]: [{ ...target, zOrder: 'back' as const }, ...rest] };
        }
        const next = [...list];
        if (dir === 'forward' && idx < next.length - 1) {
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        } else if (dir === 'backward' && idx > 0) {
          [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        }
        return { ...prev, [currentSymbol]: next };
      });
    },
    [currentSymbol]
  );

  const handleOpenDrawingSettings = useCallback((id: string, tab: SettingsTab = 'style') => {
    setSettingsInitialTab(tab);
    setSettingsDrawingId(id);
  }, []);

  const handleAddAlertFromDrawing = useCallback((d: DrawingObject) => {
    const fallbackPrice = candlesRef.current[candlesRef.current.length - 1]?.close || 0;
    const targetPrice = d.price ?? d.p2?.price ?? d.p1?.price ?? fallbackPrice;
    const label = d.title || ALL_TOOLS_MAP[d.type]?.label || 'Drawing';
    setAlertPrefill({ price: targetPrice, note: `${label} level` });
    setAlertModalOpen(true);
  }, []);

  const handleSnapshotAction = useCallback(
    async (action: SnapshotAction) => {
      const copyTextFallback = async (text: string): Promise<boolean> => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {
          // fallback below
        }
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return ok;
        } catch {
          return false;
        }
      };

      if (action === 'copy_link') {
        const url = new URL(window.location.href);
        url.searchParams.set('symbol', currentSymbol);
        url.searchParams.set('interval', interval);
        const ok = await copyTextFallback(url.toString());
        if (ok) {
          pushToast(
            'Link Copied',
            `${currentSymbol} (${interval.toUpperCase()}) chart link copied to clipboard.`,
            'success'
          );
        } else {
          pushToast('Copy Failed', 'Could not access clipboard in this browser.', 'warning');
        }
        return;
      }

      const snap = await chartWorkspaceRef.current?.captureSnapshot();
      if (!snap) {
        pushToast('Snapshot Failed', 'Chart is not ready yet. Please try again.', 'warning');
        return;
      }

      if (action === 'download') {
        const a = document.createElement('a');
        a.href = snap.dataUrl;
        a.download = snap.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        pushToast('Image Downloaded', `Saved ${snap.filename}`, 'success');
        return;
      }

      if (action === 'copy') {
        try {
          if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': snap.blob })]);
            pushToast('Image Copied', 'Chart snapshot copied to clipboard.', 'success');
            return;
          }
        } catch {
          // Graceful fallback if clipboard image write is restricted
        }
        const a = document.createElement('a');
        a.href = snap.dataUrl;
        a.download = snap.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        pushToast(
          'Image Downloaded',
          'Clipboard image copy is restricted here — saved PNG instead.',
          'info'
        );
        return;
      }

      if (action === 'open_tab') {
        const objUrl = URL.createObjectURL(snap.blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
        pushToast('Opened in New Tab', `Opened ${snap.filename}`, 'info');
        return;
      }

      if (action === 'post_x') {
        try {
          if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': snap.blob })]);
          }
        } catch {
          // ignore if blocked
        }
        const baseAsset = currentSymbol.replace(/USDT$|BUSD$|USD$/, '');
        const tweetText = encodeURIComponent(
          `$${baseAsset} (${currentSymbol} · ${interval.toUpperCase()}) chart snapshot`
        );
        const intentUrl = `https://x.com/intent/tweet?text=${tweetText}`;
        const a = document.createElement('a');
        a.href = intentUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        pushToast(
          'Ready to Post on X',
          'Chart snapshot copied — paste (Ctrl+V) directly into your post.',
          'success'
        );
      }
    },
    [currentSymbol, interval, pushToast]
  );

  // TradingView Keyboard Shortcuts: Alt+T/H/J/V/C/S, Ctrl+Alt+S, Ctrl+Shift+S, Del/Backspace, Ctrl+K, Ctrl+Z/Y, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setIndicatorsOpen(false);
        setIndSettingsTarget(null);
        setAlertModalOpen(false);
        setChartSettingsOpen(false);
        setSettingsDrawingId(null);
        setSelectedDrawingId(null);
        setActiveTool('cursor');
        return;
      }
      if (isInput) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 't') {
          e.preventDefault();
          setActiveTool('trendline');
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          setActiveTool('hline');
          return;
        }
        if (k === 'j') {
          e.preventDefault();
          setActiveTool('hray');
          return;
        }
        if (k === 'v') {
          e.preventDefault();
          setActiveTool('vline');
          return;
        }
        if (k === 'f') {
          e.preventDefault();
          setActiveTool('fib');
          return;
        }
        if (k === 'c') {
          e.preventDefault();
          setActiveTool('crossline');
          return;
        }
        if (k === 'i') {
          e.preventDefault();
          setChartSettings((prev) => ({
            ...prev,
            scales: { ...prev.scales, invertScale: !prev.scales.invertScale },
          }));
          return;
        }
        if (k === 'p') {
          e.preventDefault();
          chartWorkspaceRef.current?.setScaleMode('pct');
          return;
        }
        if (k === 'l') {
          e.preventDefault();
          chartWorkspaceRef.current?.setScaleMode('log');
          return;
        }
        if (k === 'a') {
          e.preventDefault();
          setAlertPrefill(null);
          setAlertModalOpen(true);
          return;
        }
        if (k === 's') {
          e.preventDefault();
          void handleSnapshotAction('copy_link');
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSnapshotAction('download');
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSnapshotAction('copy');
        return;
      }

      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setRightVisible(true);
        setRightTab('watchlist');
        setOpenListModalTrigger((n) => n + 1);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId && !lockDrawings) {
        const target = currentDrawings.find((d) => d.id === selectedDrawingId);
        if (target?.locked) return;
        e.preventDefault();
        handleDeleteDrawing(selectedDrawingId);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDeleteDrawing,
    handleSnapshotAction,
    selectedDrawingId,
    lockDrawings,
    currentDrawings,
  ]);

  const handleUpdateWatchlistItems = useCallback(
    (listId: string, updater: (items: WatchlistItem[]) => WatchlistItem[]) => {
      setWatchlists((prev) => {
        const next = prev.map((wl) => (wl.id === listId ? { ...wl, items: updater(wl.items) } : wl));
        saveWatchlistCollections(next);
        return next;
      });
    },
    []
  );

  const handleCreateWatchlist = useCallback(
    (name: string, initialItems: WatchlistItem[] = []) => {
      const id = `wl-${Date.now()}`;
      setWatchlists((prev) => [
        ...prev,
        { id, name, color: '#2962ff', shared: false, items: initialItems },
      ]);
      setActiveListId(id);
      pushToast('Watchlist Created', `"${name}" is now active.`, 'success');
    },
    [pushToast]
  );

  const handleRenameWatchlist = useCallback((id: string, name: string) => {
    setWatchlists((prev) => prev.map((wl) => (wl.id === id ? { ...wl, name } : wl)));
  }, []);

  const handleDuplicateWatchlist = useCallback(
    (id: string) => {
      const orig = watchlists.find((wl) => wl.id === id);
      if (!orig) return;
      const copyId = `wl-${Date.now()}`;
      const copyName = `${orig.name} (Copy)`;
      setWatchlists((prev) => [
        ...prev,
        {
          ...orig,
          id: copyId,
          name: copyName,
          items: orig.items.map((x) => ({ ...x })),
        },
      ]);
      setActiveListId(copyId);
      pushToast('Watchlist Copied', `Created "${copyName}".`, 'success');
    },
    [watchlists, pushToast]
  );

  const handleDeleteWatchlist = useCallback(
    (id: string) => {
      setWatchlists((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((wl) => wl.id !== id);
        if (activeListId === id && next.length > 0) {
          setActiveListId(next[0].id);
        }
        return next;
      });
    },
    [activeListId]
  );

  const handleToggleShareWatchlist = useCallback((id: string) => {
    setWatchlists((prev) =>
      prev.map((wl) => (wl.id === id ? { ...wl, shared: !wl.shared } : wl))
    );
  }, []);

  const handleToggleWatchlist = useCallback(
    (sym: string) => {
      const targetId = activeWatchlist?.id || 'main';
      handleUpdateWatchlistItems(targetId, (prev) => {
        if (prev.some((w) => !w.isSection && w.sym === sym)) {
          return prev.filter((w) => w.isSection || w.sym !== sym);
        }
        return [
          {
            sym,
            name: `${sym.replace('USDT', '')} / TetherUS`,
            color: '#2962ff',
            letter: sym[0] || 'C',
            flagColor: '#f23645',
          },
          ...prev,
        ];
      });
    },
    [activeWatchlist?.id, handleUpdateWatchlistItems]
  );

  const handleToggleCurrentSymbolFlag = useCallback(() => {
    const targetId = activeWatchlist?.id || 'main';
    handleUpdateWatchlistItems(targetId, (prev) =>
      prev.map((item) => {
        if (item.isSection || item.sym !== currentSymbol) return item;
        const idx = FLAG_COLORS.indexOf((item.flagColor || '') as (typeof FLAG_COLORS)[number]);
        const nextColor = FLAG_COLORS[(idx + 1) % FLAG_COLORS.length];
        return { ...item, flagColor: nextColor };
      })
    );
  }, [activeWatchlist?.id, currentSymbol, handleUpdateWatchlistItems]);

  const handleSelectFromSearch = (sym: string) => {
    if (!watchlist.some((w) => w.sym === sym)) {
      handleToggleWatchlist(sym);
    }
    loadSymbolChart(sym, interval);
  };

  const handleCreateAlert = (
    price: number,
    condition: 'above' | 'below' | 'crossing',
    note: string
  ) => {
    const newAlert: PriceAlert = {
      id: `al-${Date.now()}`,
      symbol: currentSymbol,
      price,
      condition,
      note,
      active: true,
      createdAt: Date.now(),
    };
    setAlerts((prev) => [newAlert, ...prev]);
    pushToast(
      `Alert Created: ${currentSymbol}`,
      `${condition === 'above' ? 'Crossing Up' : condition === 'below' ? 'Crossing Down' : 'Crossing'} $${fmtPrice(price)}`,
      'info'
    );
  };

  const handlePlacePaperOrder = (params: {
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    qty: number;
    limitPrice?: number;
    takeProfit?: number;
    stopLoss?: number;
  }) => {
    const lastPrice = candles[candles.length - 1]?.close || tickerMap[currentSymbol]?.last || 0;
    if (!lastPrice) return;

    if (params.orderType === 'LIMIT' && params.limitPrice) {
      setPaperAccount((prev) => ({
        ...prev,
        limitOrders: [
          {
            id: `ord-${Date.now()}`,
            symbol: currentSymbol,
            side: params.side,
            qty: params.qty,
            limitPrice: params.limitPrice!,
            takeProfit: params.takeProfit,
            stopLoss: params.stopLoss,
            createdAt: Date.now(),
          },
          ...prev.limitOrders,
        ],
      }));
      pushToast(
        `Limit Order Placed: ${params.side} ${params.qty} ${currentSymbol}`,
        `Target @ $${fmtPrice(params.limitPrice)}`,
        'info'
      );
      return;
    }

    setPaperAccount((prev) => ({
      ...prev,
      positions: [
        {
          id: `pos-${Date.now()}`,
          symbol: currentSymbol,
          side: params.side,
          qty: params.qty,
          entryPrice: lastPrice,
          takeProfit: params.takeProfit,
          stopLoss: params.stopLoss,
          openedAt: Date.now(),
        },
        ...prev.positions,
      ],
    }));
    const tradeCfg = chartSettingsRef.current.trading;
    if (tradeCfg.executionSound) {
      playAlertChime(tradeCfg.executionSoundVolume / 100);
    }
    if (!tradeCfg.onlyRejectionNotifications) {
      pushToast(
        `Position Opened: ${params.side === 'BUY' ? 'LONG' : 'SHORT'} ${params.qty} ${currentSymbol}`,
        `Entry @ $${fmtPrice(lastPrice)}`,
        'success'
      );
    }
  };

  const handleQuickOrder = (side: 'BUY' | 'SELL') => {
    if (!chartSettings.trading.oneClickTrading) {
      setIsTradeOpen(true);
      return;
    }
    const lastPrice = candles[candles.length - 1]?.close || tickerMap[currentSymbol]?.last || 0;
    if (!lastPrice) return;
    const rawQty = 1000 / lastPrice;
    const qty = rawQty >= 10 ? Math.round(rawQty) : parseFloat(rawQty.toFixed(4));
    handlePlacePaperOrder({ side, orderType: 'MARKET', qty: Math.max(qty, 0.0001) });
  };

  const handleQuickLimitOrder = (side: 'BUY' | 'SELL', limitPrice: number) => {
    if (!limitPrice || limitPrice <= 0) return;
    const rawQty = 1000 / limitPrice;
    const qty = rawQty >= 10 ? Math.round(rawQty) : parseFloat(rawQty.toFixed(4));
    handlePlacePaperOrder({
      side,
      orderType: 'LIMIT',
      qty: Math.max(qty, 0.0001),
      limitPrice,
    });
  };

  const handleOpenAlertAtPrice = useCallback((price: number) => {
    setAlertPrefill({ price, note: '' });
    setAlertModalOpen(true);
  }, []);

  const handleOpenChartSettings = useCallback((tab: ChartSettingsTab = 'symbol') => {
    setChartSettingsTab(tab);
    setChartSettingsOpen(true);
  }, []);

  const handleSaveChartTemplate = useCallback(
    (tpl: ChartSettingsTemplate) => {
      setChartTemplates((prev) => [tpl, ...prev.filter((x) => x.name !== tpl.name)]);
      pushToast('Chart Template Saved', `"${tpl.name}" saved to settings templates.`, 'success');
    },
    [pushToast]
  );

  const handleDeleteChartTemplate = useCallback((id: string) => {
    setChartTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClosePosition = (id: string) => {
    setPaperAccount((prev) => {
      const pos = prev.positions.find((p) => p.id === id);
      if (!pos) return prev;
      const exitPrice =
        tickerMap[pos.symbol]?.last ||
        (pos.symbol === currentSymbol ? candles[candles.length - 1]?.close : pos.entryPrice) ||
        pos.entryPrice;
      const pnl =
        (pos.side === 'BUY' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) * pos.qty;
      pushToast(
        `Position Closed: ${pos.symbol}`,
        `P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        pnl >= 0 ? 'success' : 'danger'
      );
      return {
        ...prev,
        balance: prev.balance + pnl,
        realizedPnl: prev.realizedPnl + pnl,
        positions: prev.positions.filter((p) => p.id !== id),
        history: [
          {
            id: `hist-${Date.now()}`,
            symbol: pos.symbol,
            side: pos.side,
            qty: pos.qty,
            entryPrice: pos.entryPrice,
            exitPrice,
            pnl,
            reason: 'Manual' as const,
            closedAt: Date.now(),
          },
          ...prev.history,
        ].slice(0, 100),
      };
    });
  };

  const handleToggleReplay = () => {
    if (isReplayMode) {
      setIsReplayMode(false);
      setIsReplayPlaying(false);
    } else {
      if (candles.length < 30) return;
      setReplayIndex(Math.max(25, candles.length - 60));
      setIsReplayMode(true);
      setIsReplayPlaying(false);
      pushToast('Bar Replay Active', 'Use Play, +1 step, or the scrubber to test setups.', 'info');
    }
  };

  const symbolMeta = watchlist.find((w) => w.sym === currentSymbol) || {
    sym: currentSymbol,
    name: `${currentSymbol.replace('USDT', '')} / TetherUS`,
    color: '#2962ff',
    letter: currentSymbol[0] || 'C',
  };

  const currentPrice =
    (chartDataMeta.sym === currentSymbol ? candles[candles.length - 1]?.close : undefined) ||
    tickerMap[currentSymbol]?.last ||
    0;

  // Live browser tab title synced with active symbol & real-time price
  useEffect(() => {
    if (currentPrice > 0) {
      document.title = `${currentSymbol} ${fmtPrice(currentPrice)} · TradePulse`;
    }
  }, [currentSymbol, currentPrice]);

  const avgVolume30d = useMemo(() => {
    if (!volumes.length) return 0;
    const slice = volumes.slice(-30);
    return slice.reduce((acc, v) => acc + v.value, 0) / slice.length;
  }, [volumes]);

  const activeIndicatorCount = [
    indicators.smaEma.enabled,
    indicators.bb.enabled,
    indicators.volume.enabled,
    indicators.rsi.enabled,
  ].filter(Boolean).length;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col gap-[3px] bg-[var(--bg-gutter)] text-[var(--text-main)]">
      {/* Top Toolbar */}
      <TopBar
        currentSymbol={currentSymbol}
        symbolMeta={symbolMeta}
        interval={interval}
        onIntervalChange={(tf) => loadSymbolChart(currentSymbol, tf)}
        onPrefetchInterval={(tf) => prefetchChart(currentSymbol, tf)}
        chartType={chartType}
        onChartTypeChange={setChartType}
        activeIndicatorCount={activeIndicatorCount}
        onOpenIndicators={() => setIndicatorsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAlertModal={() => {
          setAlertPrefill(null);
          setAlertModalOpen(true);
        }}
        isReplayMode={isReplayMode}
        onToggleReplay={handleToggleReplay}
        canUndo={currentDrawings.length > 0}
        canRedo={currentRedo.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        barCount={candles.length}
        onSnapshot={(action) => void handleSnapshotAction(action)}
        onToggleRightPanel={() => setRightVisible((v) => !v)}
        onSaveWorkspace={() => {
          saveWatchlistCollections(watchlists);
          saveChartSettings(chartSettings);
          saveIndicators(indicators);
          saveAllDrawings(drawingsMap);
          pushToast('Workspace Saved', 'Chart layout, drawings, and watchlists saved.', 'success');
        }}
        isTradeOpen={isTradeOpen}
        openPositionsCount={paperAccount.positions.length}
        onToggleTrade={() => setIsTradeOpen((v) => !v)}
        onOpenSettings={() => handleOpenChartSettings('symbol')}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((d) => !d)}
      />

      {/* Main Workspace Row (Compact 3px TradingView Gutters + Crisp Panels) */}
      <div className="flex-1 flex gap-[3px] min-h-0">
        {/* Left Drawing Toolbox (TradingView Style with Flyout Menus) */}
        <LeftToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          favoriteTools={favoriteTools}
          onToggleFavoriteTool={handleToggleFavoriteTool}
          magnetMode={magnetMode}
          onChangeMagnetMode={setMagnetMode}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          lockDrawings={lockDrawings}
          onToggleLockDrawings={() => {
            setLockDrawings((v) => !v);
            setSelectedDrawingId(null);
          }}
          drawingsHidden={drawingsHidden}
          onToggleHideDrawings={() => {
            setDrawingsHidden((h) => {
              const nextHidden = !h;
              if (!nextHidden) {
                setDrawingsMap((prev) => ({
                  ...prev,
                  [currentSymbol]: (prev[currentSymbol] || []).map((d) =>
                    d.hidden ? { ...d, hidden: false } : d
                  ),
                }));
              }
              return nextHidden;
            });
          }}
          drawingsCount={currentDrawings.length}
          selectedDrawingId={selectedDrawingId}
          onDeleteSelectedDrawing={() => {
            if (!selectedDrawingId) return;
            const target = currentDrawings.find((d) => d.id === selectedDrawingId);
            if (target?.locked) return;
            handleDeleteDrawing(selectedDrawingId);
          }}
          onClearDrawings={handleClearDrawings}
          onZoomOut={() => chartWorkspaceRef.current?.zoomOut()}
          onOpenIndicators={() => setIndicatorsOpen(true)}
        />

        {/* Center Chart + Bottom Paper Trade Drawer */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 rounded-[4px] overflow-hidden bg-[var(--bg-app)]">
          <ChartWorkspace
            ref={chartWorkspaceRef}
            symbol={chartDataMeta.sym}
            symbolMeta={
              watchlist.find((w) => w.sym === chartDataMeta.sym) || {
                sym: chartDataMeta.sym,
                name: `${chartDataMeta.sym.replace('USDT', '')} / TetherUS`,
                color: '#2962ff',
                letter: chartDataMeta.sym[0] || 'C',
              }
            }
            tickerData={tickerMap[chartDataMeta.sym]}
            interval={chartDataMeta.tf}
            chartType={chartType}
            isDarkMode={isDarkMode}
            chartSettings={chartSettings}
            onUpdateChartSettings={setChartSettings}
            onOpenChartSettings={handleOpenChartSettings}
            onQuickOrder={handleQuickOrder}
            onQuickLimitOrder={handleQuickLimitOrder}
            onOpenAlertAtPrice={handleOpenAlertAtPrice}
            onToggleSymbolFlag={handleToggleCurrentSymbolFlag}
            onUpdateIndicators={setIndicators}
            onOpenIndicators={() => setIndicatorsOpen(true)}
            onOpenIndicatorSettings={(target) => setIndSettingsTarget(target)}
            candles={candles}
            volumes={volumes}
            candleCloseMs={candleCloseMs}
            loadingText={loadingText}
            wsStatus={wsStatus}
            indicators={indicators}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            favoriteTools={favoriteTools}
            drawColor={drawColor}
            onSelectDrawColor={setDrawColor}
            magnetMode={magnetMode}
            stayInDrawingMode={stayInDrawingMode}
            lockDrawings={lockDrawings}
            drawingsHidden={drawingsHidden}
            drawings={currentDrawings}
            templates={drawingTemplates}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawingId={setSelectedDrawingId}
            onAddDrawing={handleAddDrawing}
            onUpdateDrawing={handleUpdateDrawing}
            onDeleteDrawing={handleDeleteDrawing}
            onCloneDrawing={handleCloneDrawing}
            onOpenDrawingSettings={handleOpenDrawingSettings}
            onAddAlertFromDrawing={handleAddAlertFromDrawing}
            onReorderDrawing={handleReorderDrawing}
            onRequestOlderHistory={() => prependOlderCandles()}
            alerts={alerts}
            onDeleteAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
            onUpdateAlertPrice={(id, newPrice) =>
              setAlerts((prev) =>
                prev.map((a) =>
                  a.id === id ? { ...a, price: newPrice, active: true, triggeredAt: undefined } : a
                )
              )
            }
            positions={paperAccount.positions}
            limitOrders={paperAccount.limitOrders}
            isReplayMode={isReplayMode}
            replayIndex={replayIndex}
            isReplayPlaying={isReplayPlaying}
            replaySpeed={replaySpeed}
            onReplayIndexChange={(idx) => setReplayIndex(idx)}
            onToggleReplayPlay={() => setIsReplayPlaying((p) => !p)}
            onReplayStep={() => setReplayIndex((idx) => Math.min(candles.length, idx + 1))}
            onReplaySpeedChange={setReplaySpeed}
            onExitReplay={() => {
              setIsReplayMode(false);
              setIsReplayPlaying(false);
            }}
          />

          <TradeDrawer
            open={isTradeOpen}
            onClose={() => setIsTradeOpen(false)}
            currentSymbol={currentSymbol}
            currentPrice={currentPrice}
            tickerMap={tickerMap}
            account={paperAccount}
            onPlaceOrder={handlePlacePaperOrder}
            onClosePosition={handleClosePosition}
            onCancelLimitOrder={(id) =>
              setPaperAccount((prev) => ({
                ...prev,
                limitOrders: prev.limitOrders.filter((o) => o.id !== id),
              }))
            }
            onResetAccount={() => {
              setPaperAccount(DEFAULT_PAPER_ACCOUNT);
              pushToast('Paper Account Reset', 'Virtual balance restored to $100,000.00', 'info');
            }}
          />
        </main>

        {/* Right Watchlist / Order Book / Alerts Sidebar + Rail */}
        <RightSidebar
          visible={rightVisible}
          activeTab={rightTab}
          onSelectTab={setRightTab}
          onToggleVisible={() => setRightVisible((v) => !v)}
          onToggleTrade={() => setIsTradeOpen((v) => !v)}
          onOpenIndicators={() => setIndicatorsOpen(true)}
          onOpenSettings={(tab) => handleOpenChartSettings(tab || 'symbol')}
          watchlists={watchlists}
          activeListId={activeWatchlist?.id || 'main'}
          onSelectWatchlist={setActiveListId}
          onUpdateWatchlistItems={handleUpdateWatchlistItems}
          onCreateWatchlist={handleCreateWatchlist}
          onRenameWatchlist={handleRenameWatchlist}
          onDuplicateWatchlist={handleDuplicateWatchlist}
          onDeleteWatchlist={handleDeleteWatchlist}
          onToggleShareWatchlist={handleToggleShareWatchlist}
          watchlistPrefs={watchlistPrefs}
          onUpdateWatchlistPrefs={setWatchlistPrefs}
          openListModalTrigger={openListModalTrigger}
          tickerMap={tickerMap}
          candles={candles}
          avgVolume30d={avgVolume30d}
          currentSymbol={currentSymbol}
          onSelectSymbol={(sym) => loadSymbolChart(sym, interval)}
          onPrefetchSymbol={(sym) => prefetchChart(sym, interval)}
          onRemoveSymbol={handleToggleWatchlist}
          onOpenSearch={() => setSearchOpen(true)}
          alerts={alerts}
          onOpenAlertModal={() => {
            setAlertPrefill(null);
            setAlertModalOpen(true);
          }}
          onToggleAlert={(id) =>
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === id ? { ...a, active: !a.active, triggeredAt: undefined } : a
              )
            )
          }
          onDeleteAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
          symbolNotes={symbolNotes}
          onSaveSymbolNote={(sym, text) =>
            setSymbolNotes((prev) => ({ ...prev, [sym]: text }))
          }
          onToast={pushToast}
        />
      </div>

      {/* Modals */}
      <SymbolSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        watchlist={watchlist}
        tickerMap={tickerMap}
        onSelectSymbol={handleSelectFromSearch}
        onToggleWatchlist={handleToggleWatchlist}
      />

      <IndicatorsModal
        open={indicatorsOpen}
        onClose={() => setIndicatorsOpen(false)}
        config={indicators}
        onChange={setIndicators}
        onOpenIndicatorSettings={(target) => {
          setIndicatorsOpen(false);
          setIndSettingsTarget(target);
        }}
      />

      <IndicatorSettingsModal
        open={Boolean(indSettingsTarget)}
        target={indSettingsTarget}
        config={indicators}
        onLiveChange={setIndicators}
        onClose={() => setIndSettingsTarget(null)}
      />

      <CreateAlertModal
        open={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false);
          setAlertPrefill(null);
        }}
        symbol={currentSymbol}
        lastPrice={currentPrice}
        defaultPrice={alertPrefill?.price}
        defaultNote={alertPrefill?.note}
        onCreateAlert={handleCreateAlert}
      />

      <DrawingSettingsModal
        open={Boolean(settingsDrawingId)}
        drawing={currentDrawings.find((d) => d.id === settingsDrawingId) || null}
        candles={candles}
        interval={interval}
        templates={drawingTemplates}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsDrawingId(null)}
        onLiveUpdate={(updated) => handleUpdateDrawing(updated.id, () => updated)}
        onSaveTemplate={handleSaveTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <ChartSettingsModal
        open={chartSettingsOpen}
        initialTab={chartSettingsTab}
        settings={chartSettings}
        isDarkMode={isDarkMode}
        templates={chartTemplates}
        onClose={() => setChartSettingsOpen(false)}
        onLiveChange={setChartSettings}
        onSaveTemplate={handleSaveChartTemplate}
        onDeleteTemplate={handleDeleteChartTemplate}
      />

      {/* Non-blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-14 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-md shadow-xl px-3 py-2.5 flex items-start gap-2.5 text-xs"
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--up)] shrink-0 mt-0.5" />
              ) : t.tone === 'warning' ? (
                <Bell className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
              ) : t.tone === 'danger' ? (
                <AlertTriangle className="w-4 h-4 text-[var(--down)] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text-main)]">{t.title}</div>
                {t.detail && <div className="text-[var(--text-muted)] mt-0.5">{t.detail}</div>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
