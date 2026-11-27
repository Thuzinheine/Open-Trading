import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  CandlestickChart,
  LineChart,
  AreaChart,
  AlarmClockPlus,
  Rewind,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Camera,
  Moon,
  Sun,
  ChevronDown,
  BarChart2,
  Briefcase,
  Settings,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { ChartType, Timeframe, WatchlistItem } from '../types/trading';

interface TopBarProps {
  currentSymbol: string;
  symbolMeta: WatchlistItem;
  interval: Timeframe;
  onIntervalChange: (tf: Timeframe) => void;
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
  onSnapshot: () => void;
  onOpenSettings: () => void;
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
  { value: 'candles', label: 'Candles', icon: <CandlestickChart className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { value: 'hollow', label: 'Hollow Candles', icon: <BarChart2 className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { value: 'heikin', label: 'Heikin Ashi', icon: <CandlestickChart className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { value: 'area', label: 'Area', icon: <AreaChart className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
  { value: 'line', label: 'Line', icon: <LineChart className="w-[18px] h-[18px]" strokeWidth={1.7} /> },
];

export const TopBar: React.FC<TopBarProps> = ({
  currentSymbol,
  interval,
  onIntervalChange,
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
  isTradeOpen,
  openPositionsCount,
  onToggleTrade,
  isDarkMode,
  onToggleTheme,
}) => {
  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const [ctMenuOpen, setCtMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const tfRef = useRef<HTMLDivElement>(null);
  const ctRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tfRef.current && !tfRef.current.contains(e.target as Node)) setTfMenuOpen(false);
      if (ctRef.current && !ctRef.current.contains(e.target as Node)) setCtMenuOpen(false);
    };
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('fullscreenchange', handleFs);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const currentCt = CHART_TYPES.find((c) => c.value === chartType) || CHART_TYPES[0];
  const isCustomQuickTf = !QUICK_TFS.some((q) => q.value === interval);

  return (
    <header className="h-[44px] bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center px-2.5 gap-1 shrink-0 select-none z-30">
      {/* TradingView-style Circular Profile Avatar */}
      <button
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

      {/* Rounded Pill Symbol Search Button (TradingView style) */}
      <button
        onClick={onOpenSearch}
        className="h-8 pl-3 pr-1.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border)] flex items-center gap-2 font-semibold text-[13px] text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Symbol Search (Ctrl+K)"
      >
        <span className="tracking-tight">{currentSymbol}</span>
        <span className="w-6 h-6 rounded-full bg-[var(--bg-surface)] border border-[var(--border)]/70 inline-flex items-center justify-center text-[var(--text-main)]">
          <SlidersHorizontal className="w-3 h-3" strokeWidth={2} />
        </span>
      </button>

      {/* Compare / Add Symbol (+) */}
      <button
        onClick={onOpenSearch}
        className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors shrink-0 cursor-pointer"
        title="Compare or Add Symbol"
      >
        <PlusCircle className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

      {/* Timeframes */}
      <div className="hidden md:flex items-center gap-0.5 shrink-0">
        {QUICK_TFS.map((tf) => {
          const active = interval === tf.value;
          return (
            <button
              key={tf.value}
              onClick={() => onIntervalChange(tf.value)}
              className={`h-8 px-2 rounded-md text-[13px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-main)] font-normal hover:bg-[var(--bg-hover)]'
              }`}
            >
              {tf.label}
            </button>
          );
        })}
        {isCustomQuickTf && (
          <span className="h-8 px-2 rounded-md text-[13px] bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold inline-flex items-center">
            {interval}
          </span>
        )}
      </div>

      {/* All Timeframes Dropdown */}
      <div className="relative shrink-0" ref={tfRef}>
        <button
          onClick={() => setTfMenuOpen((v) => !v)}
          className="h-8 px-1.5 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1 text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer"
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

      <div className="w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

      {/* Chart Type Dropdown */}
      <div className="relative shrink-0" ref={ctRef}>
        <button
          onClick={() => setCtMenuOpen((v) => !v)}
          className="h-8 px-2 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1 text-[13px] font-medium text-[var(--text-main)] transition-colors whitespace-nowrap cursor-pointer"
          title={`Chart Style: ${currentCt.label}`}
        >
          {currentCt.icon}
        </button>
        {ctMenuOpen && (
          <div className="absolute left-0 top-9 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.value}
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

      <div className="w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

      {/* Indicators */}
      <button
        onClick={onOpenIndicators}
        className="h-8 px-2.5 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 text-[13px] font-normal text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title={`Indicators (${activeIndicatorCount} active)`}
      >
        <TrendingUp className="w-[17px] h-[17px]" strokeWidth={1.7} />
        <span className="hidden sm:inline">Indicators</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

      {/* Alert & Replay */}
      <button
        onClick={onOpenAlertModal}
        className="h-8 px-2.5 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 text-[13px] font-normal text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Create Alert (Alt+A)"
      >
        <AlarmClockPlus className="w-[18px] h-[18px]" strokeWidth={1.6} />
        <span className="hidden lg:inline">Alert</span>
      </button>

      <button
        onClick={onToggleReplay}
        className={`h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[13px] font-normal transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isReplayMode
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`}
        title="Bar Replay"
      >
        <Rewind className="w-[17px] h-[17px]" strokeWidth={1.6} />
        <span className="hidden lg:inline">{isReplayMode ? 'Exit Replay' : 'Replay'}</span>
      </button>

      <div className="hidden sm:block w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

      {/* Undo / Redo */}
      <div className="hidden sm:flex items-center gap-0.5 shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-[17px] h-[17px]" strokeWidth={1.6} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-[17px] h-[17px]" strokeWidth={1.6} />
        </button>
      </div>

      {/* Right Action Cluster */}
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <button
          onClick={onOpenSearch}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Quick Search (Ctrl+K)"
        >
          <Search className="w-[17px] h-[17px]" strokeWidth={1.7} />
        </button>

        <button
          onClick={onOpenSettings}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Chart Settings"
        >
          <Settings className="w-[17px] h-[17px]" strokeWidth={1.7} />
        </button>

        <button
          onClick={toggleFullscreen}
          className="hidden sm:inline-flex h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Fullscreen Mode"
        >
          {isFullscreen ? (
            <Minimize2 className="w-[17px] h-[17px]" strokeWidth={1.7} />
          ) : (
            <Maximize2 className="w-[17px] h-[17px]" strokeWidth={1.7} />
          )}
        </button>

        <button
          onClick={onSnapshot}
          className="hidden sm:inline-flex h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer"
          title="Take a Snapshot"
        >
          <Camera className="w-[17px] h-[17px]" strokeWidth={1.7} />
        </button>

        <button
          onClick={onToggleTrade}
          className={`h-8 px-2.5 ml-1 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isTradeOpen
              ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
          title="Paper Trading Panel"
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Trade</span>
          {openPositionsCount > 0 && (
            <span className="font-mono-num text-[11px] font-bold">({openPositionsCount})</span>
          )}
        </button>

        <button
          onClick={onToggleTheme}
          className="h-8 w-8 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors shrink-0 cursor-pointer"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun className="w-[17px] h-[17px]" strokeWidth={1.7} />
          ) : (
            <Moon className="w-[17px] h-[17px]" strokeWidth={1.7} />
          )}
        </button>
      </div>
    </header>
  );
};
