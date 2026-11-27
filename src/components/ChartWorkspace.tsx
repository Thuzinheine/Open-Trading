import React, {
  useEffect,
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
  Star,
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
  loadSavedZoom,
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

export interface ChartWorkspaceHandle {
  resetZoom: () => void;
  zoomOut: () => void;
  setVisibleBars: (bars: number) => void;
  fitContent: () => void;
  takeSnapshot: () => void;
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
  onReorderDrawing: (id: string, dir: 'front' | 'back') => void;
  onRequestOlderHistory: () => void;
  alerts: PriceAlert[];
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
    const emaFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const emaSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbMidSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const priceLinesRef = useRef<IPriceLine[]>([]);

    // Cached arrays & zoom persistence refs
    const emaFastRef = useRef<LinePoint[]>([]);
    const emaSlowRef = useRef<LinePoint[]>([]);
    const displayCandlesRef = useRef<CandleBar[]>([]);
    const prevSymIntervalRef = useRef<string>('');
    const prevFirstCandleTimeRef = useRef<number | null>(null);
    const savedZoomRef = useRef<SavedZoomState>(loadSavedZoom());
    const isApplyingZoomRef = useRef<boolean>(false);
    const zoomSaveTimerRef = useRef<number | null>(null);

    // Drawing interaction refs
    const isDrawingRef = useRef(false);
    const drawStageRef = useRef<0 | 1 | 2>(0); // for 3-point & multi-point tools
    const tempShapeRef = useRef<DrawingObject | null>(null);
    const zoomBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const dragEditRef = useRef<{
      drawingId: string;
      handleKey?: HandleHit['handleKey'];
      startAnchor: AnchorPoint;
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

    // UI states
    const [scaleMode, setScaleMode] = useState<ScaleMode>('auto');
    const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
    const scaleMenuRef = useRef<HTMLDivElement>(null);
    const [goToDateOpen, setGoToDateOpen] = useState(false);
    const [goToDateVal, setGoToDateVal] = useState<string>(() =>
      new Date().toISOString().slice(0, 10)
    );
    const [activeDateRange, setActiveDateRange] = useState<string>('');
    const [indExpanded, setIndExpanded] = useState(true);
    const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);
    const [hoverCursor, setHoverCursor] = useState<string>('');
    const [drawingHint, setDrawingHint] = useState<string | null>(null);
    const [toolbarMenu, setToolbarMenu] = useState<
      'none' | 'template' | 'lineColor' | 'textColor' | 'lineWidth' | 'lineStyle' | 'more'
    >('none');
    const [toolbarOffset, setToolbarOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const toolbarDragRef = useRef<{
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

    const [indValues, setIndValues] = useState<{
      emaFast?: number;
      emaSlow?: number;
      ema50?: number;
      ema200?: number;
      volMa?: number;
      rsi?: number;
    }>({});
    const [clockStr, setClockStr] = useState('--:--:--');
    const [countdownStr, setCountdownStr] = useState('');
    const [countdownTop, setCountdownTop] = useState<number | null>(null);
    const [showScrollToRecent, setShowScrollToRecent] = useState(false);
    const [rightScaleWidth, setRightScaleWidth] = useState(66);
    const [crosshairPlus, setCrosshairPlus] = useState<{ y: number; price: number } | null>(null);
    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const plusMenuOpenRef = useRef(false);
    plusMenuOpenRef.current = plusMenuOpen;
    const plusMenuRef = useRef<HTMLDivElement>(null);

    // Slice candles when in Replay mode
    const effectiveCandles = isReplayMode
      ? candles.slice(0, Math.max(2, Math.min(replayIndex, candles.length)))
      : candles;
    const effectiveVolumes = isReplayMode
      ? volumes.slice(0, effectiveCandles.length)
      : volumes;

    displayCandlesRef.current = effectiveCandles;

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
        width: canvas.width,
        height: canvas.height,
        intervalSec: INTERVAL_SECONDS[intervalRef.current] || 86400,
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

      ctx.clearRect(0, 0, canvas.width, canvas.height);

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
              ctx.lineTo(Number(x), canvas.height);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      const cfg = indicatorsRef.current;
      const fast = emaFastRef.current;
      const slow = emaSlowRef.current;
      if (!cfg.emaCloud.enabled || !cfg.emaFast.enabled || !cfg.emaSlow.enabled || fast.length < 2) {
        return;
      }

      const startIdx = Math.max(0, Math.floor(range.from) - 1);
      const endIdx = Math.min(fast.length - 1, Math.ceil(range.to) + 1);

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
        ctx.fillStyle = isBull ? 'rgba(41, 98, 255, 0.11)' : 'rgba(242, 54, 69, 0.11)';
        ctx.beginPath();
        ctx.moveTo(x1, yf1);
        ctx.lineTo(x2, yf2);
        ctx.lineTo(x2, ys2);
        ctx.lineTo(x1, ys1);
        ctx.closePath();
        ctx.fill();
      }
    }, []);

    // Redraw Drawing Canvas (all saved drawings + active preview + zoom box)
    const redrawOverlay = useCallback(() => {
      const canvas = drawCanvasRef.current;
      const bridge = buildCoordBridge();
      if (!canvas || !bridge) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!drawingsHiddenRef.current) {
        const visibleDrawings = drawingsRef.current.filter((d) =>
          isDrawingVisibleOnTimeframe(d, intervalRef.current)
        );
        visibleDrawings.forEach((d) =>
          renderDrawingObject(
            ctx,
            d,
            bridge,
            d.id === selectedIdRef.current,
            d.id === hoveredDrawingIdRef.current
          )
        );
        if (tempShapeRef.current) {
          renderDrawingObject(ctx, tempShapeRef.current, bridge, true, false);
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
      const series = candleSeriesRef.current;
      const canvas = drawCanvasRef.current;
      const arr = displayCandlesRef.current;
      if (!series || !canvas || !arr.length || isReplayMode) {
        setCountdownTop(null);
        return;
      }
      const lastClose = arr[arr.length - 1].close;
      const y = series.priceToCoordinate(lastClose);
      if (y === null) {
        setCountdownTop(null);
        return;
      }
      setCountdownTop(Math.max(4, Math.min(canvas.height - 46, Number(y) + 10)));
    }, [isReplayMode]);

    // Initialize Main Chart once
    useEffect(() => {
      if (!chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDarkMode ? '#d1d4dc' : '#131722',
          fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
        },
        grid: {
          vertLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
          horzLines: { color: isDarkMode ? '#1e222d' : '#f0f3fa' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#9598a1', style: LineStyle.Dashed },
          horzLine: { color: '#9598a1', style: LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: isDarkMode ? '#2a2e39' : '#e0e3eb',
          autoScale: true,
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
      });

      const lineSeries = chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 2,
        visible: false,
      });

      const areaSeries = chart.addAreaSeries({
        lineColor: '#2962ff',
        topColor: 'rgba(41, 98, 255, 0.28)',
        bottomColor: 'rgba(41, 98, 255, 0.01)',
        lineWidth: 2,
        visible: false,
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      const volMaSeries = chart.addLineSeries({
        color: '#9c27b0',
        lineWidth: 1,
        priceScaleId: 'vol',
        priceLineVisible: false,
      });

      const emaFastSeries = chart.addLineSeries({
        color: '#f23645',
        lineWidth: 1,
        priceLineVisible: false,
      });
      const emaSlowSeries = chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 1,
        priceLineVisible: false,
      });
      const ema50Series = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        visible: false,
      });
      const ema200Series = chart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 2,
        priceLineVisible: false,
        visible: false,
      });

      const bbUpperSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        priceLineVisible: false,
        visible: false,
      });
      const bbMidSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        visible: false,
      });
      const bbLowerSeries = chart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1,
        priceLineVisible: false,
        visible: false,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      lineSeriesRef.current = lineSeries;
      areaSeriesRef.current = areaSeries;
      volumeSeriesRef.current = volumeSeries;
      volMaSeriesRef.current = volMaSeries;
      emaFastSeriesRef.current = emaFastSeries;
      emaSlowSeriesRef.current = emaSlowSeries;
      ema50SeriesRef.current = ema50Series;
      ema200SeriesRef.current = ema200Series;
      bbUpperSeriesRef.current = bbUpperSeries;
      bbMidSeriesRef.current = bbMidSeries;
      bbLowerSeriesRef.current = bbLowerSeries;

      chart.subscribeCrosshairMove((param) => {
        if (!param.point || param.point.y < 0) {
          if (!plusMenuOpenRef.current) setCrosshairPlus(null);
        } else {
          const p = candleSeries.coordinateToPrice(param.point.y);
          if (p !== null && Number.isFinite(Number(p)) && !plusMenuOpenRef.current) {
            setCrosshairPlus({ y: param.point.y, price: Number(p) });
            const rw = chart.priceScale('right').width();
            if (rw > 0) setRightScaleWidth(rw);
          }
        }
        if (!param.time) {
          setHoverBar(null);
          return;
        }
        const t = Number(param.time);
        const found = displayCandlesRef.current.find((c) => c.time === t);
        if (found) setHoverBar(found);
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
          if (span >= 10 && span <= 1400) {
            const lastIdx = arr.length - 1;
            const currentRightOffset = range.to - lastIdx;
            const nextZoom: SavedZoomState = {
              visibleBars: span,
              rightOffset:
                currentRightOffset >= -10 && currentRightOffset <= 80
                  ? currentRightOffset
                  : savedZoomRef.current.rightOffset,
            };
            savedZoomRef.current = nextZoom;
            if (zoomSaveTimerRef.current) window.clearTimeout(zoomSaveTimerRef.current);
            zoomSaveTimerRef.current = window.setTimeout(() => {
              saveZoomState(savedZoomRef.current);
            }, 150);
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
          chart.applyOptions({ width, height });
          if (cloudCanvasRef.current) {
            cloudCanvasRef.current.width = width;
            cloudCanvasRef.current.height = height;
          }
          if (drawCanvasRef.current) {
            drawCanvasRef.current.width = width;
            drawCanvasRef.current.height = height;
          }
          drawEmaCloud();
          redrawOverlay();
          updateCountdownPos();
        }
      });
      if (wrapperRef.current) observer.observe(wrapperRef.current);

      return () => {
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
        chart.applyOptions({
          crosshair: {
            vertLine: { visible: false },
            horzLine: { visible: false },
          },
        });
      } else {
        chart.applyOptions({
          crosshair: {
            vertLine: { visible: true, color: '#9598a1', style: LineStyle.Dashed },
            horzLine: { visible: true, color: '#9598a1', style: LineStyle.Dashed },
          },
        });
      }
    }, [activeTool]);

    // Initialize / teardown RSI Sub-Pane
    useEffect(() => {
      if (!indicators.rsi.enabled || !rsiContainerRef.current) {
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
          fontFamily: '"JetBrains Mono", monospace',
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
    }, [indicators.rsi.enabled, indicators.rsi.color, isDarkMode]);

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
          background:
            cv.backgroundType === 'gradient'
              ? { type: ColorType.VerticalGradient, topColor: bg1, bottomColor: bg2 }
              : { type: ColorType.Solid, color: cv.backgroundColor ? bg1 : 'transparent' },
          textColor: txtCol,
          fontSize: cv.scaleFontSize || 12,
        },
        grid: {
          vertLines: { visible: cv.vertGridEnabled, color: vGridCol },
          horzLines: { visible: cv.horzGridEnabled, color: hGridCol },
        },
        crosshair:
          activeTool === 'arrow'
            ? { vertLine: { visible: false }, horzLine: { visible: false } }
            : {
                vertLine: { visible: true, color: cv.crosshairColor || '#9598a1', style: chStyle },
                horzLine: { visible: true, color: cv.crosshairColor || '#9598a1', style: chStyle },
              },
        rightPriceScale: {
          visible: !isLeftScale,
          borderColor: borderCol,
          autoScale: sc.autoScale,
          invertScale: sc.invertScale,
          mode: priceMode,
          scaleMargins: { top: marginTop, bottom: marginBottom },
        },
        leftPriceScale: {
          visible: isLeftScale,
          borderColor: borderCol,
          autoScale: sc.autoScale,
          invertScale: sc.invertScale,
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
      const showSymVal = sc.symbolLabel !== 'hidden';
      const showSymLine = sc.symbolLabel === 'value_line';
      const showIndVal = sc.indicatorsLabel !== 'hidden';

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
        lastValueVisible: showSymVal,
        priceLineVisible: showSymLine,
      });

      ls.applyOptions({
        priceScaleId: targetScaleId,
        visible: chartType === 'line',
        color: symCfg.upColor,
        lastValueVisible: showSymVal,
        priceLineVisible: showSymLine,
      });
      as.applyOptions({
        priceScaleId: targetScaleId,
        visible: chartType === 'area',
        lineColor: symCfg.upColor,
        lastValueVisible: showSymVal,
        priceLineVisible: showSymLine,
      });

      [
        emaFastSeriesRef.current,
        emaSlowSeriesRef.current,
        ema50SeriesRef.current,
        ema200SeriesRef.current,
        bbUpperSeriesRef.current,
        bbMidSeriesRef.current,
        bbLowerSeriesRef.current,
      ].forEach((s) => {
        s?.applyOptions({ priceScaleId: targetScaleId, lastValueVisible: showIndVal });
      });

      drawEmaCloud();
    }, [chartSettings, isDarkMode, chartType, scaleMode, activeTool, symbol, interval, isReplayMode, drawEmaCloud]);

    // Update all series data & STRICTLY PRESERVE USER'S LAST ZOOM across coin & timeframe switches
    useEffect(() => {
      const chart = chartRef.current;
      const cs = candleSeriesRef.current;
      const ls = lineSeriesRef.current;
      const as = areaSeriesRef.current;
      const vs = volumeSeriesRef.current;
      const vms = volMaSeriesRef.current;
      const ef = emaFastSeriesRef.current;
      const es = emaSlowSeriesRef.current;
      const e50 = ema50SeriesRef.current;
      const e200 = ema200SeriesRef.current;
      const bbu = bbUpperSeriesRef.current;
      const bbm = bbMidSeriesRef.current;
      const bbl = bbLowerSeriesRef.current;

      if (!chart || !cs || !ls || !as || !vs || !vms || !ef || !es || !e50 || !e200 || !bbu || !bbm || !bbl) {
        return;
      }
      if (!effectiveCandles.length) return;

      const key = `${symbol}_${interval}`;
      const isSymbolOrTfSwitch = prevSymIntervalRef.current !== key;

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

      const lastClose = effectiveCandles[effectiveCandles.length - 1].close;
      const prec =
        chartSettings.symbol.precision === 'default'
          ? getPrecision(lastClose)
          : parseInt(chartSettings.symbol.precision, 10);
      const minMove = Math.pow(10, -prec);
      const priceFormat = { type: 'price' as const, precision: prec, minMove };

      cs.applyOptions({ priceFormat });
      ls.applyOptions({ priceFormat });
      as.applyOptions({ priceFormat });
      ef.applyOptions({ priceFormat, visible: indicators.emaFast.enabled, color: indicators.emaFast.color });
      es.applyOptions({ priceFormat, visible: indicators.emaSlow.enabled, color: indicators.emaSlow.color });
      e50.applyOptions({ priceFormat, visible: indicators.ema50.enabled, color: indicators.ema50.color });
      e200.applyOptions({ priceFormat, visible: indicators.ema200.enabled, color: indicators.ema200.color });
      bbu.applyOptions({ priceFormat, visible: indicators.bb.enabled, color: indicators.bb.color });
      bbm.applyOptions({ priceFormat, visible: indicators.bb.enabled, color: indicators.bb.color });
      bbl.applyOptions({ priceFormat, visible: indicators.bb.enabled, color: indicators.bb.color });
      vs.applyOptions({ visible: indicators.volume.enabled });
      vms.applyOptions({ visible: indicators.volume.enabled && indicators.volume.showMa });

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
      vs.setData(effectiveVolumes as never);

      // Compute Indicators
      const emaFast = computeEMA(effectiveCandles, indicators.emaFast.period);
      const emaSlow = computeEMA(effectiveCandles, indicators.emaSlow.period);
      const ema50 = indicators.ema50.enabled ? computeEMA(effectiveCandles, indicators.ema50.period) : [];
      const ema200 = indicators.ema200.enabled ? computeEMA(effectiveCandles, indicators.ema200.period) : [];
      const volMa = computeVolumeSMA(effectiveVolumes, indicators.volume.maPeriod);
      const bb = indicators.bb.enabled
        ? computeBollingerBands(effectiveCandles, indicators.bb.period, indicators.bb.stdDev)
        : { upper: [], middle: [], lower: [] };
      const rsiData = indicators.rsi.enabled ? computeRSI(effectiveCandles, indicators.rsi.period) : [];

      emaFastRef.current = emaFast;
      emaSlowRef.current = emaSlow;

      ef.setData(emaFast as never);
      es.setData(emaSlow as never);
      e50.setData(ema50 as never);
      e200.setData(ema200 as never);
      vms.setData(volMa as never);
      bbu.setData(bb.upper as never);
      bbm.setData(bb.middle as never);
      bbl.setData(bb.lower as never);

      if (rsiSeriesRef.current && indicators.rsi.enabled) {
        rsiSeriesRef.current.setData(rsiData as never);
      }

      setIndValues({
        emaFast: emaFast[emaFast.length - 1]?.value,
        emaSlow: emaSlow[emaSlow.length - 1]?.value,
        ema50: ema50[ema50.length - 1]?.value,
        ema200: ema200[ema200.length - 1]?.value,
        volMa: volMa[volMa.length - 1]?.value,
        rsi: rsiData[rsiData.length - 1]?.value,
      });

      if (isSymbolOrTfSwitch) {
        prevSymIntervalRef.current = key;
        chart
          .priceScale(chartSettings.scales.scalesPlacement)
          .applyOptions({ autoScale: chartSettings.scales.autoScale });
        const { visibleBars, rightOffset } = savedZoomRef.current;
        const lastIdx = effectiveCandles.length - 1;
        const to = lastIdx + rightOffset;
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
          isApplyingZoomRef.current = false;
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
    }, [
      symbol,
      interval,
      chartType,
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

      // Alert lines (Alerts tab)
      if (chartSettings.alerts.alertLines) {
        alerts
          .filter(
            (a) =>
              a.symbol === symbol && (!chartSettings.alerts.onlyActiveAlerts || a.active)
          )
          .forEach((a) => {
            priceLinesRef.current.push(
              cs.createPriceLine({
                price: a.price,
                color: chartSettings.alerts.alertLineColor || '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: a.note ? `Alert: ${a.note}` : a.active ? 'Alert' : 'Triggered',
              })
            );
          });
      }

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
        if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
          setPlusMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, []);

    // Redraw overlay whenever drawings/selection/visibility/timeframe change
    useEffect(() => {
      redrawOverlay();
    }, [drawings, selectedDrawingId, drawingsHidden, interval, redrawOverlay]);

    // Reset floating toolbar popovers when selection changes
    useEffect(() => {
      setToolbarMenu('none');
    }, [selectedDrawingId]);

    // Drag floating selected-drawing toolbar via its grip handle
    useEffect(() => {
      const onMove = (e: MouseEvent) => {
        if (!toolbarDragRef.current) return;
        const dx = e.clientX - toolbarDragRef.current.startX;
        const dy = e.clientY - toolbarDragRef.current.startY;
        setToolbarOffset({
          x: toolbarDragRef.current.origX + dx,
          y: toolbarDragRef.current.origY + dy,
        });
      };
      const onUp = () => {
        toolbarDragRef.current = null;
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
          const secLeft = Math.floor((candleCloseMs - now) / 1000);
          const h = String(Math.floor(secLeft / 3600)).padStart(2, '0');
          const m = String(Math.floor((secLeft % 3600) / 60)).padStart(2, '0');
          const s = String(secLeft % 60).padStart(2, '0');
          setCountdownStr(`${h}:${m}:${s}`);
        } else {
          setCountdownStr('');
        }
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
      takeSnapshot: () => {
        const chart = chartRef.current;
        if (!chart) return;
        const base = chart.takeScreenshot();
        const out = document.createElement('canvas');
        out.width = base.width;
        out.height = base.height;
        const ctx = out.getContext('2d');
        if (!ctx) return;

        const bg1 = chartSettings.canvas.backgroundColor || (isDarkMode ? '#131722' : '#ffffff');
        if (chartSettings.canvas.backgroundType === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, 0, out.height);
          grad.addColorStop(0, bg1);
          grad.addColorStop(
            1,
            chartSettings.canvas.backgroundColor2 || (isDarkMode ? '#1e222d' : '#f0f3fa')
          );
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = bg1;
        }
        ctx.fillRect(0, 0, out.width, out.height);
        if (cloudCanvasRef.current) {
          ctx.drawImage(cloudCanvasRef.current, 0, 0, out.width, out.height);
        }
        ctx.drawImage(base, 0, 0);
        if (drawCanvasRef.current) {
          ctx.drawImage(drawCanvasRef.current, 0, 0, out.width, out.height);
        }
        const a = document.createElement('a');
        a.href = out.toDataURL('image/png');
        a.download = `${symbol}-${interval}.png`;
        a.click();
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

    // Finish Path drawing on Enter or Double-Click
    const commitPathDrawing = useCallback(() => {
      const shape = tempShapeRef.current;
      if (shape && shape.type === 'path' && shape.points && shape.points.length >= 2) {
        tempShapeRef.current = null;
        isDrawingRef.current = false;
        drawStageRef.current = 0;
        finalizeDrawing(shape);
      }
    }, [finalizeDrawing]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && tempShapeRef.current?.type === 'path') {
          e.preventDefault();
          commitPathDrawing();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [commitPathDrawing]);

    // Canvas Drawing Mouse Handlers (active when a non-cursor tool is selected)
    const handleDrawMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || isCursorTool(activeTool)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Zoom Box Tool
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
        } else if (tempShapeRef.current.points) {
          tempShapeRef.current.points[tempShapeRef.current.points.length - 1] = pt;
          tempShapeRef.current.points.push(pt);
        }
        redrawOverlay();
        return;
      }

      // 3-Point Tools (Channel, Flat Channel, Disjoint Channel, Pitchfork, Fib Ext, Triangle)
      if (THREE_POINT_TOOLS.includes(activeTool)) {
        if (drawStageRef.current === 0) {
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
          setDrawingHint('Drag or click second point...');
          redrawOverlay();
          return;
        }
        if (drawStageRef.current === 2 && tempShapeRef.current) {
          tempShapeRef.current.p3 = pt;
          const finished = tempShapeRef.current;
          tempShapeRef.current = null;
          isDrawingRef.current = false;
          drawStageRef.current = 0;
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
          // Scale default stop/target cleanly from recent visible ATR/range
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
            color: isLong ? '#089981' : '#f23645',
            lineWidth: 1.5,
            p1: pt,
            p2: { time: pt.time + step * 18, price: pt.price },
            targetPrice: isLong ? pt.price + rewardDist : pt.price - rewardDist,
            stopPrice: isLong ? pt.price - riskDist : pt.price + riskDist,
          });
        }
        return;
      }

      // Freehand Brush / Highlighter
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
      isDrawingRef.current = true;
      tempShapeRef.current = {
        id: `d-${Date.now()}`,
        type: activeTool as DrawingObject['type'],
        color: drawColor,
        lineWidth: 1.8,
        p1: pt,
        p2: pt,
      };
      redrawOverlay();
    };

    const handleDrawMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isCursorTool(activeTool)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (activeTool === 'zoom_in' && isDrawingRef.current && zoomBoxRef.current) {
        zoomBoxRef.current.x2 = sx;
        zoomBoxRef.current.y2 = sy;
        redrawOverlay();
        return;
      }

      if (!tempShapeRef.current) return;
      const pt = screenToAnchor(sx, sy);
      if (!pt) return;

      if (tempShapeRef.current.type === 'path' && tempShapeRef.current.points) {
        tempShapeRef.current.points[tempShapeRef.current.points.length - 1] = pt;
        redrawOverlay();
        return;
      }

      if (THREE_POINT_TOOLS.includes(activeTool)) {
        if (drawStageRef.current === 1) {
          tempShapeRef.current.p2 = pt;
        } else if (drawStageRef.current === 2) {
          tempShapeRef.current.p3 = pt;
        }
        redrawOverlay();
        return;
      }

      if (!isDrawingRef.current) return;

      if (
        (tempShapeRef.current.type === 'brush' || tempShapeRef.current.type === 'highlighter') &&
        tempShapeRef.current.points
      ) {
        tempShapeRef.current.points.push(pt);
      } else {
        tempShapeRef.current.p2 = pt;
      }
      redrawOverlay();
    };

    // Complete 2-point / brush / zoom-box drags on mouseup
    useEffect(() => {
      const handleMouseUp = (e: MouseEvent) => {
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
            // Simple click zooms in by 25%
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

        if (!isDrawingRef.current || !tempShapeRef.current) return;
        const shape = tempShapeRef.current;

        if (shape.type === 'path') return; // finished via double-click / Enter

        // Transition 3-point tool from stage 1 -> stage 2 (waiting for 3rd point click)
        if (THREE_POINT_TOOLS.includes(shape.type as DrawingTool)) {
          if (drawStageRef.current === 1) {
            if (shape.p1 && shape.p2 && shape.p1.time === shape.p2.time && shape.p1.price === shape.p2.price) {
              // User clicked point 1 instead of dragging: keep waiting on stage 1? Better: move to stage 2 only when moved
              return;
            }
            drawStageRef.current = 2;
            setDrawingHint('Move mouse and click 3rd point to complete · Esc to cancel');
          }
          return;
        }

        // Callout opens text input at p2
        if (shape.type === 'callout' && shape.p1 && shape.p2) {
          isDrawingRef.current = false;
          const p1 = shape.p1;
          const p2 = shape.p2;
          tempShapeRef.current = null;
          const rect = drawCanvasRef.current?.getBoundingClientRect();
          const sx = rect ? e.clientX - rect.left : 200;
          const sy = rect ? e.clientY - rect.top : 140;
          setTextPrompt({ x: sx, y: sy, mode: 'callout', p1, p2, value: '' });
          redrawOverlay();
          return;
        }

        // Measure stays visible until click/tool switch or adds cleanly
        isDrawingRef.current = false;
        tempShapeRef.current = null;
        finalizeDrawing(shape);
      };

      const handleWindowMouseMove = (e: MouseEvent) => {
        if (!dragEditRef.current || !drawCanvasRef.current) return;
        const rect = drawCanvasRef.current.getBoundingClientRect();
        const pt = screenToAnchor(e.clientX - rect.left, e.clientY - rect.top, Boolean(dragEditRef.current.handleKey));
        if (!pt) return;

        const { drawingId, handleKey, startAnchor, origDrawing } = dragEditRef.current;
        const dt = pt.time - startAnchor.time;
        const dp = pt.price - startAnchor.price;

        onUpdateDrawing(drawingId, () => {
          const clone: DrawingObject = JSON.parse(JSON.stringify(origDrawing));
          if (handleKey === 'p1' && clone.p1) {
            clone.p1 = pt;
          } else if (handleKey === 'p2' && clone.p2) {
            clone.p2 = pt;
          } else if (handleKey === 'p3' && clone.p3) {
            clone.p3 = pt;
          } else if (handleKey === 'price') {
            clone.price = pt.price;
          } else if (handleKey === 'time') {
            clone.time = pt.time;
          } else if (handleKey === 'target') {
            clone.targetPrice = pt.price;
          } else if (handleKey === 'stop') {
            clone.stopPrice = pt.price;
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
      };

      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleWindowMouseMove);
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleWindowMouseMove);
      };
    }, [applyZoomRange, finalizeDrawing, onSelectTool, onUpdateDrawing, redrawOverlay, screenToAnchor]);

    // Capture-phase selection & dragging of existing drawings when in Cursor mode
    const handleWrapperMouseDownCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !isCursorTool(activeToolRef.current) || drawingsHiddenRef.current) return;
      // Ignore clicks on UI buttons/overlays inside wrapper
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
        onSelectDrawingId(hit.drawingId);
        setToolbarMenu('none');
        const orig = visible.find((d) => d.id === hit.drawingId);
        if (orig && !lockDrawingsRef.current && !orig.locked) {
          const startAnchor = screenToAnchor(sx, sy, false);
          if (startAnchor) {
            e.stopPropagation();
            e.preventDefault();
            dragEditRef.current = {
              drawingId: hit.drawingId,
              handleKey: hit.handleKey,
              startAnchor,
              origDrawing: JSON.parse(JSON.stringify(orig)),
            };
          }
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
        onOpenDrawingSettings(hit.drawingId, 'style');
      }
    };

    const handleWrapperMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isCursorTool(activeToolRef.current) || drawingsHiddenRef.current || dragEditRef.current) {
        if (hoverCursor) setHoverCursor('');
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-overlay="true"]')) {
        if (hoveredDrawingIdRef.current !== null) {
          hoveredDrawingIdRef.current = null;
          redrawOverlay();
        }
        if (hoverCursor) setHoverCursor('');
        return;
      }

      const bridge = buildCoordBridge();
      const canvas = drawCanvasRef.current;
      if (!bridge || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const visible = drawingsRef.current.filter((d) =>
        isDrawingVisibleOnTimeframe(d, intervalRef.current)
      );
      const hit = hitTestDrawings(
        visible,
        e.clientX - rect.left,
        e.clientY - rect.top,
        bridge,
        selectedIdRef.current
      );

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
      if (hoverCursor) setHoverCursor('');
      if (!plusMenuOpenRef.current) setCrosshairPlus(null);
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

    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-app)]">
        {/* Main Chart Wrapper */}
        <div
          ref={wrapperRef}
          onMouseDownCapture={handleWrapperMouseDownCapture}
          onDoubleClickCapture={handleWrapperDoubleClickCapture}
          onMouseMove={handleWrapperMouseMove}
          onMouseLeave={handleWrapperMouseLeave}
          style={
            hoverCursor
              ? { cursor: hoverCursor }
              : activeTool === 'dot'
              ? { cursor: 'cell' }
              : activeTool === 'arrow'
              ? { cursor: 'default' }
              : undefined
          }
          className="flex-1 relative min-h-[220px] overflow-hidden"
        >
          <canvas
            ref={cloudCanvasRef}
            className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
          />
          <div ref={chartContainerRef} className="absolute inset-0 w-full h-full z-[2]" />
          <canvas
            ref={drawCanvasRef}
            onMouseDown={handleDrawMouseDown}
            onMouseMove={handleDrawMouseMove}
            onDoubleClick={commitPathDrawing}
            className={`absolute inset-0 w-full h-full z-[3] ${
              !isCursorTool(activeTool)
                ? 'pointer-events-auto cursor-crosshair'
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

            {/* Collapsible TradingView Indicator Legend Stack (Screenshots 2 & 3) */}
            {(chartSettings.statusLine.indTitles || chartSettings.statusLine.indValues) && (() => {
              const baseCoin = symbol.replace(/USDT$|BUSD$|FDUSD$|USDC$/, '');
              const hasEma =
                indicators.emaFast.enabled ||
                indicators.emaSlow.enabled ||
                indicators.ema50.enabled ||
                indicators.ema200.enabled;
              const indRowsCount =
                (indicators.volume.enabled ? 1 : 0) +
                (hasEma ? 1 : 0) +
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
                      {indicators.volume.enabled && (
                        <div
                          style={bgStyle}
                          className="group/ind relative inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors"
                        >
                          {/* TradingView dark hover tooltip */}
                          <span className="pointer-events-none opacity-0 group-hover/ind:opacity-100 transition-opacity absolute -top-7 left-0 px-2 py-0.5 rounded bg-[#131722] text-white text-[11px] font-medium whitespace-nowrap shadow-md z-30">
                            Volume · {baseCoin}
                          </span>
                          {chartSettings.statusLine.indTitles && (
                            <span className="text-[var(--text-main)]">
                              Vol · {baseCoin}
                              {chartSettings.statusLine.indInputs && indicators.volume.showMa && (
                                <span className="text-[var(--text-muted)] ml-1">
                                  {indicators.volume.maPeriod}
                                </span>
                              )}
                            </span>
                          )}
                          {chartSettings.statusLine.indValues && (
                            <span className="font-mono-num text-[11.5px] inline-flex items-center gap-1.5 group-hover/ind:hidden">
                              {legendVol !== undefined && (
                                <span className="text-[#089981]">{fmtCompact(legendVol)}</span>
                              )}
                              {indicators.volume.showMa && indValues.volMa !== undefined && (
                                <span className="text-[#9c27b0]">{fmtCompact(indValues.volMa)}</span>
                              )}
                            </span>
                          )}
                          {/* Hover Action Controls (Exact Screenshot 5: Eye, Hex Gear, Trash, ...) */}
                          <span className="hidden group-hover/ind:inline-flex items-center gap-0.5 ml-0.5">
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    volume: { ...prev.volume, enabled: false },
                                  }))
                                }
                                title="Hide Volume"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="Indicator Settings"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <HexSettingsIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    volume: { ...prev.volume, enabled: false },
                                  }))
                                }
                                title="Remove Volume"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="More Indicator Options"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}

                      {/* EMA Bundle Indicator Row */}
                      {hasEma && (
                        <div
                          style={bgStyle}
                          className="group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors flex-wrap"
                        >
                          {chartSettings.statusLine.indTitles && (
                            <span className="text-[var(--text-main)]">
                              EMA
                              {chartSettings.statusLine.indInputs && (
                                <span className="text-[var(--text-muted)] ml-1">
                                  {[
                                    indicators.emaFast.enabled && `${indicators.emaFast.period} close`,
                                    indicators.emaSlow.enabled && `${indicators.emaSlow.period} close`,
                                    indicators.ema50.enabled && `${indicators.ema50.period} close`,
                                    indicators.ema200.enabled && `${indicators.ema200.period} close`,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                </span>
                              )}
                            </span>
                          )}
                          {chartSettings.statusLine.indValues && (
                            <span className="font-mono-num text-[11.5px] inline-flex items-center gap-2">
                              {indicators.emaFast.enabled && (
                                <span style={{ color: indicators.emaFast.color }}>
                                  {fmtPrice(indValues.emaFast)}
                                </span>
                              )}
                              {indicators.emaSlow.enabled && (
                                <span style={{ color: indicators.emaSlow.color }}>
                                  {fmtPrice(indValues.emaSlow)}
                                </span>
                              )}
                              {indicators.ema50.enabled && (
                                <span style={{ color: indicators.ema50.color }}>
                                  {fmtPrice(indValues.ema50)}
                                </span>
                              )}
                              {indicators.ema200.enabled && (
                                <span style={{ color: indicators.ema200.color }}>
                                  {fmtPrice(indValues.ema200)}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="hidden group-hover/ind:inline-flex items-center gap-0.5 ml-1 pl-1 border-l border-[var(--border)]/70">
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    emaFast: { ...prev.emaFast, enabled: false },
                                    emaSlow: { ...prev.emaSlow, enabled: false },
                                    ema50: { ...prev.ema50, enabled: false },
                                    ema200: { ...prev.ema200, enabled: false },
                                  }))
                                }
                                title="Hide EMAs"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="EMA Settings"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <HexSettingsIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onUpdateIndicators && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateIndicators((prev) => ({
                                    ...prev,
                                    emaFast: { ...prev.emaFast, enabled: false },
                                    emaSlow: { ...prev.emaSlow, enabled: false },
                                    ema50: { ...prev.ema50, enabled: false },
                                    ema200: { ...prev.ema200, enabled: false },
                                  }))
                                }
                                title="Remove EMAs"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            {onOpenIndicators && (
                              <button
                                type="button"
                                onClick={onOpenIndicators}
                                title="More Options"
                                className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.7} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Bollinger Bands Row */}
                      {indicators.bb.enabled && (
                        <div
                          style={bgStyle}
                          className="group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors"
                        >
                          <span style={{ color: indicators.bb.color }}>
                            BB
                            {chartSettings.statusLine.indInputs &&
                              ` ${indicators.bb.period} close ${indicators.bb.stdDev}`}
                          </span>
                          <span className="hidden group-hover/ind:inline-flex items-center gap-0.5 ml-1 pl-1 border-l border-[var(--border)]/70">
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
                                    bb: { ...prev.bb, enabled: false },
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
                          className="group/ind inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)] text-[12px] transition-colors"
                        >
                          <span style={{ color: indicators.rsi.color }}>
                            RSI
                            {chartSettings.statusLine.indInputs && ` ${indicators.rsi.period}`}
                          </span>
                          {chartSettings.statusLine.indValues && indValues.rsi !== undefined && (
                            <span className="font-mono-num text-[11.5px]" style={{ color: indicators.rsi.color }}>
                              {indValues.rsi.toFixed(2)}
                            </span>
                          )}
                          <span className="hidden group-hover/ind:inline-flex items-center gap-0.5 ml-1 pl-1 border-l border-[var(--border)]/70">
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
                                    rsi: { ...prev.rsi, enabled: false },
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

                      {/* Collapse [^] Square Button (Screenshot 2) */}
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

          {/* Floating Favorite Tools Bar (TradingView Style) */}
          {favoriteTools.length > 0 && (
            <div
              data-ui-overlay="true"
              className="absolute bottom-9 left-3 z-10 bg-[var(--bg-surface)]/95 border border-[var(--border)] rounded-md shadow-md px-1.5 py-1 flex items-center gap-0.5"
            >
              <Star className="w-3 h-3 text-[var(--amber)] fill-current mx-1 shrink-0" />
              {favoriteTools.map((tid) => {
                const def = ALL_TOOLS_MAP[tid];
                if (!def) return null;
                const active = activeTool === tid;
                return (
                  <button
                    key={tid}
                    onClick={() => onSelectTool(tid)}
                    title={`${def.label}${def.shortcut ? ` (${def.shortcut})` : ''}`}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {def.renderIcon('w-4 h-4')}
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

                <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

                {/* 7. Settings Modal Button */}
                <button
                  type="button"
                  onClick={() => {
                    setToolbarMenu('none');
                    onOpenDrawingSettings(selectedDrawing.id, 'style');
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

          {/* Candle Close Countdown Tag (Flush below live price badge) */}
          {countdownTop !== null &&
            countdownStr &&
            !isReplayMode &&
            chartSettings.scales.countdownToBarClose && (
              <div
                className={`absolute ${
                  chartSettings.scales.scalesPlacement === 'left' ? 'left-0' : 'right-0'
                } z-10 bg-[#2962ff] text-white text-[10px] font-mono-num font-semibold px-1.5 py-[1px] rounded-b-[2px] pointer-events-none leading-tight text-center`}
                style={{
                  top: `${countdownTop - 2}px`,
                  minWidth: `${Math.max(54, rightScaleWidth - 2)}px`,
                }}
              >
                {countdownStr}
              </div>
            )}

          {/* Price-Scale Crosshair (+) Quick Action Button (Screenshot 5) */}
          {chartSettings.scales.plusButton && crosshairPlus && crosshairPlus.y > 14 && (
            <div
              ref={plusMenuRef}
              data-ui-overlay="true"
              style={{
                top: `${crosshairPlus.y - 11}px`,
                ...(chartSettings.scales.scalesPlacement === 'right'
                  ? { right: `${rightScaleWidth + 1}px` }
                  : { left: `${rightScaleWidth + 1}px` }),
              }}
              className="absolute z-20"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlusMenuOpen((v) => !v);
                }}
                title={`Quick actions at ${fmtPrice(crosshairPlus.price)}`}
                className="w-[24px] h-[22px] rounded-xs bg-[#131722] dark:bg-[#2a2e39] hover:bg-[var(--accent)] text-white inline-flex items-center justify-center shadow-sm cursor-pointer transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" strokeWidth={2} />
              </button>

              {plusMenuOpen && (
                <div
                  className={`absolute ${
                    chartSettings.scales.scalesPlacement === 'right' ? 'right-7' : 'left-7'
                  } top-0 w-[235px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 text-xs text-[var(--text-main)] z-30`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAlertAtPrice?.(crosshairPlus.price);
                      setPlusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span>Add alert on {symbol}</span>
                    <span className="font-mono-num text-[var(--text-muted)]">
                      {fmtPrice(crosshairPlus.price)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddDrawing({
                        id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        type: 'hline',
                        color: drawColor,
                        price: crosshairPlus.price,
                        lineWidth: 2,
                        lineStyle: 'solid',
                        visibility: DEFAULT_VISIBILITY,
                      });
                      setPlusMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span>Draw Horizontal Line</span>
                    <span className="font-mono-num text-[var(--text-muted)]">
                      {fmtPrice(crosshairPlus.price)}
                    </span>
                  </button>
                  {onQuickLimitOrder && (
                    <>
                      <div className="h-px bg-[var(--border)] my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          onQuickLimitOrder('BUY', crosshairPlus.price);
                          setPlusMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 text-[#089981] font-medium cursor-pointer"
                      >
                        <span>Buy Limit {symbol}</span>
                        <span className="font-mono-num">{fmtPrice(crosshairPlus.price)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onQuickLimitOrder('SELL', crosshairPlus.price);
                          setPlusMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 text-[#f23645] font-medium cursor-pointer"
                      >
                        <span>Sell Limit {symbol}</span>
                        <span className="font-mono-num">{fmtPrice(crosshairPlus.price)}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

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
