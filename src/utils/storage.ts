import {
  ChartSettings,
  ChartSettingsTemplate,
  DrawingObject,
  DrawingTemplate,
  DrawingTool,
  DrawingVisibility,
  IndicatorConfig,
  MagnetMode,
  PaperAccountState,
  PriceAlert,
  SavedZoomState,
  Timeframe,
  WatchlistCollection,
  WatchlistItem,
  WatchlistViewPrefs,
} from '../types/trading';
import { DEFAULT_WATCHLIST } from './binance';

const KEYS = {
  THEME: 'tp_theme_v1',
  WATCHLIST: 'tp_watchlist_v1',
  WATCHLIST_COLLECTIONS: 'tp_watchlists_v2',
  WATCHLIST_ACTIVE_ID: 'tp_watchlist_active_v2',
  WATCHLIST_PREFS: 'tp_watchlist_prefs_v1',
  SYMBOL_NOTES: 'tp_symbol_notes_v1',
  INDICATORS: 'tp_indicators_v1',
  DRAWINGS: 'tp_drawings_v1',
  ALERTS: 'tp_alerts_v1',
  PAPER: 'tp_paper_account_v1',
  ZOOM: 'tp_chart_zoom_v1',
  FAVORITE_TOOLS: 'tp_fav_tools_v1',
  TOOL_PREFS: 'tp_tool_prefs_v1',
  TEMPLATES: 'tp_drawing_templates_v1',
  CHART_SETTINGS: 'tp_chart_settings_v2',
  CHART_TEMPLATES: 'tp_chart_templates_v1',
};

export const DEFAULT_INDICATORS: IndicatorConfig = {
  emaFast: { enabled: true, period: 9, color: '#f23645' },
  emaSlow: { enabled: true, period: 21, color: '#2962ff' },
  emaCloud: { enabled: true },
  ema50: { enabled: false, period: 50, color: '#f59e0b' },
  ema200: { enabled: false, period: 200, color: '#8b5cf6' },
  bb: { enabled: false, period: 20, stdDev: 2, color: '#06b6d4' },
  volume: { enabled: true, maPeriod: 20, showMa: true },
  rsi: { enabled: false, period: 14, color: '#9c27b0' },
};

export const DEFAULT_PAPER_ACCOUNT: PaperAccountState = {
  balance: 100000,
  realizedPnl: 0,
  positions: [],
  limitOrders: [],
  history: [],
};

export const DEFAULT_ZOOM: SavedZoomState = {
  visibleBars: 110,
  rightOffset: 10,
};

export const DEFAULT_VISIBILITY: DrawingVisibility = {
  ticks: true,
  seconds: { enabled: true, min: 1, max: 59 },
  minutes: { enabled: true, min: 1, max: 59 },
  hours: { enabled: true, min: 1, max: 24 },
  days: { enabled: true, min: 1, max: 366 },
  weeks: { enabled: true, min: 1, max: 52 },
  months: { enabled: true, min: 1, max: 12 },
  ranges: true,
};

export function isDrawingVisibleOnTimeframe(d: DrawingObject, tf: Timeframe): boolean {
  if (d.hidden) return false;
  const v = d.visibility;
  if (!v) return true;

  if (tf === '1m') return v.minutes.enabled && 1 >= v.minutes.min && 1 <= v.minutes.max;
  if (tf === '5m') return v.minutes.enabled && 5 >= v.minutes.min && 5 <= v.minutes.max;
  if (tf === '15m') return v.minutes.enabled && 15 >= v.minutes.min && 15 <= v.minutes.max;
  if (tf === '30m') return v.minutes.enabled && 30 >= v.minutes.min && 30 <= v.minutes.max;
  if (tf === '1h') return v.hours.enabled && 1 >= v.hours.min && 1 <= v.hours.max;
  if (tf === '4h') return v.hours.enabled && 4 >= v.hours.min && 4 <= v.hours.max;
  if (tf === '1d') return v.days.enabled && 1 >= v.days.min && 1 <= v.days.max;
  if (tf === '1w') return v.weeks.enabled && 1 >= v.weeks.min && 1 <= v.weeks.max;
  return true;
}

export interface ToolPrefs {
  magnetMode: MagnetMode;
  stayInDrawingMode: boolean;
  lockDrawings: boolean;
}

const DEFAULT_TOOL_PREFS: ToolPrefs = {
  magnetMode: 'weak',
  stayInDrawingMode: false,
  lockDrawings: false,
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadTheme(): boolean {
  try {
    return localStorage.getItem(KEYS.THEME) === 'dark';
  } catch {
    return false;
  }
}

export function saveTheme(isDark: boolean): void {
  try {
    localStorage.setItem(KEYS.THEME, isDark ? 'dark' : 'light');
  } catch {}
}

export function loadWatchlist(): WatchlistItem[] {
  const list = safeRead<WatchlistItem[]>(KEYS.WATCHLIST, DEFAULT_WATCHLIST);
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_WATCHLIST;
}

export function saveWatchlist(list: WatchlistItem[]): void {
  safeWrite(KEYS.WATCHLIST, list);
}

export const DEFAULT_WATCHLIST_PREFS: WatchlistViewPrefs = {
  tableView: false,
  groupBy: 'sections',
  columns: {
    last: true,
    chg: true,
    chgPct: true,
    volume: false,
    extHours: false,
  },
  showLogo: true,
  symbolDisplay: 'symbol',
};

export function loadWatchlistCollections(): WatchlistCollection[] {
  const stored = safeRead<WatchlistCollection[] | null>(KEYS.WATCHLIST_COLLECTIONS, null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  const legacyItems = loadWatchlist().map((item) => ({
    ...item,
    flagColor: item.flagColor !== undefined ? item.flagColor : '#f23645',
  }));
  return [
    {
      id: 'main',
      name: 'Main',
      color: '#f23645',
      shared: false,
      items: legacyItems,
    },
  ];
}

export function saveWatchlistCollections(lists: WatchlistCollection[]): void {
  safeWrite(KEYS.WATCHLIST_COLLECTIONS, lists);
}

export function loadActiveWatchlistId(): string {
  try {
    return localStorage.getItem(KEYS.WATCHLIST_ACTIVE_ID) || 'main';
  } catch {
    return 'main';
  }
}

export function saveActiveWatchlistId(id: string): void {
  try {
    localStorage.setItem(KEYS.WATCHLIST_ACTIVE_ID, id);
  } catch {}
}

export function loadWatchlistPrefs(): WatchlistViewPrefs {
  const stored = safeRead<Partial<WatchlistViewPrefs>>(KEYS.WATCHLIST_PREFS, {});
  return {
    tableView: Boolean(stored.tableView),
    groupBy: stored.groupBy || DEFAULT_WATCHLIST_PREFS.groupBy,
    columns: { ...DEFAULT_WATCHLIST_PREFS.columns, ...stored.columns },
    showLogo: stored.showLogo !== undefined ? stored.showLogo : true,
    symbolDisplay: stored.symbolDisplay || 'symbol',
  };
}

export function saveWatchlistPrefs(prefs: WatchlistViewPrefs): void {
  safeWrite(KEYS.WATCHLIST_PREFS, prefs);
}

export function loadSymbolNotes(): Record<string, string> {
  return safeRead<Record<string, string>>(KEYS.SYMBOL_NOTES, {});
}

export function saveSymbolNotes(notes: Record<string, string>): void {
  safeWrite(KEYS.SYMBOL_NOTES, notes);
}

export function loadIndicators(): IndicatorConfig {
  const stored = safeRead<Partial<IndicatorConfig>>(KEYS.INDICATORS, {});
  return {
    emaFast: { ...DEFAULT_INDICATORS.emaFast, ...stored.emaFast },
    emaSlow: { ...DEFAULT_INDICATORS.emaSlow, ...stored.emaSlow },
    emaCloud: { ...DEFAULT_INDICATORS.emaCloud, ...stored.emaCloud },
    ema50: { ...DEFAULT_INDICATORS.ema50, ...stored.ema50 },
    ema200: { ...DEFAULT_INDICATORS.ema200, ...stored.ema200 },
    bb: { ...DEFAULT_INDICATORS.bb, ...stored.bb },
    volume: { ...DEFAULT_INDICATORS.volume, ...stored.volume },
    rsi: { ...DEFAULT_INDICATORS.rsi, ...stored.rsi },
  };
}

export function saveIndicators(cfg: IndicatorConfig): void {
  safeWrite(KEYS.INDICATORS, cfg);
}

export function loadAllDrawings(): Record<string, DrawingObject[]> {
  return safeRead<Record<string, DrawingObject[]>>(KEYS.DRAWINGS, {});
}

export function saveAllDrawings(map: Record<string, DrawingObject[]>): void {
  safeWrite(KEYS.DRAWINGS, map);
}

export function loadAlerts(): PriceAlert[] {
  return safeRead<PriceAlert[]>(KEYS.ALERTS, []);
}

export function saveAlerts(alerts: PriceAlert[]): void {
  safeWrite(KEYS.ALERTS, alerts);
}

export function loadPaperAccount(): PaperAccountState {
  const stored = safeRead<Partial<PaperAccountState>>(KEYS.PAPER, {});
  return {
    balance: typeof stored.balance === 'number' ? stored.balance : DEFAULT_PAPER_ACCOUNT.balance,
    realizedPnl: typeof stored.realizedPnl === 'number' ? stored.realizedPnl : 0,
    positions: Array.isArray(stored.positions) ? stored.positions : [],
    limitOrders: Array.isArray(stored.limitOrders) ? stored.limitOrders : [],
    history: Array.isArray(stored.history) ? stored.history : [],
  };
}

export function savePaperAccount(state: PaperAccountState): void {
  safeWrite(KEYS.PAPER, state);
}

export function loadSavedZoom(): SavedZoomState {
  const stored = safeRead<Partial<SavedZoomState>>(KEYS.ZOOM, DEFAULT_ZOOM);
  const visibleBars =
    typeof stored.visibleBars === 'number' && stored.visibleBars >= 10 && stored.visibleBars <= 1500
      ? stored.visibleBars
      : DEFAULT_ZOOM.visibleBars;
  const rightOffset =
    typeof stored.rightOffset === 'number' && stored.rightOffset >= -50 && stored.rightOffset <= 120
      ? stored.rightOffset
      : DEFAULT_ZOOM.rightOffset;
  return { visibleBars, rightOffset };
}

export function saveZoomState(zoom: SavedZoomState): void {
  safeWrite(KEYS.ZOOM, zoom);
}

export function loadFavoriteTools(): DrawingTool[] {
  const list = safeRead<DrawingTool[]>(KEYS.FAVORITE_TOOLS, ['trendline', 'hline', 'fib', 'rect']);
  return Array.isArray(list) ? list : ['trendline', 'hline', 'fib', 'rect'];
}

export function saveFavoriteTools(tools: DrawingTool[]): void {
  safeWrite(KEYS.FAVORITE_TOOLS, tools);
}

export function loadToolPrefs(): ToolPrefs {
  const stored = safeRead<Partial<ToolPrefs>>(KEYS.TOOL_PREFS, DEFAULT_TOOL_PREFS);
  return {
    magnetMode: stored.magnetMode || DEFAULT_TOOL_PREFS.magnetMode,
    stayInDrawingMode: Boolean(stored.stayInDrawingMode),
    lockDrawings: Boolean(stored.lockDrawings),
  };
}

export function saveToolPrefs(prefs: ToolPrefs): void {
  safeWrite(KEYS.TOOL_PREFS, prefs);
}

export function loadDrawingTemplates(): DrawingTemplate[] {
  return safeRead<DrawingTemplate[]>(KEYS.TEMPLATES, []);
}

export function saveDrawingTemplates(list: DrawingTemplate[]): void {
  safeWrite(KEYS.TEMPLATES, list);
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  symbol: {
    colorBasedOnPrevClose: false,
    bodyEnabled: true,
    upColor: '#2962ff',
    downColor: '#f23645',
    bordersEnabled: true,
    borderUpColor: '#131722',
    borderDownColor: '#131722',
    wickEnabled: true,
    wickUpColor: '#131722',
    wickDownColor: '#131722',
    precision: 'default',
    timezone: 'local',
  },
  statusLine: {
    logo: true,
    title: true,
    titleMode: 'name',
    openMarketStatus: true,
    ohlcValues: true,
    barChangeValues: true,
    volume: false,
    lastDayChangeValues: false,
    buySellButtons: false,
    indTitles: true,
    indInputs: true,
    indValues: true,
    indBackground: true,
    indBackgroundOpacity: 80,
  },
  scales: {
    autoScale: true,
    lockPriceToBarRatio: false,
    invertScale: false,
    scalesPlacement: 'right',
    noOverlappingLabels: true,
    plusButton: true,
    countdownToBarClose: true,
    symbolLabel: 'value_line',
    indicatorsLabel: 'value',
    highLowLines: 'hidden',
    highLowColor: '#089981',
    bidAskLines: 'hidden',
    bidColor: '#2962ff',
    askColor: '#f23645',
    dayOfWeekOnLabels: true,
    dateFormat: 'short',
    timeHoursFormat: '24',
  },
  canvas: {
    backgroundType: 'solid',
    backgroundColor: '',
    backgroundColor2: '#f0f3fa',
    vertGridEnabled: false,
    vertGridColor: '',
    horzGridEnabled: false,
    horzGridColor: '',
    crosshairColor: '#9598a1',
    crosshairStyle: 'dashed',
    watermarkMode: 'replay',
    watermarkColor: 'rgba(120, 123, 134, 0.14)',
    scaleTextColor: '',
    scaleFontSize: 12,
    scaleLineColor: '',
    marginTop: 8,
    marginBottom: 20,
    marginRightBars: 10,
  },
  trading: {
    buySellButtons: false,
    oneClickTrading: false,
    executionSound: true,
    executionSoundVolume: 65,
    onlyRejectionNotifications: false,
    positionsAndOrders: true,
    reversePositionButton: true,
    pnlValueEnabled: true,
    pnlPositionMode: 'money',
    pnlBracketMode: 'money',
    executionMarks: true,
    executionLabels: false,
    extendedPriceLines: true,
  },
  alerts: {
    alertLines: true,
    alertLineColor: '#f59e0b',
    onlyActiveAlerts: true,
    alertVolumeEnabled: true,
    alertVolume: 70,
    autoHideToasts: true,
  },
  events: {
    ideas: false,
    ideasFilter: 'all',
    economicEvents: true,
    onlyFutureEvents: true,
    sessionBreaks: false,
    sessionBreaksColor: '#787b86',
    latestNews: false,
    newsNotification: false,
  },
};

export function loadChartSettings(): ChartSettings {
  const stored = safeRead<Partial<ChartSettings>>(KEYS.CHART_SETTINGS, {});
  return {
    symbol: { ...DEFAULT_CHART_SETTINGS.symbol, ...stored.symbol },
    statusLine: { ...DEFAULT_CHART_SETTINGS.statusLine, ...stored.statusLine },
    scales: { ...DEFAULT_CHART_SETTINGS.scales, ...stored.scales },
    canvas: { ...DEFAULT_CHART_SETTINGS.canvas, ...stored.canvas },
    trading: { ...DEFAULT_CHART_SETTINGS.trading, ...stored.trading },
    alerts: { ...DEFAULT_CHART_SETTINGS.alerts, ...stored.alerts },
    events: { ...DEFAULT_CHART_SETTINGS.events, ...stored.events },
  };
}

export function saveChartSettings(settings: ChartSettings): void {
  safeWrite(KEYS.CHART_SETTINGS, settings);
}

export function loadChartTemplates(): ChartSettingsTemplate[] {
  return safeRead<ChartSettingsTemplate[]>(KEYS.CHART_TEMPLATES, []);
}

export function saveChartTemplates(list: ChartSettingsTemplate[]): void {
  safeWrite(KEYS.CHART_TEMPLATES, list);
}

