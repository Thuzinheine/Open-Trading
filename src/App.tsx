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
import { fetchBinance, fmtPrice, parseKlines, playAlertChime, WS_BASE } from './utils/binance';
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
  savePaperAccount,
  saveSymbolNotes,
  saveTheme,
  saveToolPrefs,
  saveWatchlistCollections,
  saveWatchlistPrefs,
} from './utils/storage';
import { ALL_TOOLS_MAP } from './utils/drawingToolsCatalog';
import { TopBar } from './components/TopBar';
import { LeftToolbar } from './components/LeftToolbar';
import { ChartWorkspace, ChartWorkspaceHandle } from './components/ChartWorkspace';
import { RightSidebar } from './components/RightSidebar';
import { TradeDrawer } from './components/TradeDrawer';
import { CreateAlertModal, IndicatorsModal, SymbolSearchModal } from './components/Modals';
import { DrawingSettingsModal, SettingsTab } from './components/DrawingSettingsModal';
import { ChartSettingsModal } from './components/ChartSettingsModal';
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
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(
    initialToolPrefs.stayInDrawingMode
  );
  const [lockDrawings, setLockDrawings] = useState<boolean>(initialToolPrefs.lockDrawings);

  // Chart state
  const [currentSymbol, setCurrentSymbol] = useState<string>('BTCUSDT');
  const [interval, setIntervalState] = useState<Timeframe>('1d');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [volumes, setVolumes] = useState<VolumeBar[]>([]);
  const [candleCloseMs, setCandleCloseMs] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string | null>('Loading Binance data...');
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
  const isFetchingHistoryRef = useRef<boolean>(false);
  const hasMoreHistoryRef = useRef<boolean>(true);
  const klineWsRef = useRef<WebSocket | null>(null);
  const tickerWsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<CandleBar[]>([]);
  candlesRef.current = candles;
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

  // Connect live Kline WebSocket
  const connectKlineSocket = useCallback(
    (sym: string, tf: Timeframe, expectedGen: number) => {
      if (klineWsRef.current) {
        klineWsRef.current.onclose = null;
        klineWsRef.current.close();
      }
      setWsStatus('connecting');
      const ws = new WebSocket(`${WS_BASE}/ws/${sym.toLowerCase()}@kline_${tf}`);
      klineWsRef.current = ws;

      ws.onopen = () => {
        if (expectedGen !== loadGenRef.current) return;
        setWsStatus('live');
      };

      ws.onmessage = (evt) => {
        if (expectedGen !== loadGenRef.current) return;
        try {
          const msg = JSON.parse(evt.data);
          if (!msg.k || msg.s !== currentSymRef.current) return;
          const k = msg.k;
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
            color: bar.close >= bar.open ? 'rgba(8, 153, 129, 0.48)' : 'rgba(242, 54, 69, 0.48)',
          };

          setCandleCloseMs(k.T);
          evaluatePriceTriggers(sym, bar.close);

          if (isReplayRef.current) return;

          setCandles((prev) => {
            if (!prev.length) return [bar];
            const last = prev[prev.length - 1];
            if (tSec < last.time) return prev;
            if (last.time === tSec) {
              const next = prev.slice();
              next[next.length - 1] = bar;
              return next;
            }
            return [...prev, bar];
          });

          setVolumes((prev) => {
            if (!prev.length) return [volBar];
            const last = prev[prev.length - 1];
            if (tSec < last.time) return prev;
            if (last.time === tSec) {
              const next = prev.slice();
              next[next.length - 1] = volBar;
              return next;
            }
            return [...prev, volBar];
          });
        } catch {}
      };

      ws.onerror = () => {
        if (expectedGen === loadGenRef.current) setWsStatus('error');
      };

      ws.onclose = () => {
        if (expectedGen !== loadGenRef.current) return;
        setWsStatus('connecting');
        setTimeout(() => {
          if (expectedGen === loadGenRef.current) {
            connectKlineSocket(sym, tf, expectedGen);
          }
        }, 2500);
      };
    },
    [evaluatePriceTriggers]
  );

  // Load Symbol + Timeframe history
  const loadSymbolChart = useCallback(
    async (sym: string, tf: Timeframe) => {
      loadGenRef.current += 1;
      const myGen = loadGenRef.current;

      if (klineWsRef.current) {
        klineWsRef.current.onclose = null;
        klineWsRef.current.close();
        klineWsRef.current = null;
      }

      setCurrentSymbol(sym);
      setIntervalState(tf);
      setSelectedDrawingId(null);
      setIsReplayMode(false);
      setIsReplayPlaying(false);
      hasMoreHistoryRef.current = true;
      isFetchingHistoryRef.current = false;
      setLoadingText(`Loading ${sym} (${tf.toUpperCase()})...`);

      try {
        const raw = await fetchBinance<unknown[][]>(
          `/klines?symbol=${sym}&interval=${tf}&limit=1000`
        );
        if (myGen !== loadGenRef.current) return;
        if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty klines');

        const parsed = parseKlines(raw);
        setCandles(parsed.candles);
        setVolumes(parsed.volumes);
        setCandleCloseMs(Number(raw[raw.length - 1][6]));
        setLoadingText(null);

        const lastClose = parsed.candles[parsed.candles.length - 1].close;
        prevPriceMapRef.current[sym] = lastClose;

        connectKlineSocket(sym, tf, myGen);

        if (raw.length === 1000) {
          setTimeout(() => prependOlderCandles(myGen), 120);
        } else {
          hasMoreHistoryRef.current = false;
        }
      } catch (err) {
        if (myGen !== loadGenRef.current) return;
        setWsStatus('error');
        setLoadingText(
          `Failed to load ${sym} (${err instanceof Error ? err.message : 'API error'})`
        );
      }
    },
    [connectKlineSocket, prependOlderCandles]
  );

  // Boot initial chart
  useEffect(() => {
    loadSymbolChart('BTCUSDT', '1d');
    return () => {
      if (klineWsRef.current) {
        klineWsRef.current.onclose = null;
        klineWsRef.current.close();
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
    if (!syms.length) return;
    try {
      const param = encodeURIComponent(JSON.stringify(syms));
      const data = await fetchBinance<RawTicker24h[]>(`/ticker/24hr?symbols=${param}`);
      if (Array.isArray(data)) {
        setTickerMap((prev) => {
          const next = { ...prev };
          data.forEach((t) => {
            const last = parseFloat(t.lastPrice);
            next[t.symbol] = {
              symbol: t.symbol,
              last,
              chg: parseFloat(t.priceChange),
              pct: parseFloat(t.priceChangePercent),
              high: parseFloat(t.highPrice),
              low: parseFloat(t.lowPrice),
              vol: parseFloat(t.quoteVolume),
              baseVol: parseFloat(t.volume),
              prevLast: prev[t.symbol]?.last,
            };
          });
          return next;
        });
      }
    } catch {}
  }, [watchlistSymbolsKey]);

  useEffect(() => {
    fetchWatchlistTickers();

    if (tickerWsRef.current) {
      tickerWsRef.current.onclose = null;
      tickerWsRef.current.close();
    }
    const syms = watchlistSymbolsKey.split(',').filter(Boolean);
    if (!syms.length) return;

    const streams = syms.map((s) => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`${WS_BASE}/stream?streams=${streams}`);
    tickerWsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const d = payload.data;
        if (!d || !d.s) return;
        const last = parseFloat(d.c);

        setTickerMap((prev) => ({
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
            prevLast: prev[d.s]?.last,
          },
        }));

        if (d.s !== currentSymRef.current) {
          evaluatePriceTriggers(d.s, last);
        }
      } catch {}
    };

    return () => {
      ws.onclose = null;
      ws.close();
    };
  }, [watchlistSymbolsKey, fetchWatchlistTickers, evaluatePriceTriggers]);

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
    (id: string, dir: 'front' | 'back') => {
      setDrawingsMap((prev) => {
        const list = prev[currentSymbol] || [];
        const target = list.find((d) => d.id === id);
        if (!target) return prev;
        const rest = list.filter((d) => d.id !== id);
        return {
          ...prev,
          [currentSymbol]: dir === 'front' ? [...rest, target] : [target, ...rest],
        };
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

  // TradingView Keyboard Shortcuts: Alt+T, Alt+H, Alt+J, Alt+V, Alt+C, Del/Backspace, Ctrl+K, Ctrl+Z/Y, Esc
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
        setAlertModalOpen(false);
        setChartSettingsOpen(false);
        setSettingsDrawingId(null);
        setSelectedDrawingId(null);
        setActiveTool('cursor');
        return;
      }
      if (isInput) return;

      if (e.altKey) {
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
  }, [handleUndo, handleRedo, handleDeleteDrawing, selectedDrawingId, lockDrawings, currentDrawings]);

  const handleUpdateWatchlistItems = useCallback(
    (listId: string, updater: (items: WatchlistItem[]) => WatchlistItem[]) => {
      setWatchlists((prev) =>
        prev.map((wl) => (wl.id === listId ? { ...wl, items: updater(wl.items) } : wl))
      );
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

  const currentPrice = candles[candles.length - 1]?.close || tickerMap[currentSymbol]?.last || 0;

  const avgVolume30d = useMemo(() => {
    if (!volumes.length) return 0;
    const slice = volumes.slice(-30);
    return slice.reduce((acc, v) => acc + v.value, 0) / slice.length;
  }, [volumes]);

  const activeIndicatorCount = [
    indicators.emaFast.enabled,
    indicators.emaSlow.enabled,
    indicators.ema50.enabled,
    indicators.ema200.enabled,
    indicators.bb.enabled,
    indicators.volume.enabled,
    indicators.rsi.enabled,
  ].filter(Boolean).length;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col gap-[4px] bg-[var(--bg-gutter)] text-[var(--text-main)]">
      {/* Top Toolbar */}
      <TopBar
        currentSymbol={currentSymbol}
        symbolMeta={symbolMeta}
        interval={interval}
        onIntervalChange={(tf) => loadSymbolChart(currentSymbol, tf)}
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
        onSnapshot={() => chartWorkspaceRef.current?.takeSnapshot()}
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

      {/* Main Workspace Row (4px TradingView Gutters + Crisp Rounded Panels) */}
      <div className="flex-1 flex gap-[4px] min-h-0">
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
        <main className="flex-1 flex flex-col min-w-0 min-h-0 rounded-[6px] overflow-hidden bg-[var(--bg-app)]">
          <ChartWorkspace
            ref={chartWorkspaceRef}
            symbol={currentSymbol}
            symbolMeta={symbolMeta}
            tickerData={tickerMap[currentSymbol]}
            interval={interval}
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
