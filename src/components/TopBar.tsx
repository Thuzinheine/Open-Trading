import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  LineChart,
  AreaChart,
  Undo2,
  Redo2,
  Camera,
  Moon,
  Sun,
  ChevronDown,
  BarChart2,
  Check,
  Download,
  Copy,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { ChartType, Timeframe, WatchlistItem } from '../types/trading';

export type SnapshotAction = 'download' | 'copy' | 'copy_link' | 'open_tab' | 'post_x';
import {
  AlertClockSparkleIcon,
  CornerFullscreenIcon,
  HexSettingsIcon,
  HollowCandlesIcon,
  IndicatorsChartIcon,
  LayoutPaneIcon,
  ReplayChevronsIcon,
  TwoCandlesPillIcon,
} from './TradingViewIcons';

interface TopBarProps {
  currentSymbol: string;
  symbolMeta: WatchlistItem;
  interval: Timeframe;
  onIntervalChange: (tf: Timeframe) => void;
  onPrefetchInterval?: (tf: Timeframe) => void;
  chartType: ChartType;
  onChartTypeChange: (ct: ChartType) => void;
  activeIndicatorCount: number;
  onOpenIndicators: () => void;
  onOpenSearch: () => void;
  onOpenAlertModal: () => void;
  isReplayMode: boolean;
  onToggleReplay: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  barCount: number;
  onSnapshot: (action: SnapshotAction) => void;
  onOpenSettings: () => void;
  onToggleRightPanel?: () => void;
  onSaveWorkspace?: () => void;
  isTradeOpen: boolean;
  openPositionsCount: number;
  onToggleTrade: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const QUICK_TFS: { value: Timeframe; label: string }[] = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: 'D' },
  { value: '1w', label: 'W' },
];

const ALL_TFS: { value: Timeframe; label: string; desc: string }[] = [
  { value: '1m', label: '1m', desc: '1 Minute' },
  { value: '5m', label: '5m', desc: '5 Minutes' },
  { value: '15m', label: '15m', desc: '15 Minutes' },
  { value: '30m', label: '30m', desc: '30 Minutes' },
  { value: '1h', label: '1h', desc: '1 Hour' },
  { value: '4h', label: '4h', desc: '4 Hours' },
  { value: '1d', label: '1D', desc: '1 Day' },
  { value: '1w', label: '1W', desc: '1 Week' },
];

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'candles', label: 'Candles', icon: <HollowCandlesIcon className="w-[19px] h-[19px]" /> },
  { value: 'hollow', label: 'Hollow Candles', icon: <BarChart2 className="w-[17px] h-[17px]" strokeWidth={1.5} /> },
  { value: 'heikin', label: 'Heikin Ashi', icon: <HollowCandlesIcon className="w-[19px] h-[19px]" /> },
  { value: 'area', label: 'Area', icon: <AreaChart className="w-[17px] h-[17px]" strokeWidth={1.5} /> },
  { value: 'line', label: 'Line', icon: <LineChart className="w-[17px] h-[17px]" strokeWidth={1.5} /> },
];

export const TopBar: React.FC<TopBarProps> = ({
  currentSymbol,
  interval,
  onIntervalChange,
  onPrefetchInterval,
  chartType,
  onChartTypeChange,
  activeIndicatorCount,
  onOpenIndicators,
  onOpenSearch,
  onOpenAlertModal,
  isReplayMode,
  onToggleReplay,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSnapshot,
  onOpenSettings,
  onToggleRightPanel,
  onSaveWorkspace,
  isTradeOpen,
  openPositionsCount,
  onToggleTrade,
  isDarkMode,
  onToggleTheme,
}) => {
  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const [ctMenuOpen, setCtMenuOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [snapMenuOpen, setSnapMenuOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const tfRef = useRef<HTMLDivElement>(null);
  const ctRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tfRef.current && !tfRef.current.contains(e.target as Node)) setTfMenuOpen(false);
      if (ctRef.current && !ctRef.current.contains(e.target as Node)) setCtMenuOpen(false);
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) setSaveMenuOpen(false);
      if (snapRef.current && !snapRef.current.contains(e.target as Node)) setSnapMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTfMenuOpen(false);
        setCtMenuOpen(false);
        setSaveMenuOpen(false);
        setSnapMenuOpen(false);
      }
    };
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFs);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFs);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const triggerSave = () => {
    onSaveWorkspace?.();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const currentCt = CHART_TYPES.find((c) => c.value === chartType) || CHART_TYPES[0];
  const isCustomQuickTf = !QUICK_TFS.some((q) => q.value === interval);

  return (
    <header className="h-[44px] bg-[var(--bg-surface)] flex items-center px-2.5 gap-1 shrink-0 select-none z-30">
      {/* TradingView Circular Profile Avatar */}
      <button
        type="button"
        onClick={onOpenSettings}
        title="Workspace & Chart Settings"
        className="relative w-7 h-7 rounded-full bg-[#687e99] hover:opacity-90 text-white text-[13px] font-semibold inline-flex items-center justify-center shrink-0 mr-1 cursor-pointer transition-opacity"
      >
        <span>T</span>
        {openPositionsCount > 0 && (
          <span className="absolute -top-0.5 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#f23645] text-white text-[9px] font-bold inline-flex items-center justify-center leading-none">
            {openPositionsCount}
          </span>
        )}
      </button>

      {/* Rounded Pill Symbol Search Button (Exact TradingView LTCUSDT [00]) */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="h-[30px] pl-3 pr-1 rounded-full bg-[#f0f3fa] dark:bg-[var(--bg-elevated)] hover:bg-[#e6e9f2] dark:hover:bg-[var(--bg-hover)] flex items-center gap-2 font-semibold text-[13px] text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Symbol Search (Ctrl+K)"
      >
        <span className="tracking-tight">{currentSymbol}</span>
        <span className="w-[24px] h-[24px] rounded-full bg-[var(--bg-surface)] border border-[var(--border)]/60 inline-flex items-center justify-center text-[var(--text-main)]">
          <TwoCandlesPillIcon className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Compare / Add Symbol (+) */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors shrink-0 cursor-pointer"
        title="Compare or Add Symbol"
      >
        <PlusCircle className="w-[18px] h-[18px]" strokeWidth={1.4} />
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

      {/* Timeframes (15m 1h 4h D W) */}
      <div className="hidden md:flex items-center gap-0.5 shrink-0">
        {QUICK_TFS.map((tf) => {
          const active = interval === tf.value;
          return (
            <button
              key={tf.value}
              type="button"
              onMouseEnter={() => onPrefetchInterval?.(tf.value)}
              onClick={() => onIntervalChange(tf.value)}
              className={`h-7 px-2 rounded-[5px] text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#f0f3fa] dark:bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-main)] font-normal hover:bg-[var(--bg-hover)]'
              }`}
            >
              {tf.label}
            </button>
          );
        })}
        {isCustomQuickTf && (
          <span className="h-7 px-2 rounded-[5px] text-[13px] bg-[#f0f3fa] dark:bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold inline-flex items-center">
            {interval}
          </span>
        )}
      </div>

      {/* All Timeframes Dropdown */}
      <div className="relative shrink-0" ref={tfRef}>
        <button
          type="button"
          onClick={() => setTfMenuOpen((v) => !v)}
          className="h-7 px-1 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-0.5 text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer"
          title="Select Timeframe"
        >
          <span className="md:hidden font-semibold">{interval.toUpperCase()}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
        {tfMenuOpen && (
          <div className="absolute left-0 top-9 w-40 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50">
            {ALL_TFS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onMouseEnter={() => onPrefetchInterval?.(tf.value)}
                onClick={() => {
                  onIntervalChange(tf.value);
                  setTfMenuOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[var(--bg-hover)] cursor-pointer ${
                  interval === tf.value
                    ? 'text-[var(--accent)] font-bold bg-[var(--bg-active)]'
                    : 'text-[var(--text-main)]'
                }`}
              >
                <span>{tf.desc}</span>
                <span className="font-mono-num opacity-70">{tf.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

      {/* Chart Type Dropdown (Hollow Candles Icon) */}
      <div className="relative shrink-0" ref={ctRef}>
        <button
          type="button"
          onClick={() => setCtMenuOpen((v) => !v)}
          className="h-8 px-1.5 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors whitespace-nowrap cursor-pointer"
          title={`Chart Style: ${currentCt.label}`}
        >
          {currentCt.icon}
        </button>
        {ctMenuOpen && (
          <div className="absolute left-0 top-9 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => {
                  onChartTypeChange(ct.value);
                  setCtMenuOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 hover:bg-[var(--bg-hover)] cursor-pointer ${
                  chartType === ct.value
                    ? 'text-[var(--accent)] font-bold bg-[var(--bg-active)]'
                    : 'text-[var(--text-main)]'
                }`}
              >
                {ct.icon}
                <span>{ct.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

      {/* Indicators */}
      <button
        type="button"
        onClick={onOpenIndicators}
        className="h-8 px-2 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 text-[13px] font-normal text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title={`Indicators (${activeIndicatorCount} active)`}
      >
        <IndicatorsChartIcon className="w-[18px] h-[18px]" />
        <span className="hidden sm:inline">Indicators</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

      {/* Alert & Replay */}
      <button
        type="button"
        onClick={onOpenAlertModal}
        className="h-8 px-2 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 text-[13px] font-normal text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Create Alert (Alt+A)"
      >
        <AlertClockSparkleIcon className="w-[18px] h-[18px]" />
        <span className="hidden lg:inline">Alert</span>
      </button>

      <button
        type="button"
        onClick={onToggleReplay}
        className={`h-8 px-2 rounded-md inline-flex items-center gap-1.5 text-[13px] font-normal transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isReplayMode
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`}
        title="Bar Replay"
      >
        <ReplayChevronsIcon className="w-[17px] h-[17px]" />
        <span className="hidden lg:inline">{isReplayMode ? 'Exit Replay' : 'Replay'}</span>
      </button>

      <div className="hidden sm:block w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

      {/* Undo / Redo */}
      <div className="hidden sm:flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-[16px] h-[16px]" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-[16px] h-[16px]" strokeWidth={1.5} />
        </button>
      </div>

      {/* Right Action Cluster (Exact Match to Full-Screen TradingView Top-Right) */}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {/* Single-Pane Layout Toggle */}
        <button
          type="button"
          onClick={onToggleRightPanel}
          className="hidden xl:inline-flex h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Toggle Watchlist Pane"
        >
          <LayoutPaneIcon className="w-[17px] h-[17px]" />
        </button>

        {/* Saved Layout Label (Main / Save v) */}
        <div className="relative hidden lg:block" ref={saveRef}>
          <div className="flex items-center">
            <button
              type="button"
              onClick={triggerSave}
              className="h-8 px-2 rounded-l-md hover:bg-[var(--bg-hover)] flex flex-col items-start justify-center leading-none cursor-pointer"
              title="Save workspace layout"
            >
              <span className="text-[12.5px] font-medium text-[var(--text-main)] leading-tight">
                Main
              </span>
              <span className="text-[10px] text-[var(--text-muted)] inline-flex items-center gap-0.5 leading-none mt-0.5">
                {justSaved ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-[#089981]" />
                    <span className="text-[#089981]">Saved</span>
                  </>
                ) : (
                  'Save'
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSaveMenuOpen((v) => !v)}
              className="h-8 px-1 rounded-r-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              title="Layout Options"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          {saveMenuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 text-xs text-[var(--text-main)]">
              <button
                type="button"
                onClick={() => {
                  triggerSave();
                  setSaveMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                Save now
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                Chart settings...
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveMenuOpen(false);
                  onSnapshot('download');
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                Download chart PNG
              </button>
            </div>
          )}
        </div>

        <div className="hidden lg:block w-px h-5 bg-[var(--border)] mx-0.5 shrink-0" />

        <button
          type="button"
          onClick={onOpenSearch}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Quick Search (Ctrl+K)"
        >
          <Search className="w-[17px] h-[17px]" strokeWidth={1.5} />
        </button>

        {/* Hexagon Nut Settings Icon (Exact TradingView Match) */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Chart Settings"
        >
          <HexSettingsIcon className="w-[18px] h-[18px]" />
        </button>

        {/* 4-Corner Brackets Fullscreen Icon */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`hidden sm:inline-flex h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] items-center justify-center transition-colors cursor-pointer ${
            isFullscreen ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'text-[var(--text-main)]'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
        >
          <CornerFullscreenIcon className="w-[17px] h-[17px]" />
        </button>

        {/* Camera / Chart Snapshot Dropdown (Exact TradingView Menu) */}
        <div className="relative hidden sm:block" ref={snapRef}>
          <button
            type="button"
            onClick={() => setSnapMenuOpen((v) => !v)}
            className={`h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer ${
              snapMenuOpen ? 'bg-[var(--bg-hover)]' : ''
            }`}
            title="Take a snapshot"
            aria-haspopup="menu"
            aria-expanded={snapMenuOpen}
          >
            <Camera className="w-[17px] h-[17px]" strokeWidth={1.5} />
          </button>

          {snapMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[38px] w-[262px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.14)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)] py-2 z-50 select-none"
            >
              <div className="px-4 pt-1 pb-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-muted)]">
                Chart Snapshot
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSnapMenuOpen(false);
                  onSnapshot('download');
                }}
                className="w-full px-4 py-[9px] flex items-center justify-between gap-3 text-[13.5px] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <Download className="w-[18px] h-[18px] text-[var(--text-main)] shrink-0" strokeWidth={1.55} />
                  <span>Download image</span>
                </span>
                <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                  Ctrl + Alt + S
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSnapMenuOpen(false);
                  onSnapshot('copy');
                }}
                className="w-full px-4 py-[9px] flex items-center justify-between gap-3 text-[13.5px] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <Copy className="w-[18px] h-[18px] text-[var(--text-main)] shrink-0" strokeWidth={1.55} />
                  <span>Copy image</span>
                </span>
                <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                  Ctrl + Shift + S
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSnapMenuOpen(false);
                  onSnapshot('copy_link');
                }}
                className="w-full px-4 py-[9px] flex items-center justify-between gap-3 text-[13.5px] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <Link2 className="w-[18px] h-[18px] text-[var(--text-main)] shrink-0" strokeWidth={1.55} />
                  <span>Copy link</span>
                </span>
                <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                  Alt + S
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSnapMenuOpen(false);
                  onSnapshot('open_tab');
                }}
                className="w-full px-4 py-[9px] flex items-center justify-between gap-3 text-[13.5px] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <ExternalLink className="w-[18px] h-[18px] text-[var(--text-main)] shrink-0" strokeWidth={1.55} />
                  <span>Open in new tab</span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSnapMenuOpen(false);
                  onSnapshot('post_x');
                }}
                className="w-full px-4 py-[9px] flex items-center justify-between gap-3 text-[13.5px] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-[17px] h-[17px] text-[var(--text-main)] shrink-0"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Post image</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors shrink-0 cursor-pointer"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun className="w-[17px] h-[17px]" strokeWidth={1.5} />
          ) : (
            <Moon className="w-[17px] h-[17px]" strokeWidth={1.5} />
          )}
        </button>

        {/* Clean Rounded Pill Trade Button (Exact Match to Screenshot) */}
        <button
          type="button"
          onClick={onToggleTrade}
          className={`h-[30px] px-3.5 ml-1 rounded-full border text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isTradeOpen
              ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
          title="Paper Trading Panel"
        >
          <span>Trade</span>
          {openPositionsCount > 0 && (
            <span className="font-mono-num text-[11px] font-bold">({openPositionsCount})</span>
          )}
        </button>
      </div>
    </header>
  );
};
