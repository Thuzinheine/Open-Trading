import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  ColorType,
  createChart,
  CrosshairMode,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  PriceScaleMode,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  Play,
  Pause,
  SkipForward,
  Rewind,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  X,
  Copy,
  Trash2,
  Type,
  GripVertical,
  LayoutGrid,
  Pencil,
  Settings,
  BellPlus,
  Lock,
  Unlock,
  MoreHorizontal,
  Eye,
  EyeOff,
  PlusCircle,
  ArrowUpToLine,
  ArrowDownToLine,
  Check,
  Calendar,
  AlarmClockPlus,
  Layers,
  ChevronRight,
  PaintBucket,
} from 'lucide-react';
import { HexSettingsIcon } from './TradingViewIcons';
import {
  AnchorPoint,
  CandleBar,
  ChartSettings,
  ChartSettingsTab,
  ChartType,
  DrawingLineStyle,
  DrawingObject,
  DrawingTemplate,
  DrawingTool,
  IndicatorConfig,
  IndicatorSettingsTarget,
  LinePoint,
  MagnetMode,
  PaperLimitOrder,
  PaperPosition,
  PriceAlert,
  SavedZoomState,
  ScaleMode,
  TickerData,
  Timeframe,
  VolumeBar,
  WatchlistItem,
} from '../types/trading';
import {
  computeBollingerBands,
  computeEMA,
  computeRSI,
  computeSMA,
  computeVolumeSMA,
  fmtCompact,
  fmtPrice,
  getPrecision,
  INTERVAL_SECONDS,
  toHeikinAshi,
} from '../utils/binance';
import {
  DEFAULT_VISIBILITY,
  isDrawingVisibleOnTimeframe,
  isVisibilityActiveOnTimeframe,
  loadSavedZoom,
  loadSymbolViewports,
  saveSymbolViewport,
  saveZoomState,
} from '../utils/storage';
import {
  CoordBridge,
  HandleHit,
  hitTestDrawings,
  renderDrawingObject,
} from '../utils/drawingRenderer';
import { ALL_TOOLS_MAP } from '../utils/drawingToolsCatalog';
import { SettingsTab } from './DrawingSettingsModal';
import { ColorPalettePopover } from './ColorPalettePopover';
import { CoinLogo, FlagRibbon } from './CoinLogo';

export interface SnapshotCaptureResult {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

export interface ChartWorkspaceHandle {
  resetZoom: () => void;
  zoomOut: () => void;
  setVisibleBars: (bars: number) => void;
  fitContent: () => void;
  takeSnapshot: () => void;
  captureSnapshot: () => Promise<SnapshotCaptureResult | null>;
  setScaleMode: (mode: ScaleMode) => void;
}

interface ChartWorkspaceProps {
  symbol: string;
  symbolMeta: WatchlistItem;
  tickerData?: TickerData;
  interval: Timeframe;
  chartType: ChartType;
  isDarkMode: boolean;
  chartSettings: ChartSettings;
  onUpdateChartSettings: (next: ChartSettings) => void;
  onOpenChartSettings: (tab?: ChartSettingsTab) => void;
  onQuickOrder: (side: 'BUY' | 'SELL') => void;
  onQuickLimitOrder?: (side: 'BUY' | 'SELL', price: number) => void;
  onOpenAlertAtPrice?: (price: number) => void;
  onToggleSymbolFlag?: () => void;
  onUpdateIndicators?: (updater: (prev: IndicatorConfig) => IndicatorConfig) => void;
  onOpenIndicators?: () => void;
  onOpenIndicatorSettings?: (target: IndicatorSettingsTarget) => void;
  candles: CandleBar[];
  volumes: VolumeBar[];
  candleCloseMs: number;
  loadingText: string | null;
  wsStatus: 'live' | 'connecting' | 'error';
  indicators: IndicatorConfig;
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  favoriteTools: DrawingTool[];
  drawColor: string;
  onSelectDrawColor: (c: string) => void;
  magnetMode: MagnetMode;
  stayInDrawingMode: boolean;
  lockDrawings: boolean;
  drawingsHidden: boolean;
  drawings: DrawingObject[];
  templates: DrawingTemplate[];
  selectedDrawingId: string | null;
  onSelectDrawingId: (id: string | null) => void;
  onAddDrawing: (d: DrawingObject) => void;
  onUpdateDrawing: (id: string, updater: (d: DrawingObject) => DrawingObject) => void;
  onDeleteDrawing: (id: string) => void;
  onCloneDrawing: (id: string) => void;
  onOpenDrawingSettings: (id: string, tab?: SettingsTab) => void;
  onAddAlertFromDrawing: (d: DrawingObject) => void;
  onReorderDrawing: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void;
  onRequestOlderHistory: () => void;
  alerts: PriceAlert[];
  onDeleteAlert?: (id: string) => void;
  onUpdateAlertPrice?: (id: string, price: number) => void;
  positions: PaperPosition[];
  limitOrders: PaperLimitOrder[];
  isReplayMode: boolean;
  replayIndex: number;
  isReplayPlaying: boolean;
  replaySpeed: number;
  onReplayIndexChange: (idx: number) => void;
  onToggleReplayPlay: () => void;
  onReplayStep: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onExitReplay: () => void;
}

const THREE_POINT_TOOLS: DrawingTool[] = [
  'channel',
  'flat_channel',
  'disjoint_channel',
  'pitchfork',
  'fib_ext',
  'triangle',
];

const ONE_CLICK_TOOLS: DrawingTool[] = [
  'hline',
  'hray',
  'vline',
  'crossline',
  'price_label',
  'long_pos',
  'short_pos',
];

function isCursorTool(t: DrawingTool): boolean {
  return t === 'cursor' || t === 'dot' || t === 'arrow';
}

export const ChartWorkspace = forwardRef<ChartWorkspaceHandle, ChartWorkspaceProps>(
  (
    {
      symbol,
      symbolMeta,
      tickerData,
      interval,
      chartType,
      isDarkMode,
      chartSettings,
      onUpdateChartSettings,
      onOpenChartSettings,
      onQuickOrder,
      onQuickLimitOrder,
      onOpenAlertAtPrice,
      onToggleSymbolFlag,
      onUpdateIndicators,
      onOpenIndicators,
      onOpenIndicatorSettings,
      candles,
      volumes,
      candleCloseMs,
      loadingText,
      wsStatus,
      indicators,
      activeTool,
      onSelectTool,
      favoriteTools,
      drawColor,
      onSelectDrawColor,
      magnetMode,
      stayInDrawingMode,
      lockDrawings,
      drawingsHidden,
      drawings,
      templates,
      selectedDrawingId,
      onSelectDrawingId,
      onAddDrawing,
      onUpdateDrawing,
      onDeleteDrawing,
      onCloneDrawing,
      onOpenDrawingSettings,
      onAddAlertFromDrawing,
      onReorderDrawing,
      onRequestOlderHistory,
      alerts,
      onDeleteAlert,
      onUpdateAlertPrice,
      positions,
      limitOrders,
      isReplayMode,
      replayIndex,
      isReplayPlaying,
      replaySpeed,
      onReplayIndexChange,
      onToggleReplayPlay,
      onReplayStep,
      onReplaySpeedChange,
      onExitReplay,
    },
    ref
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const cloudCanvasRef = useRef<HTMLCanvasElement>(null);
    const underDrawCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const rsiContainerRef = useRef<HTMLDivElement>(null);

    const chartRef = useRef<IChartApi | null>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);
    const isSyncingRangeRef = useRef(false);

    // Series refs
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const volMaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma1SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma2SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma3SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema1SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema2SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema3SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbMidSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const priceLinesRef = useRef<IPriceLine[]>([]);

    // Cached arrays & zoom persistence refs
    const ema1Ref = useRef<LinePoint[]>([]);
    const ema2Ref = useRef<LinePoint[]>([]);
    const displayCandlesRef = useRef<CandleBar[]>([]);
    const displayVolumesRef = useRef<VolumeBar[]>([]);
    const prevSymIntervalRef = useRef<string>('');
    const prevFirstCandleTimeRef = useRef<number | null>(null);
    const prevSeriesStateRef = useRef<{
      key: string;
      chartType: ChartType;
      symbolSettings: ChartSettings['symbol'];
      scalesPlacement: 'left' | 'right';
      autoScale: boolean;
      indicators: IndicatorConfig;
      isReplay: boolean;
      firstTime: number;
      lastTime: number;
      length: number;
    } | null>(null);
    const savedZoomRef = useRef<SavedZoomState>(loadSavedZoom());
    const symbolViewportsRef = useRef<Record<string, SavedZoomState>>(loadSymbolViewports());
    const isApplyingZoomRef = useRef<boolean>(false);
    const zoomSaveTimerRef = useRef<number | null>(null);

    // Drawing interaction refs
    const isDrawingRef = useRef(false);
    const drawStageRef = useRef<0 | 1 | 2>(0); // 0 = idle, 1 = moving to p2, 2 = moving to p3
    const tempShapeRef = useRef<DrawingObject | null>(null);
    const drawCursorRef = useRef<{ x: number; y: number } | null>(null);
    const drawStartScreenRef = useRef<{ x: number; y: number } | null>(null);
    const lastPointerClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const shiftPressedRef = useRef(false);
    const zoomBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const dragEditRef = useRef<{
      drawingId: string;
      handleKey?: HandleHit['handleKey'];
      startAnchor: AnchorPoint;
      startScreen: { x: number; y: number };
      origDrawing: DrawingObject;
    } | null>(null);

    const drawingsRef = useRef<DrawingObject[]>(drawings);
    drawingsRef.current = drawings;
    const selectedIdRef = useRef<string | null>(selectedDrawingId);
    selectedIdRef.current = selectedDrawingId;
    const hoveredDrawingIdRef = useRef<string | null>(null);
    const drawingsHiddenRef = useRef(drawingsHidden);
    drawingsHiddenRef.current = drawingsHidden;
    const indicatorsRef = useRef(indicators);
    indicatorsRef.current = indicators;
    const chartSettingsRef = useRef(chartSettings);
    chartSettingsRef.current = chartSettings;
    const intervalRef = useRef(interval);
    intervalRef.current = interval;
    const activeToolRef = useRef(activeTool);
    activeToolRef.current = activeTool;
    const lockDrawingsRef = useRef(lockDrawings);
    lockDrawingsRef.current = lockDrawings;
    const stayInDrawingRef = useRef(stayInDrawingMode);
    stayInDrawingRef.current = stayInDrawingMode;
    const onRequestOlderRef = useRef(onRequestOlderHistory);
    onRequestOlderRef.current = onRequestOlderHistory;
    const alertsRef = useRef<PriceAlert[]>(alerts);
    alertsRef.current = alerts;
    const symbolRef = useRef<string>(symbol);
    symbolRef.current = symbol;
    const hoveredAlertIdRef = useRef<string | null>(null);
    const isHoveringAlertPillRef = useRef(false);
    const draggingAlertRef = useRef<{ id: string; price: number; y: number } | null>(null);
    const onUpdateAlertPriceRef = useRef(onUpdateAlertPrice);
    onUpdateAlertPriceRef.current = onUpdateAlertPrice;

    // UI states
    const [scaleMode, setScaleMode] = useState<ScaleMode>('auto');
    const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
    const scaleMenuRef = useRef<HTMLDivElement>(null);
    const [goToDateOpen, setGoToDateOpen] = useState(false);
    const [goToDateVal, setGoToDateVal] = useState<string>(() =>
      new Date().toISOString().slice(0, 10)
    );
    const [activeDateRange, setActiveDateRange] = useState<string>('');
    const [indExpanded, setIndExpanded] = useState(false);
    const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);
    const [hoverCursor, setHoverCursor] = useState<string>('');
    const [drawingHint, setDrawingHint] = useState<string | null>(null);
    const [toolbarMenu, setToolbarMenu] = useState<
      | 'none'
      | 'template'
      | 'lineColor'
      | 'textColor'
      | 'targetColor'
      | 'stopColor'
      | 'lineWidth'
      | 'lineStyle'
      | 'more'
    >('none');
    const [toolbarOffset, setToolbarOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const toolbarDragRef = useRef<{
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    } | null>(null);
    const favBarRef = useRef<HTMLDivElement>(null);
    const [favBarPos, setFavBarPos] = useState<{ x: number; y: number }>(() => {
      try {
        const raw = localStorage.getItem('tp_fav_bar_pos_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            return { x: Math.max(8, parsed.x), y: Math.max(8, parsed.y) };
          }
        }
      } catch {
        // ignore storage errors
      }
      return { x: 16, y: 74 };
    });
    const favBarPosRef = useRef(favBarPos);
    favBarPosRef.current = favBarPos;
    const favBarDragRef = useRef<{
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    } | null>(null);
    const [textPrompt, setTextPrompt] = useState<{
      x: number;
      y: number;
      mode: 'text' | 'callout' | 'edit';
      p1: AnchorPoint;
      p2?: AnchorPoint;
      editId?: string;
      value: string;
    } | null>(null);
    const [drawingContextMenu, setDrawingContextMenu] = useState<{
      drawingId: string;
      x: number;
      y: number;
    } | null>(null);
    const [ctxSubmenu, setCtxSubmenu] = useState<'none' | 'template' | 'order' | 'visibility'>(
      'none'
    );
    const [objectTreeOpen, setObjectTreeOpen] = useState(false);
    const copiedDrawingRef = useRef<DrawingObject | null>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);

    const [indValues, setIndValues] = useState<{
      sma1?: number;
      sma2?: number;
      sma3?: number;
      ema1?: number;
      ema2?: number;
      ema3?: number;
      bbUpper?: number;
      bbMid?: number;
      bbLower?: number;
      volMa?: number;
      rsi?: number;
    }>({});
    const indValuesRef = useRef<{
      sma1?: number;
      sma2?: number;
      sma3?: number;
      ema1?: number;
      ema2?: number;
      ema3?: number;
      bbUpper?: number;
      bbMid?: number;
      bbLower?: number;
      volMa?: number;
      rsi?: number;
    }>({});
    const [clockStr, setClockStr] = useState('--:--:--');
    const [countdownStr, setCountdownStr] = useState('');
    const countdownStrRef = useRef('');
    countdownStrRef.current = countdownStr;
    const [scaleBadges, setScaleBadges] = useState<
      Array<{
        id: string;
        kind: 'price' | 'indicator';
        text: string;
        subText?: string;
        bgColor: string;
        top: number;
        height: number;
      }>
    >([]);
    const scaleBadgesRef = useRef(scaleBadges);
    scaleBadgesRef.current = scaleBadges;
    const scaleBadgesSigRef = useRef('');
    const [showScrollToRecent, setShowScrollToRecent] = useState(false);
    const [rightScaleWidth, setRightScaleWidth] = useState(70);
    const hoverBarTimeRef = useRef<number | null>(null);
    const crosshairLiveRef = useRef<{ y: number; price: number } | null>(null);
    const crosshairTagElRef = useRef<HTMLDivElement>(null);
    const crosshairPriceTextElRef = useRef<HTMLSpanElement>(null);
    const crosshairPlusBtnElRef = useRef<HTMLButtonElement>(null);
    const isHoveringPlusBtnRef = useRef(false);
    const [plusMenuAnchor, setPlusMenuAnchor] = useState<{ y: number; price: number } | null>(null);
    const plusMenuOpenRef = useRef(false);
    plusMenuOpenRef.current = plusMenuAnchor !== null;
    const plusMenuRef = useRef<HTMLDivElement>(null);
    const [alertHoverInfo, setAlertHoverInfo] = useState<{
      id: string;
      y: number;
      price: number;
      label: string;
    } | null>(null);

    // Slice candles when in Replay mode
    const effectiveCandles = isReplayMode
      ? candles.slice(0, Math.max(2, Math.min(replayIndex, candles.length)))
      : candles;
    const effectiveVolumes = isReplayMode
      ? volumes.slice(0, effectiveCandles.length)
      : volumes;

    displayCandlesRef.current = effectiveCandles;
    displayVolumesRef.current = effectiveVolumes;

    // Clear in-progress drawing when switching tools
    useEffect(() => {
      isDrawingRef.current = false;
      drawStageRef.current = 0;
      tempShapeRef.current = null;
      zoomBoxRef.current = null;
      setDrawingHint(null);
      if (!isCursorTool(activeTool)) {
        onSelectDrawingId(null);
      }
      if (activeTool === 'path') {
        setDrawingHint('Click points to draw path · Double-click or Enter to finish');
      } else if (activeTool === 'zoom_in') {
        setDrawingHint('Drag a box on the chart to zoom into that range');
      }
    }, [activeTool, onSelectDrawingId]);

    // Helper: Convert time <-> logical using effectiveCandles
    const timeToLogical = useCallback((t: number): number | null => {
      const arr = displayCandlesRef.current;
      if (!arr.length) return null;
      const step = INTERVAL_SECONDS[intervalRef.current] || 86400;
      if (t <= arr[0].time) {
        return (t - arr[0].time) / step;
      }
      const lastIdx = arr.length - 1;
      if (t >= arr[lastIdx].time) {
        return lastIdx + (t - arr[lastIdx].time) / step;
      }
      let lo = 0;
      let hi = lastIdx;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].time === t) return mid;
        if (arr[mid].time < t) lo = mid + 1;
        else hi = mid - 1;
      }
      const t0 = arr[Math.max(0, hi)].time;
      const t1 = arr[Math.min(lastIdx, lo)].time;
      if (t1 === t0) return hi;
      return hi + (t - t0) / (t1 - t0);
    }, []);

    const logicalToTime = useCallback((logical: number): number | null => {
      const arr = displayCandlesRef.current;
      if (!arr.length) return null;
      const step = INTERVAL_SECONDS[intervalRef.current] || 86400;
      const rounded = Math.round(logical);
      if (rounded < 0) return arr[0].time + rounded * step;
      if (rounded >= arr.length) {
        return arr[arr.length - 1].time + (rounded - (arr.length - 1)) * step;
      }
      return arr[rounded].time;
    }, []);

    const buildCoordBridge = useCallback((): CoordBridge | null => {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      const canvas = drawCanvasRef.current;
      if (!chart || !series || !canvas) return null;
      const placement = chartSettingsRef.current.scales.scalesPlacement;
      const scaleW = chart.priceScale(placement).width() || 70;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth || Math.round(canvas.width / dpr);
      const cssH = canvas.clientHeight || Math.round(canvas.height / dpr);
      const plotLeft = placement === 'left' ? scaleW : 0;
      const plotWidth = Math.max(0, cssW - scaleW);
      return {
        ptToScreen: (pt: AnchorPoint) => {
          const logical = timeToLogical(pt.time);
          if (logical === null) return null;
          const x = chart.timeScale().logicalToCoordinate(logical as never);
          const y = series.priceToCoordinate(pt.price);
          if (x === null || y === null) return null;
          return { x: Number(x), y: Number(y) };
        },
        priceToY: (price: number) => {
          const y = series.priceToCoordinate(price);
          return y === null ? null : Number(y);
        },
        timeToX: (time: number) => {
          const logical = timeToLogical(time);
          if (logical === null) return null;
          const x = chart.timeScale().logicalToCoordinate(logical as never);
          return x === null ? null : Number(x);
        },
        timeToLogical,
        width: cssW,
        height: cssH,
        plotLeft,
        plotWidth,
        intervalSec: INTERVAL_SECONDS[intervalRef.current] || 86400,
        lastClose: displayCandlesRef.current[displayCandlesRef.current.length - 1]?.close,
      };
    }, [timeToLogical]);

    // Apply & persist zoom safely without triggering recursive capture
    const applyZoomRange = useCallback((visibleBars: number, rightOffset?: number) => {
      const chart = chartRef.current;
      const arr = displayCandlesRef.current;
      if (!chart || arr.length < 2) return;

      const clampedBars = Math.max(12, Math.min(1200, visibleBars));
      const offset = rightOffset !== undefined ? rightOffset : savedZoomRef.current.rightOffset;
      const clampedOffset = Math.max(-10, Math.min(80, offset));

      savedZoomRef.current = { visibleBars: clampedBars, rightOffset: clampedOffset };
      saveZoomState(savedZoomRef.current);

      const lastIdx = arr.length - 1;
      const to = lastIdx + clampedOffset;
      const from = to - clampedBars;

      isApplyingZoomRef.current = true;
      chart.timeScale().setVisibleLogicalRange({ from, to });
      if (rsiChartRef.current) {
        rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to });
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isApplyingZoomRef.current = false;
        });
      });
    }, []);

    // Draw EMA Cloud + Optional Session/Events Break Lines
    const drawEmaCloud = useCallback(() => {
      const canvas = cloudCanvasRef.current;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!canvas || !chart || !series) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth || Math.round(canvas.width / dpr);
      const cssH = canvas.clientHeight || Math.round(canvas.height / dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const ts = chart.timeScale();
      const range = ts.getVisibleLogicalRange();
      if (!range) return;

      // Vertical Session / Day Breaks (Events tab -> Session breaks)
      const csCfg = chartSettingsRef.current;
      const bars = displayCandlesRef.current;
      if (csCfg.events.sessionBreaks && bars.length > 2) {
        const bStart = Math.max(1, Math.floor(range.from));
        const bEnd = Math.min(bars.length - 1, Math.ceil(range.to));
        ctx.save();
        ctx.strokeStyle = csCfg.events.sessionBreaksColor || '#787b86';
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let i = bStart; i <= bEnd; i++) {
          const prevD = new Date(bars[i - 1].time * 1000).getUTCDate();
          const curD = new Date(bars[i].time * 1000).getUTCDate();
          const prevM = new Date(bars[i - 1].time * 1000).getUTCMonth();
          const curM = new Date(bars[i].time * 1000).getUTCMonth();
          const isBreak = ['1d', '1w'].includes(intervalRef.current)
            ? prevM !== curM
            : prevD !== curD;
          if (isBreak) {
            const x = ts.timeToCoordinate(bars[i].time as UTCTimestamp);
            if (x !== null) {
              ctx.beginPath();
              ctx.moveTo(Number(x), 0);
              ctx.lineTo(Number(x), cssH);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      const cfg = indicatorsRef.current;
      const se = cfg.smaEma;
      const fast = ema1Ref.current;
      const slow = ema2Ref.current;
      const seVisible =
        se.enabled &&
        !se.hidden &&
        isVisibilityActiveOnTimeframe(se.visibility, intervalRef.current);
      if (
        !seVisible ||
        !se.plotsBackground ||
        !se.ema1.enabled ||
        !se.ema2.enabled ||
        fast.length < 2 ||
        slow.length < 2
      ) {
        return;
      }

      const startIdx = Math.max(0, Math.floor(range.from) - 1);
      const endIdx = Math.min(fast.length - 1, slow.length - 1, Math.ceil(range.to) + 1);

      for (let i = startIdx; i < endIdx; i++) {
        const x1 = ts.timeToCoordinate(fast[i].time as UTCTimestamp);
        const x2 = ts.timeToCoordinate(fast[i + 1].time as UTCTimestamp);
        const yf1 = series.priceToCoordinate(fast[i].value);
        const yf2 = series.priceToCoordinate(fast[i + 1].value);
        const ys1 = series.priceToCoordinate(slow[i].value);
        const ys2 = series.priceToCoordinate(slow[i + 1].value);

        if (
          x1 === null ||
          x2 === null ||
          yf1 === null ||
          yf2 === null ||
          ys1 === null ||
          ys2 === null
        ) {
          continue;
        }

        const isBull = fast[i].value >= slow[i].value;
        ctx.fillStyle = isBull
          ? se.bgColor0 || 'rgba(41, 98, 255, 0.14)'
          : se.bgColor1 || 'rgba(242, 54, 69, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x1, yf1);
        ctx.lineTo(x2, yf2);
        ctx.lineTo(x2, ys2);
        ctx.lineTo(x1, ys1);
        ctx.closePath();
        ctx.fill();
      }
    }, []);

    // Redraw Drawing Canvases:
    // - underDrawCanvasRef (z-[1], behind candles): all finalized idle drawings
    // - drawCanvasRef (z-[3], above candles): active in-progress drawing, hovered/dragged drawings, or drawings explicitly brought to front
    const redrawOverlay = useCallback(() => {
      const canvas = drawCanvasRef.current;
      const underCanvas = underDrawCanvasRef.current;
      const bridge = buildCoordBridge();
      if (!canvas || !bridge) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const underCtx = underCanvas ? underCanvas.getContext('2d') : null;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssW = bridge.width;
      const cssH = bridge.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      if (underCanvas && underCtx) {
        underCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        underCtx.clearRect(0, 0, cssW, cssH);
      }

      const chart = chartRef.current;
      const placement = chartSettingsRef.current.scales.scalesPlacement;
      const scaleW = chart ? chart.priceScale(placement).width() : 70;
      const plotLeft = placement === 'left' ? scaleW : 0;
      const plotWidth = Math.max(0, cssW - scaleW);
      const plotHeight = Math.max(0, cssH - 26);

      if (!drawingsHiddenRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotLeft, 0, plotWidth, plotHeight);
        ctx.clip();

        if (underCtx) {
          underCtx.save();
          underCtx.beginPath();
          underCtx.rect(plotLeft, 0, plotWidth, plotHeight);
          underCtx.clip();
        }

        const visibleDrawings = drawingsRef.current.filter((d) =>
          isDrawingVisibleOnTimeframe(d, intervalRef.current)
        );
        visibleDrawings.forEach((d) => {
          const isSelected = d.id === selectedIdRef.current;
          const isHovered = d.id === hoveredDrawingIdRef.current;
          const isDragging = dragEditRef.current?.drawingId === d.id;
          // Appear on top of candles ONLY while actively hovered, dragged, or explicitly brought to front.
          // Once finished and mouse is in free space, render cleanly behind candles!
          const renderOnTop = isHovered || isDragging || d.zOrder === 'front' || !underCtx;
          renderDrawingObject(
            renderOnTop ? ctx : underCtx!,
            d,
            bridge,
            isSelected,
            isHovered
          );
        });

        // In-progress drawing ALWAYS renders on top of candles while user is drawing
        if (tempShapeRef.current) {
          renderDrawingObject(ctx, tempShapeRef.current, bridge, true, false, true);
        }

        // Crisp TradingView dashed crosshair while any drawing tool is active
        if (!isCursorTool(activeToolRef.current) && drawCursorRef.current) {
          const cx = Math.round(drawCursorRef.current.x) + 0.5;
          const cy = Math.round(drawCursorRef.current.y) + 0.5;
          if (cx >= plotLeft && cx <= plotLeft + plotWidth && cy >= 0 && cy <= plotHeight) {
            ctx.save();
            ctx.strokeStyle = '#9598a1';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(plotLeft, cy);
            ctx.lineTo(plotLeft + plotWidth, cy);
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);
            // Subtle crisp '+' center mark at snapped/active point
            if (shiftPressedRef.current && tempShapeRef.current) {
              ctx.strokeStyle = '#434651';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(cx - 5, cy);
              ctx.lineTo(cx + 5, cy);
              ctx.moveTo(cx, cy - 5);
              ctx.lineTo(cx, cy + 5);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        if (underCtx) underCtx.restore();
        ctx.restore();
      }

      // Draw TradingView Alert Lines (grey dashed line; blue circle dot ONLY when hovered or dragging!)
      const csAlertsCfg = chartSettingsRef.current.alerts;
      const series = candleSeriesRef.current;
      if (csAlertsCfg.alertLines && series) {
        const curSym = symbolRef.current;
        const visibleAlerts = alertsRef.current.filter(
          (a) => a.symbol === curSym && (!csAlertsCfg.onlyActiveAlerts || a.active)
        );
        if (visibleAlerts.length > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(plotLeft, 0, plotWidth, plotHeight);
          ctx.clip();
          for (const a of visibleAlerts) {
            const dragInfo = draggingAlertRef.current;
            const effectivePrice = dragInfo && dragInfo.id === a.id ? dragInfo.price : a.price;
            const rawY = series.priceToCoordinate(effectivePrice);
            if (rawY === null || !Number.isFinite(Number(rawY))) continue;
            const py = Math.round(Number(rawY)) + 0.5;
            if (py < 0 || py > plotHeight) continue;

            const isFocused =
              hoveredAlertIdRef.current === a.id ||
              (dragInfo !== null && dragInfo.id === a.id);

            ctx.strokeStyle = isFocused ? '#787b86' : '#9598a1';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(plotLeft, py);
            ctx.lineTo(plotLeft + plotWidth, py);
            ctx.stroke();
            ctx.setLineDash([]);

            // Blue-ringed white drag dot appears ONLY when hovering or dragging this alert!
            if (isFocused) {
              const dotX =
                placement === 'left' ? plotLeft + 16 : plotLeft + plotWidth - 16;
              ctx.beginPath();
              ctx.arc(dotX, py, 3.6, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.lineWidth = 1.8;
              ctx.strokeStyle = '#2962ff';
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }

      if (zoomBoxRef.current) {
        const { x1, y1, x2, y2 } = zoomBoxRef.current;
        ctx.save();
        ctx.fillStyle = 'rgba(41, 98, 255, 0.16)';
        ctx.strokeStyle = '#2962ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.restore();
      }
    }, [buildCoordBridge]);

    const updateCountdownPos = useCallback(() => {
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      const canvas = drawCanvasRef.current;
      const arr = displayCandlesRef.current;
      if (!chart || !series || !canvas || !arr.length) {
        if (scaleBadgesSigRef.current !== '') {
          scaleBadgesSigRef.current = '';
          scaleBadgesRef.current = [];
          setScaleBadges([]);
        }
        return;
      }

      const csCfg = chartSettingsRef.current;
      const sc = csCfg.scales;
      const symCfg = csCfg.symbol;
      const ind = indicatorsRef.current;
      const vals = indValuesRef.current;

      const scaleW = chart.priceScale(sc.scalesPlacement).width();
      if (scaleW > 0) setRightScaleWidth(scaleW);

      const lastBar = arr[arr.length - 1];
      const prevBar = arr.length > 1 ? arr[arr.length - 2] : lastBar;
      const prec =
        symCfg.precision === 'default'
          ? getPrecision(lastBar.close)
          : parseInt(symCfg.precision, 10);

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssH = canvas.clientHeight || Math.round(canvas.height / dpr);
      const maxBottom = Math.max(40, cssH - 27);
      const pillH = 18;
      const halfPill = 9;

      type RawBadge = {
        id: string;
        kind: 'price' | 'indicator';
        text: string;
        subText?: string;
        bgColor: string;
        idealY: number;
        top: number;
        height: number;
      };

      // 1. Unified Current Price (+ Candle Time) badge
      let priceBadge: RawBadge | null = null;
      const rawPriceY = series.priceToCoordinate(lastBar.close);
      if (sc.symbolLabel !== 'hidden' && rawPriceY !== null && Number.isFinite(Number(rawPriceY))) {
        const py = Number(rawPriceY);
        const isBull = symCfg.colorBasedOnPrevClose
          ? lastBar.close >= prevBar.close
          : lastBar.close >= lastBar.open;
        const priceBg = isBull ? symCfg.upColor : symCfg.downColor;
        const cdText =
          !isReplayMode && sc.countdownToBarClose ? countdownStrRef.current : '';
        const h = cdText ? 32 : pillH;
        const top = Math.max(2, Math.min(maxBottom - h, Math.round(py - halfPill)));
        priceBadge = {
          id: 'current_price',
          kind: 'price',
          text: fmtPrice(lastBar.close, prec),
          subText: cdText || undefined,
          bgColor: priceBg,
          idealY: py,
          top,
          height: h,
        };
      }

      // 2. All Price Scale indicator badges (EMA10, EMA20, EMA50, EMA200, BB, VolMA, Volume)
      const indRaw: RawBadge[] = [];
      if (sc.indicatorsLabel !== 'hidden') {
        const pushInd = (
          id: string,
          enabled: boolean,
          value: number | undefined,
          color: string,
          coordSeries: ISeriesApi<'Candlestick' | 'Line' | 'Histogram'> | null = series,
          formatter: (v: number) => string = (v) => fmtPrice(v, prec)
        ) => {
          if (!enabled || value === undefined || !Number.isFinite(value) || !coordSeries) return;
          const y = coordSeries.priceToCoordinate(value);
          if (y === null || !Number.isFinite(Number(y))) return;
          const iy = Number(y);
          if (iy < -24 || iy > maxBottom + 24) return;
          indRaw.push({
            id,
            kind: 'indicator',
            text: formatter(value),
            bgColor: color,
            idealY: iy,
            top: Math.max(2, Math.min(maxBottom - pillH, Math.round(iy - halfPill))),
            height: pillH,
          });
        };

        const tfNow = intervalRef.current;
        const se = ind.smaEma;
        const sePrec = se.precision === 'default' ? prec : parseInt(se.precision, 10);
        const seFmt = (v: number) => fmtPrice(v, sePrec);
        const seShowScale =
          se.enabled &&
          !se.hidden &&
          se.labelsOnPriceScale &&
          isVisibilityActiveOnTimeframe(se.visibility, tfNow);

        if (seShowScale) {
          pushInd('sma_1', se.sma1.enabled, vals.sma1, se.sma1.color, series, seFmt);
          pushInd('sma_2', se.sma2.enabled, vals.sma2, se.sma2.color, series, seFmt);
          pushInd('sma_3', se.sma3.enabled, vals.sma3, se.sma3.color, series, seFmt);
          pushInd('ema_1', se.ema1.enabled, vals.ema1, se.ema1.color, series, seFmt);
          pushInd('ema_2', se.ema2.enabled, vals.ema2, se.ema2.color, series, seFmt);
          pushInd('ema_3', se.ema3.enabled, vals.ema3, se.ema3.color, series, seFmt);
        }

        const bbShow = ind.bb.enabled && !ind.bb.hidden;
        pushInd('bb_upper', bbShow, vals.bbUpper, ind.bb.color);
        pushInd('bb_mid', bbShow, vals.bbMid, ind.bb.color);
        pushInd('bb_lower', bbShow, vals.bbLower, ind.bb.color);

        // Include Volume & Vol MA in the unified collision-free stack
        const volArr = displayVolumesRef.current;
        const lastVol = volArr.length ? volArr[volArr.length - 1] : null;
        const volShowScale =
          ind.volume.enabled &&
          !ind.volume.hidden &&
          ind.volume.labelsOnPriceScale &&
          isVisibilityActiveOnTimeframe(ind.volume.visibility, tfNow);
        const volFmt = (v: number) =>
          ind.volume.precision === 'default'
            ? fmtCompact(v)
            : v.toLocaleString('en-US', {
                minimumFractionDigits: parseInt(ind.volume.precision, 10),
                maximumFractionDigits: parseInt(ind.volume.precision, 10),
              });
        if (volShowScale) {
          if (ind.volume.showMa && vals.volMa !== undefined) {
            pushInd(
              'vol_ma',
              true,
              vals.volMa,
              ind.volume.maColor || '#9c27b0',
              volMaSeriesRef.current,
              volFmt
            );
          }
          if (ind.volume.showVolume && lastVol && Number.isFinite(lastVol.value)) {
            const isVolUp = ind.volume.colorBasedOnPrevClose
              ? lastBar.close >= prevBar.close
              : lastBar.close >= lastBar.open;
            const rawVolColor = isVolUp
              ? ind.volume.growingColor || '#089981'
              : ind.volume.fallingColor || '#f23645';
            const volColor = rawVolColor.startsWith('rgba(')
              ? rawVolColor.replace(/,\s*[\d.]+\)$/, ', 1)')
              : rawVolColor;
            pushInd(
              'vol_last',
              true,
              lastVol.value,
              volColor,
              volumeSeriesRef.current,
              volFmt
            );
          }
        }
      }

      // 2b. Horizontal Line, Horizontal Ray & Long/Short Position price badges on the Price Scale (matches TradingView!)
      if (!drawingsHiddenRef.current) {
        const activeDrawings = drawingsRef.current.filter((d) =>
          isDrawingVisibleOnTimeframe(d, intervalRef.current)
        );
        const pushDrawingPrice = (id: string, price: number | undefined, bgColor: string) => {
          if (price === undefined || !Number.isFinite(price)) return;
          const y = series.priceToCoordinate(price);
          if (y === null || !Number.isFinite(Number(y))) return;
          const iy = Number(y);
          if (iy < -24 || iy > maxBottom + 24) return;
          indRaw.push({
            id,
            kind: 'indicator',
            text: fmtPrice(price, prec),
            bgColor,
            idealY: iy,
            top: Math.max(2, Math.min(maxBottom - pillH, Math.round(iy - halfPill))),
            height: pillH,
          });
        };
        for (const d of activeDrawings) {
          if (d.showPriceLabels === false) continue;
          if (d.type === 'hline' && d.price !== undefined) {
            pushDrawingPrice(`drawing_${d.id}`, d.price, d.color || '#2962ff');
          } else if (d.type === 'hray' && d.p1) {
            pushDrawingPrice(`drawing_${d.id}`, d.p1.price, d.color || '#2962ff');
          } else if ((d.type === 'long_pos' || d.type === 'short_pos') && d.p1) {
            pushDrawingPrice(`drawing_${d.id}_tp`, d.targetPrice, '#089981');
            pushDrawingPrice(`drawing_${d.id}_entry`, d.p1.price, d.color || '#787b86');
            pushDrawingPrice(`drawing_${d.id}_sl`, d.stopPrice, '#f23645');
          }
        }
      }

      // 2c. Alert price badges on the Price Scale (exact TradingView neutral grey #787b86)
      if (csCfg.alerts.alertLines) {
        const curSym = symbolRef.current;
        const visibleAlerts = alertsRef.current.filter(
          (a) => a.symbol === curSym && (!csCfg.alerts.onlyActiveAlerts || a.active)
        );
        for (const a of visibleAlerts) {
          const dragInfo = draggingAlertRef.current;
          const effectivePrice = dragInfo && dragInfo.id === a.id ? dragInfo.price : a.price;
          const y = series.priceToCoordinate(effectivePrice);
          if (y === null || !Number.isFinite(Number(y))) continue;
          const iy = Number(y);
          if (iy < -24 || iy > maxBottom + 24) continue;
          indRaw.push({
            id: `alert_${a.id}`,
            kind: 'indicator',
            text: fmtPrice(effectivePrice, prec),
            bgColor: '#787b86',
            idealY: iy,
            top: Math.max(2, Math.min(maxBottom - pillH, Math.round(iy - halfPill))),
            height: pillH,
          });
        }
      }

      // 3. Guaranteed Zero-Overlap Bidirectional Stacking Solver (with crisp 1px seam when stacked)
      const badgeGap = 1;
      const resolved: RawBadge[] = [];
      if (sc.noOverlappingLabels) {
        let ordered: RawBadge[];
        if (priceBadge) {
          const above = indRaw
            .filter((b) => b.idealY < priceBadge!.idealY)
            .sort((a, b) => b.idealY - a.idealY);
          const below = indRaw
            .filter((b) => b.idealY >= priceBadge!.idealY)
            .sort((a, b) => a.idealY - b.idealY);

          // Stack indicators/drawings above Current Price upward from priceBadge.top
          let upCursor = priceBadge.top;
          for (const item of above) {
            item.top = Math.min(Math.round(item.idealY - halfPill), upCursor - item.height - badgeGap);
            upCursor = item.top;
          }
          above.reverse();

          // Stack indicators/drawings below Current Price downward from bottom of Price+Countdown box
          let downCursor = priceBadge.top + priceBadge.height + badgeGap;
          for (const item of below) {
            item.top = Math.max(Math.round(item.idealY - halfPill), downCursor);
            downCursor = item.top + item.height + badgeGap;
          }

          ordered = [...above, priceBadge, ...below];
        } else {
          ordered = [...indRaw].sort((a, b) => a.idealY - b.idealY);
          let cursor = 2;
          for (const item of ordered) {
            item.top = Math.max(Math.round(item.idealY - halfPill), cursor);
            cursor = item.top + item.height + badgeGap;
          }
        }

        // Bottom boundary pass: cascade upward so nothing clips past time axis OR overlaps
        for (let i = ordered.length - 1; i >= 0; i--) {
          const limit = i === ordered.length - 1 ? maxBottom : ordered[i + 1].top - badgeGap;
          if (ordered[i].top + ordered[i].height > limit) {
            ordered[i].top = limit - ordered[i].height;
          }
        }

        // Top boundary pass: cascade downward so nothing clips above top edge OR overlaps
        for (let i = 0; i < ordered.length; i++) {
          const minTop = i === 0 ? 2 : ordered[i - 1].top + ordered[i - 1].height + badgeGap;
          if (ordered[i].top < minTop) {
            ordered[i].top = minTop;
          }
        }

        resolved.push(...ordered);
      } else {
        if (priceBadge) resolved.push(priceBadge);
        resolved.push(...indRaw);
      }

      const nextBadges = resolved.map((b) => ({
        id: b.id,
        kind: b.kind,
        text: b.text,
        subText: b.subText,
        bgColor: b.bgColor,
        top: b.top,
        height: b.height,
      }));

      const sig = nextBadges
        .map((b) => `${b.id}:${b.text}:${b.subText || ''}:${b.bgColor}:${b.top}:${b.height}`)
        .join('|');
      if (sig !== scaleBadgesSigRef.current) {
        scaleBadgesSigRef.current = sig;
        scaleBadgesRef.current = nextBadges;
        setScaleBadges(nextBadges);
      }
    }, [isReplayMode]);

    // Initialize Main Chart once
    useEffect(() => {
      if (!chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDarkMode ? '#d1d4dc' : '#131722',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
          horzLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#9598a1', style: LineStyle.Dashed },
          horzLine: { color: '#9598a1', style: LineStyle.Dashed, labelVisible: false },
        },
        rightPriceScale: {
          borderColor: isDarkMode ? '#2a2e39' : '#e0e3eb',
          autoScale: true,
          minimumWidth: 70,
          scaleMargins: { top: 0.08, bottom: 0.22 },
        },
        timeScale: {
          borderColor: isDarkMode ? '#2a2e39' : '#e0e3eb',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: savedZoomRef.current.rightOffset,
          barSpacing: 9,
          minBarSpacing: 1.2,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#2962ff',
        downColor: '#f23645',
        borderUpColor: isDarkMode ? '#2962ff' : '#131722',
        borderDownColor: isDarkMode ? '#f23645' : '#131722',
        wickUpColor: isDarkMode ? '#d1d4dc' : '#131722',
        wickDownColor: isDarkMode ? '#d1d4dc' : '#131722',
        borderVisible: true,
        lastValueVisible: false,
      });

      const lineSeries = chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 2,
        visible: false,
        lastValueVisible: false,
      });

      const areaSeries = chart.addAreaSeries({
        lineColor: '#2962ff',
        topColor: 'rgba(41, 98, 255, 0.28)',
        bottomColor: 'rgba(41, 98, 255, 0.01)',
        lineWidth: 2,
        visible: false,
        lastValueVisible: false,
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      const volMaSeries = chart.addLineSeries({
        color: '#9c27b0',
        lineWidth: 1,
        priceScaleId: 'vol',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const sma1Series = chart.addLineSeries({
        color: '#4db6ac',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      const sma2Series = chart.addLineSeries({
        color: '#f48fb1',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      const sma3Series = chart.addLineSeries({
        color: '#7986cb',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      const ema1Series = chart.addLineSeries({
        color: '#f23645',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema2Series = chart.addLineSeries({
        color: '#1d54d4',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const ema3Series = chart.addLineSeries({
        color: '#81c784',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });

      const bbUpperSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      const bbMidSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });
      const bbLowerSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      lineSeriesRef.current = lineSeries;
      areaSeriesRef.current = areaSeries;
      volumeSeriesRef.current = volumeSeries;
      volMaSeriesRef.current = volMaSeries;
      sma1SeriesRef.current = sma1Series;
      sma2SeriesRef.current = sma2Series;
      sma3SeriesRef.current = sma3Series;
      ema1SeriesRef.current = ema1Series;
      ema2SeriesRef.current = ema2Series;
      ema3SeriesRef.current = ema3Series;
      bbUpperSeriesRef.current = bbUpperSeries;
      bbMidSeriesRef.current = bbMidSeries;
      bbLowerSeriesRef.current = bbLowerSeries;

      const hideCrosshairDom = () => {
        crosshairLiveRef.current = null;
        if (crosshairTagElRef.current) crosshairTagElRef.current.style.visibility = 'hidden';
        if (crosshairPlusBtnElRef.current) crosshairPlusBtnElRef.current.style.visibility = 'hidden';
      };

      chart.subscribeCrosshairMove((param) => {
        if (!plusMenuOpenRef.current) {
          if (!param.point || param.point.y < 10 || activeToolRef.current === 'arrow') {
            if (!isHoveringPlusBtnRef.current) hideCrosshairDom();
          } else {
            const p = candleSeries.coordinateToPrice(param.point.y);
            if (p !== null && Number.isFinite(Number(p))) {
              const priceNum = Number(p);
              const yPos = Math.round(param.point.y - 9.5);
              crosshairLiveRef.current = { y: param.point.y, price: priceNum };

              const arr = displayCandlesRef.current;
              const symCfg = chartSettingsRef.current.symbol;
              const refClose = arr.length ? arr[arr.length - 1].close : priceNum;
              const prec =
                symCfg.precision === 'default'
                  ? getPrecision(refClose)
                  : parseInt(symCfg.precision, 10);

              const tagEl = crosshairTagElRef.current;
              const txtEl = crosshairPriceTextElRef.current;
              if (tagEl && txtEl) {
                txtEl.textContent = fmtPrice(priceNum, prec);
                tagEl.style.transform = `translate3d(0, ${yPos}px, 0)`;
                tagEl.style.visibility = 'visible';
              }

              const plusBtnEl = crosshairPlusBtnElRef.current;
              if (plusBtnEl) {
                if (chartSettingsRef.current.scales.plusButton && param.point.y > 14) {
                  plusBtnEl.style.transform = `translate3d(0, ${yPos}px, 0)`;
                  plusBtnEl.style.visibility = 'visible';
                } else {
                  plusBtnEl.style.visibility = 'hidden';
                }
              }
            } else {
              hideCrosshairDom();
            }
          }
        }

        if (!param.time) {
          if (hoverBarTimeRef.current !== null) {
            hoverBarTimeRef.current = null;
            setHoverBar(null);
          }
          return;
        }
        const t = Number(param.time);
        if (hoverBarTimeRef.current !== t) {
          hoverBarTimeRef.current = t;
          const found = displayCandlesRef.current.find((c) => c.time === t);
          if (found) setHoverBar(found);
        }
      });

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        drawEmaCloud();
        redrawOverlay();
        updateCountdownPos();

        if (range && rsiChartRef.current && !isSyncingRangeRef.current) {
          isSyncingRangeRef.current = true;
          rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
          isSyncingRangeRef.current = false;
        }

        // Continuously remember user's exact zoom density & right offset!
        const arr = displayCandlesRef.current;
        if (range && arr.length > 2) {
          const lastIdx = arr.length - 1;
          const isAway = range.to < lastIdx - 1 || range.from > lastIdx - 1;
          setShowScrollToRecent(isAway);
          const rw = chart.priceScale('right').width();
          if (rw > 0) setRightScaleWidth(rw);
        }
        if (range && !isApplyingZoomRef.current && arr.length > 5) {
          const span = range.to - range.from;
          if (span >= 8 && span <= 1500) {
            const lastIdx = arr.length - 1;
            const currentRightOffset = range.to - lastIdx;
            const clampedToIdx = Math.max(0, Math.min(lastIdx, Math.round(range.to)));
            const toTime = range.to <= lastIdx ? arr[clampedToIdx]?.time : undefined;
            const curKey = `${symbolRef.current}_${intervalRef.current}`;
            const nextPerSymZoom: SavedZoomState = {
              visibleBars: span,
              rightOffset: currentRightOffset,
              ...(toTime !== undefined ? { toTime } : {}),
            };
            symbolViewportsRef.current[curKey] = nextPerSymZoom;

            const nextGlobalZoom: SavedZoomState = {
              visibleBars: span,
              rightOffset:
                currentRightOffset >= -10 && currentRightOffset <= 80
                  ? currentRightOffset
                  : savedZoomRef.current.rightOffset,
            };
            savedZoomRef.current = nextGlobalZoom;
            if (zoomSaveTimerRef.current) window.clearTimeout(zoomSaveTimerRef.current);
            zoomSaveTimerRef.current = window.setTimeout(() => {
              saveZoomState(savedZoomRef.current);
              saveSymbolViewport(curKey, nextPerSymZoom);
            }, 140);
          }
        }

        if (range && range.from < 35 && arr.length > 0) {
          onRequestOlderRef.current();
        }
      });

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) continue;
          const dpr = Math.max(1, window.devicePixelRatio || 1);
          const physW = Math.round(width * dpr);
          const physH = Math.round(height * dpr);
          chart.applyOptions({ width, height });
          if (cloudCanvasRef.current) {
            cloudCanvasRef.current.width = physW;
            cloudCanvasRef.current.height = physH;
          }
          if (underDrawCanvasRef.current) {
            underDrawCanvasRef.current.width = physW;
            underDrawCanvasRef.current.height = physH;
          }
          if (drawCanvasRef.current) {
            drawCanvasRef.current.width = physW;
            drawCanvasRef.current.height = physH;
          }
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
        }
      });
      if (wrapperRef.current) observer.observe(wrapperRef.current);

      // Keep custom price scale badges & overlays synced during Y-axis drag / wheel / double-click
      let scaleSyncRaf = 0;
      const scheduleScaleSync = () => {
        if (scaleSyncRaf) return;
        scaleSyncRaf = requestAnimationFrame(() => {
          scaleSyncRaf = 0;
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
        });
      };
      const onPointerDrag = (e: PointerEvent) => {
        if (e.buttons !== 0) scheduleScaleSync();
      };
      const wrapEl = wrapperRef.current;
      wrapEl?.addEventListener('pointermove', onPointerDrag, { passive: true });
      wrapEl?.addEventListener('wheel', scheduleScaleSync, { passive: true });
      wrapEl?.addEventListener('dblclick', scheduleScaleSync, { passive: true });

      return () => {
        if (scaleSyncRaf) cancelAnimationFrame(scaleSyncRaf);
        wrapEl?.removeEventListener('pointermove', onPointerDrag);
        wrapEl?.removeEventListener('wheel', scheduleScaleSync);
        wrapEl?.removeEventListener('dblclick', scheduleScaleSync);
        if (zoomSaveTimerRef.current) window.clearTimeout(zoomSaveTimerRef.current);
        observer.disconnect();
        chart.remove();
        chartRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync Crosshair visibility based on cursor tool (Crosshair vs Dot vs Arrow)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      if (activeTool === 'arrow') {
        if (crosshairTagElRef.current) crosshairTagElRef.current.style.visibility = 'hidden';
        if (crosshairPlusBtnElRef.current) crosshairPlusBtnElRef.current.style.visibility = 'hidden';
        chart.applyOptions({
          crosshair: {
            vertLine: { visible: false },
            horzLine: { visible: false, labelVisible: false },
          },
        });
      } else {
        chart.applyOptions({
          crosshair: {
            vertLine: { visible: true, color: '#9598a1', style: LineStyle.Dashed },
            horzLine: { visible: true, color: '#9598a1', style: LineStyle.Dashed, labelVisible: false },
          },
        });
      }
    }, [activeTool]);

    // Initialize / teardown RSI Sub-Pane
    useEffect(() => {
      if (!indicators.rsi.enabled || indicators.rsi.hidden || !rsiContainerRef.current) {
        if (rsiChartRef.current) {
          rsiChartRef.current.remove();
          rsiChartRef.current = null;
          rsiSeriesRef.current = null;
        }
        return;
      }

      const rsiChart = createChart(rsiContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDarkMode ? '#d1d4dc' : '#131722',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
          horzLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
        },
        rightPriceScale: {
          borderColor: isDarkMode ? '#2a2e39' : '#e0e3eb',
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          visible: false,
          rightOffset: savedZoomRef.current.rightOffset,
        },
        crosshair: { mode: CrosshairMode.Normal },
      });

      const rsiSeries = rsiChart.addLineSeries({
        color: indicators.rsi.color,
        lineWidth: 2,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(242, 54, 69, 0.55)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(8, 153, 129, 0.55)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '30',
      });

      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiSeries;

      rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && chartRef.current && !isSyncingRangeRef.current) {
          isSyncingRangeRef.current = true;
          chartRef.current.timeScale().setVisibleLogicalRange(range);
          isSyncingRangeRef.current = false;
        }
      });

      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const { width, height } = e.contentRect;
          if (width > 0 && height > 0) rsiChart.applyOptions({ width, height });
        }
      });
      ro.observe(rsiContainerRef.current);

      return () => {
        ro.disconnect();
        rsiChart.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      };
    }, [indicators.rsi.enabled, indicators.rsi.hidden, indicators.rsi.color, isDarkMode]);

    // Sync Theme + ALL Chart Settings (Canvas, Scales, Symbol, Crosshair, Watermark, Margins)
    useEffect(() => {
      const chart = chartRef.current;
      const cs = candleSeriesRef.current;
      const ls = lineSeriesRef.current;
      const as = areaSeriesRef.current;
      if (!chart || !cs || !ls || !as) return;

      const { canvas: cv, scales: sc, symbol: symCfg } = chartSettings;
      const bg1 = cv.backgroundColor || (isDarkMode ? '#131722' : '#ffffff');
      const bg2 = cv.backgroundColor2 || (isDarkMode ? '#1e222d' : '#f0f3fa');
      const vGridCol = cv.vertGridColor || (isDarkMode ? '#1e222d' : '#f0f3fa');
      const hGridCol = cv.horzGridColor || (isDarkMode ? '#1e222d' : '#f0f3fa');
      const txtCol = cv.scaleTextColor || (isDarkMode ? '#d1d4dc' : '#131722');
      const borderCol = cv.scaleLineColor || (isDarkMode ? '#2a2e39' : '#e0e3eb');

      const chStyle =
        cv.crosshairStyle === 'solid'
          ? LineStyle.Solid
          : cv.crosshairStyle === 'dotted'
          ? LineStyle.Dotted
          : LineStyle.Dashed;

      const priceMode =
        scaleMode === 'pct'
          ? PriceScaleMode.Percentage
          : scaleMode === 'log'
          ? PriceScaleMode.Logarithmic
          : scaleMode === 'indexed100'
          ? PriceScaleMode.IndexedTo100
          : PriceScaleMode.Normal;

      const marginTop = Math.max(0.02, Math.min(0.4, cv.marginTop / 100));
      const marginBottom = Math.max(0.02, Math.min(0.45, cv.marginBottom / 100));
      const isLeftScale = sc.scalesPlacement === 'left';
      const targetScaleId = isLeftScale ? 'left' : 'right';

      const showWatermark =
        cv.watermarkMode === 'symbol' || (cv.watermarkMode === 'replay' && isReplayMode);
      const watermarkText =
        cv.watermarkMode === 'replay' && isReplayMode
          ? `${symbol} · REPLAY`
          : `${symbol}, ${interval.toUpperCase()}`;

      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: txtCol,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
          fontSize: cv.scaleFontSize || 11,
        },
        grid: {
          vertLines: { visible: cv.vertGridEnabled, color: vGridCol },
          horzLines: { visible: cv.horzGridEnabled, color: hGridCol },
        },
        crosshair:
          activeTool === 'arrow'
            ? { vertLine: { visible: false }, horzLine: { visible: false, labelVisible: false } }
            : {
                vertLine: { visible: true, color: cv.crosshairColor || '#9598a1', style: chStyle },
                horzLine: {
                  visible: true,
                  color: cv.crosshairColor || '#9598a1',
                  style: chStyle,
                  labelVisible: false,
                },
              },
        rightPriceScale: {
          visible: !isLeftScale,
          borderColor: borderCol,
          autoScale: sc.autoScale,
          invertScale: sc.invertScale,
          minimumWidth: 70,
          mode: priceMode,
          scaleMargins: { top: marginTop, bottom: marginBottom },
        },
        leftPriceScale: {
          visible: isLeftScale,
          borderColor: borderCol,
          autoScale: sc.autoScale,
          invertScale: sc.invertScale,
          minimumWidth: 70,
          mode: priceMode,
          scaleMargins: { top: marginTop, bottom: marginBottom },
        },
        timeScale: { borderColor: borderCol },
        watermark: {
          visible: showWatermark,
          fontSize: 42,
          horzAlign: 'center',
          vertAlign: 'center',
          color: cv.watermarkColor || 'rgba(120, 123, 134, 0.14)',
          text: watermarkText,
        },
      });

      if (rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          layout: { textColor: txtCol },
          grid: {
            vertLines: { visible: cv.vertGridEnabled, color: vGridCol },
            horzLines: { visible: cv.horzGridEnabled, color: hGridCol },
          },
          rightPriceScale: { visible: !isLeftScale, borderColor: borderCol },
          leftPriceScale: { visible: isLeftScale, borderColor: borderCol },
        });
      }

      const showCandle = chartType === 'candles' || chartType === 'hollow' || chartType === 'heikin';
      const showSymLine = sc.symbolLabel === 'value_line';

      const defaultBorder = isDarkMode ? symCfg.upColor : symCfg.borderUpColor;
      const defaultBorderDown = isDarkMode ? symCfg.downColor : symCfg.borderDownColor;
      const defaultWickUp =
        isDarkMode && symCfg.wickUpColor === '#131722' ? '#d1d4dc' : symCfg.wickUpColor;
      const defaultWickDown =
        isDarkMode && symCfg.wickDownColor === '#131722' ? '#d1d4dc' : symCfg.wickDownColor;

      cs.applyOptions({
        priceScaleId: targetScaleId,
        visible: showCandle,
        upColor:
          !symCfg.bodyEnabled || chartType === 'hollow' ? 'transparent' : symCfg.upColor,
        downColor: !symCfg.bodyEnabled ? 'transparent' : symCfg.downColor,
        borderVisible: symCfg.bordersEnabled || chartType === 'hollow',
        borderUpColor: chartType === 'hollow' ? '#089981' : defaultBorder,
        borderDownColor: chartType === 'hollow' ? '#f23645' : defaultBorderDown,
        wickVisible: symCfg.wickEnabled,
        wickUpColor: chartType === 'hollow' ? '#089981' : defaultWickUp,
        wickDownColor: chartType === 'hollow' ? '#f23645' : defaultWickDown,
        lastValueVisible: false,
        priceLineVisible: showSymLine,
      });

      ls.applyOptions({
        priceScaleId: targetScaleId,
        visible: chartType === 'line',
        color: symCfg.upColor,
        lastValueVisible: false,
        priceLineVisible: showSymLine,
      });
      as.applyOptions({
        priceScaleId: targetScaleId,
        visible: chartType === 'area',
        lineColor: symCfg.upColor,
        lastValueVisible: false,
        priceLineVisible: showSymLine,
      });

      [
        sma1SeriesRef.current,
        sma2SeriesRef.current,
        sma3SeriesRef.current,
        ema1SeriesRef.current,
        ema2SeriesRef.current,
        ema3SeriesRef.current,
        bbUpperSeriesRef.current,
        bbMidSeriesRef.current,
        bbLowerSeriesRef.current,
      ].forEach((s) => {
        s?.applyOptions({ priceScaleId: targetScaleId, lastValueVisible: false });
      });

      drawEmaCloud();
      requestAnimationFrame(() => updateCountdownPos());
    }, [chartSettings, isDarkMode, chartType, scaleMode, activeTool, symbol, interval, isReplayMode, drawEmaCloud, updateCountdownPos]);

    // Update all series data & STRICTLY PRESERVE PER-COIN ZOOM/POSITION across coin & timeframe switches
    useEffect(() => {
      const chart = chartRef.current;
      const cs = candleSeriesRef.current;
      const ls = lineSeriesRef.current;
      const as = areaSeriesRef.current;
      const vs = volumeSeriesRef.current;
      const vms = volMaSeriesRef.current;
      const s1 = sma1SeriesRef.current;
      const s2 = sma2SeriesRef.current;
      const s3 = sma3SeriesRef.current;
      const e1 = ema1SeriesRef.current;
      const e2 = ema2SeriesRef.current;
      const e3 = ema3SeriesRef.current;
      const bbu = bbUpperSeriesRef.current;
      const bbm = bbMidSeriesRef.current;
      const bbl = bbLowerSeriesRef.current;

      if (
        !chart ||
        !cs ||
        !ls ||
        !as ||
        !vs ||
        !vms ||
        !s1 ||
        !s2 ||
        !s3 ||
        !e1 ||
        !e2 ||
        !e3 ||
        !bbu ||
        !bbm ||
        !bbl
      ) {
        return;
      }
      if (!effectiveCandles.length) return;

      const toLwLineStyle = (st: DrawingLineStyle): LineStyle =>
        st === 'dashed'
          ? LineStyle.Dashed
          : st === 'dotted'
          ? LineStyle.Dotted
          : LineStyle.Solid;

      const volCfg = indicators.volume;
      const seCfg = indicators.smaEma;

      const buildVolBar = (idx: number): VolumeBar => {
        const rawV = effectiveVolumes[idx];
        const c = effectiveCandles[idx];
        const prevClose = idx > 0 ? effectiveCandles[idx - 1].close : c.open;
        const isUp = volCfg.colorBasedOnPrevClose
          ? c.close >= prevClose
          : c.close >= c.open;
        return {
          time: rawV.time,
          value: rawV.value,
          color: isUp ? volCfg.growingColor : volCfg.fallingColor,
        };
      };

      const key = `${symbol}_${interval}`;
      const isSymbolOrTfSwitch = prevSymIntervalRef.current !== key;
      const prevSnap = prevSeriesStateRef.current;
      const lastRawCandle = effectiveCandles[effectiveCandles.length - 1];
      const lastIdx = effectiveCandles.length - 1;
      const lastStyledVol = effectiveVolumes.length ? buildVolBar(effectiveVolumes.length - 1) : null;

      const seActiveOnTf =
        seCfg.enabled &&
        !seCfg.hidden &&
        isVisibilityActiveOnTimeframe(seCfg.visibility, interval);
      const volActiveOnTf =
        volCfg.enabled &&
        !volCfg.hidden &&
        isVisibilityActiveOnTimeframe(volCfg.visibility, interval);

      // Zero-jank in-place .update() fast path for live sub-second / 1-second candle ticks
      const isLiveTickOnly =
        !isSymbolOrTfSwitch &&
        prevSnap !== null &&
        prevSnap.key === key &&
        prevSnap.chartType === chartType &&
        chartType !== 'heikin' &&
        prevSnap.symbolSettings === chartSettings.symbol &&
        prevSnap.scalesPlacement === chartSettings.scales.scalesPlacement &&
        prevSnap.autoScale === chartSettings.scales.autoScale &&
        prevSnap.indicators === indicators &&
        !isReplayMode &&
        !prevSnap.isReplay &&
        effectiveCandles[0].time === prevSnap.firstTime &&
        (effectiveCandles.length === prevSnap.length ||
          effectiveCandles.length === prevSnap.length + 1) &&
        lastRawCandle.time >= prevSnap.lastTime;

      if (isLiveTickOnly) {
        const plottedLast = chartSettings.symbol.colorBasedOnPrevClose
          ? (() => {
              const prevBarClose =
                effectiveCandles.length > 1
                  ? effectiveCandles[effectiveCandles.length - 2].close
                  : lastRawCandle.open;
              const up = lastRawCandle.close >= prevBarClose;
              return {
                ...lastRawCandle,
                color: chartSettings.symbol.bodyEnabled
                  ? up
                    ? chartSettings.symbol.upColor
                    : chartSettings.symbol.downColor
                  : 'transparent',
                borderColor: up
                  ? chartSettings.symbol.borderUpColor
                  : chartSettings.symbol.borderDownColor,
                wickColor: up
                  ? chartSettings.symbol.wickUpColor
                  : chartSettings.symbol.wickDownColor,
              };
            })()
          : lastRawCandle;

        try {
          cs.update(plottedLast as never);
          const closePt = { time: lastRawCandle.time as UTCTimestamp, value: lastRawCandle.close };
          ls.update(closePt);
          as.update(closePt);
          if (lastStyledVol) vs.update(lastStyledVol as never);

          const sma1 = seCfg.sma1.enabled ? computeSMA(effectiveCandles, seCfg.sma1.period, seCfg.sma1.source) : [];
          const sma2 = seCfg.sma2.enabled ? computeSMA(effectiveCandles, seCfg.sma2.period, seCfg.sma2.source) : [];
          const sma3 = seCfg.sma3.enabled ? computeSMA(effectiveCandles, seCfg.sma3.period, seCfg.sma3.source) : [];
          const ema1 = seCfg.ema1.enabled ? computeEMA(effectiveCandles, seCfg.ema1.period, seCfg.ema1.source) : [];
          const ema2 = seCfg.ema2.enabled ? computeEMA(effectiveCandles, seCfg.ema2.period, seCfg.ema2.source) : [];
          const ema3 = seCfg.ema3.enabled ? computeEMA(effectiveCandles, seCfg.ema3.period, seCfg.ema3.source) : [];
          const volMa = computeVolumeSMA(effectiveVolumes, volCfg.maPeriod);
          const bb = indicators.bb.enabled
            ? computeBollingerBands(effectiveCandles, indicators.bb.period, indicators.bb.stdDev)
            : { upper: [], middle: [], lower: [] };
          const rsiData =
            indicators.rsi.enabled && !indicators.rsi.hidden
              ? computeRSI(effectiveCandles, indicators.rsi.period)
              : [];

          ema1Ref.current = ema1;
          ema2Ref.current = ema2;

          if (sma1.length) s1.update(sma1[sma1.length - 1] as never);
          if (sma2.length) s2.update(sma2[sma2.length - 1] as never);
          if (sma3.length) s3.update(sma3[sma3.length - 1] as never);
          if (ema1.length) e1.update(ema1[ema1.length - 1] as never);
          if (ema2.length) e2.update(ema2[ema2.length - 1] as never);
          if (ema3.length) e3.update(ema3[ema3.length - 1] as never);
          if (volMa.length) vms.update(volMa[volMa.length - 1] as never);
          if (bb.upper.length) bbu.update(bb.upper[bb.upper.length - 1] as never);
          if (bb.middle.length) bbm.update(bb.middle[bb.middle.length - 1] as never);
          if (bb.lower.length) bbl.update(bb.lower[bb.lower.length - 1] as never);
          if (rsiSeriesRef.current && indicators.rsi.enabled && !indicators.rsi.hidden && rsiData.length) {
            rsiSeriesRef.current.update(rsiData[rsiData.length - 1] as never);
          }

          const nextIndVals = {
            sma1: sma1[sma1.length - 1]?.value,
            sma2: sma2[sma2.length - 1]?.value,
            sma3: sma3[sma3.length - 1]?.value,
            ema1: ema1[ema1.length - 1]?.value,
            ema2: ema2[ema2.length - 1]?.value,
            ema3: ema3[ema3.length - 1]?.value,
            bbUpper: bb.upper[bb.upper.length - 1]?.value,
            bbMid: bb.middle[bb.middle.length - 1]?.value,
            bbLower: bb.lower[bb.lower.length - 1]?.value,
            volMa: volMa[volMa.length - 1]?.value,
            rsi: rsiData[rsiData.length - 1]?.value,
          };
          indValuesRef.current = nextIndVals;
          setIndValues(nextIndVals);

          prevSeriesStateRef.current = {
            ...prevSnap,
            lastTime: lastRawCandle.time,
            length: effectiveCandles.length,
          };

          requestAnimationFrame(() => {
            drawEmaCloud();
            redrawOverlay();
            updateCountdownPos();
          });
          return;
        } catch {
          // Fall through cleanly to full setData() if lightweight-charts rejects an out-of-order point
        }
      }

      const prevRange = chart.timeScale().getVisibleLogicalRange();
      let prependedCount = 0;
      if (
        !isSymbolOrTfSwitch &&
        prevFirstCandleTimeRef.current !== null &&
        effectiveCandles[0].time < prevFirstCandleTimeRef.current
      ) {
        const oldIdx = effectiveCandles.findIndex((c) => c.time === prevFirstCandleTimeRef.current);
        if (oldIdx > 0) prependedCount = oldIdx;
      }

      // Guard against internal setData range emissions clobbering saved zoom!
      isApplyingZoomRef.current = true;

      const lastClose = effectiveCandles[lastIdx].close;
      const prec =
        chartSettings.symbol.precision === 'default'
          ? getPrecision(lastClose)
          : parseInt(chartSettings.symbol.precision, 10);
      const minMove = Math.pow(10, -prec);
      const priceFormat = {
        type: 'custom' as const,
        minMove,
        formatter: (price: number) => fmtPrice(price, prec),
      };

      const sePrec =
        seCfg.precision === 'default' ? prec : parseInt(seCfg.precision, 10);
      const sePriceFormat = {
        type: 'custom' as const,
        minMove: Math.pow(10, -sePrec),
        formatter: (price: number) => fmtPrice(price, sePrec),
      };

      const applyMaOpts = (
        ser: ISeriesApi<'Line'>,
        cfg: typeof seCfg.ema1
      ) => {
        ser.applyOptions({
          priceFormat: sePriceFormat,
          visible: seActiveOnTf && cfg.enabled,
          color: cfg.color,
          lineWidth: Math.max(1, Math.min(4, cfg.lineWidth)) as 1 | 2 | 3 | 4,
          lineStyle: toLwLineStyle(cfg.lineStyle),
        });
      };

      cs.applyOptions({ priceFormat });
      ls.applyOptions({ priceFormat });
      as.applyOptions({ priceFormat });
      applyMaOpts(s1, seCfg.sma1);
      applyMaOpts(s2, seCfg.sma2);
      applyMaOpts(s3, seCfg.sma3);
      applyMaOpts(e1, seCfg.ema1);
      applyMaOpts(e2, seCfg.ema2);
      applyMaOpts(e3, seCfg.ema3);

      const bbVisible = indicators.bb.enabled && !indicators.bb.hidden;
      bbu.applyOptions({ priceFormat, visible: bbVisible, color: indicators.bb.color });
      bbm.applyOptions({ priceFormat, visible: bbVisible, color: indicators.bb.color });
      bbl.applyOptions({ priceFormat, visible: bbVisible, color: indicators.bb.color });

      vs.applyOptions({ visible: volActiveOnTf && volCfg.showVolume });
      vms.applyOptions({
        visible: volActiveOnTf && volCfg.showMa,
        color: volCfg.maColor || '#9c27b0',
        lineWidth: Math.max(1, Math.min(4, volCfg.maLineWidth)) as 1 | 2 | 3 | 4,
        lineStyle: toLwLineStyle(volCfg.maLineStyle),
      });

      chart.timeScale().applyOptions({
        timeVisible: !['1d', '1w'].includes(interval),
      });

      const baseCandles = chartType === 'heikin' ? toHeikinAshi(effectiveCandles) : effectiveCandles;
      const plottedCandles = chartSettings.symbol.colorBasedOnPrevClose
        ? baseCandles.map((c, idx) => {
            const prevClose = idx > 0 ? baseCandles[idx - 1].close : c.open;
            const up = c.close >= prevClose;
            return {
              ...c,
              color: chartSettings.symbol.bodyEnabled
                ? up
                  ? chartSettings.symbol.upColor
                  : chartSettings.symbol.downColor
                : 'transparent',
              borderColor: up
                ? chartSettings.symbol.borderUpColor
                : chartSettings.symbol.borderDownColor,
              wickColor: up
                ? chartSettings.symbol.wickUpColor
                : chartSettings.symbol.wickDownColor,
            };
          })
        : baseCandles;
      cs.setData(plottedCandles as never);
      const closeLine = effectiveCandles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }));
      ls.setData(closeLine);
      as.setData(closeLine);

      const styledVolumes = effectiveVolumes.map((_, idx) => buildVolBar(idx));
      vs.setData(styledVolumes as never);

      // Compute Indicators
      const sma1 = seCfg.sma1.enabled ? computeSMA(effectiveCandles, seCfg.sma1.period, seCfg.sma1.source) : [];
      const sma2 = seCfg.sma2.enabled ? computeSMA(effectiveCandles, seCfg.sma2.period, seCfg.sma2.source) : [];
      const sma3 = seCfg.sma3.enabled ? computeSMA(effectiveCandles, seCfg.sma3.period, seCfg.sma3.source) : [];
      const ema1 = seCfg.ema1.enabled ? computeEMA(effectiveCandles, seCfg.ema1.period, seCfg.ema1.source) : [];
      const ema2 = seCfg.ema2.enabled ? computeEMA(effectiveCandles, seCfg.ema2.period, seCfg.ema2.source) : [];
      const ema3 = seCfg.ema3.enabled ? computeEMA(effectiveCandles, seCfg.ema3.period, seCfg.ema3.source) : [];
      const volMa = computeVolumeSMA(effectiveVolumes, volCfg.maPeriod);
      const bb = indicators.bb.enabled
        ? computeBollingerBands(effectiveCandles, indicators.bb.period, indicators.bb.stdDev)
        : { upper: [], middle: [], lower: [] };
      const rsiData =
        indicators.rsi.enabled && !indicators.rsi.hidden
          ? computeRSI(effectiveCandles, indicators.rsi.period)
          : [];

      ema1Ref.current = ema1;
      ema2Ref.current = ema2;

      s1.setData(sma1 as never);
      s2.setData(sma2 as never);
      s3.setData(sma3 as never);
      e1.setData(ema1 as never);
      e2.setData(ema2 as never);
      e3.setData(ema3 as never);
      vms.setData(volMa as never);
      bbu.setData(bb.upper as never);
      bbm.setData(bb.middle as never);
      bbl.setData(bb.lower as never);

      if (rsiSeriesRef.current && indicators.rsi.enabled && !indicators.rsi.hidden) {
        rsiSeriesRef.current.setData(rsiData as never);
      }

      const nextIndVals = {
        sma1: sma1[sma1.length - 1]?.value,
        sma2: sma2[sma2.length - 1]?.value,
        sma3: sma3[sma3.length - 1]?.value,
        ema1: ema1[ema1.length - 1]?.value,
        ema2: ema2[ema2.length - 1]?.value,
        ema3: ema3[ema3.length - 1]?.value,
        bbUpper: bb.upper[bb.upper.length - 1]?.value,
        bbMid: bb.middle[bb.middle.length - 1]?.value,
        bbLower: bb.lower[bb.lower.length - 1]?.value,
        volMa: volMa[volMa.length - 1]?.value,
        rsi: rsiData[rsiData.length - 1]?.value,
      };
      indValuesRef.current = nextIndVals;
      setIndValues(nextIndVals);

      if (isSymbolOrTfSwitch) {
        prevSymIntervalRef.current = key;
        chart
          .priceScale(chartSettings.scales.scalesPlacement)
          .applyOptions({ autoScale: chartSettings.scales.autoScale });

        // Restore this coin+timeframe's exact saved position/zoom if available!
        const perSymSaved = symbolViewportsRef.current[key];
        const chosenZoom = perSymSaved || savedZoomRef.current;
        const visibleBars = chosenZoom.visibleBars;
        let to = lastIdx + chosenZoom.rightOffset;

        if (perSymSaved?.toTime !== undefined && effectiveCandles.length > 5) {
          const firstT = effectiveCandles[0].time;
          const lastT = effectiveCandles[lastIdx].time;
          if (perSymSaved.toTime >= firstT && perSymSaved.toTime <= lastT) {
            let bestIdx = lastIdx;
            let bestDiff = Infinity;
            for (let i = 0; i <= lastIdx; i++) {
              const d = Math.abs(effectiveCandles[i].time - perSymSaved.toTime);
              if (d < bestDiff) {
                bestDiff = d;
                bestIdx = i;
              }
            }
            to = bestIdx;
          }
        }
        const from = to - visibleBars;

        chart.timeScale().setVisibleLogicalRange({ from, to });
        if (rsiChartRef.current) {
          rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to });
        }

        requestAnimationFrame(() => {
          chart.timeScale().setVisibleLogicalRange({ from, to });
          if (rsiChartRef.current) {
            rsiChartRef.current.timeScale().setVisibleLogicalRange({ from, to });
          }
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
          requestAnimationFrame(() => {
            updateCountdownPos();
            isApplyingZoomRef.current = false;
          });
        });
      } else if (prependedCount > 0 && prevRange) {
        const shifted = {
          from: prevRange.from + prependedCount,
          to: prevRange.to + prependedCount,
        };
        chart.timeScale().setVisibleLogicalRange(shifted);
        if (rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange(shifted);
        requestAnimationFrame(() => {
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
          requestAnimationFrame(() => {
            updateCountdownPos();
            isApplyingZoomRef.current = false;
          });
        });
      } else {
        requestAnimationFrame(() => {
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
          isApplyingZoomRef.current = false;
        });
      }

      prevFirstCandleTimeRef.current = effectiveCandles[0].time;
      prevSeriesStateRef.current = {
        key,
        chartType,
        symbolSettings: chartSettings.symbol,
        scalesPlacement: chartSettings.scales.scalesPlacement,
        autoScale: chartSettings.scales.autoScale,
        indicators,
        isReplay: isReplayMode,
        firstTime: effectiveCandles[0].time,
        lastTime: lastRawCandle.time,
        length: effectiveCandles.length,
      };
    }, [
      symbol,
      interval,
      chartType,
      isReplayMode,
      chartSettings.symbol,
      chartSettings.scales.scalesPlacement,
      chartSettings.scales.autoScale,
      effectiveCandles,
      effectiveVolumes,
      indicators,
      drawEmaCloud,
      redrawOverlay,
      updateCountdownPos,
    ]);

    // Sync Alerts, Positions (Entry/TP/SL), Limit Orders, High/Low, and Bid/Ask Price Lines
    useEffect(() => {
      const cs = candleSeriesRef.current;
      if (!cs) return;
      priceLinesRef.current.forEach((pl) => {
        try {
          cs.removePriceLine(pl);
        } catch {}
      });
      priceLinesRef.current = [];

      const lastPrice = effectiveCandles[effectiveCandles.length - 1]?.close || 0;

      // High & Low lines (Scales & Lines tab)
      if (chartSettings.scales.highLowLines !== 'hidden' && effectiveCandles.length > 0) {
        const recent = effectiveCandles.slice(-Math.round(savedZoomRef.current.visibleBars || 110));
        let hi = -Infinity;
        let lo = Infinity;
        for (const b of recent) {
          if (b.high > hi) hi = b.high;
          if (b.low < lo) lo = b.low;
        }
        const showLine = chartSettings.scales.highLowLines === 'value_line';
        if (Number.isFinite(hi) && Number.isFinite(lo)) {
          priceLinesRef.current.push(
            cs.createPriceLine({
              price: hi,
              color: chartSettings.scales.highLowColor || '#089981',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              lineVisible: showLine,
              axisLabelVisible: true,
              title: 'High',
            }),
            cs.createPriceLine({
              price: lo,
              color: chartSettings.scales.highLowColor || '#089981',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              lineVisible: showLine,
              axisLabelVisible: true,
              title: 'Low',
            })
          );
        }
      }

      // Bid & Ask lines (Scales & Lines tab)
      if (chartSettings.scales.bidAskLines === 'value_line' && lastPrice > 0) {
        const spread = lastPrice * 0.00025;
        priceLinesRef.current.push(
          cs.createPriceLine({
            price: lastPrice - spread,
            color: chartSettings.scales.bidColor || '#2962ff',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Bid',
          }),
          cs.createPriceLine({
            price: lastPrice + spread,
            color: chartSettings.scales.askColor || '#f23645',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Ask',
          })
        );
      }

      // Alert lines are rendered interactively on the overlay canvas + unified Price Scale stack
      // (grey dashed line + grey price scale badge; hover reveals text pill + delete + blue dot)

      // Trading Positions & Orders (Trading tab)
      if (chartSettings.trading.positionsAndOrders) {
        positions
          .filter((p) => p.symbol === symbol)
          .forEach((p) => {
            const pnlVal =
              lastPrice > 0
                ? (p.side === 'BUY' ? lastPrice - p.entryPrice : p.entryPrice - lastPrice) * p.qty
                : 0;
            const pnlPct =
              p.entryPrice > 0
                ? ((p.side === 'BUY' ? lastPrice - p.entryPrice : p.entryPrice - lastPrice) /
                    p.entryPrice) *
                  100
                : 0;
            const pnlTag = chartSettings.trading.pnlValueEnabled
              ? chartSettings.trading.pnlPositionMode === 'percent'
                ? ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`
                : ` (${pnlVal >= 0 ? '+' : ''}$${pnlVal.toFixed(2)})`
              : '';

            priceLinesRef.current.push(
              cs.createPriceLine({
                price: p.entryPrice,
                color: p.side === 'BUY' ? '#2962ff' : '#f23645',
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                lineVisible: chartSettings.trading.extendedPriceLines,
                axisLabelVisible: true,
                title: `${p.side === 'BUY' ? 'LONG' : 'SHORT'} ${p.qty}${pnlTag}`,
              })
            );
            if (p.takeProfit) {
              priceLinesRef.current.push(
                cs.createPriceLine({
                  price: p.takeProfit,
                  color: '#089981',
                  lineWidth: 1,
                  lineStyle: LineStyle.Dashed,
                  lineVisible: chartSettings.trading.extendedPriceLines,
                  axisLabelVisible: true,
                  title: 'TP',
                })
              );
            }
            if (p.stopLoss) {
              priceLinesRef.current.push(
                cs.createPriceLine({
                  price: p.stopLoss,
                  color: '#f23645',
                  lineWidth: 1,
                  lineStyle: LineStyle.Dashed,
                  lineVisible: chartSettings.trading.extendedPriceLines,
                  axisLabelVisible: true,
                  title: 'SL',
                })
              );
            }
          });

        limitOrders
          .filter((o) => o.symbol === symbol)
          .forEach((o) => {
            priceLinesRef.current.push(
              cs.createPriceLine({
                price: o.limitPrice,
                color: '#9c27b0',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                lineVisible: chartSettings.trading.extendedPriceLines,
                axisLabelVisible: true,
                title: `Limit ${o.side} ${o.qty}`,
              })
            );
          });
      }
    }, [
      symbol,
      alerts,
      positions,
      limitOrders,
      effectiveCandles,
      chartSettings.alerts,
      chartSettings.trading,
      chartSettings.scales.highLowLines,
      chartSettings.scales.highLowColor,
      chartSettings.scales.bidAskLines,
      chartSettings.scales.bidColor,
      chartSettings.scales.askColor,
    ]);

    // Close Scale Quick Menu & Plus Price Menu on outside click
    useEffect(() => {
      const onDown = (e: MouseEvent) => {
        if (scaleMenuRef.current && !scaleMenuRef.current.contains(e.target as Node)) {
          setScaleMenuOpen(false);
        }
        if (
          plusMenuRef.current &&
          !plusMenuRef.current.contains(e.target as Node) &&
          !crosshairPlusBtnElRef.current?.contains(e.target as Node)
        ) {
          setPlusMenuAnchor(null);
        }
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, []);

    // Redraw overlay & sync horizontal-line + alert price scale badges whenever drawings/alerts/visibility/timeframe change
    useEffect(() => {
      redrawOverlay();
      updateCountdownPos();
    }, [
      drawings,
      selectedDrawingId,
      drawingsHidden,
      interval,
      alerts,
      symbol,
      chartSettings.alerts,
      redrawOverlay,
      updateCountdownPos,
    ]);

    // Reset floating toolbar popovers when selection changes
    useEffect(() => {
      setToolbarMenu('none');
    }, [selectedDrawingId]);

    // Drag floating selected-drawing toolbar & floating favorites bar via their grip handles
    useEffect(() => {
      const onMove = (e: MouseEvent) => {
        if (toolbarDragRef.current) {
          const dx = e.clientX - toolbarDragRef.current.startX;
          const dy = e.clientY - toolbarDragRef.current.startY;
          setToolbarOffset({
            x: toolbarDragRef.current.origX + dx,
            y: toolbarDragRef.current.origY + dy,
          });
        }
        if (favBarDragRef.current) {
          const dx = e.clientX - favBarDragRef.current.startX;
          const dy = e.clientY - favBarDragRef.current.startY;
          const wrapW = wrapperRef.current?.clientWidth || window.innerWidth;
          const wrapH = wrapperRef.current?.clientHeight || window.innerHeight;
          const barW = favBarRef.current?.offsetWidth || 180;
          const barH = favBarRef.current?.offsetHeight || 42;
          const nextX = Math.max(8, Math.min(Math.max(8, wrapW - barW - 8), favBarDragRef.current.origX + dx));
          const nextY = Math.max(8, Math.min(Math.max(8, wrapH - barH - 34), favBarDragRef.current.origY + dy));
          setFavBarPos({ x: nextX, y: nextY });
        }
      };
      const onUp = () => {
        toolbarDragRef.current = null;
        if (favBarDragRef.current) {
          favBarDragRef.current = null;
          try {
            localStorage.setItem('tp_fav_bar_pos_v1', JSON.stringify(favBarPosRef.current));
          } catch {
            // ignore storage errors
          }
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }, []);

    // Live Clock (with Timezone & 12h/24h format) + Candle Countdown
    useEffect(() => {
      const tick = () => {
        const now = Date.now();
        const d = new Date();
        const tzSetting = chartSettings.symbol.timezone || 'local';
        const hour12 = chartSettings.scales.timeHoursFormat === '12';

        try {
          if (tzSetting === 'local') {
            const offsetMin = -d.getTimezoneOffset();
            const sign = offsetMin >= 0 ? '+' : '-';
            const oh = Math.floor(Math.abs(offsetMin) / 60);
            const om = Math.abs(offsetMin) % 60;
            const tz = `UTC${sign}${oh}${om ? ':' + String(om).padStart(2, '0') : ''}`;
            setClockStr(
              `${d.toLocaleTimeString('en-GB', { hour12 })} ${tz}`
            );
          } else {
            const formatted = d.toLocaleTimeString('en-GB', {
              timeZone: tzSetting,
              hour12,
            });
            const shortTz = tzSetting === 'UTC' ? 'UTC' : tzSetting.split('/')[1]?.replace('_', ' ') || tzSetting;
            setClockStr(`${formatted} (${shortTz})`);
          }
        } catch {
          setClockStr(d.toLocaleTimeString('en-GB', { hour12 }));
        }

        if (candleCloseMs > now && !isReplayMode && chartSettings.scales.countdownToBarClose) {
          const secLeft = Math.max(0, Math.floor((candleCloseMs - now) / 1000));
          let nextCd = '';
          if (secLeft >= 86400) {
            const days = Math.floor(secLeft / 86400);
            const hrs = String(Math.floor((secLeft % 86400) / 3600)).padStart(2, '0');
            nextCd = `${days}d ${hrs}h`;
          } else if (secLeft >= 3600) {
            const h = String(Math.floor(secLeft / 3600)).padStart(2, '0');
            const m = String(Math.floor((secLeft % 3600) / 60)).padStart(2, '0');
            const s = String(secLeft % 60).padStart(2, '0');
            nextCd = `${h}:${m}:${s}`;
          } else {
            const m = String(Math.floor(secLeft / 60)).padStart(2, '0');
            const s = String(secLeft % 60).padStart(2, '0');
            nextCd = `${m}:${s}`;
          }
          countdownStrRef.current = nextCd;
          setCountdownStr(nextCd);
        } else {
          countdownStrRef.current = '';
          setCountdownStr('');
        }
        updateCountdownPos();
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, [
      candleCloseMs,
      isReplayMode,
      chartSettings.symbol.timezone,
      chartSettings.scales.timeHoursFormat,
      chartSettings.scales.countdownToBarClose,
      updateCountdownPos,
    ]);

    const prevMarginRightRef = useRef<number>(chartSettings.canvas.marginRightBars);
    useEffect(() => {
      const nextRight = chartSettings.canvas.marginRightBars;
      if (prevMarginRightRef.current !== nextRight) {
        prevMarginRightRef.current = nextRight;
        applyZoomRange(savedZoomRef.current.visibleBars, nextRight);
      }
    }, [chartSettings.canvas.marginRightBars, applyZoomRange]);

    const handleScrollToMostRecent = useCallback(() => {
      const preferredRight =
        savedZoomRef.current.rightOffset >= 0 && savedZoomRef.current.rightOffset <= 40
          ? savedZoomRef.current.rightOffset
          : chartSettings.canvas.marginRightBars ?? 10;
      applyZoomRange(savedZoomRef.current.visibleBars, preferredRight);
      setShowScrollToRecent(false);
    }, [applyZoomRange, chartSettings.canvas.marginRightBars]);

    const applyScaleMode = useCallback(
      (mode: ScaleMode) => {
        setScaleMode(mode);
        const chart = chartRef.current;
        if (!chart) return;
        const priceMode =
          mode === 'pct'
            ? PriceScaleMode.Percentage
            : mode === 'log'
            ? PriceScaleMode.Logarithmic
            : mode === 'indexed100'
            ? PriceScaleMode.IndexedTo100
            : PriceScaleMode.Normal;
        const isAuto = mode === 'auto' ? true : chartSettings.scales.autoScale;
        chart
          .priceScale(chartSettings.scales.scalesPlacement)
          .applyOptions({ mode: priceMode, autoScale: isAuto });
      },
      [chartSettings.scales.autoScale, chartSettings.scales.scalesPlacement]
    );

    // Imperative handle
    useImperativeHandle(ref, () => ({
      resetZoom: () => applyZoomRange(110, chartSettings.canvas.marginRightBars ?? 10),
      zoomOut: () => applyZoomRange(savedZoomRef.current.visibleBars * 1.35),
      setVisibleBars: (bars: number) => applyZoomRange(bars),
      setScaleMode: (mode: ScaleMode) => applyScaleMode(mode),
      fitContent: () => {
        chartRef.current?.timeScale().fitContent();
      },
      captureSnapshot: async (): Promise<SnapshotCaptureResult | null> => {
        const chart = chartRef.current;
        if (!chart) return null;

        // Refresh badges & overlays immediately so snapshot reflects exact latest frame
        updateCountdownPos();

        const base = chart.takeScreenshot();
        if (!base || base.width === 0 || base.height === 0) return null;

        const cssW = wrapperRef.current?.clientWidth || base.width;
        const cssH = wrapperRef.current?.clientHeight || base.height;
        const scaleX = base.width / Math.max(1, cssW);
        const scaleY = base.height / Math.max(1, cssH);

        const padX = 8;
        const headerH = 24;
        const footerH = 34;
        const totalCssW = cssW + padX * 2;
        const totalCssH = headerH + cssH + footerH;

        const out = document.createElement('canvas');
        out.width = Math.round(totalCssW * scaleX);
        out.height = Math.round(totalCssH * scaleY);
        const ctx = out.getContext('2d');
        if (!ctx) return null;

        const TV_SNAP_FONT =
          '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
        const frameBg = isDarkMode ? '#131722' : '#ffffff';
        const frameText = isDarkMode ? '#d1d4dc' : '#131722';
        const frameMuted = isDarkMode ? '#868993' : '#787b86';
        const frameBorder = isDarkMode ? '#2a2e39' : '#e0e3eb';

        // 1. Outer TradingView snapshot margin background
        ctx.save();
        ctx.scale(scaleX, scaleY);
        ctx.fillStyle = frameBg;
        ctx.fillRect(0, 0, totalCssW, totalCssH);

        // 2. Top metadata bar ("Published on TradePulse, Nov 28, 2026 12:21 UTC")
        const now = new Date();
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ];
        const utcStr = `${months[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()} ${String(
          now.getUTCHours()
        ).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;
        ctx.font = `400 11px ${TV_SNAP_FONT}`;
        ctx.fillStyle = frameText;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(`Published on TradePulse, ${utcStr}`, padX, headerH / 2 + 1);

        // 3. Chart pane background inside (padX, headerH, cssW, cssH)
        ctx.save();
        ctx.beginPath();
        ctx.rect(padX, headerH, cssW, cssH);
        ctx.clip();

        const bg1 = chartSettings.canvas.backgroundColor || frameBg;
        if (chartSettings.canvas.backgroundType === 'gradient') {
          const grad = ctx.createLinearGradient(0, headerH, 0, headerH + cssH);
          grad.addColorStop(0, bg1);
          grad.addColorStop(
            1,
            chartSettings.canvas.backgroundColor2 || (isDarkMode ? '#1e222d' : '#f0f3fa')
          );
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = bg1;
        }
        ctx.fillRect(padX, headerH, cssW, cssH);

        // 4. Composite HiDPI chart layers in exact visual z-order
        if (cloudCanvasRef.current) {
          ctx.drawImage(cloudCanvasRef.current, padX, headerH, cssW, cssH);
        }
        if (underDrawCanvasRef.current) {
          ctx.drawImage(underDrawCanvasRef.current, padX, headerH, cssW, cssH);
        }
        ctx.drawImage(base, padX, headerH, cssW, cssH);
        if (drawCanvasRef.current) {
          ctx.drawImage(drawCanvasRef.current, padX, headerH, cssW, cssH);
        }

        // 5. Top-left Chart Status Line (Symbol · TF · Exchange + O H L C + Change)
        const arr = displayCandlesRef.current;
        const lastBar = arr.length ? arr[arr.length - 1] : null;
        const prevBar = arr.length > 1 ? arr[arr.length - 2] : lastBar;
        const prec =
          chartSettings.symbol.precision === 'default'
            ? getPrecision(lastBar?.close ?? 1)
            : parseInt(chartSettings.symbol.precision, 10);

        const tfLabel = interval.toUpperCase();
        const pairDisplayName =
          symbol.endsWith('USDT') && !symbolMeta.name.includes('/')
            ? `${symbolMeta.name} / TetherUS`
            : symbolMeta.name;
        const titleStr =
          chartSettings.statusLine.titleMode === 'ticker'
            ? `${symbol} · ${tfLabel}`
            : chartSettings.statusLine.titleMode === 'description'
            ? `${pairDisplayName} (${symbol}) · ${tfLabel} · Binance Spot`
            : `${pairDisplayName} · ${tfLabel} · Binance`;

        const placement = chartSettings.scales.scalesPlacement;
        const scaleW = chart.priceScale(placement).width() || rightScaleWidth || 70;
        const statusStartX = placement === 'left' ? padX + scaleW + 10 : padX + 10;
        const statusY = headerH + 13;
        let curX = statusStartX;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        if (chartSettings.statusLine.title) {
          ctx.font = `400 12px ${TV_SNAP_FONT}`;
          ctx.fillStyle = frameText;
          ctx.fillText(titleStr, curX, statusY);
          curX += ctx.measureText(titleStr).width + 10;
        }

        if (lastBar) {
          const baseRef = prevBar ? prevBar.close : lastBar.open;
          const diff = lastBar.close - baseRef;
          const pct = baseRef > 0 ? (diff / baseRef) * 100 : 0;
          const sign = diff >= 0 ? '+' : '−';
          const absDiff = fmtPrice(Math.abs(diff), prec);
          const absPct = Math.abs(pct).toFixed(2);

          ctx.font = `400 12px ${TV_SNAP_FONT}`;
          if (chartSettings.statusLine.ohlcValues) {
            const ohlcParts = [
              `O${fmtPrice(lastBar.open, prec)}`,
              `H${fmtPrice(lastBar.high, prec)}`,
              `L${fmtPrice(lastBar.low, prec)}`,
              `C${fmtPrice(lastBar.close, prec)}`,
            ];
            for (const part of ohlcParts) {
              ctx.fillStyle = frameText;
              ctx.fillText(part, curX, statusY);
              curX += ctx.measureText(part).width + 7;
            }
          }
          if (chartSettings.statusLine.barChangeValues) {
            const chgText = `${sign}${absDiff} (${sign}${absPct}%)`;
            ctx.fillStyle = frameText;
            ctx.fillText(chgText, curX, statusY);
          }
        }

        // 6. All Collision-Free Price Scale Colored Badges (Current Price + Countdown, EMAs, Vol, HLines, Positions, Alerts)
        const badges = scaleBadgesRef.current;
        const badgeW = Math.max(64, scaleW - 1);
        const badgeX = placement === 'left' ? padX : padX + cssW - badgeW;
        const badgeFontPx = chartSettings.canvas.scaleFontSize || 11;

        for (const badge of badges) {
          const by = headerH + badge.top;
          ctx.fillStyle = badge.bgColor;
          ctx.fillRect(badgeX, by, badgeW, badge.height);

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          if (badge.subText) {
            ctx.font = `600 ${badgeFontPx}px ${TV_SNAP_FONT}`;
            ctx.fillText(badge.text, badgeX + 7, by + 9.5);
            ctx.font = `500 ${badgeFontPx}px ${TV_SNAP_FONT}`;
            ctx.fillText(badge.subText, badgeX + 7, by + 23);
          } else {
            ctx.font = `600 ${badgeFontPx}px ${TV_SNAP_FONT}`;
            ctx.fillText(badge.text, badgeX + 7, by + badge.height / 2 + 0.5);
          }
        }

        ctx.restore(); // end chart clip

        // 7. Clean 1px hairline border framing the chart area (exact TradingView look)
        ctx.strokeStyle = frameBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(padX + 0.5, headerH + 0.5, cssW - 1, cssH - 1);

        // 8. Bottom-left Brand Footer Mark (crisp monochrome mark + TradePulse wordmark)
        const footerCenterY = headerH + cssH + footerH / 2 + 1;
        const logoX = padX + 2;
        ctx.fillStyle = frameText;
        // Minimal geometric TradingView-style mark (bar + dot + angled pulse slash)
        ctx.fillRect(logoX, footerCenterY - 5, 9, 2.6);
        ctx.fillRect(logoX + 4.4, footerCenterY - 5, 2.8, 10.5);
        ctx.beginPath();
        ctx.arc(logoX + 10.8, footerCenterY - 3.5, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(logoX + 14.5, footerCenterY - 5);
        ctx.lineTo(logoX + 17.5, footerCenterY - 5);
        ctx.lineTo(logoX + 13.8, footerCenterY + 5.5);
        ctx.lineTo(logoX + 10.8, footerCenterY + 5.5);
        ctx.closePath();
        ctx.fill();

        ctx.font = `700 13.5px ${TV_SNAP_FONT}`;
        ctx.fillStyle = frameText;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('TradePulse', logoX + 22, footerCenterY + 0.5);

        // Subtle right-aligned symbol/timeframe caption in footer
        ctx.font = `400 11px ${TV_SNAP_FONT}`;
        ctx.fillStyle = frameMuted;
        ctx.textAlign = 'right';
        ctx.fillText(`${symbol} · ${tfLabel}`, padX + cssW - 2, footerCenterY + 0.5);

        ctx.restore();

        // Format TradingView-style timestamped filename: BTCUSDT_2026-11-28_18-51-49.png
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(
          now.getHours()
        )}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;
        const filename = `${symbol}_${stamp}.png`;
        const dataUrl = out.toDataURL('image/png');

        const blob = await new Promise<Blob | null>((resolve) =>
          out.toBlob((b) => resolve(b), 'image/png')
        );
        if (!blob) return null;

        return { blob, dataUrl, filename };
      },
      takeSnapshot: () => {
        const handle = ref && typeof ref !== 'function' ? ref.current : null;
        if (handle) {
          void handle.captureSnapshot().then((res) => {
            if (!res) return;
            const a = document.createElement('a');
            a.href = res.dataUrl;
            a.download = res.filename;
            a.click();
          });
        }
      },
    }));

    // Convert screen coordinates -> AnchorPoint with Weak / Strong Magnet support
    const screenToAnchor = useCallback(
      (x: number, y: number, allowMagnet = true): AnchorPoint | null => {
        const chart = chartRef.current;
        const series = candleSeriesRef.current;
        if (!chart || !series) return null;
        const logical = chart.timeScale().coordinateToLogical(x);
        const rawPrice = series.coordinateToPrice(y);
        if (logical === null || rawPrice === null) return null;
        let price: number = Number(rawPrice);

        const arr = displayCandlesRef.current;
        if (allowMagnet && magnetMode !== 'off' && arr.length > 0) {
          const idx = Math.max(0, Math.min(arr.length - 1, Math.round(logical)));
          const bar = arr[idx];
          const candidates = [bar.open, bar.high, bar.low, bar.close];
          let best = candidates[0];
          let minDist = Infinity;
          for (const p of candidates) {
            const py = series.priceToCoordinate(p);
            if (py !== null && Math.abs(Number(py) - y) < minDist) {
              minDist = Math.abs(Number(py) - y);
              best = p;
            }
          }
          const threshold = magnetMode === 'strong' ? Infinity : 26;
          if (minDist < threshold) price = best;
        }

        const time = logicalToTime(logical);
        if (time === null) return null;
        return { time, price };
      },
      [logicalToTime, magnetMode]
    );

    const finalizeDrawing = useCallback(
      (shape: DrawingObject) => {
        onAddDrawing(shape);
        onSelectDrawingId(shape.id);
        setDrawingHint(null);
        if (!stayInDrawingRef.current) {
          onSelectTool('cursor');
        }
      },
      [onAddDrawing, onSelectDrawingId, onSelectTool]
    );

    // Angle-snappable drawing tools (Shift locks to exact 0°, 45°, 90°, 135°, 180° increments!)
    const ANGLE_SNAP_TOOLS = useMemo(
      () =>
        new Set<string>([
          'trendline',
          'ray',
          'infoline',
          'extended',
          'angle',
          'arrow_line',
          'channel',
          'flat_channel',
          'disjoint_channel',
          'callout',
          'path',
        ]),
      []
    );

    const updateDrawCrosshairTag = useCallback((sy: number, priceVal: number | null) => {
      const tagEl = crosshairTagElRef.current;
      const txtEl = crosshairPriceTextElRef.current;
      const plusBtnEl = crosshairPlusBtnElRef.current;
      if (plusBtnEl) plusBtnEl.style.visibility = 'hidden';
      if (!tagEl || !txtEl) return;
      if (priceVal === null || !Number.isFinite(priceVal) || sy < 10) {
        tagEl.style.visibility = 'hidden';
        return;
      }
      const arr = displayCandlesRef.current;
      const symCfg = chartSettingsRef.current.symbol;
      const refClose = arr.length ? arr[arr.length - 1].close : priceVal;
      const prec =
        symCfg.precision === 'default'
          ? getPrecision(refClose)
          : parseInt(symCfg.precision, 10);
      txtEl.textContent = fmtPrice(priceVal, prec);
      tagEl.style.transform = `translate3d(0, ${Math.round(sy - 9.5)}px, 0)`;
      tagEl.style.visibility = 'visible';
    }, []);

    // Snap a moving point to exact 45° multiples (0°, 45°, 90°, 135°, 180°, -135°, -90°, -45°) relative to fixedAnchor
    const snapPointTo45Degrees = useCallback(
      (
        fixedAnchor: AnchorPoint,
        rawSx: number,
        rawSy: number
      ): { sx: number; sy: number; anchor: AnchorPoint | null } => {
        const bridge = buildCoordBridge();
        const origin = bridge?.ptToScreen(fixedAnchor);
        if (!origin) {
          return { sx: rawSx, sy: rawSy, anchor: screenToAnchor(rawSx, rawSy, false) };
        }
        const dx = rawSx - origin.x;
        const dy = rawSy - origin.y;
        if (Math.hypot(dx, dy) < 1) {
          return { sx: rawSx, sy: rawSy, anchor: fixedAnchor };
        }

        const step = Math.PI / 4; // 45 degrees
        const sector = Math.round(Math.atan2(dy, dx) / step);
        const snappedAngle = sector * step;

        // Exact 0° or 180° -> pure horizontal (zero price drift!)
        if (sector === 0 || Math.abs(sector) === 4) {
          const a = screenToAnchor(rawSx, origin.y, false);
          return {
            sx: rawSx,
            sy: origin.y,
            anchor: a ? { time: a.time, price: fixedAnchor.price } : null,
          };
        }

        // Exact 90° or -90° -> pure vertical (zero bar/time drift!)
        if (Math.abs(sector) === 2) {
          const a = screenToAnchor(origin.x, rawSy, false);
          return {
            sx: origin.x,
            sy: rawSy,
            anchor: a ? { time: fixedAnchor.time, price: a.price } : null,
          };
        }

        // Exact ±45° / ±135° diagonal projection in screen space
        const ux = Math.cos(snappedAngle);
        const uy = Math.sin(snappedAngle);
        const proj = Math.max(0, dx * ux + dy * uy);
        const sx = origin.x + proj * ux;
        const sy = origin.y + proj * uy;
        return {
          sx,
          sy,
          anchor: screenToAnchor(sx, sy, false),
        };
      },
      [buildCoordBridge, screenToAnchor]
    );

    const cancelPendingDrawing = useCallback(() => {
      if (!tempShapeRef.current && !zoomBoxRef.current) return;
      tempShapeRef.current = null;
      zoomBoxRef.current = null;
      isDrawingRef.current = false;
      drawStageRef.current = 0;
      setDrawingHint(null);
      redrawOverlay();
    }, [redrawOverlay]);

    // Clear unfinished draft when user switches tool
    useEffect(() => {
      tempShapeRef.current = null;
      zoomBoxRef.current = null;
      isDrawingRef.current = false;
      drawStageRef.current = 0;
      drawCursorRef.current = null;
      setDrawingHint(null);
      redrawOverlay();
    }, [activeTool, redrawOverlay]);

    // Finish Path drawing on Enter or Double-Click
    const commitPathDrawing = useCallback(() => {
      const shape = tempShapeRef.current;
      if (shape && shape.type === 'path' && shape.points && shape.points.length >= 2) {
        tempShapeRef.current = null;
        isDrawingRef.current = false;
        drawStageRef.current = 0;
        drawCursorRef.current = null;
        finalizeDrawing(shape);
      }
    }, [finalizeDrawing]);

    // Shared live preview updater (called both on mousemove AND immediately when Shift is pressed/released!)
    const updateDraftPreviewAt = useCallback(
      (sx: number, sy: number, shiftHeld: boolean) => {
        const tool = activeToolRef.current;
        if (isCursorTool(tool)) return;

        if (tool === 'zoom_in' && isDrawingRef.current && zoomBoxRef.current) {
          zoomBoxRef.current.x2 = sx;
          zoomBoxRef.current.y2 = sy;
          drawCursorRef.current = { x: sx, y: sy };
          redrawOverlay();
          return;
        }

        const shape = tempShapeRef.current;
        if (!shape) {
          drawCursorRef.current = { x: sx, y: sy };
          const rawP = candleSeriesRef.current?.coordinateToPrice(sy);
          updateDrawCrosshairTag(sy, rawP !== null && rawP !== undefined ? Number(rawP) : null);
          redrawOverlay();
          return;
        }

        if (shape.type === 'path' && shape.points && shape.points.length >= 2) {
          const prevAnchor = shape.points[shape.points.length - 2];
          if (shiftHeld) {
            const snapped = snapPointTo45Degrees(prevAnchor, sx, sy);
            if (snapped.anchor) {
              shape.points[shape.points.length - 1] = snapped.anchor;
              drawCursorRef.current = { x: snapped.sx, y: snapped.sy };
              updateDrawCrosshairTag(snapped.sy, snapped.anchor.price);
            }
          } else {
            const pt = screenToAnchor(sx, sy);
            if (pt) {
              shape.points[shape.points.length - 1] = pt;
              drawCursorRef.current = { x: sx, y: sy };
              updateDrawCrosshairTag(sy, pt.price);
            }
          }
          redrawOverlay();
          return;
        }

        if (
          (shape.type === 'brush' || shape.type === 'highlighter') &&
          isDrawingRef.current &&
          shape.points
        ) {
          const pt = screenToAnchor(sx, sy);
          if (pt) {
            shape.points.push(pt);
            drawCursorRef.current = { x: sx, y: sy };
            updateDrawCrosshairTag(sy, pt.price);
            redrawOverlay();
          }
          return;
        }

        if (THREE_POINT_TOOLS.includes(tool)) {
          if (drawStageRef.current === 1 && shape.p1) {
            if (shiftHeld && ANGLE_SNAP_TOOLS.has(shape.type)) {
              const snapped = snapPointTo45Degrees(shape.p1, sx, sy);
              if (snapped.anchor) {
                shape.p2 = snapped.anchor;
                drawCursorRef.current = { x: snapped.sx, y: snapped.sy };
                updateDrawCrosshairTag(snapped.sy, snapped.anchor.price);
              }
            } else {
              const pt = screenToAnchor(sx, sy);
              if (pt) {
                shape.p2 = pt;
                drawCursorRef.current = { x: sx, y: sy };
                updateDrawCrosshairTag(sy, pt.price);
              }
            }
          } else if (drawStageRef.current === 2) {
            const pt = screenToAnchor(sx, sy);
            if (pt) {
              shape.p3 = pt;
              drawCursorRef.current = { x: sx, y: sy };
              updateDrawCrosshairTag(sy, pt.price);
            }
          }
          redrawOverlay();
          return;
        }

        // Standard 2-point rubber-band preview (Click #1 placed p1; mouse freely moves p2 until Click #2!)
        if (drawStageRef.current === 1 && shape.p1) {
          if (shiftHeld && ANGLE_SNAP_TOOLS.has(shape.type)) {
            const snapped = snapPointTo45Degrees(shape.p1, sx, sy);
            if (snapped.anchor) {
              shape.p2 = snapped.anchor;
              drawCursorRef.current = { x: snapped.sx, y: snapped.sy };
              updateDrawCrosshairTag(snapped.sy, snapped.anchor.price);
            }
          } else {
            const pt = screenToAnchor(sx, sy);
            if (pt) {
              shape.p2 = pt;
              drawCursorRef.current = { x: sx, y: sy };
              updateDrawCrosshairTag(sy, pt.price);
            }
          }
          redrawOverlay();
        }
      },
      [ANGLE_SNAP_TOOLS, redrawOverlay, screenToAnchor, snapPointTo45Degrees, updateDrawCrosshairTag]
    );

    // Shared drag-edit updater for existing drawings (supports Shift 45°/90°/180° angle lock on handles & body!)
    const applyDragEditAt = useCallback(
      (sx: number, sy: number, shiftHeld: boolean) => {
        const drag = dragEditRef.current;
        if (!drag) return;
        const { drawingId, handleKey, startAnchor, startScreen, origDrawing } = drag;

        let resolvedPt: AnchorPoint | null = null;
        if (
          shiftHeld &&
          handleKey === 'p2' &&
          origDrawing.p1 &&
          ANGLE_SNAP_TOOLS.has(origDrawing.type)
        ) {
          resolvedPt = snapPointTo45Degrees(origDrawing.p1, sx, sy).anchor;
        } else if (
          shiftHeld &&
          handleKey === 'p1' &&
          origDrawing.p2 &&
          ANGLE_SNAP_TOOLS.has(origDrawing.type)
        ) {
          resolvedPt = snapPointTo45Degrees(origDrawing.p2, sx, sy).anchor;
        } else if (shiftHeld && !handleKey) {
          // Shift-dragging whole drawing locks movement along 0°/45°/90°/180° axis from start point
          const dx = sx - startScreen.x;
          const dy = sy - startScreen.y;
          if (Math.hypot(dx, dy) >= 1) {
            const step = Math.PI / 4;
            const sector = Math.round(Math.atan2(dy, dx) / step);
            const ang = sector * step;
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const proj = Math.max(0, dx * ux + dy * uy);
            const snappedSx = sector === 0 || Math.abs(sector) === 4 ? sx : Math.abs(sector) === 2 ? startScreen.x : startScreen.x + proj * ux;
            const snappedSy = sector === 0 || Math.abs(sector) === 4 ? startScreen.y : Math.abs(sector) === 2 ? sy : startScreen.y + proj * uy;
            const rawSnap = screenToAnchor(snappedSx, snappedSy, false);
            if (rawSnap) {
              resolvedPt = {
                time: Math.abs(sector) === 2 ? startAnchor.time : rawSnap.time,
                price: sector === 0 || Math.abs(sector) === 4 ? startAnchor.price : rawSnap.price,
              };
            }
          }
        }

        const pt = resolvedPt || screenToAnchor(sx, sy, Boolean(handleKey) && !shiftHeld);
        if (!pt) return;

        const dt = pt.time - startAnchor.time;
        const dp = pt.price - startAnchor.price;

        onUpdateDrawing(drawingId, () => {
          const clone: DrawingObject = JSON.parse(JSON.stringify(origDrawing));
          if (handleKey === 'p1' && clone.p1) {
            if ((clone.type === 'long_pos' || clone.type === 'short_pos') && clone.p2) {
              clone.p1 = pt;
              clone.p2 = { ...clone.p2, price: pt.price };
            } else {
              clone.p1 = pt;
            }
          } else if (handleKey === 'p2' && clone.p2) {
            if ((clone.type === 'long_pos' || clone.type === 'short_pos') && clone.p1) {
              clone.p2 = { time: pt.time, price: clone.p1.price };
            } else {
              clone.p2 = pt;
            }
          } else if (handleKey === 'p3' && clone.p3) {
            clone.p3 = pt;
          } else if (handleKey === 'price') {
            clone.price = pt.price;
          } else if (handleKey === 'time') {
            clone.time = pt.time;
          } else if (handleKey === 'target') {
            if (clone.p1) {
              clone.targetPrice =
                clone.type === 'long_pos'
                  ? Math.max(clone.p1.price, pt.price)
                  : Math.min(clone.p1.price, pt.price);
            } else {
              clone.targetPrice = pt.price;
            }
          } else if (handleKey === 'stop') {
            if (clone.p1) {
              clone.stopPrice =
                clone.type === 'long_pos'
                  ? Math.min(clone.p1.price, pt.price)
                  : Math.max(clone.p1.price, pt.price);
            } else {
              clone.stopPrice = pt.price;
            }
          } else {
            // Translate whole drawing!
            if (clone.price !== undefined) clone.price += dp;
            if (clone.time !== undefined) clone.time += dt;
            if (clone.p1) clone.p1 = { time: clone.p1.time + dt, price: clone.p1.price + dp };
            if (clone.p2) clone.p2 = { time: clone.p2.time + dt, price: clone.p2.price + dp };
            if (clone.p3) clone.p3 = { time: clone.p3.time + dt, price: clone.p3.price + dp };
            if (clone.targetPrice !== undefined) clone.targetPrice += dp;
            if (clone.stopPrice !== undefined) clone.stopPrice += dp;
            if (clone.points) {
              clone.points = clone.points.map((p) => ({ time: p.time + dt, price: p.price + dp }));
            }
          }
          return clone;
        });
      },
      [ANGLE_SNAP_TOOLS, onUpdateDrawing, screenToAnchor, snapPointTo45Degrees]
    );

    // Keyboard listeners: Enter (commit Path), Esc (cancel in-progress draft), Shift press/release (instant 45/90/180 snap!)
    useEffect(() => {
      const refreshShiftSnap = (isShift: boolean) => {
        shiftPressedRef.current = isShift;
        const canvas = drawCanvasRef.current;
        const ptr = lastPointerClientRef.current;
        if (!canvas || !ptr) return;
        const rect = canvas.getBoundingClientRect();
        const sx = ptr.clientX - rect.left;
        const sy = ptr.clientY - rect.top;
        if (dragEditRef.current) {
          applyDragEditAt(sx, sy, isShift);
        } else if (tempShapeRef.current && !isCursorTool(activeToolRef.current)) {
          updateDraftPreviewAt(sx, sy, isShift);
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          if (!shiftPressedRef.current) refreshShiftSnap(true);
          return;
        }
        if (e.key === 'Enter' && tempShapeRef.current?.type === 'path') {
          e.preventDefault();
          commitPathDrawing();
          return;
        }
        if (e.key === 'Escape') {
          setDrawingContextMenu(null);
          setCtxSubmenu('none');
          if (tempShapeRef.current || zoomBoxRef.current) {
            cancelPendingDrawing();
          }
          return;
        }
        const tag = (e.target as HTMLElement | null)?.tagName;
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (isTyping) return;

        // Alt + A: Add alert on selected drawing
        if (e.altKey && (e.key === 'a' || e.key === 'A') && selectedIdRef.current) {
          const sel = drawingsRef.current.find((d) => d.id === selectedIdRef.current);
          if (sel) {
            e.preventDefault();
            onAddAlertFromDrawing(sel);
          }
          return;
        }
        // Ctrl + C: Copy selected drawing
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && selectedIdRef.current) {
          const sel = drawingsRef.current.find((d) => d.id === selectedIdRef.current);
          if (sel) {
            copiedDrawingRef.current = JSON.parse(JSON.stringify(sel));
          }
          return;
        }
        // Ctrl + V: Paste copied drawing
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && copiedDrawingRef.current) {
          e.preventDefault();
          const src = JSON.parse(JSON.stringify(copiedDrawingRef.current)) as DrawingObject;
          const refPrice =
            src.price ?? src.p1?.price ?? displayCandlesRef.current[displayCandlesRef.current.length - 1]?.close ?? 100;
          const dp = refPrice * 0.004;
          const pasted: DrawingObject = {
            ...src,
            id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            locked: false,
            hidden: false,
            price: src.price !== undefined ? src.price + dp : undefined,
            p1: src.p1 ? { ...src.p1, price: src.p1.price + dp } : undefined,
            p2: src.p2 ? { ...src.p2, price: src.p2.price + dp } : undefined,
            p3: src.p3 ? { ...src.p3, price: src.p3.price + dp } : undefined,
            points: src.points ? src.points.map((pt) => ({ ...pt, price: pt.price + dp })) : undefined,
            stopPrice: src.stopPrice !== undefined ? src.stopPrice + dp : undefined,
            targetPrice: src.targetPrice !== undefined ? src.targetPrice + dp : undefined,
          };
          onAddDrawing(pasted);
          onSelectDrawingId(pasted.id);
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          if (shiftPressedRef.current) refreshShiftSnap(false);
        }
      };

      const onWindowBlur = () => {
        shiftPressedRef.current = false;
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onWindowBlur);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onWindowBlur);
      };
    }, [
      applyDragEditAt,
      cancelPendingDrawing,
      commitPathDrawing,
      onAddAlertFromDrawing,
      onAddDrawing,
      onSelectDrawingId,
      updateDraftPreviewAt,
    ]);

    // Close right-click drawing context menu on outside mousedown
    useEffect(() => {
      if (!drawingContextMenu) return;
      const onDown = (e: MouseEvent) => {
        if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
          setDrawingContextMenu(null);
          setCtxSubmenu('none');
        }
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, [drawingContextMenu]);

    // Canvas Drawing Mouse Handlers (exact TradingView Click-Move-Click + Shift 45°/90°/180° Snap!)
    const handleDrawMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 2 && tempShapeRef.current) {
        e.preventDefault();
        cancelPendingDrawing();
        return;
      }
      if (e.button !== 0 || isCursorTool(activeTool)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const shiftHeld = e.shiftKey || shiftPressedRef.current;
      shiftPressedRef.current = shiftHeld;
      lastPointerClientRef.current = { clientX: e.clientX, clientY: e.clientY };

      // Zoom Box Tool (press-drag-release)
      if (activeTool === 'zoom_in') {
        zoomBoxRef.current = { x1: sx, y1: sy, x2: sx, y2: sy };
        isDrawingRef.current = true;
        redrawOverlay();
        return;
      }

      const pt = screenToAnchor(sx, sy);
      if (!pt) return;

      // Text Tool -> Open inline input right at clicked position
      if (activeTool === 'text') {
        setTextPrompt({ x: sx, y: sy, mode: 'text', p1: pt, value: '' });
        return;
      }

      // Path Multi-Point Tool
      if (activeTool === 'path') {
        if (!tempShapeRef.current) {
          tempShapeRef.current = {
            id: `d-${Date.now()}`,
            type: 'path',
            color: drawColor,
            lineWidth: 2,
            points: [pt, pt],
          };
          isDrawingRef.current = true;
          drawStageRef.current = 1;
        } else if (tempShapeRef.current.points && tempShapeRef.current.points.length >= 2) {
          const prevAnchor = tempShapeRef.current.points[tempShapeRef.current.points.length - 2];
          const nextPt = shiftHeld ? snapPointTo45Degrees(prevAnchor, sx, sy).anchor || pt : pt;
          tempShapeRef.current.points[tempShapeRef.current.points.length - 1] = nextPt;
          tempShapeRef.current.points.push(nextPt);
        }
        redrawOverlay();
        return;
      }

      // 3-Point Tools (Click #1 -> Move -> Click #2 -> Move -> Click #3)
      if (THREE_POINT_TOOLS.includes(activeTool)) {
        if (!tempShapeRef.current || drawStageRef.current === 0) {
          tempShapeRef.current = {
            id: `d-${Date.now()}`,
            type: activeTool as DrawingObject['type'],
            color: drawColor,
            lineWidth: 1.8,
            p1: pt,
            p2: pt,
          };
          isDrawingRef.current = true;
          drawStageRef.current = 1;
          drawCursorRef.current = { x: sx, y: sy };
          redrawOverlay();
          return;
        }
        if (drawStageRef.current === 1 && tempShapeRef.current.p1) {
          const finalP2 =
            shiftHeld && ANGLE_SNAP_TOOLS.has(activeTool)
              ? snapPointTo45Degrees(tempShapeRef.current.p1, sx, sy).anchor || pt
              : pt;
          tempShapeRef.current.p2 = finalP2;
          tempShapeRef.current.p3 = finalP2;
          drawStageRef.current = 2;
          redrawOverlay();
          return;
        }
        if (drawStageRef.current === 2 && tempShapeRef.current) {
          tempShapeRef.current.p3 = pt;
          const finished = tempShapeRef.current;
          tempShapeRef.current = null;
          isDrawingRef.current = false;
          drawStageRef.current = 0;
          drawCursorRef.current = null;
          finalizeDrawing(finished);
          return;
        }
      }

      // 1-Click Instant Tools
      if (ONE_CLICK_TOOLS.includes(activeTool)) {
        const id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (activeTool === 'hline') {
          finalizeDrawing({ id, type: 'hline', color: drawColor, lineWidth: 1.6, price: pt.price });
        } else if (activeTool === 'vline') {
          finalizeDrawing({ id, type: 'vline', color: drawColor, lineWidth: 1.6, time: pt.time });
        } else if (activeTool === 'hray' || activeTool === 'crossline' || activeTool === 'price_label') {
          finalizeDrawing({ id, type: activeTool, color: drawColor, lineWidth: 1.6, p1: pt });
        } else if (activeTool === 'long_pos' || activeTool === 'short_pos') {
          const step = INTERVAL_SECONDS[interval] || 86400;
          const isLong = activeTool === 'long_pos';
          const recent = effectiveCandles.slice(-30);
          const avgRange =
            recent.length > 0
              ? recent.reduce((acc, c) => acc + (c.high - c.low), 0) / recent.length
              : pt.price * 0.02;
          const riskDist = Math.max(pt.price * 0.004, avgRange * 1.6);
          const rewardDist = riskDist * 2.2;

          finalizeDrawing({
            id,
            type: activeTool,
            color: '#787b86',
            lineWidth: 1,
            lineStyle: 'solid',
            targetColor: 'rgba(8, 153, 129, 0.2)',
            stopColor: 'rgba(242, 54, 69, 0.2)',
            textColor: '#ffffff',
            fontSize: 12,
            accountSize: 1000,
            accountCurrency: 'Default',
            lotSize: 1,
            risk: 25,
            riskUnit: '%',
            leverage: 10000,
            qtyPrecision: 'Default',
            showPriceLabels: true,
            statsMode: 'all',
            compactStatsMode: false,
            alwaysShowStats: false,
            p1: pt,
            p2: { time: pt.time + step * 18, price: pt.price },
            targetPrice: isLong ? pt.price + rewardDist : pt.price - rewardDist,
            stopPrice: isLong ? pt.price - riskDist : pt.price + riskDist,
          });
        }
        return;
      }

      // Freehand Brush / Highlighter (press-drag-release)
      if (activeTool === 'brush' || activeTool === 'highlighter') {
        isDrawingRef.current = true;
        tempShapeRef.current = {
          id: `d-${Date.now()}`,
          type: activeTool,
          color: drawColor,
          lineWidth: activeTool === 'highlighter' ? 3 : 2,
          points: [pt],
        };
        redrawOverlay();
        return;
      }

      // Standard 2-Point Tools (Trendline, Ray, Info Line, Extended, Angle, Fib, Rect, Ellipse, Arrow, Callout, Measure, Ranges)
      // CLICK #1: Place start anchor p1 -> live preview follows mouse pointer!
      if (!tempShapeRef.current || drawStageRef.current === 0) {
        isDrawingRef.current = true;
        drawStageRef.current = 1;
        drawStartScreenRef.current = { x: sx, y: sy };
        tempShapeRef.current = {
          id: `d-${Date.now()}`,
          type: activeTool as DrawingObject['type'],
          color: drawColor,
          lineWidth: 2,
          p1: pt,
          p2: pt,
        };
        drawCursorRef.current = { x: sx, y: sy };
        redrawOverlay();
        return;
      }

      // CLICK #2: Lock final end anchor p2 (with Shift 45°/90°/180° snap if held) & commit drawing!
      if (drawStageRef.current === 1 && tempShapeRef.current && tempShapeRef.current.p1) {
        const shape = tempShapeRef.current;
        const finalP2 =
          shiftHeld && ANGLE_SNAP_TOOLS.has(shape.type)
            ? snapPointTo45Degrees(shape.p1!, sx, sy).anchor || pt
            : pt;
        shape.p2 = finalP2;

        tempShapeRef.current = null;
        isDrawingRef.current = false;
        drawStageRef.current = 0;
        drawCursorRef.current = null;

        if (shape.type === 'callout' && shape.p1 && shape.p2) {
          setTextPrompt({ x: sx, y: sy, mode: 'callout', p1: shape.p1, p2: shape.p2, value: '' });
          redrawOverlay();
          return;
        }

        finalizeDrawing(shape);
      }
    };

    const handleDrawMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isCursorTool(activeTool)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const shiftHeld = e.shiftKey || shiftPressedRef.current;
      shiftPressedRef.current = shiftHeld;
      lastPointerClientRef.current = { clientX: e.clientX, clientY: e.clientY };
      updateDraftPreviewAt(sx, sy, shiftHeld);
    };

    const handleDrawMouseLeave = () => {
      if (!isCursorTool(activeToolRef.current)) {
        drawCursorRef.current = null;
        if (crosshairTagElRef.current) crosshairTagElRef.current.style.visibility = 'hidden';
        redrawOverlay();
      }
    };

    // Complete brush / zoom-box drags & existing drawing handle/body drags on mouseup
    useEffect(() => {
      const handleMouseUp = () => {
        // Complete Zoom Box
        if (zoomBoxRef.current && isDrawingRef.current && activeToolRef.current === 'zoom_in') {
          const box = zoomBoxRef.current;
          zoomBoxRef.current = null;
          isDrawingRef.current = false;
          const chart = chartRef.current;
          const dist = Math.abs(box.x2 - box.x1);
          if (chart && dist > 15) {
            const l1 = chart.timeScale().coordinateToLogical(Math.min(box.x1, box.x2));
            const l2 = chart.timeScale().coordinateToLogical(Math.max(box.x1, box.x2));
            if (l1 !== null && l2 !== null && l2 - l1 >= 5) {
              const span = l2 - l1;
              savedZoomRef.current = { ...savedZoomRef.current, visibleBars: span };
              saveZoomState(savedZoomRef.current);
              isApplyingZoomRef.current = true;
              chart.timeScale().setVisibleLogicalRange({ from: l1, to: l2 });
              if (rsiChartRef.current) {
                rsiChartRef.current.timeScale().setVisibleLogicalRange({ from: l1, to: l2 });
              }
              requestAnimationFrame(() => {
                isApplyingZoomRef.current = false;
              });
            }
          } else if (chart) {
            applyZoomRange(savedZoomRef.current.visibleBars * 0.75);
          }
          redrawOverlay();
          if (!stayInDrawingRef.current) onSelectTool('cursor');
          return;
        }

        // Complete existing drawing handle/body drag
        if (dragEditRef.current) {
          dragEditRef.current = null;
          return;
        }

        // Complete freehand Brush & Highlighter on mouseup
        const shape = tempShapeRef.current;
        if (
          isDrawingRef.current &&
          shape &&
          (shape.type === 'brush' || shape.type === 'highlighter')
        ) {
          isDrawingRef.current = false;
          tempShapeRef.current = null;
          drawStageRef.current = 0;
          drawStartScreenRef.current = null;
          finalizeDrawing(shape);
          return;
        }

        // Also support TradingView Press-Drag-Release for 2-point tools (Trendline, Fib, Rect, etc.):
        // If user dragged >= 12px before releasing mouse, finalize immediately & return to free cursor!
        // If user just clicked (< 12px), keep drawStageRef === 1 for Click-Move-Click!
        if (
          isDrawingRef.current &&
          drawStageRef.current === 1 &&
          shape &&
          !THREE_POINT_TOOLS.includes(shape.type as DrawingTool) &&
          shape.type !== 'path' &&
          drawStartScreenRef.current &&
          drawCursorRef.current
        ) {
          const dragDist = Math.hypot(
            drawCursorRef.current.x - drawStartScreenRef.current.x,
            drawCursorRef.current.y - drawStartScreenRef.current.y
          );
          drawStartScreenRef.current = null;
          if (dragDist >= 12) {
            isDrawingRef.current = false;
            tempShapeRef.current = null;
            drawStageRef.current = 0;
            const endCursor = drawCursorRef.current;
            drawCursorRef.current = null;
            if (shape.type === 'callout' && shape.p1 && shape.p2) {
              setTextPrompt({
                x: endCursor.x,
                y: endCursor.y,
                mode: 'callout',
                p1: shape.p1,
                p2: shape.p2,
                value: '',
              });
              redrawOverlay();
              return;
            }
            finalizeDrawing(shape);
          }
        }
      };

      const handleWindowMouseMove = (e: MouseEvent) => {
        lastPointerClientRef.current = { clientX: e.clientX, clientY: e.clientY };
        shiftPressedRef.current = e.shiftKey;

        if (draggingAlertRef.current && drawCanvasRef.current && candleSeriesRef.current) {
          const rect = drawCanvasRef.current.getBoundingClientRect();
          const sy = Math.max(10, Math.min(rect.height - 30, e.clientY - rect.top));
          const nextPrice = candleSeriesRef.current.coordinateToPrice(sy);
          if (nextPrice !== null && Number.isFinite(Number(nextPrice))) {
            const pNum = Number(nextPrice);
            const cur = draggingAlertRef.current;
            draggingAlertRef.current = { id: cur.id, price: pNum, y: sy };
            const al = alertsRef.current.find((a) => a.id === cur.id);
            const arr = displayCandlesRef.current;
            const refClose = arr.length ? arr[arr.length - 1].close : pNum;
            const prec =
              chartSettingsRef.current.symbol.precision === 'default'
                ? getPrecision(refClose)
                : parseInt(chartSettingsRef.current.symbol.precision, 10);
            const condLabel =
              al?.condition === 'above'
                ? 'Crossing Up'
                : al?.condition === 'below'
                ? 'Crossing Down'
                : 'Crossing';
            const label = al?.note?.trim()
              ? al.note.trim()
              : `${symbolRef.current} ${condLabel} ${fmtPrice(pNum, prec)}`;
            setAlertHoverInfo({ id: cur.id, y: sy, price: pNum, label });
            redrawOverlay();
            updateCountdownPos();
          }
          return;
        }

        if (!dragEditRef.current || !drawCanvasRef.current) return;
        const rect = drawCanvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        applyDragEditAt(sx, sy, e.shiftKey);
      };

      const handleAlertDragEnd = () => {
        if (!draggingAlertRef.current) return;
        const finished = draggingAlertRef.current;
        draggingAlertRef.current = null;
        onUpdateAlertPriceRef.current?.(finished.id, finished.price);
        redrawOverlay();
        updateCountdownPos();
      };

      window.addEventListener('mouseup', handleAlertDragEnd);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleWindowMouseMove);
      return () => {
        window.removeEventListener('mouseup', handleAlertDragEnd);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleWindowMouseMove);
      };
    }, [applyDragEditAt, applyZoomRange, finalizeDrawing, onSelectTool, redrawOverlay, updateCountdownPos]);

    // Apply TradingView "Visibility on intervals" presets based on current timeframe
    const applyIntervalVisibilityPreset = useCallback(
      (drawingId: string, mode: 'below' | 'above' | 'only' | 'all') => {
        if (mode === 'all') {
          onUpdateDrawing(drawingId, (d) => ({
            ...d,
            visibility: JSON.parse(JSON.stringify(DEFAULT_VISIBILITY)),
          }));
          return;
        }
        const tf = intervalRef.current;
        const tfMap: Record<
          Timeframe,
          { unit: 'minutes' | 'hours' | 'days' | 'weeks'; val: number; rank: number }
        > = {
          '1m': { unit: 'minutes', val: 1, rank: 2 },
          '5m': { unit: 'minutes', val: 5, rank: 2 },
          '15m': { unit: 'minutes', val: 15, rank: 2 },
          '30m': { unit: 'minutes', val: 30, rank: 2 },
          '1h': { unit: 'hours', val: 1, rank: 3 },
          '4h': { unit: 'hours', val: 4, rank: 3 },
          '1d': { unit: 'days', val: 1, rank: 4 },
          '1w': { unit: 'weeks', val: 1, rank: 5 },
        };
        const cur = tfMap[tf] || { unit: 'days' as const, val: 1, rank: 4 };
        const maxMap = { seconds: 59, minutes: 59, hours: 24, days: 366, weeks: 52, months: 12 };
        const rankMap = { seconds: 1, minutes: 2, hours: 3, days: 4, weeks: 5, months: 6 };

        const makeRange = (unit: keyof typeof maxMap) => {
          const r = rankMap[unit];
          const maxV = maxMap[unit];
          if (mode === 'only') {
            return unit === cur.unit
              ? { enabled: true, min: cur.val, max: cur.val }
              : { enabled: false, min: 1, max: maxV };
          }
          if (mode === 'below') {
            if (r < cur.rank) return { enabled: true, min: 1, max: maxV };
            if (r === cur.rank) return { enabled: true, min: 1, max: cur.val };
            return { enabled: false, min: 1, max: maxV };
          }
          // above
          if (r > cur.rank) return { enabled: true, min: 1, max: maxV };
          if (r === cur.rank) return { enabled: true, min: cur.val, max: maxV };
          return { enabled: false, min: 1, max: maxV };
        };

        const nextVis = {
          ticks: mode === 'below',
          seconds: makeRange('seconds'),
          minutes: makeRange('minutes'),
          hours: makeRange('hours'),
          days: makeRange('days'),
          weeks: makeRange('weeks'),
          months: makeRange('months'),
          ranges: mode === 'above',
        };
        onUpdateDrawing(drawingId, (d) => ({ ...d, visibility: nextVis }));
      },
      [onUpdateDrawing]
    );

    // Capture-phase selection & dragging of existing drawings / alert lines when in Cursor mode
    const handleWrapperMouseDownCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !isCursorTool(activeToolRef.current)) return;
      // Ignore clicks on UI buttons/overlays inside wrapper
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-overlay="true"]')) return;

      setDrawingContextMenu(null);
      setCtxSubmenu('none');

      const canvas = drawCanvasRef.current;
      const series = candleSeriesRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Check if user grabbed an Alert line to drag its price vertically
      if (chartSettingsRef.current.alerts.alertLines && series) {
        const curSym = symbolRef.current;
        const visibleAlerts = alertsRef.current.filter(
          (a) =>
            a.symbol === curSym &&
            (!chartSettingsRef.current.alerts.onlyActiveAlerts || a.active)
        );
        for (const a of visibleAlerts) {
          const ay = series.priceToCoordinate(a.price);
          if (ay !== null && Math.abs(Number(ay) - sy) <= 8) {
            e.stopPropagation();
            e.preventDefault();
            hoveredAlertIdRef.current = a.id;
            draggingAlertRef.current = { id: a.id, price: a.price, y: Number(ay) };
            redrawOverlay();
            return;
          }
        }
      }

      if (drawingsHiddenRef.current) return;
      const bridge = buildCoordBridge();
      if (!bridge) return;

      const visible = drawingsRef.current.filter((d) =>
        isDrawingVisibleOnTimeframe(d, intervalRef.current)
      );
      const hit = hitTestDrawings(visible, sx, sy, bridge, selectedIdRef.current);
      if (hit) {
        setToolbarMenu('none');
        const orig = visible.find((d) => d.id === hit.drawingId);
        if (orig && !lockDrawingsRef.current && !orig.locked) {
          const startAnchor = screenToAnchor(sx, sy, false);
          if (startAnchor) {
            e.stopPropagation();
            e.preventDefault();
            // Ctrl + Drag clones the drawing immediately and drags the clone!
            if ((e.ctrlKey || e.metaKey) && !hit.handleKey) {
              const cloned: DrawingObject = {
                ...JSON.parse(JSON.stringify(orig)),
                id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                locked: false,
              };
              onAddDrawing(cloned);
              onSelectDrawingId(cloned.id);
              dragEditRef.current = {
                drawingId: cloned.id,
                handleKey: undefined,
                startAnchor,
                startScreen: { x: sx, y: sy },
                origDrawing: JSON.parse(JSON.stringify(cloned)),
              };
            } else {
              onSelectDrawingId(hit.drawingId);
              dragEditRef.current = {
                drawingId: hit.drawingId,
                handleKey: hit.handleKey,
                startAnchor,
                startScreen: { x: sx, y: sy },
                origDrawing: JSON.parse(JSON.stringify(orig)),
              };
            }
            lastPointerClientRef.current = { clientX: e.clientX, clientY: e.clientY };
            shiftPressedRef.current = e.shiftKey;
          } else {
            onSelectDrawingId(hit.drawingId);
          }
        } else {
          onSelectDrawingId(hit.drawingId);
        }
      } else {
        setToolbarMenu('none');
        if (selectedIdRef.current) {
          onSelectDrawingId(null);
        }
        if (hoveredDrawingIdRef.current !== null) {
          hoveredDrawingIdRef.current = null;
          redrawOverlay();
        }
      }
    };

    // Right-click any drawing -> open TradingView Drawing Context Menu
    const handleWrapperContextMenuCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-overlay="true"]')) return;
      if (tempShapeRef.current) {
        e.preventDefault();
        cancelPendingDrawing();
        return;
      }
      if (!isCursorTool(activeToolRef.current) || drawingsHiddenRef.current) return;

      const bridge = buildCoordBridge();
      const canvas = drawCanvasRef.current;
      if (!bridge || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const visible = drawingsRef.current.filter((d) =>
        isDrawingVisibleOnTimeframe(d, intervalRef.current)
      );
      const hit = hitTestDrawings(visible, sx, sy, bridge, selectedIdRef.current);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        onSelectDrawingId(hit.drawingId);
        setToolbarMenu('none');
        setCtxSubmenu('none');
        setDrawingContextMenu({ drawingId: hit.drawingId, x: sx, y: sy });
      } else {
        setDrawingContextMenu(null);
        setCtxSubmenu('none');
      }
    };

    // Double-click any drawing in Cursor mode -> open full TradingView Settings Modal
    const handleWrapperDoubleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isCursorTool(activeToolRef.current) || drawingsHiddenRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-overlay="true"]')) return;

      const bridge = buildCoordBridge();
      const canvas = drawCanvasRef.current;
      if (!bridge || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const visible = drawingsRef.current.filter((d) =>
        isDrawingVisibleOnTimeframe(d, intervalRef.current)
      );
      const hit = hitTestDrawings(visible, sx, sy, bridge, selectedIdRef.current);
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        onSelectDrawingId(hit.drawingId);
        const hitObj = drawingsRef.current.find((d) => d.id === hit.drawingId);
        onOpenDrawingSettings(
          hit.drawingId,
          hitObj && (hitObj.type === 'long_pos' || hitObj.type === 'short_pos') ? 'inputs' : 'style'
        );
      }
    };

    const handleWrapperMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingAlertRef.current) return;

      const clearAlertHoverIfNeeded = () => {
        if (isHoveringAlertPillRef.current) return;
        if (hoveredAlertIdRef.current !== null) {
          hoveredAlertIdRef.current = null;
          setAlertHoverInfo(null);
          redrawOverlay();
        }
      };

      if (!isCursorTool(activeToolRef.current) || dragEditRef.current) {
        clearAlertHoverIfNeeded();
        if (hoverCursor) setHoverCursor('');
        return;
      }

      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-overlay="true"]')) {
        if (hoveredDrawingIdRef.current !== null) {
          hoveredDrawingIdRef.current = null;
          redrawOverlay();
        }
        clearAlertHoverIfNeeded();
        if (hoverCursor) setHoverCursor('');
        return;
      }

      const canvas = drawCanvasRef.current;
      const series = candleSeriesRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // 1. Check hover proximity to Alert Lines (shows floating label pill + blue dot ONLY while hovering!)
      let hitAlert: PriceAlert | null = null;
      let hitAlertY = 0;
      if (chartSettingsRef.current.alerts.alertLines && series) {
        const placement = chartSettingsRef.current.scales.scalesPlacement;
        const scaleW = chartRef.current?.priceScale(placement).width() || 70;
        const inPlotX =
          placement === 'left' ? sx >= scaleW : sx <= rect.width - scaleW;
        if (inPlotX && sy > 6 && sy < rect.height - 28) {
          const curSym = symbolRef.current;
          const visibleAlerts = alertsRef.current.filter(
            (a) =>
              a.symbol === curSym &&
              (!chartSettingsRef.current.alerts.onlyActiveAlerts || a.active)
          );
          let bestDist = 9;
          for (const a of visibleAlerts) {
            const ay = series.priceToCoordinate(a.price);
            if (ay === null || !Number.isFinite(Number(ay))) continue;
            const dist = Math.abs(Number(ay) - sy);
            if (dist < bestDist) {
              bestDist = dist;
              hitAlert = a;
              hitAlertY = Number(ay);
            }
          }
        }
      }

      if (hitAlert) {
        const arr = displayCandlesRef.current;
        const refClose = arr.length ? arr[arr.length - 1].close : hitAlert.price;
        const prec =
          chartSettingsRef.current.symbol.precision === 'default'
            ? getPrecision(refClose)
            : parseInt(chartSettingsRef.current.symbol.precision, 10);
        const condLabel =
          hitAlert.condition === 'above'
            ? 'Crossing Up'
            : hitAlert.condition === 'below'
            ? 'Crossing Down'
            : 'Crossing';
        const label = hitAlert.note?.trim()
          ? hitAlert.note.trim()
          : `${hitAlert.symbol} ${condLabel} ${fmtPrice(hitAlert.price, prec)}`;

        if (hoveredAlertIdRef.current !== hitAlert.id) {
          hoveredAlertIdRef.current = hitAlert.id;
          redrawOverlay();
        }
        setAlertHoverInfo((prev) =>
          prev &&
          prev.id === hitAlert!.id &&
          Math.abs(prev.y - hitAlertY) < 0.5 &&
          prev.label === label
            ? prev
            : { id: hitAlert!.id, y: hitAlertY, price: hitAlert!.price, label }
        );
        if (hoverCursor !== 'ns-resize') setHoverCursor('ns-resize');
        return;
      } else {
        clearAlertHoverIfNeeded();
      }

      if (drawingsHiddenRef.current) {
        if (hoverCursor) setHoverCursor('');
        return;
      }

      const bridge = buildCoordBridge();
      if (!bridge) return;
      const visible = drawingsRef.current.filter((d) =>
        isDrawingVisibleOnTimeframe(d, intervalRef.current)
      );
      const hit = hitTestDrawings(visible, sx, sy, bridge, selectedIdRef.current);

      const nextHoverId = hit ? hit.drawingId : null;
      if (hoveredDrawingIdRef.current !== nextHoverId) {
        hoveredDrawingIdRef.current = nextHoverId;
        redrawOverlay();
      }

      if (hit) {
        const hitObj = visible.find((d) => d.id === hit.drawingId);
        if (lockDrawingsRef.current || hitObj?.locked) {
          setHoverCursor('pointer');
        } else {
          setHoverCursor(hit.handleKey ? 'pointer' : 'move');
        }
      } else if (hoverCursor) {
        setHoverCursor('');
      }
    };

    const handleWrapperMouseLeave = () => {
      if (hoveredDrawingIdRef.current !== null) {
        hoveredDrawingIdRef.current = null;
        redrawOverlay();
      }
      if (!draggingAlertRef.current) {
        isHoveringAlertPillRef.current = false;
        if (hoveredAlertIdRef.current !== null) {
          hoveredAlertIdRef.current = null;
          setAlertHoverInfo(null);
          redrawOverlay();
        }
      }
      if (hoverCursor) setHoverCursor('');
      if (!plusMenuOpenRef.current) {
        crosshairLiveRef.current = null;
        if (crosshairTagElRef.current) crosshairTagElRef.current.style.visibility = 'hidden';
        if (crosshairPlusBtnElRef.current) crosshairPlusBtnElRef.current.style.visibility = 'hidden';
      }
    };

    const handleSubmitTextPrompt = (e: React.FormEvent) => {
      e.preventDefault();
      if (!textPrompt) return;
      const clean = textPrompt.value.trim();
      if (!clean) {
        setTextPrompt(null);
        return;
      }
      if (textPrompt.mode === 'edit' && textPrompt.editId) {
        onUpdateDrawing(textPrompt.editId, (d) => ({ ...d, text: clean }));
      } else if (textPrompt.mode === 'text') {
        finalizeDrawing({
          id: `d-${Date.now()}`,
          type: 'text',
          color: drawColor,
          lineWidth: 1.5,
          p1: textPrompt.p1,
          text: clean,
        });
      } else if (textPrompt.mode === 'callout') {
        finalizeDrawing({
          id: `d-${Date.now()}`,
          type: 'callout',
          color: drawColor,
          lineWidth: 1.6,
          p1: textPrompt.p1,
          p2: textPrompt.p2,
          text: clean,
        });
      }
      setTextPrompt(null);
    };


    const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId) || null;
    const legendBar = hoverBar || effectiveCandles[effectiveCandles.length - 1];
    const legendVol = legendBar
      ? effectiveVolumes.find((v) => v.time === legendBar.time)?.value
      : effectiveVolumes[effectiveVolumes.length - 1]?.value;
    const barDiff = legendBar ? legendBar.close - legendBar.open : 0;
    const barPct = legendBar && legendBar.open ? (barDiff / legendBar.open) * 100 : 0;
    const barColorClass = barDiff >= 0 ? 'text-[var(--accent)]' : 'text-[var(--down)]';
    const lastPriceLive = effectiveCandles[effectiveCandles.length - 1]?.close || tickerData?.last || 0;

    const chartBgStyle = useMemo<React.CSSProperties>(() => {
      const cv = chartSettings.canvas;
      const bg1 = cv.backgroundColor || (isDarkMode ? '#131722' : '#ffffff');
      const bg2 = cv.backgroundColor2 || (isDarkMode ? '#1e222d' : '#f0f3fa');
      if (cv.backgroundType === 'gradient') {
        return { background: `linear-gradient(180deg, ${bg1} 0%, ${bg2} 100%)` };
      }
      return { backgroundColor: bg1 };
    }, [chartSettings.canvas, isDarkMode]);

    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-app)]">
        {/* Main Chart Wrapper */}
        <div
          ref={wrapperRef}
          onMouseDownCapture={handleWrapperMouseDownCapture}
          onContextMenuCapture={handleWrapperContextMenuCapture}
          onDoubleClickCapture={handleWrapperDoubleClickCapture}
          onMouseMove={handleWrapperMouseMove}
          onMouseLeave={handleWrapperMouseLeave}
          style={chartBgStyle}
          className="flex-1 relative min-h-[220px] overflow-hidden"
        >
          <canvas
            ref={cloudCanvasRef}
            className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
          />
          <canvas
            ref={underDrawCanvasRef}
            className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
          />
          <div
            ref={chartContainerRef}
            className={`absolute inset-0 w-full h-full z-[2] ${
              hoverCursor === 'move'
                ? 'tv-cursor-move'
                : hoverCursor === 'pointer'
                ? 'tv-cursor-pointer'
                : hoverCursor === 'ns-resize'
                ? 'tv-cursor-ns-resize'
                : activeTool === 'cursor'
                ? 'tv-cursor-crosshair'
                : activeTool === 'dot'
                ? 'tv-cursor-dot'
                : ''
            }`}
          />
          <canvas
            ref={drawCanvasRef}
            onMouseDown={handleDrawMouseDown}
            onMouseMove={handleDrawMouseMove}
            onMouseLeave={handleDrawMouseLeave}
            onContextMenu={(e) => {
              if (tempShapeRef.current) {
                e.preventDefault();
                cancelPendingDrawing();
              }
            }}
            onDoubleClick={commitPathDrawing}
            className={`absolute inset-0 w-full h-full z-[3] ${
              !isCursorTool(activeTool)
                ? 'pointer-events-auto tv-cursor-crosshair'
                : 'pointer-events-none'
            }`}
          />

          {/* Loading Overlay */}
          {loadingText && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-[#131722]/90 text-white px-4 py-2 rounded-md text-xs font-semibold shadow-lg pointer-events-none">
              {loadingText}
            </div>
          )}

          {/* Chart Legend (Status Line — exact TradingView Screenshot 2 & 3) */}
          <div
            data-ui-overlay="true"
            className={`absolute top-2 ${
              chartSettings.scales.scalesPlacement === 'left' ? 'left-16' : 'left-3'
            } z-10 pointer-events-none flex flex-col gap-1 max-w-[calc(100%-96px)]`}
          >
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px]">
              {(chartSettings.statusLine.logo || chartSettings.statusLine.title) && (
                <span className="font-medium text-[var(--text-main)] inline-flex items-center gap-1.5">
                  {chartSettings.statusLine.logo && (
                    <CoinLogo
                      symbol={symbol}
                      color={symbolMeta.color}
                      letter={symbolMeta.letter}
                      size={18}
                    />
                  )}
                  {chartSettings.statusLine.title && (
                    <span>
                      {chartSettings.statusLine.titleMode === 'ticker'
                        ? `${symbol} · ${interval.toUpperCase()}`
                        : chartSettings.statusLine.titleMode === 'description'
                        ? `${symbolMeta.name} (${symbol}) · ${interval.toUpperCase()} · Binance Spot`
                        : `${symbolMeta.name} · ${interval.toUpperCase()} · Binance`}
                    </span>
                  )}
                </span>
              )}

              {/* Clickable Watchlist Flag Ribbon right beside symbol name */}
              {onToggleSymbolFlag && (
                <button
                  type="button"
                  onClick={onToggleSymbolFlag}
                  title="Flag symbol"
                  className="pointer-events-auto inline-flex items-center justify-center p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
                >
                  <FlagRibbon color={symbolMeta.flagColor || '#f23645'} size={12} />
                </button>
              )}

              {chartSettings.statusLine.openMarketStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    isReplayMode
                      ? 'bg-[var(--amber)]/15 text-[var(--amber)]'
                      : wsStatus === 'live'
                      ? 'bg-[#089981]/12 text-[#089981]'
                      : wsStatus === 'connecting'
                      ? 'bg-[var(--amber)]/15 text-[var(--amber)]'
                      : 'bg-[var(--down)]/15 text-[var(--down)]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isReplayMode
                        ? 'bg-[var(--amber)]'
                        : wsStatus === 'live'
                        ? 'bg-[#089981] animate-live-pulse'
                        : wsStatus === 'connecting'
                        ? 'bg-[var(--amber)]'
                        : 'bg-[var(--down)]'
                    }`}
                  />
                  <span>
                    {isReplayMode
                      ? 'Replay'
                      : wsStatus === 'live'
                      ? 'Open'
                      : wsStatus === 'connecting'
                      ? 'Connecting'
                      : 'Offline'}
                  </span>
                </span>
              )}

              {legendBar &&
                (chartSettings.statusLine.ohlcValues ||
                  chartSettings.statusLine.barChangeValues ||
                  chartSettings.statusLine.volume) && (
                  <div className="inline-flex items-center gap-1.5 font-mono-num text-[11.5px] text-[var(--text-main)]">
                    {chartSettings.statusLine.ohlcValues && (
                      <>
                        <span>
                          <span className="font-normal">O</span>
                          {fmtPrice(legendBar.open)}
                        </span>
                        <span>
                          <span className="font-normal">H</span>
                          {fmtPrice(legendBar.high)}
                        </span>
                        <span>
                          <span className="font-normal">L</span>
                          {fmtPrice(legendBar.low)}
                        </span>
                        <span>
                          <span className="font-normal">C</span>
                          {fmtPrice(legendBar.close)}
                        </span>
                      </>
                    )}
                    {chartSettings.statusLine.barChangeValues && (
                      <span className="font-normal text-[var(--text-main)]">
                        {barDiff >= 0 ? '+' : ''}
                        {fmtPrice(barDiff)} ({barDiff >= 0 ? '+' : ''}
                        {barPct.toFixed(2)}%)
                      </span>
                    )}
                    {chartSettings.statusLine.volume && legendVol !== undefined && (
                      <span className="text-[var(--text-muted)]">
                        Vol <b className="text-[var(--text-main)]">{fmtCompact(legendVol)}</b>
                      </span>
                    )}
                  </div>
                )}

              {chartSettings.statusLine.lastDayChangeValues && tickerData && (
                <span
                  className={`font-mono-num text-[11px] font-semibold ${
                    tickerData.pct >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'
                  }`}
                >
                  24h: {tickerData.pct >= 0 ? '+' : ''}
                  {tickerData.pct.toFixed(2)}%
                </span>
              )}
            </div>

            {/* On-Chart Quick Buy/Sell Buttons (Status line / Trading -> Buy/sell buttons) */}
            {(chartSettings.statusLine.buySellButtons || chartSettings.trading.buySellButtons) &&
              lastPriceLive > 0 && (
                <div className="pointer-events-auto flex items-center gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => onQuickOrder('SELL')}
                    className="h-7 px-2.5 rounded border border-[var(--down)] bg-[var(--down)]/95 hover:bg-[var(--down)] text-white text-[11px] font-mono-num font-bold shadow-sm flex flex-col justify-center leading-none cursor-pointer"
                    title={
                      chartSettings.trading.oneClickTrading
                        ? 'One-click Market Sell'
                        : 'Open Sell Order'
                    }
                  >
                    <span>{fmtPrice(lastPriceLive * 0.9999)}</span>
                    <span className="text-[8px] opacity-85 uppercase tracking-wider">Sell</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickOrder('BUY')}
                    className="h-7 px-2.5 rounded border border-[var(--accent)] bg-[var(--accent)]/95 hover:bg-[var(--accent)] text-white text-[11px] font-mono-num font-bold shadow-sm flex flex-col justify-center leading-none cursor-pointer"
                    title={
                      chartSettings.trading.oneClickTrading
                        ? 'One-click Market Buy'
                        : 'Open Buy Order'
                    }
                  >
                    <span>{fmtPrice(lastPriceLive * 1.0001)}</span>
                    <span className="text-[8px] opacity-85 uppercase tracking-wider">Buy</span>
                  </button>
                </div>
              )}

            {/* Collapsible TradingView Indicator Legend Stack */}
            {(chartSettings.statusLine.indTitles || chartSettings.statusLine.indValues) && (() => {
              const baseCoin = symbol.replace(/USDT$|BUSD$|FDUSD$|USDC$/, '');
              const volCfg = indicators.volume;
              const seCfg = indicators.smaEma;
              const indRowsCount =
                (volCfg.enabled ? 1 : 0) +
                (seCfg.enabled ? 1 : 0) +
                (indicators.bb.enabled ? 1 : 0) +
                (indicators.rsi.enabled ? 1 : 0);

              if (indRowsCount === 0) return null;

              const bgStyle = chartSettings.statusLine.indBackground
                ? {
                    backgroundColor: isDarkMode
                      ? `rgba(24, 28, 39, ${chartSettings.statusLine.indBackgroundOpacity / 100})`
                      : `rgba(255, 255, 255, ${chartSettings.statusLine.indBackgroundOpacity / 100})`,
                  }
                : undefined;

              const volHidden = Boolean(volCfg.hidden);
              const seHidden = Boolean(seCfg.hidden);
              const bbHidden = Boolean(indicators.bb.hidden);
              const rsiHidden = Boolean(indicators.rsi.hidden);

              const fmtVolLegend = (v: number) =>
                volCfg.precision === 'default'
                  ? fmtCompact(v)
                  : v.toLocaleString('en-US', {
                      minimumFractionDigits: parseInt(volCfg.precision, 10),
                      maximumFractionDigits: parseInt(volCfg.precision, 10),
                    });

              const sePrec =
                seCfg.precision === 'default' ? undefined : parseInt(seCfg.precision, 10);

              const activeMaOutputs = (
                [
                  { cfg: seCfg.sma1, val: indValues.sma1 },
                  { cfg: seCfg.sma2, val: indValues.sma2 },
                  { cfg: seCfg.sma3, val: indValues.sma3 },
                  { cfg: seCfg.ema1, val: indValues.ema1 },
                  { cfg: seCfg.ema2, val: indValues.ema2 },
                  { cfg: seCfg.ema3, val: indValues.ema3 },
                ] as const
              ).filter((x) => x.cfg.enabled);

              return (
                <div className="pointer-events-auto flex flex-col items-start gap-1">
                  {!indExpanded ? (
                    <button
                      type="button"
                      onClick={() => setIndExpanded(true)}
                      className="h-[22px] px-1.5 rounded border border-[var(--border)] bg-[var(--bg-surface)]/95 hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-main)] inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Show Indicator Legend"
                    >
                      <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="font-mono-num">{indRowsCount}</span>
                    </button>
                  ) : (
                    <>
                      {/* Volume Indicator Row */}
                      {volCfg.enabled && (
                        <div
                          style={bgStyle}
                          className={`group/ind relative inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors ${
                            volHidden ? 'opacity-60' : ''
                          }`}
                        >
                          <span className="pointer-events-none opacity-0 group-hover/ind:opacity-100 transition-opacity absolute -top-7 left-0 px-2 py-0.5 rounded bg-[#131722] text-white text-[11px] font-medium whitespace-nowrap shadow-md z-30">
                            Volume · {baseCoin}
                          </span>
                          {chartSettings.statusLine.indTitles && (
                            <span
                              className={
                                volHidden
                                  ? 'text-[var(--text-muted)]'
                                  : 'text-[var(--text-main)]'
                              }
                            >
                              Vol · {baseCoin}
                              {chartSettings.statusLine.indInputs &&
                                volCfg.inputsInStatusLine &&
                                volCfg.showMa && (
                                  <span className="text-[var(--text-muted)] ml-1">
                                    {volCfg.maPeriod}
                                  </span>
                                )}
                            </span>
                          )}
                          {!volHidden &&
                            chartSettings.statusLine.indValues &&
                            volCfg.valuesInStatusLine && (
                              <span className="font-mono-num text-[11.5px] inline-flex items-center gap-1.5 group-hover/ind:hidden">
                                {volCfg.showVolume && legendVol !== undefined && (
                                  <span className="text-[#089981]">{fmtVolLegend(legendVol)}</span>
                                )}
                                {volCfg.showMa && indValues.volMa !== undefined && (
                                  <span style={{ color: volCfg.maColor || '#9c27b0' }}>
                                    {fmtVolLegend(indValues.volMa)}
                                  </span>
                                )}
                              </span>
                            )}
                          {/* Hover Action Controls (Eye = Hide ONLY, Gear = Vol Settings, Trash = Remove) */}
                          <span
                            className={`${
                              volHidden ? 'inline-flex' : 'hidden group-hover/ind:inline-flex'
                            } items-center gap-0.5 ml-0.5`}
                          >
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    volume: { ...prev.volume, hidden: !prev.volume.hidden },
                                  }))
                                }
                                title={volHidden ? 'Show Volume' : 'Hide Volume'}
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                {volHidden ? (
                                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.6} />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.6} />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIndicatorSettings
                                  ? onOpenIndicatorSettings('volume')
                                  : onOpenIndicators?.()
                              }
                              title="Volume Settings"
                              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                            >
                              <HexSettingsIcon className="w-3.5 h-3.5" />
                            </button>
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    volume: { ...prev.volume, enabled: false, hidden: false },
                                  }))
                                }
                                title="Remove Volume"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIndicatorSettings
                                  ? onOpenIndicatorSettings('volume')
                                  : onOpenIndicators?.()
                              }
                              title="More Volume Options"
                              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.7} />
                            </button>
                          </span>
                        </div>
                      )}

                      {/* SMA/EMA Indicator Row */}
                      {seCfg.enabled && (
                        <div
                          style={bgStyle}
                          className={`group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors flex-wrap ${
                            seHidden ? 'opacity-60' : ''
                          }`}
                        >
                          {chartSettings.statusLine.indTitles && (
                            <span
                              className={
                                seHidden
                                  ? 'text-[var(--text-muted)]'
                                  : 'text-[var(--text-main)]'
                              }
                            >
                              SMA/EMA
                              {chartSettings.statusLine.indInputs && seCfg.inputsInStatusLine && (
                                <span className="text-[var(--text-muted)] ml-1">
                                  {activeMaOutputs
                                    .map((x) => `${x.cfg.period} ${x.cfg.source}`)
                                    .join(' ')}
                                </span>
                              )}
                            </span>
                          )}
                          {!seHidden &&
                            chartSettings.statusLine.indValues &&
                            seCfg.valuesInStatusLine && (
                              <span className="font-mono-num text-[11.5px] inline-flex items-center gap-2 group-hover/ind:hidden">
                                {activeMaOutputs.map((x, i) => (
                                  <span key={i} style={{ color: x.cfg.color }}>
                                    {fmtPrice(x.val, sePrec)}
                                  </span>
                                ))}
                              </span>
                            )}
                          <span
                            className={`${
                              seHidden ? 'inline-flex' : 'hidden group-hover/ind:inline-flex'
                            } items-center gap-0.5 ml-0.5`}
                          >
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    smaEma: { ...prev.smaEma, hidden: !prev.smaEma.hidden },
                                  }))
                                }
                                title={seHidden ? 'Show SMA/EMA' : 'Hide SMA/EMA'}
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                {seHidden ? (
                                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.7} />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.7} />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIndicatorSettings
                                  ? onOpenIndicatorSettings('smaEma')
                                  : onOpenIndicators?.()
                              }
                              title="SMA/EMA Settings"
                              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                            >
                              <HexSettingsIcon className="w-3.5 h-3.5" />
                            </button>
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    smaEma: { ...prev.smaEma, enabled: false, hidden: false },
                                  }))
                                }
                                title="Remove SMA/EMA"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIndicatorSettings
                                  ? onOpenIndicatorSettings('smaEma')
                                  : onOpenIndicators?.()
                              }
                              title="More SMA/EMA Options"
                              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.7} />
                            </button>
                          </span>
                        </div>
                      )}

                      {/* Bollinger Bands Row */}
                      {indicators.bb.enabled && (
                        <div
                          style={bgStyle}
                          className={`group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors ${
                            bbHidden ? 'opacity-60' : ''
                          }`}
                        >
                          <span style={{ color: bbHidden ? 'var(--text-muted)' : indicators.bb.color }}>
                            BB
                            {chartSettings.statusLine.indInputs &&
                              ` ${indicators.bb.period} close ${indicators.bb.stdDev}`}
                          </span>
                          <span
                            className={`${
                              bbHidden ? 'inline-flex' : 'hidden group-hover/ind:inline-flex'
                            } items-center gap-0.5 ml-1 pl-1 border-l border-[var(--border)]/70`}
                          >
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    bb: { ...prev.bb, hidden: !prev.bb.hidden },
                                  }))
                                }
                                title={bbHidden ? 'Show BB' : 'Hide BB'}
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                {bbHidden ? (
                                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.7} />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.7} />
                                )}
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="BB Settings"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <Settings className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    bb: { ...prev.bb, enabled: false, hidden: false },
                                  }))
                                }
                                title="Remove BB"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}

                      {/* RSI Row */}
                      {indicators.rsi.enabled && (
                        <div
                          style={bgStyle}
                          className={`group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors ${
                            rsiHidden ? 'opacity-60' : ''
                          }`}
                        >
                          <span style={{ color: rsiHidden ? 'var(--text-muted)' : indicators.rsi.color }}>
                            RSI
                            {chartSettings.statusLine.indInputs && ` ${indicators.rsi.period}`}
                          </span>
                          {!rsiHidden && chartSettings.statusLine.indValues && indValues.rsi !== undefined && (
                            <span className="font-mono-num text-[11.5px]" style={{ color: indicators.rsi.color }}>
                              {indValues.rsi.toFixed(2)}
                            </span>
                          )}
                          <span
                            className={`${
                              rsiHidden ? 'inline-flex' : 'hidden group-hover/ind:inline-flex'
                            } items-center gap-0.5 ml-1 pl-1 border-l border-[var(--border)]/70`}
                          >
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    rsi: { ...prev.rsi, hidden: !prev.rsi.hidden },
                                  }))
                                }
                                title={rsiHidden ? 'Show RSI' : 'Hide RSI'}
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                {rsiHidden ? (
                                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.7} />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.7} />
                                )}
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="RSI Settings"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <Settings className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    rsi: { ...prev.rsi, enabled: false, hidden: false },
                                  }))
                                }
                                title="Remove RSI"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Collapse [^] Square Button */}
                      <button
                        type="button"
                        onClick={() => setIndExpanded(false)}
                        className="w-7 h-[22px] rounded border border-[var(--border)] bg-[var(--bg-surface)]/95 hover:bg-[var(--bg-hover)] text-[var(--text-main)] inline-flex items-center justify-center shadow-2xs cursor-pointer"
                        title="Hide Indicator Legend"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Freely Draggable Floating Favorite Tools Bar (Exact TradingView Style) */}
          {favoriteTools.length > 0 && (
            <div
              ref={favBarRef}
              data-ui-overlay="true"
              style={{
                left: `${favBarPos.x}px`,
                top: `${favBarPos.y}px`,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if ((e.target as HTMLElement).closest('button[data-fav-tool]')) return;
                e.preventDefault();
                favBarDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: favBarPos.x,
                  origY: favBarPos.y,
                };
              }}
              className="absolute z-20 bg-white dark:bg-[var(--bg-surface)] border border-black/[0.06] dark:border-[var(--border)] rounded-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.09)] dark:shadow-[0_4px_18px_rgba(0,0,0,0.45)] pl-1 pr-1.5 py-1 flex items-center gap-0.5 select-none"
            >
              {/* 6-dot Vertical Drag Grip */}
              <div
                title="Drag favorites bar anywhere"
                className="w-5 h-8 rounded-[5px] flex items-center justify-center text-[#b2b5be] hover:text-[#787b86] dark:text-[#787b86] dark:hover:text-[#b2b5be] cursor-grab active:cursor-grabbing shrink-0 transition-colors"
              >
                <svg viewBox="0 0 12 18" className="w-2.5 h-3.5" fill="currentColor" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="1.15" />
                  <circle cx="8.5" cy="3.5" r="1.15" />
                  <circle cx="3.5" cy="9" r="1.15" />
                  <circle cx="8.5" cy="9" r="1.15" />
                  <circle cx="3.5" cy="14.5" r="1.15" />
                  <circle cx="8.5" cy="14.5" r="1.15" />
                </svg>
              </div>

              {favoriteTools.map((tid) => {
                const def = ALL_TOOLS_MAP[tid];
                if (!def) return null;
                const active = activeTool === tid;
                return (
                  <button
                    key={tid}
                    type="button"
                    data-fav-tool={tid}
                    onClick={() => onSelectTool(tid)}
                    title={`${def.label}${def.shortcut ? ` (${def.shortcut})` : ''}`}
                    className={`w-[34px] h-[34px] rounded-[6px] flex items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#e8edf7] dark:bg-[var(--bg-active)] text-[#000000] dark:text-[#ffffff]'
                        : 'text-[#000000] dark:text-[#f0f3fa] hover:bg-[#f0f3fa] dark:hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {def.renderIcon('w-[22px] h-[22px]')}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Multi-Step Drawing Hint */}
          {drawingHint && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#131722]/90 text-white text-[11px] font-medium px-3 py-1.5 rounded-md shadow-lg pointer-events-none">
              {drawingHint}
            </div>
          )}

          {/* TradingView-Style Floating Selected Drawing Toolbar */}
          {selectedDrawing &&
            !drawingsHidden &&
            isDrawingVisibleOnTimeframe(selectedDrawing, interval) && (
              <div
                data-ui-overlay="true"
                style={{
                  transform: `translate(calc(-50% + ${toolbarOffset.x}px), ${toolbarOffset.y}px)`,
                }}
                className="absolute top-3 left-1/2 z-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl px-1.5 py-1 flex items-center gap-0.5 text-xs select-none"
              >
                {/* 1. Drag Grip */}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toolbarDragRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: toolbarOffset.x,
                      origY: toolbarOffset.y,
                    };
                  }}
                  title="Drag toolbar"
                  className="w-5 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>

                {/* 2. Templates Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setToolbarMenu((m) => (m === 'template' ? 'none' : 'template'))
                    }
                    title="Templates"
                    className={`w-7 h-7 rounded inline-flex items-center justify-center cursor-pointer ${
                      toolbarMenu === 'template'
                        ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  {toolbarMenu === 'template' && (
                    <div className="absolute left-0 top-9 w-48 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-40 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setToolbarMenu('none');
                          onOpenDrawingSettings(selectedDrawing.id, 'style');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium cursor-pointer"
                      >
                        Save Drawing Template As...
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateDrawing(selectedDrawing.id, (d) => ({
                            ...d,
                            color: '#2962ff',
                            lineWidth: 2,
                            lineStyle: 'solid',
                            extend: 'none',
                            leftEnd: 'normal',
                            rightEnd: 'normal',
                            showMiddlePoint: false,
                            showPriceLabels: false,
                            statsMode: 'hidden',
                            alwaysShowStats: false,
                            visibility: DEFAULT_VISIBILITY,
                          }));
                          setToolbarMenu('none');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      >
                        Apply Defaults
                      </button>
                      {templates.length > 0 && (
                        <div className="border-t border-[var(--border)] mt-1 pt-1 max-h-40 overflow-y-auto">
                          {templates.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                onUpdateDrawing(selectedDrawing.id, (d) => ({
                                  ...d,
                                  color: tpl.color,
                                  lineWidth: tpl.lineWidth,
                                  lineStyle: tpl.lineStyle,
                                  extend: tpl.extend,
                                  leftEnd: tpl.leftEnd,
                                  rightEnd: tpl.rightEnd,
                                  showMiddlePoint: tpl.showMiddlePoint,
                                  showPriceLabels: tpl.showPriceLabels,
                                  statsMode: tpl.statsMode,
                                  statsPosition: tpl.statsPosition,
                                  alwaysShowStats: tpl.alwaysShowStats,
                                  textColor: tpl.textColor,
                                  fontSize: tpl.fontSize,
                                  fontBold: tpl.fontBold,
                                  fontItalic: tpl.fontItalic,
                                  textAlignV: tpl.textAlignV,
                                  textAlignH: tpl.textAlignH,
                                }));
                                setToolbarMenu('none');
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 text-[var(--text-main)] cursor-pointer"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                                style={{ backgroundColor: tpl.color }}
                              />
                              <span className="truncate">{tpl.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3-6. Position Tool vs Standard Tool Styling Controls */}
                {selectedDrawing.type === 'long_pos' || selectedDrawing.type === 'short_pos' ? (
                  <>
                    {/* Text Color */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'textColor' ? 'none' : 'textColor'))
                        }
                        title="Text color"
                        className={`w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          toolbarMenu === 'textColor'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span
                          className="w-4 h-[3px] rounded-xs border border-[var(--border)]"
                          style={{ backgroundColor: selectedDrawing.textColor || '#ffffff' }}
                        />
                      </button>
                      {toolbarMenu === 'textColor' && (
                        <ColorPalettePopover
                          value={selectedDrawing.textColor || '#ffffff'}
                          onChange={(col) => {
                            onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, textColor: col }));
                          }}
                          onClose={() => setToolbarMenu('none')}
                        />
                      )}
                    </div>

                    {/* Target Fill Color */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'targetColor' ? 'none' : 'targetColor'))
                        }
                        title="Target color"
                        className={`w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          toolbarMenu === 'targetColor'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <PaintBucket className="w-3.5 h-3.5" />
                        <span
                          className="w-4 h-[3px] rounded-xs"
                          style={{
                            backgroundColor:
                              selectedDrawing.targetColor || 'rgba(8, 153, 129, 0.45)',
                          }}
                        />
                      </button>
                      {toolbarMenu === 'targetColor' && (
                        <ColorPalettePopover
                          value={selectedDrawing.targetColor || 'rgba(8, 153, 129, 0.2)'}
                          onChange={(col) => {
                            onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, targetColor: col }));
                          }}
                          onClose={() => setToolbarMenu('none')}
                        />
                      )}
                    </div>

                    {/* Stop Fill Color */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'stopColor' ? 'none' : 'stopColor'))
                        }
                        title="Stop color"
                        className={`w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          toolbarMenu === 'stopColor'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <PaintBucket className="w-3.5 h-3.5" />
                        <span
                          className="w-4 h-[3px] rounded-xs"
                          style={{
                            backgroundColor:
                              selectedDrawing.stopColor || 'rgba(242, 54, 69, 0.45)',
                          }}
                        />
                      </button>
                      {toolbarMenu === 'stopColor' && (
                        <ColorPalettePopover
                          value={selectedDrawing.stopColor || 'rgba(242, 54, 69, 0.2)'}
                          onChange={(col) => {
                            onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, stopColor: col }));
                          }}
                          onClose={() => setToolbarMenu('none')}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* 3. Line Color Picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'lineColor' ? 'none' : 'lineColor'))
                        }
                        title="Line Color"
                        className={`w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          toolbarMenu === 'lineColor'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span
                          className="w-4 h-[3px] rounded-xs"
                          style={{ backgroundColor: selectedDrawing.color || '#2962ff' }}
                        />
                      </button>
                      {toolbarMenu === 'lineColor' && (
                        <ColorPalettePopover
                          value={selectedDrawing.color || '#2962ff'}
                          onChange={(col) => {
                            onSelectDrawColor(col);
                            onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, color: col }));
                          }}
                          onClose={() => setToolbarMenu('none')}
                        />
                      )}
                    </div>

                    {/* 4. Text Color & Quick Text */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'textColor' ? 'none' : 'textColor'))
                        }
                        title="Text & Text Color"
                        className={`w-7 h-7 rounded flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          toolbarMenu === 'textColor'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span
                          className="w-4 h-[3px] rounded-xs"
                          style={{
                            backgroundColor:
                              selectedDrawing.textColor || selectedDrawing.color || '#2962ff',
                          }}
                        />
                      </button>
                      {toolbarMenu === 'textColor' && (
                        <ColorPalettePopover
                          value={selectedDrawing.textColor || selectedDrawing.color || '#2962ff'}
                          onChange={(col) => {
                            onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, textColor: col }));
                          }}
                          onClose={() => setToolbarMenu('none')}
                          extraAction={{
                            label: selectedDrawing.text ? 'Edit Label Text...' : 'Add Text Label...',
                            onClick: () => {
                              setToolbarMenu('none');
                              onOpenDrawingSettings(selectedDrawing.id, 'text');
                            },
                          }}
                        />
                      )}
                    </div>

                    {/* 5. Line Width Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'lineWidth' ? 'none' : 'lineWidth'))
                        }
                        title="Line Width"
                        className={`h-7 px-2 rounded inline-flex items-center gap-1.5 cursor-pointer ${
                          toolbarMenu === 'lineWidth'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span
                          className="w-3.5 rounded-full bg-current"
                          style={{ height: `${Math.max(1, Math.min(4, Math.round(selectedDrawing.lineWidth || 2)))}px` }}
                        />
                        <span className="font-mono-num text-[11px] font-semibold">
                          {Math.round(selectedDrawing.lineWidth || 2)}px
                        </span>
                      </button>
                      {toolbarMenu === 'lineWidth' && (
                        <div className="absolute left-0 top-9 w-28 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-40">
                          {[1, 2, 3, 4].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => {
                                onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, lineWidth: w }));
                                setToolbarMenu('none');
                              }}
                              className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)] cursor-pointer ${
                                Math.round(selectedDrawing.lineWidth || 2) === w
                                  ? 'text-[var(--accent)] font-bold'
                                  : 'text-[var(--text-main)]'
                              }`}
                            >
                              <span
                                className="w-10 rounded-full bg-current"
                                style={{ height: `${w}px` }}
                              />
                              <span className="font-mono-num text-[11px]">{w}px</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 6. Line Style Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setToolbarMenu((m) => (m === 'lineStyle' ? 'none' : 'lineStyle'))
                        }
                        title="Line Style"
                        className={`w-8 h-7 rounded inline-flex items-center justify-center cursor-pointer ${
                          toolbarMenu === 'lineStyle'
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <svg className="w-5 h-3" viewBox="0 0 24 8">
                          <line
                            x1="2"
                            y1="4"
                            x2="22"
                            y2="4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={
                              selectedDrawing.lineStyle === 'dashed'
                                ? '5 3'
                                : selectedDrawing.lineStyle === 'dotted'
                                ? '2 3'
                                : undefined
                            }
                          />
                        </svg>
                      </button>
                      {toolbarMenu === 'lineStyle' && (
                        <div className="absolute left-0 top-9 w-32 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-40">
                          {(
                            [
                              { id: 'solid', label: 'Line', dash: undefined },
                              { id: 'dashed', label: 'Dashed', dash: '5 3' },
                              { id: 'dotted', label: 'Dotted', dash: '2 3' },
                            ] as { id: DrawingLineStyle; label: string; dash?: string }[]
                          ).map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                onUpdateDrawing(selectedDrawing.id, (d) => ({
                                  ...d,
                                  lineStyle: st.id,
                                }));
                                setToolbarMenu('none');
                              }}
                              className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)] cursor-pointer ${
                                (selectedDrawing.lineStyle || 'solid') === st.id
                                  ? 'text-[var(--accent)] font-bold'
                                  : 'text-[var(--text-main)]'
                              }`}
                            >
                              <svg className="w-9 h-3" viewBox="0 0 36 8">
                                <line
                                  x1="2"
                                  y1="4"
                                  x2="34"
                                  y2="4"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray={st.dash}
                                />
                              </svg>
                              <span className="text-[11px]">{st.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

                {/* 7. Settings Modal Button */}
                <button
                  type="button"
                  onClick={() => {
                    setToolbarMenu('none');
                    onOpenDrawingSettings(
                      selectedDrawing.id,
                      selectedDrawing.type === 'long_pos' || selectedDrawing.type === 'short_pos'
                        ? 'inputs'
                        : 'style'
                    );
                  }}
                  title="Settings (Double-click drawing)"
                  className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* 8. Add Alert on Drawing */}
                <button
                  type="button"
                  onClick={() => {
                    setToolbarMenu('none');
                    onAddAlertFromDrawing(selectedDrawing);
                  }}
                  title="Add Alert on Drawing"
                  className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                >
                  <BellPlus className="w-4 h-4" />
                </button>

                {/* 9. Lock / Unlock Individual Drawing */}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, locked: !d.locked }))
                  }
                  title={selectedDrawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
                  className={`w-7 h-7 rounded inline-flex items-center justify-center cursor-pointer ${
                    selectedDrawing.locked
                      ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {selectedDrawing.locked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>

                {/* 10. Delete Drawing */}
                <button
                  type="button"
                  disabled={Boolean(selectedDrawing.locked || lockDrawings)}
                  onClick={() => onDeleteDrawing(selectedDrawing.id)}
                  title={
                    selectedDrawing.locked || lockDrawings
                      ? 'Unlock to delete'
                      : 'Remove (Del)'
                  }
                  className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* 11. More Menu (Clone, Z-Order, Hide) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setToolbarMenu((m) => (m === 'more' ? 'none' : 'more'))}
                    title="More"
                    className={`w-7 h-7 rounded inline-flex items-center justify-center cursor-pointer ${
                      toolbarMenu === 'more'
                        ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {toolbarMenu === 'more' && (
                    <div className="absolute right-0 top-9 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-40 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onCloneDrawing(selectedDrawing.id);
                          setToolbarMenu('none');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] flex items-center gap-2 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Clone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onReorderDrawing(selectedDrawing.id, 'front');
                          setToolbarMenu('none');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Bring to front</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onReorderDrawing(selectedDrawing.id, 'back');
                          setToolbarMenu('none');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Send to back</span>
                      </button>
                      <div className="border-t border-[var(--border)] my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateDrawing(selectedDrawing.id, (d) => ({ ...d, hidden: true }));
                          onSelectDrawingId(null);
                          setToolbarMenu('none');
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-2 cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* TradingView Right-Click Drawing Context Menu */}
          {drawingContextMenu &&
            (() => {
              const targetDrawing = drawings.find((d) => d.id === drawingContextMenu.drawingId);
              if (!targetDrawing) return null;
              const toolLabel = (
                ALL_TOOLS_MAP[targetDrawing.type]?.label || targetDrawing.type
              ).toLowerCase();
              const wrapW = wrapperRef.current?.clientWidth || 900;
              const wrapH = wrapperRef.current?.clientHeight || 560;
              const menuW = 280;
              const menuH = 420;
              const leftPos = Math.max(8, Math.min(drawingContextMenu.x, wrapW - menuW - 8));
              const topPos = Math.max(8, Math.min(drawingContextMenu.y, wrapH - menuH - 8));
              const openSubLeft = leftPos + menuW + 210 > wrapW;

              const closeCtx = () => {
                setDrawingContextMenu(null);
                setCtxSubmenu('none');
              };

              return (
                <div
                  ref={ctxMenuRef}
                  data-ui-overlay="true"
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ left: `${leftPos}px`, top: `${topPos}px`, width: `${menuW}px` }}
                  className="absolute z-50 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 text-[13px] text-[var(--text-main)] select-none"
                >
                  {/* 1. Add alert on <drawing>... */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onAddAlertFromDrawing(targetDrawing);
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <AlarmClockPlus className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                      <span className="truncate">Add alert on {toolLabel}...</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">Alt + A</span>
                  </button>

                  <div className="h-px bg-[var(--border)] my-1" />

                  {/* 2. Template > */}
                  <div
                    className="relative"
                    onMouseEnter={() => setCtxSubmenu('template')}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCtxSubmenu((prev) => (prev === 'template' ? 'none' : 'template'))
                      }
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer ${
                        ctxSubmenu === 'template' ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-4 h-4 shrink-0" />
                        <span>Template</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                    {ctxSubmenu === 'template' && (
                      <div
                        className={`absolute top-0 ${
                          openSubLeft ? 'right-full mr-0.5' : 'left-full ml-0.5'
                        } w-52 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-50 text-[12.5px]`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            closeCtx();
                            onOpenDrawingSettings(targetDrawing.id, 'style');
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
                        >
                          Save As...
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateDrawing(targetDrawing.id, (d) => ({
                              ...d,
                              color: '#2962ff',
                              lineWidth: 2,
                              lineStyle: 'solid',
                              extend: 'none',
                              leftEnd: 'normal',
                              rightEnd: 'normal',
                              showMiddlePoint: false,
                              showPriceLabels: d.type === 'hline' || d.type === 'hray',
                              statsMode: 'hidden',
                              alwaysShowStats: false,
                              visibility: JSON.parse(JSON.stringify(DEFAULT_VISIBILITY)),
                            }));
                            closeCtx();
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
                        >
                          Apply Default
                        </button>
                        {templates.length > 0 && (
                          <div className="border-t border-[var(--border)] mt-1 pt-1 max-h-44 overflow-y-auto">
                            {templates.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => {
                                  onUpdateDrawing(targetDrawing.id, (d) => ({
                                    ...d,
                                    color: tpl.color,
                                    lineWidth: tpl.lineWidth,
                                    lineStyle: tpl.lineStyle,
                                    extend: tpl.extend,
                                    leftEnd: tpl.leftEnd,
                                    rightEnd: tpl.rightEnd,
                                    showMiddlePoint: tpl.showMiddlePoint,
                                    showPriceLabels: tpl.showPriceLabels,
                                    statsMode: tpl.statsMode,
                                    statsPosition: tpl.statsPosition,
                                    alwaysShowStats: tpl.alwaysShowStats,
                                    textColor: tpl.textColor,
                                    fontSize: tpl.fontSize,
                                    fontBold: tpl.fontBold,
                                    fontItalic: tpl.fontItalic,
                                    textAlignV: tpl.textAlignV,
                                    textAlignH: tpl.textAlignH,
                                  }));
                                  closeCtx();
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tpl.color }}
                                />
                                <span className="truncate">{tpl.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. Visual order > */}
                  <div
                    className="relative"
                    onMouseEnter={() => setCtxSubmenu('order')}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCtxSubmenu((prev) => (prev === 'order' ? 'none' : 'order'))
                      }
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer ${
                        ctxSubmenu === 'order' ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Layers className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Visual order</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                    {ctxSubmenu === 'order' && (
                      <div
                        className={`absolute top-0 ${
                          openSubLeft ? 'right-full mr-0.5' : 'left-full ml-0.5'
                        } w-48 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-50 text-[12.5px]`}
                      >
                        {(
                          [
                            { id: 'front', label: 'Bring to front' },
                            { id: 'back', label: 'Send to back' },
                            { id: 'forward', label: 'Bring forward' },
                            { id: 'backward', label: 'Send backward' },
                          ] as const
                        ).map((ord) => (
                          <button
                            key={ord.id}
                            type="button"
                            onClick={() => {
                              onReorderDrawing(targetDrawing.id, ord.id);
                              closeCtx();
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
                          >
                            {ord.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Visibility on intervals > */}
                  <div
                    className="relative"
                    onMouseEnter={() => setCtxSubmenu('visibility')}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCtxSubmenu((prev) => (prev === 'visibility' ? 'none' : 'visibility'))
                      }
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer ${
                        ctxSubmenu === 'visibility'
                          ? 'bg-[var(--bg-hover)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-4 h-4 shrink-0" />
                        <span>Visibility on intervals</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                    {ctxSubmenu === 'visibility' && (
                      <div
                        className={`absolute top-0 ${
                          openSubLeft ? 'right-full mr-0.5' : 'left-full ml-0.5'
                        } w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-50 text-[12.5px]`}
                      >
                        {(
                          [
                            { id: 'below', label: 'Current interval and below' },
                            { id: 'above', label: 'Current interval and above' },
                            { id: 'only', label: 'Current interval only' },
                            { id: 'all', label: 'All intervals' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              applyIntervalVisibilityPreset(targetDrawing.id, opt.id);
                              closeCtx();
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Object tree */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      setObjectTreeOpen(true);
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <span className="w-4 h-4 shrink-0" />
                    <span>Object tree</span>
                  </button>

                  <div className="h-px bg-[var(--border)] my-1" />

                  {/* 6. Clone */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onCloneDrawing(targetDrawing.id);
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Copy className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                      <span>Clone</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">Ctrl + Drag</span>
                  </button>

                  {/* 7. Copy */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      copiedDrawingRef.current = JSON.parse(JSON.stringify(targetDrawing));
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 h-4 shrink-0" />
                      <span>Copy</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">Ctrl + C</span>
                  </button>

                  <div className="h-px bg-[var(--border)] my-1" />

                  {/* 8. Lock / Unlock */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onUpdateDrawing(targetDrawing.id, (d) => ({ ...d, locked: !d.locked }));
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    {targetDrawing.locked ? (
                      <Lock className="w-4 h-4 shrink-0 text-[var(--accent)]" strokeWidth={1.6} />
                    ) : (
                      <Unlock className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                    )}
                    <span>{targetDrawing.locked ? 'Unlock' : 'Lock'}</span>
                  </button>

                  {/* 9. Hide */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onUpdateDrawing(targetDrawing.id, (d) => ({ ...d, hidden: true }));
                      onSelectDrawingId(null);
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <EyeOff className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                    <span>Hide</span>
                  </button>

                  {/* 10. Remove */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onDeleteDrawing(targetDrawing.id);
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                      <span>Remove</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">Del</span>
                  </button>

                  <div className="h-px bg-[var(--border)] my-1" />

                  {/* 11. Settings... */}
                  <button
                    type="button"
                    onMouseEnter={() => setCtxSubmenu('none')}
                    onClick={() => {
                      onOpenDrawingSettings(targetDrawing.id, 'style');
                      closeCtx();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <HexSettingsIcon className="w-4 h-4 shrink-0 text-[var(--text-main)]" />
                    <span>Settings...</span>
                  </button>
                </div>
              );
            })()}

          {/* Floating Object Tree Panel (opened from right-click context menu) */}
          {objectTreeOpen && (
            <div
              data-ui-overlay="true"
              className="absolute top-12 right-20 z-40 w-[268px] max-h-[360px] flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl text-[12px] text-[var(--text-main)] overflow-hidden select-none"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                <span className="font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Object Tree · {symbol}
                </span>
                <button
                  type="button"
                  onClick={() => setObjectTreeOpen(false)}
                  className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto divide-y divide-[var(--border)]/50">
                {drawings.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No drawings on {symbol}
                  </div>
                ) : (
                  [...drawings].reverse().map((d) => {
                    const label =
                      d.title || ALL_TOOLS_MAP[d.type]?.label || d.type;
                    const pricePreview =
                      d.price !== undefined
                        ? fmtPrice(d.price, getPrecision(d.price))
                        : d.p1
                        ? fmtPrice(d.p1.price, getPrecision(d.p1.price))
                        : '';
                    const isSel = d.id === selectedDrawingId;
                    return (
                      <div
                        key={d.id}
                        onClick={() => onSelectDrawingId(d.id)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 cursor-pointer ${
                          isSel
                            ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'hover:bg-[var(--bg-hover)]'
                        } ${d.hidden ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: d.color || '#2962ff' }}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium leading-tight">{label}</div>
                            {pricePreview && (
                              <div className="text-[10.5px] font-mono-num text-[var(--text-muted)] leading-tight">
                                {pricePreview}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            title={d.locked ? 'Unlock' : 'Lock'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateDrawing(d.id, (prev) => ({ ...prev, locked: !prev.locked }));
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                          >
                            {d.locked ? (
                              <Lock className="w-3 h-3 text-[var(--accent)]" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title={d.hidden ? 'Show' : 'Hide'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateDrawing(d.id, (prev) => ({ ...prev, hidden: !prev.hidden }));
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                          >
                            {d.hidden ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Settings"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDrawingSettings(d.id, 'style');
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            title="Remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDrawing(d.id);
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[#f23645] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Inline Text / Callout Input Popup */}
          {textPrompt && (
            <form
              data-ui-overlay="true"
              onSubmit={handleSubmitTextPrompt}
              style={{
                left: `${Math.max(12, Math.min(textPrompt.x, (wrapperRef.current?.clientWidth || 500) - 260))}px`,
                top: `${Math.max(12, Math.min(textPrompt.y, (wrapperRef.current?.clientHeight || 400) - 60))}px`,
              }}
              className="absolute z-30 bg-[var(--bg-surface)] border border-[var(--accent)] rounded-md shadow-2xl p-1.5 flex items-center gap-1.5"
            >
              <input
                autoFocus
                type="text"
                value={textPrompt.value}
                onChange={(e) => setTextPrompt({ ...textPrompt, value: e.target.value })}
                placeholder={textPrompt.mode === 'callout' ? 'Callout label...' : 'Type note...'}
                className="w-44 h-7 px-2 text-xs bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="h-7 px-2.5 rounded bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setTextPrompt(null)}
                className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Unified Collision-Free Sharp-Corner TradingView Price Scale Badges */}
          {scaleBadges.map((badge) => (
            <div
              key={badge.id}
              className={`absolute ${
                chartSettings.scales.scalesPlacement === 'left' ? 'left-0' : 'right-0'
              } z-[9] pointer-events-none text-white select-none rounded-none flex flex-col justify-center overflow-hidden`}
              style={{
                top: `${badge.top}px`,
                height: `${badge.height}px`,
                width: `${Math.max(64, rightScaleWidth - 1)}px`,
                backgroundColor: badge.bgColor,
                paddingLeft: '7px',
                paddingRight: '3px',
                fontSize: `${chartSettings.canvas.scaleFontSize || 11}px`,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span className="font-semibold leading-[14px] whitespace-nowrap tracking-[-0.01em]">
                {badge.text}
              </span>
              {badge.subText && (
                <span className="font-medium leading-[14px] whitespace-nowrap tracking-[-0.01em] opacity-95">
                  {badge.subText}
                </span>
              )}
            </div>
          ))}

          {/* Hover-Only TradingView Alert Floating Pill (disappears immediately when mouse moves away) */}
          {alertHoverInfo && (
            <div
              data-ui-overlay="true"
              onMouseEnter={() => {
                isHoveringAlertPillRef.current = true;
              }}
              onMouseLeave={() => {
                isHoveringAlertPillRef.current = false;
                if (!draggingAlertRef.current) {
                  hoveredAlertIdRef.current = null;
                  setAlertHoverInfo(null);
                  redrawOverlay();
                }
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                e.stopPropagation();
                e.preventDefault();
                draggingAlertRef.current = {
                  id: alertHoverInfo.id,
                  price: alertHoverInfo.price,
                  y: alertHoverInfo.y,
                };
                redrawOverlay();
              }}
              style={{
                top: `${Math.round(alertHoverInfo.y - 11)}px`,
                left:
                  chartSettings.scales.scalesPlacement === 'left'
                    ? `calc(50% + ${rightScaleWidth / 2}px)`
                    : `calc(50% - ${rightScaleWidth / 2}px)`,
              }}
              className="absolute -translate-x-1/2 z-[18] h-[22px] bg-[var(--bg-surface)] border border-[#b2b5be] dark:border-[#434651] rounded-[4px] shadow-sm flex items-center overflow-hidden select-none"
            >
              <span className="px-2 text-[11px] font-normal text-[#787b86] dark:text-[#b2b5be] whitespace-nowrap cursor-ns-resize">
                {alertHoverInfo.label}
              </span>
              {onDeleteAlert && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    isHoveringAlertPillRef.current = false;
                    hoveredAlertIdRef.current = null;
                    setAlertHoverInfo(null);
                    onDeleteAlert(alertHoverInfo.id);
                  }}
                  title="Delete alert"
                  className="h-full px-1.5 text-[#787b86] hover:text-[#f23645] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.8} />
                </button>
              )}
            </div>
          )}

          {/* Top-Layer GPU-Smooth Crosshair Price Tag (zero React re-render on mousemove!) */}
          <div
            ref={crosshairTagElRef}
            className={`absolute top-0 ${
              chartSettings.scales.scalesPlacement === 'left' ? 'left-0' : 'right-0'
            } z-[15] pointer-events-none bg-[#131722] dark:bg-[#2a2e39] text-white select-none rounded-none flex items-center overflow-hidden will-change-transform`}
            style={{
              visibility: 'hidden',
              height: '19px',
              width: `${Math.max(64, rightScaleWidth - 1)}px`,
              paddingLeft: '7px',
              paddingRight: '3px',
              fontSize: `${chartSettings.canvas.scaleFontSize || 11}px`,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              ref={crosshairPriceTextElRef}
              className="font-semibold leading-none whitespace-nowrap tracking-[-0.01em]"
            />
          </div>

          {/* Price-Scale Crosshair (+) Add Alert / Quick Action Button (exact TradingView Image 1 & 2) */}
          <button
            ref={crosshairPlusBtnElRef}
            type="button"
            data-ui-overlay="true"
            onMouseEnter={() => {
              isHoveringPlusBtnRef.current = true;
            }}
            onMouseLeave={() => {
              isHoveringPlusBtnRef.current = false;
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (plusMenuAnchor) {
                setPlusMenuAnchor(null);
              } else if (crosshairLiveRef.current) {
                setPlusMenuAnchor({ ...crosshairLiveRef.current });
              }
            }}
            title="Add alert / quick actions"
            style={{
              visibility: 'hidden',
              ...(chartSettings.scales.scalesPlacement === 'right'
                ? { right: `${rightScaleWidth}px` }
                : { left: `${rightScaleWidth}px` }),
            }}
            className="absolute top-0 z-20 w-[22px] h-[19px] rounded-none bg-[#131722] dark:bg-[#2a2e39] hover:bg-[#2962ff] text-white inline-flex items-center justify-center cursor-pointer transition-colors will-change-transform border-r border-white/90"
          >
            <PlusCircle className="w-3.5 h-3.5" strokeWidth={1.9} />
          </button>

          {/* TradingView (+) Quick Action Menu (Image 2) */}
          {plusMenuAnchor && (() => {
            const menuPrice = plusMenuAnchor.price;
            const lastClose = effectiveCandles[effectiveCandles.length - 1]?.close ?? menuPrice;
            const prec =
              chartSettings.symbol.precision === 'default'
                ? getPrecision(lastClose)
                : parseInt(chartSettings.symbol.precision, 10);
            const priceLabel = fmtPrice(menuPrice, prec);
            const isAbovePrice = menuPrice >= lastClose;
            const containerH = wrapperRef.current?.clientHeight || 520;
            const menuTop = Math.max(8, Math.min(plusMenuAnchor.y - 10, containerH - 255));

            return (
              <div
                ref={plusMenuRef}
                data-ui-overlay="true"
                style={{
                  top: `${menuTop}px`,
                  ...(chartSettings.scales.scalesPlacement === 'right'
                    ? { right: `${rightScaleWidth + 24}px` }
                    : { left: `${rightScaleWidth + 24}px` }),
                }}
                className="absolute z-30 w-[305px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-md shadow-2xl py-1.5 text-[13px] text-[var(--text-main)] select-none"
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenAlertAtPrice?.(menuPrice);
                    setPlusMenuAnchor(null);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <BellPlus className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                    <span className="truncate">
                      Add alert on {symbol} at {priceLabel}
                    </span>
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">Alt + A</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenAlertAtPrice?.(menuPrice);
                    setPlusMenuAnchor(null);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <BellPlus className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                    <span className="truncate">
                      Add alert on EMA at {priceLabel}
                    </span>
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">Alt + A</span>
                </button>

                {onQuickLimitOrder && (
                  <>
                    <div className="h-px bg-[var(--border)] my-1.5" />
                    <button
                      type="button"
                      onClick={() => {
                        onQuickLimitOrder(isAbovePrice ? 'SELL' : 'BUY', menuPrice);
                        setPlusMenuAnchor(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.7} />
                        <span className="truncate">
                          {isAbovePrice ? 'Sell' : 'Buy'} 1 {symbol} @ {priceLabel} limit
                        </span>
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                        {isAbovePrice ? 'Alt + Shift + S' : 'Alt + Shift + B'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onQuickLimitOrder(isAbovePrice ? 'BUY' : 'SELL', menuPrice);
                        setPlusMenuAnchor(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <ChevronUp className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.7} />
                        <span className="truncate">
                          {isAbovePrice ? 'Buy' : 'Sell'} 1 {symbol} @ {priceLabel} stop
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onQuickLimitOrder(isAbovePrice ? 'SELL' : 'BUY', menuPrice);
                        setPlusMenuAnchor(null);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <LayoutGrid className="w-4 h-4 shrink-0 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span className="truncate">
                          Add order on {symbol} at {priceLabel}...
                        </span>
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0">Shift + T</span>
                    </button>
                  </>
                )}

                <div className="h-px bg-[var(--border)] my-1.5" />
                <button
                  type="button"
                  onClick={() => {
                    onAddDrawing({
                      id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      type: 'hline',
                      color: drawColor,
                      price: menuPrice,
                      lineWidth: 1.6,
                      lineStyle: 'solid',
                      visibility: DEFAULT_VISIBILITY,
                    });
                    setPlusMenuAnchor(null);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 18 18" fill="none">
                      <line x1="1" y1="9" x2="6.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                      <line x1="11.5" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    <span className="truncate">Draw horizontal line at {priceLabel}</span>
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">Alt + H</span>
                </button>
              </div>
            );
          })()}

          {/* Floating "Scroll to the most recent bar" button (TradingView style) */}
          {showScrollToRecent && effectiveCandles.length > 2 && (
            <button
              type="button"
              data-ui-overlay="true"
              onClick={handleScrollToMostRecent}
              title="Scroll to the most recent bar"
              aria-label="Scroll to the most recent bar"
              style={{
                right: `${
                  chartSettings.scales.scalesPlacement === 'right' ? rightScaleWidth + 12 : 12
                }px`,
              }}
              className="absolute bottom-[38px] z-20 w-[34px] h-[34px] rounded-lg bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border)] shadow-[0_2px_8px_rgba(0,0,0,0.16)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all inline-flex items-center justify-center cursor-pointer"
            >
              <ChevronsRight className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          )}

          {/* Floating Bar Replay Controller */}
          {isReplayMode && candles.length > 10 && (
            <div
              data-ui-overlay="true"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl px-3 py-2 flex items-center gap-2.5 text-xs"
            >
              <div className="flex items-center gap-1 text-[var(--accent)] font-bold">
                <Rewind className="w-3.5 h-3.5" />
                <span>Replay</span>
              </div>

              <button
                onClick={onToggleReplayPlay}
                className="w-7 h-7 rounded bg-[var(--accent)] text-white inline-flex items-center justify-center hover:opacity-90 cursor-pointer"
                title={isReplayPlaying ? 'Pause Replay' : 'Play Replay'}
              >
                {isReplayPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={onReplayStep}
                className="h-7 px-2 rounded border border-[var(--border)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1 font-medium cursor-pointer"
                title="Step Forward 1 Bar"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>+1</span>
              </button>

              <input
                type="range"
                min={25}
                max={candles.length}
                value={replayIndex}
                onChange={(e) => onReplayIndexChange(parseInt(e.target.value, 10))}
                className="w-28 sm:w-40 accent-[var(--accent)] cursor-pointer"
                title="Scrub Replay Bar"
              />

              <span className="font-mono-num text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                {replayIndex}/{candles.length}
              </span>

              <div className="flex items-center gap-0.5 border border-[var(--border)] rounded overflow-hidden">
                {[1, 2, 5].map((sp) => (
                  <button
                    key={sp}
                    onClick={() => onReplaySpeedChange(sp)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono-num font-bold cursor-pointer ${
                      replaySpeed === sp
                        ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>

              <button
                onClick={onExitReplay}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--down)] cursor-pointer"
                title="Exit Bar Replay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Bottom-Right Price Scale Corner Hexagon Gear Icon (Exact Match to Screenshot 4 & Full-Screen) */}
          <div
            ref={scaleMenuRef}
            data-ui-overlay="true"
            style={{
              width: `${Math.max(54, rightScaleWidth)}px`,
              ...(chartSettings.scales.scalesPlacement === 'left' ? { left: 0 } : { right: 0 }),
            }}
            className="absolute bottom-0 h-[26px] z-20 flex items-center justify-center bg-[var(--bg-app)]"
          >
            <button
              type="button"
              onClick={() => setScaleMenuOpen((v) => !v)}
              title="Price Scale Settings"
              className={`w-6 h-6 rounded inline-flex items-center justify-center transition-colors cursor-pointer ${
                scaleMenuOpen
                  ? 'bg-[var(--bg-hover)] text-[var(--accent)]'
                  : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <HexSettingsIcon className="w-[15px] h-[15px]" />
            </button>

            {scaleMenuOpen && (
              <div
                className={`absolute ${
                  chartSettings.scales.scalesPlacement === 'left' ? 'left-1' : 'right-1'
                } bottom-7 w-64 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50 text-xs text-[var(--text-main)]`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = !chartSettings.scales.autoScale;
                    onUpdateChartSettings({
                      ...chartSettings,
                      scales: { ...chartSettings.scales, autoScale: next },
                    });
                    setScaleMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-4 inline-flex justify-center">
                    {chartSettings.scales.autoScale && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1">Auto (fits data to screen)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateChartSettings({
                      ...chartSettings,
                      scales: {
                        ...chartSettings.scales,
                        lockPriceToBarRatio: !chartSettings.scales.lockPriceToBarRatio,
                      },
                    });
                    setScaleMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-4 inline-flex justify-center">
                    {chartSettings.scales.lockPriceToBarRatio && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1">Lock price to bar ratio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateChartSettings({
                      ...chartSettings,
                      scales: {
                        ...chartSettings.scales,
                        invertScale: !chartSettings.scales.invertScale,
                      },
                    });
                    setScaleMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-4 inline-flex justify-center">
                    {chartSettings.scales.invertScale && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1">Invert scale</span>
                  <span className="text-[11px] text-[var(--text-muted)]">Alt + I</span>
                </button>

                <div className="border-t border-[var(--border)] my-1" />

                {(
                  [
                    { id: 'regular', label: 'Regular', shortcut: '' },
                    { id: 'pct', label: 'Percent', shortcut: 'Alt + P' },
                    { id: 'indexed100', label: 'Indexed to 100', shortcut: '' },
                    { id: 'log', label: 'Logarithmic', shortcut: 'Alt + L' },
                  ] as const
                ).map((item) => {
                  const active =
                    item.id === 'regular'
                      ? scaleMode === 'regular' || scaleMode === 'auto'
                      : scaleMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        applyScaleMode(item.id);
                        setScaleMenuOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                    >
                      <span className="w-4 inline-flex justify-center">
                        {active && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}

                <div className="border-t border-[var(--border)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    onUpdateChartSettings({
                      ...chartSettings,
                      scales: {
                        ...chartSettings.scales,
                        scalesPlacement:
                          chartSettings.scales.scalesPlacement === 'left' ? 'right' : 'left',
                      },
                    });
                    setScaleMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-4" />
                  <span className="flex-1">
                    {chartSettings.scales.scalesPlacement === 'left'
                      ? 'Move scale to right'
                      : 'Move scale to left'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateChartSettings({
                      ...chartSettings,
                      scales: {
                        ...chartSettings.scales,
                        plusButton: !chartSettings.scales.plusButton,
                      },
                    });
                    setScaleMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-4 inline-flex justify-center">
                    {chartSettings.scales.plusButton && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1">Plus button</span>
                </button>

                <div className="border-t border-[var(--border)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setScaleMenuOpen(false);
                    onOpenChartSettings('scales');
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] flex items-center gap-2 font-medium cursor-pointer"
                >
                  <span className="w-4 inline-flex justify-center">
                    <HexSettingsIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>More settings...</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Synchronized RSI Sub-Pane */}
        {indicators.rsi.enabled && (
          <div className="h-[128px] border-t border-[var(--border)] relative shrink-0 bg-[var(--bg-app)]">
            <div className="absolute top-1.5 left-3 z-10 pointer-events-none flex items-center gap-2 text-[11px] font-mono-num">
              <span className="font-semibold" style={{ color: indicators.rsi.color }}>
                RSI({indicators.rsi.period})
              </span>
              <span className="font-bold text-[var(--text-main)]">
                {indValues.rsi !== undefined ? indValues.rsi.toFixed(2) : '-'}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">OB 70 · OS 30</span>
            </div>
            <div ref={rsiContainerRef} className="w-full h-full" />
          </div>
        )}

        {/* Bottom Date Range & UTC Clock Strip (Exact TradingView Full-Screen Match) */}
        <div className="h-[34px] border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between px-2.5 text-xs shrink-0 select-none relative">
          <div className="flex items-center gap-0.5">
            {(
              [
                { id: '1D', days: 1 },
                { id: '5D', days: 5 },
                { id: '1M', days: 30 },
                { id: '3M', days: 90 },
                { id: '6M', days: 180 },
                { id: 'YTD', days: -1 },
                { id: '1Y', days: 365 },
                { id: '5Y', days: 1825 },
                { id: 'All', days: 0 },
              ] as const
            ).map((rng) => (
              <button
                key={rng.id}
                type="button"
                onClick={() => {
                  setActiveDateRange(rng.id);
                  if (rng.days === 0) {
                    chartRef.current?.timeScale().fitContent();
                    return;
                  }
                  const secPerBar: Record<string, number> = {
                    '1m': 60,
                    '5m': 300,
                    '15m': 900,
                    '30m': 1800,
                    '1h': 3600,
                    '4h': 14400,
                    '1d': 86400,
                    '1w': 604800,
                  };
                  const barSec = secPerBar[interval] || 86400;
                  let spanDays: number = rng.days;
                  if (rng.id === 'YTD') {
                    const now = new Date();
                    const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
                    spanDays = Math.max(1, Math.ceil((now.getTime() - jan1.getTime()) / 86400000));
                  }
                  const targetBars = Math.max(12, Math.round((spanDays * 86400) / barSec));
                  applyZoomRange(targetBars);
                }}
                className={`px-2 py-1 rounded-[4px] text-[12px] transition-colors cursor-pointer ${
                  activeDateRange === rng.id
                    ? 'bg-[var(--bg-hover)] text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-main)] font-normal hover:bg-[var(--bg-hover)]'
                }`}
              >
                {rng.id}
              </button>
            ))}

            <div className="w-px h-4 bg-[var(--border)] mx-1.5" />

            {/* Go to Date Calendar Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGoToDateOpen((v) => !v)}
                title="Go to date..."
                className={`w-7 h-7 rounded-[4px] inline-flex items-center justify-center transition-colors cursor-pointer ${
                  goToDateOpen
                    ? 'bg-[var(--bg-hover)] text-[var(--accent)]'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Calendar className="w-[15px] h-[15px]" strokeWidth={1.5} />
              </button>

              {goToDateOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const targetSec = Math.floor(new Date(goToDateVal).getTime() / 1000);
                    if (!Number.isNaN(targetSec) && effectiveCandles.length > 0) {
                      let bestIdx = 0;
                      let bestDiff = Infinity;
                      for (let i = 0; i < effectiveCandles.length; i++) {
                        const d = Math.abs(effectiveCandles[i].time - targetSec);
                        if (d < bestDiff) {
                          bestDiff = d;
                          bestIdx = i;
                        }
                      }
                      const span = Math.max(20, Math.round(savedZoomRef.current.visibleBars / 2));
                      chartRef.current?.timeScale().setVisibleLogicalRange({
                        from: bestIdx - span,
                        to: bestIdx + span,
                      });
                    }
                    setGoToDateOpen(false);
                  }}
                  className="absolute left-0 bottom-9 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl p-2.5 z-50 flex items-center gap-2"
                >
                  <input
                    type="date"
                    value={goToDateVal}
                    onChange={(e) => setGoToDateVal(e.target.value)}
                    className="h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="h-7 px-2.5 rounded bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-mono-num text-[12px] text-[var(--text-main)]">{clockStr}</span>
            <div className="hidden sm:block w-px h-3.5 bg-[var(--border)]" />
            <div className="hidden sm:flex items-center gap-2">
              {(
                [
                  { id: 'pct', label: '%' },
                  { id: 'log', label: 'log' },
                  { id: 'auto', label: 'auto' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.id === 'auto') {
                      const nextAuto = !chartSettings.scales.autoScale;
                      onUpdateChartSettings({
                        ...chartSettings,
                        scales: { ...chartSettings.scales, autoScale: nextAuto },
                      });
                      if (nextAuto) applyScaleMode('auto');
                    } else {
                      applyScaleMode(scaleMode === m.id ? 'regular' : m.id);
                    }
                  }}
                  className={`text-[11.5px] font-medium cursor-pointer ${
                    (m.id === 'auto' ? chartSettings.scales.autoScale : scaleMode === m.id)
                      ? 'text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChartWorkspace.displayName = 'ChartWorkspace';
