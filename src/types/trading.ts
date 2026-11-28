export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export type ChartType = 'candles' | 'hollow' | 'heikin' | 'line' | 'area';

export type ScaleMode = 'auto' | 'regular' | 'pct' | 'indexed100' | 'log';

export type MagnetMode = 'off' | 'weak' | 'strong';

export type DrawingLineStyle = 'solid' | 'dashed' | 'dotted';

export type LineExtendMode = 'none' | 'left' | 'right' | 'both';

export type LineEndCap = 'normal' | 'arrow';

export type StatsDisplayMode = 'hidden' | 'price' | 'percent' | 'bars' | 'all';

export type StatsPosition = 'left' | 'center' | 'right';

export type TextAlignV = 'top' | 'middle' | 'bottom';

export type TextAlignH = 'left' | 'center' | 'right';

export type DrawingTool =
  // Cursors
  | 'cursor'
  | 'dot'
  | 'arrow'
  // Lines
  | 'trendline'
  | 'ray'
  | 'infoline'
  | 'extended'
  | 'angle'
  | 'hline'
  | 'hray'
  | 'vline'
  | 'crossline'
  // Channels & Pitchforks
  | 'channel'
  | 'flat_channel'
  | 'disjoint_channel'
  | 'pitchfork'
  // Fib
  | 'fib'
  | 'fib_ext'
  // Position & Ranges
  | 'long_pos'
  | 'short_pos'
  | 'price_range'
  | 'date_range'
  // Brushes & Shapes
  | 'brush'
  | 'highlighter'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'arrow_line'
  | 'path'
  // Annotations
  | 'text'
  | 'callout'
  | 'price_label'
  // Utilities
  | 'measure'
  | 'zoom_in';

export type RightPanelTab = 'watchlist' | 'orderbook' | 'alerts';

export interface CandleBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeBar {
  time: number;
  value: number;
  color: string;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface WatchlistItem {
  sym: string;
  name: string;
  color: string;
  letter: string;
  flagColor?: string; // '#f23645' | '#2962ff' | '#089981' | '#f59e0b' | '#9c27b0' | ''
  isSection?: boolean;
  collapsed?: boolean;
}

export interface WatchlistCollection {
  id: string;
  name: string;
  color: string;
  shared?: boolean;
  items: WatchlistItem[];
}

export type WatchlistGroupBy =
  | 'none'
  | 'sections'
  | 'currency'
  | 'type'
  | 'sector'
  | 'exchange';

export interface WatchlistViewPrefs {
  tableView: boolean;
  groupBy: WatchlistGroupBy;
  columns: {
    last: boolean;
    chg: boolean;
    chgPct: boolean;
    volume: boolean;
    extHours: boolean;
  };
  showLogo: boolean;
  symbolDisplay: 'symbol' | 'name';
}

export interface TickerData {
  symbol: string;
  last: number;
  chg: number;
  pct: number;
  high: number;
  low: number;
  vol: number;
  baseVol?: number;
  prevLast?: number;
}

export type PriceSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export type IndicatorPrecision =
  | 'default'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8';

export type IndicatorSettingsTarget = 'volume' | 'smaEma';

export interface MaLineConfig {
  enabled: boolean;
  period: number;
  source: PriceSource;
  color: string;
  lineWidth: number;
  lineStyle: DrawingLineStyle;
}

export interface SmaEmaBundleConfig {
  enabled: boolean;
  hidden: boolean;
  sma1: MaLineConfig;
  sma2: MaLineConfig;
  sma3: MaLineConfig;
  ema1: MaLineConfig;
  ema2: MaLineConfig;
  ema3: MaLineConfig;
  plotsBackground: boolean;
  bgColor0: string;
  bgColor1: string;
  precision: IndicatorPrecision;
  labelsOnPriceScale: boolean;
  valuesInStatusLine: boolean;
  inputsInStatusLine: boolean;
  visibility: DrawingVisibility;
}

export interface VolumeIndicatorConfig {
  enabled: boolean;
  hidden: boolean;
  showVolume: boolean;
  maPeriod: number;
  colorBasedOnPrevClose: boolean;
  growingColor: string;
  fallingColor: string;
  showMa: boolean;
  maColor: string;
  maLineWidth: number;
  maLineStyle: DrawingLineStyle;
  precision: IndicatorPrecision;
  labelsOnPriceScale: boolean;
  valuesInStatusLine: boolean;
  inputsInStatusLine: boolean;
  visibility: DrawingVisibility;
}

export interface IndicatorConfig {
  smaEma: SmaEmaBundleConfig;
  bb: { enabled: boolean; hidden?: boolean; period: number; stdDev: number; color: string };
  volume: VolumeIndicatorConfig;
  rsi: { enabled: boolean; hidden?: boolean; period: number; color: string };
}

export interface AnchorPoint {
  time: number; // unix seconds
  price: number;
}

export interface VisibilityRange {
  enabled: boolean;
  min: number;
  max: number;
}

export interface DrawingVisibility {
  ticks: boolean;
  seconds: VisibilityRange;
  minutes: VisibilityRange;
  hours: VisibilityRange;
  days: VisibilityRange;
  weeks: VisibilityRange;
  months: VisibilityRange;
  ranges: boolean;
}

export interface DrawingObject {
  id: string;
  type: Exclude<DrawingTool, 'cursor' | 'dot' | 'arrow' | 'zoom_in'>;
  title?: string;
  color: string;
  lineWidth: number;
  lineStyle?: DrawingLineStyle;
  locked?: boolean;
  hidden?: boolean;
  zOrder?: 'front' | 'back';
  // Style options
  extend?: LineExtendMode;
  leftEnd?: LineEndCap;
  rightEnd?: LineEndCap;
  showMiddlePoint?: boolean;
  showPriceLabels?: boolean;
  statsMode?: StatsDisplayMode;
  statsPosition?: StatsPosition;
  alwaysShowStats?: boolean;
  fillOpacity?: number;
  // Text options (supported on lines, channels, shapes, text, callout)
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  textAlignV?: TextAlignV;
  textAlignH?: TextAlignH;
  // Coordinates
  price?: number; // hline
  time?: number; // vline
  p1?: AnchorPoint;
  p2?: AnchorPoint;
  p3?: AnchorPoint; // 3-point tools
  points?: AnchorPoint[]; // brush, highlighter, path
  stopPrice?: number; // long_pos, short_pos
  targetPrice?: number; // long_pos, short_pos
  // Timeframe visibility
  visibility?: DrawingVisibility;
}

export interface DrawingTemplate {
  id: string;
  name: string;
  color: string;
  lineWidth: number;
  lineStyle: DrawingLineStyle;
  extend: LineExtendMode;
  leftEnd: LineEndCap;
  rightEnd: LineEndCap;
  showMiddlePoint: boolean;
  showPriceLabels: boolean;
  statsMode: StatsDisplayMode;
  statsPosition: StatsPosition;
  alwaysShowStats: boolean;
  textColor: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  textAlignV: TextAlignV;
  textAlignH: TextAlignH;
}

export interface SavedZoomState {
  visibleBars: number;
  rightOffset: number;
  toTime?: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  condition: 'above' | 'below' | 'crossing';
  note: string;
  active: boolean;
  triggeredAt?: number;
  createdAt: number;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  openedAt: number;
}

export interface PaperLimitOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  limitPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  createdAt: number;
}

export interface PaperTradeHistory {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: 'Manual' | 'Take Profit' | 'Stop Loss';
  closedAt: number;
}

export interface PaperAccountState {
  balance: number;
  realizedPnl: number;
  positions: PaperPosition[];
  limitOrders: PaperLimitOrder[];
  history: PaperTradeHistory[];
}

export interface OrderBookLevel {
  price: number;
  qty: number;
  total: number;
}

export interface MarketTrade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export type ChartSettingsTab =
  | 'symbol'
  | 'status_line'
  | 'scales'
  | 'canvas'
  | 'trading'
  | 'alerts'
  | 'events';

export interface ChartSettings {
  symbol: {
    colorBasedOnPrevClose: boolean;
    bodyEnabled: boolean;
    upColor: string;
    downColor: string;
    bordersEnabled: boolean;
    borderUpColor: string;
    borderDownColor: string;
    wickEnabled: boolean;
    wickUpColor: string;
    wickDownColor: string;
    precision: 'default' | '1' | '2' | '3' | '4' | '5' | '6';
    timezone: string; // 'local' | 'UTC' | 'Asia/Yangon' | 'Asia/Bangkok' | 'Asia/Singapore' | 'Asia/Tokyo' | 'America/New_York' | 'Europe/London'
  };
  statusLine: {
    logo: boolean;
    title: boolean;
    titleMode: 'name' | 'ticker' | 'description';
    openMarketStatus: boolean;
    ohlcValues: boolean;
    barChangeValues: boolean;
    volume: boolean;
    lastDayChangeValues: boolean;
    buySellButtons: boolean;
    indTitles: boolean;
    indInputs: boolean;
    indValues: boolean;
    indBackground: boolean;
    indBackgroundOpacity: number; // 0..100
  };
  scales: {
    autoScale: boolean;
    lockPriceToBarRatio: boolean;
    invertScale: boolean;
    scalesPlacement: 'right' | 'left';
    noOverlappingLabels: boolean;
    plusButton: boolean;
    countdownToBarClose: boolean;
    symbolLabel: 'value_line' | 'value' | 'hidden';
    indicatorsLabel: 'value' | 'hidden';
    highLowLines: 'hidden' | 'value_line' | 'value';
    highLowColor: string;
    bidAskLines: 'hidden' | 'value_line';
    bidColor: string;
    askColor: string;
    dayOfWeekOnLabels: boolean;
    dateFormat: 'short' | 'iso' | 'dmy' | 'mdy';
    timeHoursFormat: '24' | '12';
  };
  canvas: {
    backgroundType: 'solid' | 'gradient';
    backgroundColor: string; // '' means theme default
    backgroundColor2: string;
    vertGridEnabled: boolean;
    vertGridColor: string; // '' means theme default
    horzGridEnabled: boolean;
    horzGridColor: string; // '' means theme default
    crosshairColor: string;
    crosshairStyle: DrawingLineStyle;
    watermarkMode: 'off' | 'symbol' | 'replay';
    watermarkColor: string;
    scaleTextColor: string; // '' means theme default
    scaleFontSize: number;
    scaleLineColor: string; // '' means theme default
    marginTop: number; // %
    marginBottom: number; // %
    marginRightBars: number;
  };
  trading: {
    buySellButtons: boolean;
    oneClickTrading: boolean;
    executionSound: boolean;
    executionSoundVolume: number; // 0..100
    onlyRejectionNotifications: boolean;
    positionsAndOrders: boolean;
    reversePositionButton: boolean;
    pnlValueEnabled: boolean;
    pnlPositionMode: 'money' | 'percent';
    pnlBracketMode: 'money' | 'percent';
    executionMarks: boolean;
    executionLabels: boolean;
    extendedPriceLines: boolean;
  };
  alerts: {
    alertLines: boolean;
    alertLineColor: string;
    onlyActiveAlerts: boolean;
    alertVolumeEnabled: boolean;
    alertVolume: number; // 0..100
    autoHideToasts: boolean;
  };
  events: {
    ideas: boolean;
    ideasFilter: 'all' | 'mine';
    economicEvents: boolean;
    onlyFutureEvents: boolean;
    sessionBreaks: boolean;
    sessionBreaksColor: string;
    latestNews: boolean;
    newsNotification: boolean;
  };
}

export interface ChartSettingsTemplate {
  id: string;
  name: string;
  settings: ChartSettings;
}

