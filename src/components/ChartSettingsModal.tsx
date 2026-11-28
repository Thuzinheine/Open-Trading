import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CandlestickChart,
  AlignLeft,
  SlidersHorizontal,
  Pencil,
  TrendingUp,
  AlarmClock,
  Calendar,
  ChevronDown,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ChartSettings,
  ChartSettingsTab,
  ChartSettingsTemplate,
  DrawingLineStyle,
} from '../types/trading';
import { DEFAULT_CHART_SETTINGS } from '../utils/storage';
import { ColorPalettePopover } from './ColorPalettePopover';
import { TvSelect } from './TvSelect';
import { playAlertChime } from '../utils/binance';

interface ChartSettingsModalProps {
  open: boolean;
  initialTab?: ChartSettingsTab;
  settings: ChartSettings;
  isDarkMode: boolean;
  templates: ChartSettingsTemplate[];
  onClose: () => void;
  onLiveChange: (next: ChartSettings) => void;
  onSaveTemplate: (tpl: ChartSettingsTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

const NAV_TABS: { id: ChartSettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'symbol', label: 'Symbol', icon: <CandlestickChart className="w-4 h-4" /> },
  { id: 'status_line', label: 'Status line', icon: <AlignLeft className="w-4 h-4" /> },
  { id: 'scales', label: 'Scales and lines', icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'canvas', label: 'Canvas', icon: <Pencil className="w-4 h-4" /> },
  { id: 'trading', label: 'Trading', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'alerts', label: 'Alerts', icon: <AlarmClock className="w-4 h-4" /> },
  { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
];

interface SwatchPickerProps {
  id: string;
  color: string;
  fallbackColor?: string;
  disabled?: boolean;
  openPickerId: string | null;
  setOpenPickerId: (id: string | null) => void;
  onChange: (c: string) => void;
  title?: string;
}

const SwatchPicker: React.FC<SwatchPickerProps> = ({
  id,
  color,
  fallbackColor = '#2962ff',
  disabled = false,
  openPickerId,
  setOpenPickerId,
  onChange,
  title,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const isOpen = openPickerId === id;
  const displayColor = color || fallbackColor;

  const toggle = () => {
    if (disabled) return;
    if (isOpen) {
      setOpenPickerId(null);
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const popW = 266;
      const popH = 340;
      const left = Math.max(12, Math.min(window.innerWidth - popW - 12, rect.left));
      const top =
        rect.bottom + popH + 12 > window.innerHeight
          ? Math.max(12, rect.top - popH - 6)
          : rect.bottom + 6;
      setPos({ top, left });
    }
    setOpenPickerId(id);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        title={title || displayColor}
        className="w-8 h-8 rounded-md border border-[var(--border)] bg-[var(--bg-app)] p-1 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        <span
          className="w-full h-full rounded-[4px] border border-black/15"
          style={{ backgroundColor: displayColor }}
        />
      </button>
      {isOpen && (
        <div
          className="fixed z-[80]"
          style={{ top: `${pos.top - 36}px`, left: `${pos.left}px` }}
        >
          <ColorPalettePopover
            value={displayColor}
            onChange={onChange}
            onClose={() => setOpenPickerId(null)}
          />
        </div>
      )}
    </>
  );
};

export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({
  open,
  initialTab = 'symbol',
  settings,
  isDarkMode,
  templates,
  onClose,
  onLiveChange,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<ChartSettingsTab>(initialTab);
  const [snapshot, setSnapshot] = useState<ChartSettings | null>(null);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const [modalOffset, setModalOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setModalOffset({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSnapshot(JSON.parse(JSON.stringify(settings)));
      setOpenPickerId(null);
      setTemplateMenuOpen(false);
      setShowSaveTpl(false);
      setTplName('');
      setModalOffset({ x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  if (!open) return null;

  const updateSection = <K extends keyof ChartSettings>(
    section: K,
    patch: Partial<ChartSettings[K]>
  ) => {
    onLiveChange({
      ...settings,
      [section]: {
        ...settings[section],
        ...patch,
      },
    });
  };

  const handleCancel = () => {
    if (snapshot) onLiveChange(snapshot);
    onClose();
  };

  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tplName.trim();
    if (!clean) return;
    onSaveTemplate({
      id: `ctpl-${Date.now()}`,
      name: clean,
      settings: JSON.parse(JSON.stringify(settings)),
    });
    setTplName('');
    setShowSaveTpl(false);
    setTemplateMenuOpen(false);
  };

  const themeBgDefault = isDarkMode ? '#131722' : '#ffffff';
  const themeGridDefault = isDarkMode ? '#1e222d' : '#f0f3fa';
  const themeTextDefault = isDarkMode ? '#d1d4dc' : '#131722';
  const themeLineDefault = isDarkMode ? '#2a2e39' : '#e0e3eb';

  const chkClass = 'w-4 h-4 rounded accent-[#131722] dark:accent-[var(--accent)] cursor-pointer shrink-0';
  const numClass =
    'h-[34px] w-24 px-2.5 rounded-[7px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[13px] outline-none focus:border-[#131722] dark:focus:border-[#d1d4dc] transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 select-none pointer-events-none">
      <div
        style={{ transform: `translate3d(${modalOffset.x}px, ${modalOffset.y}px, 0)` }}
        className="pointer-events-auto w-full max-w-[656px] h-[548px] max-h-[88vh] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.22)] flex flex-col overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          if (openPickerId) setOpenPickerId(null);
        }}
      >
        {/* Freely Draggable Header */}
        <div
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button, input')) return;
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              origX: modalOffset.x,
              origY: modalOffset.y,
            };
          }}
          title="Drag to move anywhere on chart"
          className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing"
        >
          <h2 className="text-[18px] font-bold text-[var(--text-main)]">Settings</h2>
          <button
            type="button"
            onClick={handleCancel}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
        </div>

        {/* Body: Left Category Nav + Right Panel */}
        <div className="flex-1 flex min-h-0">
          {/* Left Navigation */}
          <nav className="w-[180px] border-r border-[var(--border)] py-3 px-2 space-y-0.5 shrink-0 bg-[var(--bg-surface)]">
            {NAV_TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.id);
                    setOpenPickerId(null);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-[13px] flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                    active
                      ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]/60 hover:text-[var(--text-main)] font-medium'
                  }`}
                >
                  <span className="shrink-0">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Scrollable Settings Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 text-[13px] text-[var(--text-main)] space-y-3.5">
            {/* ==================== 1. SYMBOL ==================== */}
            {activeTab === 'symbol' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Candles
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.symbol.colorBasedOnPrevClose}
                    onChange={(e) =>
                      updateSection('symbol', { colorBasedOnPrevClose: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Color bars based on previous close</span>
                </label>

                <div className="grid grid-cols-[120px_auto] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.symbol.bodyEnabled}
                      onChange={(e) =>
                        updateSection('symbol', { bodyEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Body</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <SwatchPicker
                      id="sym-up"
                      color={settings.symbol.upColor}
                      disabled={!settings.symbol.bodyEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { upColor: c })}
                      title="Bullish Body Color"
                    />
                    <SwatchPicker
                      id="sym-down"
                      color={settings.symbol.downColor}
                      disabled={!settings.symbol.bodyEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { downColor: c })}
                      title="Bearish Body Color"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[120px_auto] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.symbol.bordersEnabled}
                      onChange={(e) =>
                        updateSection('symbol', { bordersEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Borders</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <SwatchPicker
                      id="sym-bup"
                      color={settings.symbol.borderUpColor}
                      disabled={!settings.symbol.bordersEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { borderUpColor: c })}
                      title="Bullish Border Color"
                    />
                    <SwatchPicker
                      id="sym-bdown"
                      color={settings.symbol.borderDownColor}
                      disabled={!settings.symbol.bordersEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { borderDownColor: c })}
                      title="Bearish Border Color"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[120px_auto] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.symbol.wickEnabled}
                      onChange={(e) =>
                        updateSection('symbol', { wickEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Wick</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <SwatchPicker
                      id="sym-wup"
                      color={settings.symbol.wickUpColor}
                      disabled={!settings.symbol.wickEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { wickUpColor: c })}
                      title="Bullish Wick Color"
                    />
                    <SwatchPicker
                      id="sym-wdown"
                      color={settings.symbol.wickDownColor}
                      disabled={!settings.symbol.wickEnabled}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('symbol', { wickDownColor: c })}
                      title="Bearish Wick Color"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Data Modification
                  </div>

                  <div className="grid grid-cols-[120px_196px] items-center gap-3">
                    <span>Precision</span>
                    <TvSelect
                      value={settings.symbol.precision}
                      onChange={(val) =>
                        updateSection('symbol', {
                          precision: val as ChartSettings['symbol']['precision'],
                        })
                      }
                      options={[
                        { value: 'default', label: 'Default' },
                        { value: '1', label: '1/10 (0.1)' },
                        { value: '2', label: '1/100 (0.01)' },
                        { value: '3', label: '1/1000 (0.001)' },
                        { value: '4', label: '1/10000 (0.0001)' },
                        { value: '5', label: '1/100000 (0.00001)' },
                        { value: '6', label: '1/1000000 (0.000001)' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[120px_196px] items-center gap-3">
                    <span>Timezone</span>
                    <TvSelect
                      value={settings.symbol.timezone}
                      onChange={(val) => updateSection('symbol', { timezone: String(val) })}
                      options={[
                        { value: 'local', label: 'Local (System)' },
                        { value: 'UTC', label: 'UTC' },
                        { value: 'Asia/Yangon', label: 'UTC+6:30 Yangon' },
                        { value: 'Asia/Bangkok', label: 'UTC+7 Bangkok' },
                        { value: 'Asia/Singapore', label: 'UTC+8 Singapore' },
                        { value: 'Asia/Tokyo', label: 'UTC+9 Tokyo' },
                        { value: 'Europe/London', label: 'UTC+0 London' },
                        { value: 'America/New_York', label: 'UTC-5 New York' },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ==================== 2. STATUS LINE ==================== */}
            {activeTab === 'status_line' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Instrument
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.logo}
                    onChange={(e) => updateSection('statusLine', { logo: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Logo</span>
                </label>

                <div className="grid grid-cols-[140px_170px] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.statusLine.title}
                      onChange={(e) => updateSection('statusLine', { title: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Title</span>
                  </label>
                  <TvSelect
                    disabled={!settings.statusLine.title}
                    value={settings.statusLine.titleMode}
                    onChange={(val) =>
                      updateSection('statusLine', {
                        titleMode: val as ChartSettings['statusLine']['titleMode'],
                      })
                    }
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'ticker', label: 'Ticker' },
                      { value: 'description', label: 'Description' },
                    ]}
                    className="w-full"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.openMarketStatus}
                    onChange={(e) =>
                      updateSection('statusLine', { openMarketStatus: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Open market status</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.ohlcValues}
                    onChange={(e) => updateSection('statusLine', { ohlcValues: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Chart values (OHLC)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.barChangeValues}
                    onChange={(e) =>
                      updateSection('statusLine', { barChangeValues: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Bar change values</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.volume}
                    onChange={(e) => updateSection('statusLine', { volume: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Volume</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.statusLine.lastDayChangeValues}
                    onChange={(e) =>
                      updateSection('statusLine', { lastDayChangeValues: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Last day change values (24h)</span>
                </label>

                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.statusLine.buySellButtons}
                      onChange={(e) =>
                        onLiveChange({
                          ...settings,
                          statusLine: { ...settings.statusLine, buySellButtons: e.target.checked },
                          trading: { ...settings.trading, buySellButtons: e.target.checked },
                        })
                      }
                      className={chkClass}
                    />
                    <span>Buy/sell buttons</span>
                  </label>
                  <p className="text-[11px] text-[var(--text-muted)] ml-6.5 mt-0.5">
                    Displays buy and sell buttons directly on the chart
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Indicators
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.statusLine.indTitles}
                      onChange={(e) => updateSection('statusLine', { indTitles: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Titles</span>
                  </label>

                  <label className="flex items-center gap-2.5 ml-6 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!settings.statusLine.indTitles}
                      checked={settings.statusLine.indInputs}
                      onChange={(e) => updateSection('statusLine', { indInputs: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Inputs</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.statusLine.indValues}
                      onChange={(e) => updateSection('statusLine', { indValues: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Values</span>
                  </label>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.statusLine.indBackground}
                        onChange={(e) =>
                          updateSection('statusLine', { indBackground: e.target.checked })
                        }
                        className={chkClass}
                      />
                      <span>Background</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        disabled={!settings.statusLine.indBackground}
                        value={settings.statusLine.indBackgroundOpacity}
                        onChange={(e) =>
                          updateSection('statusLine', {
                            indBackgroundOpacity: parseInt(e.target.value, 10),
                          })
                        }
                        className="flex-1 accent-[var(--accent)] cursor-pointer disabled:opacity-40"
                      />
                      <span className="font-mono-num text-[11px] text-[var(--text-muted)] w-9 text-right">
                        {settings.statusLine.indBackgroundOpacity}%
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== 3. SCALES AND LINES ==================== */}
            {activeTab === 'scales' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Price Scale
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.scales.autoScale}
                    onChange={(e) => updateSection('scales', { autoScale: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Auto (fits data to screen)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.scales.invertScale}
                    onChange={(e) => updateSection('scales', { invertScale: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Invert scale (Alt + I)</span>
                </label>

                <div className="grid grid-cols-[175px_172px] items-center gap-3">
                  <span>Scales placement</span>
                  <TvSelect
                    value={settings.scales.scalesPlacement}
                    onChange={(val) =>
                      updateSection('scales', {
                        scalesPlacement: val as 'right' | 'left',
                      })
                    }
                    options={[
                      { value: 'right', label: 'Right (Auto)' },
                      { value: 'left', label: 'Left' },
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Price Labels &amp; Lines
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scales.noOverlappingLabels}
                      onChange={(e) =>
                        updateSection('scales', { noOverlappingLabels: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>No overlapping labels</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scales.plusButton}
                      onChange={(e) => updateSection('scales', { plusButton: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Plus button</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scales.countdownToBarClose}
                      onChange={(e) =>
                        updateSection('scales', { countdownToBarClose: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Countdown to bar close</span>
                  </label>

                  <div className="grid grid-cols-[175px_172px] items-center gap-3">
                    <span>Symbol</span>
                    <TvSelect
                      value={settings.scales.symbolLabel}
                      onChange={(val) =>
                        updateSection('scales', {
                          symbolLabel: val as ChartSettings['scales']['symbolLabel'],
                        })
                      }
                      options={[
                        { value: 'value_line', label: 'Value, line' },
                        { value: 'value', label: 'Value' },
                        { value: 'hidden', label: 'Hidden' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[175px_172px] items-center gap-3">
                    <span>Indicators and financials</span>
                    <TvSelect
                      value={settings.scales.indicatorsLabel}
                      onChange={(val) =>
                        updateSection('scales', {
                          indicatorsLabel: val as 'value' | 'hidden',
                        })
                      }
                      options={[
                        { value: 'value', label: 'Value' },
                        { value: 'hidden', label: 'Hidden' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[175px_172px_auto] items-center gap-2.5">
                    <span>High and low</span>
                    <TvSelect
                      value={settings.scales.highLowLines}
                      onChange={(val) =>
                        updateSection('scales', {
                          highLowLines: val as ChartSettings['scales']['highLowLines'],
                        })
                      }
                      options={[
                        { value: 'hidden', label: 'Hidden' },
                        { value: 'value_line', label: 'Value, line' },
                        { value: 'value', label: 'Value' },
                      ]}
                      className="w-full"
                    />
                    <SwatchPicker
                      id="sc-hl"
                      color={settings.scales.highLowColor}
                      disabled={settings.scales.highLowLines === 'hidden'}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('scales', { highLowColor: c })}
                      title="High/Low Line Color"
                    />
                  </div>

                  <div className="grid grid-cols-[175px_172px_auto] items-center gap-2.5">
                    <span>Bid and ask</span>
                    <TvSelect
                      value={settings.scales.bidAskLines}
                      onChange={(val) =>
                        updateSection('scales', {
                          bidAskLines: val as 'hidden' | 'value_line',
                        })
                      }
                      options={[
                        { value: 'hidden', label: 'Hidden' },
                        { value: 'value_line', label: 'Value, line' },
                      ]}
                      className="w-full"
                    />
                    <div className="flex items-center gap-1.5">
                      <SwatchPicker
                        id="sc-bid"
                        color={settings.scales.bidColor}
                        disabled={settings.scales.bidAskLines === 'hidden'}
                        openPickerId={openPickerId}
                        setOpenPickerId={setOpenPickerId}
                        onChange={(c) => updateSection('scales', { bidColor: c })}
                        title="Bid Color"
                      />
                      <SwatchPicker
                        id="sc-ask"
                        color={settings.scales.askColor}
                        disabled={settings.scales.bidAskLines === 'hidden'}
                        openPickerId={openPickerId}
                        setOpenPickerId={setOpenPickerId}
                        onChange={(c) => updateSection('scales', { askColor: c })}
                        title="Ask Color"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Time Scale
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scales.dayOfWeekOnLabels}
                      onChange={(e) =>
                        updateSection('scales', { dayOfWeekOnLabels: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Day of week on labels</span>
                  </label>

                  <div className="grid grid-cols-[175px_172px] items-center gap-3">
                    <span>Date format</span>
                    <TvSelect
                      value={settings.scales.dateFormat}
                      onChange={(val) =>
                        updateSection('scales', {
                          dateFormat: val as ChartSettings['scales']['dateFormat'],
                        })
                      }
                      options={[
                        { value: 'short', label: "Mon 29 Sep '97" },
                        { value: 'iso', label: 'YYYY-MM-DD' },
                        { value: 'dmy', label: 'DD/MM/YYYY' },
                        { value: 'mdy', label: 'MM/DD/YYYY' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[175px_172px] items-center gap-3">
                    <span>Time hours format</span>
                    <TvSelect
                      value={settings.scales.timeHoursFormat}
                      onChange={(val) =>
                        updateSection('scales', {
                          timeHoursFormat: val as '24' | '12',
                        })
                      }
                      options={[
                        { value: '24', label: '24-hours' },
                        { value: '12', label: '12-hours' },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ==================== 4. CANVAS ==================== */}
            {activeTab === 'canvas' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Chart Basic Styles
                </div>

                <div className="grid grid-cols-[160px_145px_auto] items-center gap-2.5">
                  <span>Background</span>
                  <TvSelect
                    value={settings.canvas.backgroundType}
                    onChange={(val) =>
                      updateSection('canvas', {
                        backgroundType: val as 'solid' | 'gradient',
                      })
                    }
                    options={[
                      { value: 'solid', label: 'Solid' },
                      { value: 'gradient', label: 'Gradient' },
                    ]}
                    className="w-full"
                  />
                  <div className="flex items-center gap-1.5">
                    <SwatchPicker
                      id="cv-bg1"
                      color={settings.canvas.backgroundColor}
                      fallbackColor={themeBgDefault}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('canvas', { backgroundColor: c })}
                      title="Background Color"
                    />
                    {settings.canvas.backgroundType === 'gradient' && (
                      <SwatchPicker
                        id="cv-bg2"
                        color={settings.canvas.backgroundColor2}
                        fallbackColor={themeGridDefault}
                        openPickerId={openPickerId}
                        setOpenPickerId={setOpenPickerId}
                        onChange={(c) => updateSection('canvas', { backgroundColor2: c })}
                        title="Gradient Bottom Color"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.canvas.vertGridEnabled}
                      onChange={(e) =>
                        updateSection('canvas', { vertGridEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Vertical grid lines</span>
                  </label>
                  <SwatchPicker
                    id="cv-vgrid"
                    color={settings.canvas.vertGridColor}
                    fallbackColor={themeGridDefault}
                    disabled={!settings.canvas.vertGridEnabled}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('canvas', { vertGridColor: c })}
                    title="Vertical Grid Color"
                  />
                </div>

                <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.canvas.horzGridEnabled}
                      onChange={(e) =>
                        updateSection('canvas', { horzGridEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Horizontal grid lines</span>
                  </label>
                  <SwatchPicker
                    id="cv-hgrid"
                    color={settings.canvas.horzGridColor}
                    fallbackColor={themeGridDefault}
                    disabled={!settings.canvas.horzGridEnabled}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('canvas', { horzGridColor: c })}
                    title="Horizontal Grid Color"
                  />
                </div>

                <div className="grid grid-cols-[160px_auto_120px] items-center gap-2.5">
                  <span>Crosshair</span>
                  <SwatchPicker
                    id="cv-cross"
                    color={settings.canvas.crosshairColor}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('canvas', { crosshairColor: c })}
                    title="Crosshair Color"
                  />
                  <TvSelect
                    value={settings.canvas.crosshairStyle}
                    onChange={(val) =>
                      updateSection('canvas', {
                        crosshairStyle: val as DrawingLineStyle,
                      })
                    }
                    options={[
                      { value: 'dashed', label: 'Dashed' },
                      { value: 'solid', label: 'Solid' },
                      { value: 'dotted', label: 'Dotted' },
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-[160px_145px_auto] items-center gap-2.5">
                  <span>Watermark</span>
                  <TvSelect
                    value={settings.canvas.watermarkMode}
                    onChange={(val) =>
                      updateSection('canvas', {
                        watermarkMode: val as ChartSettings['canvas']['watermarkMode'],
                      })
                    }
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'symbol', label: 'Symbol' },
                      { value: 'replay', label: 'Replay mode' },
                    ]}
                    className="w-full"
                  />
                  <SwatchPicker
                    id="cv-wm"
                    color={settings.canvas.watermarkColor}
                    disabled={settings.canvas.watermarkMode === 'off'}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('canvas', { watermarkColor: c })}
                    title="Watermark Color"
                  />
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Scales
                  </div>

                  <div className="grid grid-cols-[160px_auto_90px] items-center gap-2.5">
                    <span>Text</span>
                    <SwatchPicker
                      id="cv-stext"
                      color={settings.canvas.scaleTextColor}
                      fallbackColor={themeTextDefault}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('canvas', { scaleTextColor: c })}
                      title="Scale Text Color"
                    />
                    <TvSelect
                      value={settings.canvas.scaleFontSize}
                      onChange={(val) =>
                        updateSection('canvas', {
                          scaleFontSize: Number(val),
                        })
                      }
                      options={[10, 11, 12, 13, 14, 16].map((sz) => ({
                        value: sz,
                        label: String(sz),
                      }))}
                      mono
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                    <span>Lines</span>
                    <SwatchPicker
                      id="cv-sline"
                      color={settings.canvas.scaleLineColor}
                      fallbackColor={themeLineDefault}
                      openPickerId={openPickerId}
                      setOpenPickerId={setOpenPickerId}
                      onChange={(c) => updateSection('canvas', { scaleLineColor: c })}
                      title="Scale Border Line Color"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Margins
                  </div>

                  <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                    <span>Top</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={settings.canvas.marginTop}
                        onChange={(e) =>
                          updateSection('canvas', {
                            marginTop: Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0)),
                          })
                        }
                        className={numClass}
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                    <span>Bottom</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={45}
                        value={settings.canvas.marginBottom}
                        onChange={(e) =>
                          updateSection('canvas', {
                            marginBottom: Math.max(
                              0,
                              Math.min(45, parseInt(e.target.value, 10) || 0)
                            ),
                          })
                        }
                        className={numClass}
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_auto] items-center gap-2.5">
                    <span>Right</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={settings.canvas.marginRightBars}
                        onChange={(e) =>
                          updateSection('canvas', {
                            marginRightBars: Math.max(
                              0,
                              Math.min(60, parseInt(e.target.value, 10) || 0)
                            ),
                          })
                        }
                        className={numClass}
                      />
                      <span className="text-xs text-[var(--text-muted)]">bars</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== 5. TRADING ==================== */}
            {activeTab === 'trading' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  General
                </div>

                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.buySellButtons}
                      onChange={(e) =>
                        onLiveChange({
                          ...settings,
                          trading: { ...settings.trading, buySellButtons: e.target.checked },
                          statusLine: { ...settings.statusLine, buySellButtons: e.target.checked },
                        })
                      }
                      className={chkClass}
                    />
                    <span>Buy/sell buttons</span>
                  </label>
                  <p className="text-[11px] text-[var(--text-muted)] ml-6.5 mt-0.5">
                    Displays buy and sell buttons directly on the chart
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.oneClickTrading}
                      onChange={(e) =>
                        updateSection('trading', { oneClickTrading: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>One-click trading</span>
                  </label>
                  <p className="text-[11px] text-[var(--text-muted)] ml-6.5 mt-0.5">
                    Instantly place market paper orders directly from chart Buy/Sell buttons
                  </p>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.executionSound}
                      onChange={(e) =>
                        updateSection('trading', { executionSound: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Execution sound</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {settings.trading.executionSound ? (
                      <Volume2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    )}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      disabled={!settings.trading.executionSound}
                      value={settings.trading.executionSoundVolume}
                      onChange={(e) =>
                        updateSection('trading', {
                          executionSoundVolume: parseInt(e.target.value, 10),
                        })
                      }
                      onMouseUp={() => {
                        if (settings.trading.executionSound) {
                          playAlertChime(settings.trading.executionSoundVolume / 100);
                        }
                      }}
                      className="flex-1 accent-[#131722] dark:accent-[var(--accent)] cursor-pointer disabled:opacity-40"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.trading.onlyRejectionNotifications}
                    onChange={(e) =>
                      updateSection('trading', { onlyRejectionNotifications: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Show only rejection notifications</span>
                </label>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Appearance
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.positionsAndOrders}
                      onChange={(e) =>
                        updateSection('trading', { positionsAndOrders: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Positions and orders</span>
                  </label>

                  <label className="flex items-center gap-2.5 ml-6 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!settings.trading.positionsAndOrders}
                      checked={settings.trading.reversePositionButton}
                      onChange={(e) =>
                        updateSection('trading', { reversePositionButton: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Reverse position button</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.pnlValueEnabled}
                      onChange={(e) =>
                        updateSection('trading', { pnlValueEnabled: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Profit and loss value</span>
                  </label>

                  <div className="grid grid-cols-[140px_150px] items-center gap-3 ml-6">
                    <span>Positions</span>
                    <TvSelect
                      disabled={!settings.trading.pnlValueEnabled}
                      value={settings.trading.pnlPositionMode}
                      onChange={(val) =>
                        updateSection('trading', {
                          pnlPositionMode: val as 'money' | 'percent',
                        })
                      }
                      options={[
                        { value: 'money', label: 'Money' },
                        { value: 'percent', label: 'Percent' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_150px] items-center gap-3 ml-6">
                    <span>Brackets</span>
                    <TvSelect
                      disabled={!settings.trading.pnlValueEnabled}
                      value={settings.trading.pnlBracketMode}
                      onChange={(val) =>
                        updateSection('trading', {
                          pnlBracketMode: val as 'money' | 'percent',
                        })
                      }
                      options={[
                        { value: 'money', label: 'Money' },
                        { value: 'percent', label: 'Percent' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.executionMarks}
                      onChange={(e) =>
                        updateSection('trading', { executionMarks: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Execution marks</span>
                  </label>

                  <label className="flex items-center gap-2.5 ml-6 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!settings.trading.executionMarks}
                      checked={settings.trading.executionLabels}
                      onChange={(e) =>
                        updateSection('trading', { executionLabels: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Execution labels</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.trading.extendedPriceLines}
                      onChange={(e) =>
                        updateSection('trading', { extendedPriceLines: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Extended price lines across the entire chart width</span>
                  </label>
                </div>
              </>
            )}

            {/* ==================== 6. ALERTS ==================== */}
            {activeTab === 'alerts' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Chart Line Visibility
                </div>

                <div className="grid grid-cols-[160px_auto] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alerts.alertLines}
                      onChange={(e) => updateSection('alerts', { alertLines: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Alert lines</span>
                  </label>
                  <SwatchPicker
                    id="al-color"
                    color={settings.alerts.alertLineColor}
                    disabled={!settings.alerts.alertLines}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('alerts', { alertLineColor: c })}
                    title="Alert Line Color"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.alerts.onlyActiveAlerts}
                    onChange={(e) =>
                      updateSection('alerts', { onlyActiveAlerts: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Only active alerts</span>
                </label>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Notifications
                  </div>

                  <div className="grid grid-cols-[150px_1fr] items-center gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.alerts.alertVolumeEnabled}
                        onChange={(e) =>
                          updateSection('alerts', { alertVolumeEnabled: e.target.checked })
                        }
                        className={chkClass}
                      />
                      <span>Alert volume</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {settings.alerts.alertVolumeEnabled ? (
                        <Volume2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      )}
                      <input
                        type="range"
                        min={0}
                        max={100}
                        disabled={!settings.alerts.alertVolumeEnabled}
                        value={settings.alerts.alertVolume}
                        onChange={(e) =>
                          updateSection('alerts', { alertVolume: parseInt(e.target.value, 10) })
                        }
                        onMouseUp={() => {
                          if (settings.alerts.alertVolumeEnabled) {
                            playAlertChime(settings.alerts.alertVolume / 100);
                          }
                        }}
                        className="flex-1 accent-[#131722] dark:accent-[var(--accent)] cursor-pointer disabled:opacity-40"
                      />
                      <span className="font-mono-num text-[11px] text-[var(--text-muted)] w-9 text-right">
                        {settings.alerts.alertVolume}%
                      </span>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alerts.autoHideToasts}
                      onChange={(e) =>
                        updateSection('alerts', { autoHideToasts: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Automatically hide toasts</span>
                  </label>
                </div>
              </>
            )}

            {/* ==================== 7. EVENTS ==================== */}
            {activeTab === 'events' && (
              <>
                <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                  Events
                </div>

                <div className="grid grid-cols-[160px_150px] items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.events.ideas}
                      onChange={(e) => updateSection('events', { ideas: e.target.checked })}
                      className={chkClass}
                    />
                    <span>Ideas</span>
                  </label>
                  <TvSelect
                    disabled={!settings.events.ideas}
                    value={settings.events.ideasFilter}
                    onChange={(val) =>
                      updateSection('events', { ideasFilter: val as 'all' | 'mine' })
                    }
                    options={[
                      { value: 'all', label: 'All ideas' },
                      { value: 'mine', label: 'My ideas' },
                    ]}
                    className="w-full"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.events.economicEvents}
                    onChange={(e) => updateSection('events', { economicEvents: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Economic events</span>
                </label>

                <label className="flex items-center gap-2.5 ml-6 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!settings.events.economicEvents}
                    checked={settings.events.onlyFutureEvents}
                    onChange={(e) =>
                      updateSection('events', { onlyFutureEvents: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>Only future events</span>
                </label>

                <div className="grid grid-cols-[180px_auto] items-center gap-3 ml-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.events.sessionBreaks}
                      onChange={(e) =>
                        updateSection('events', { sessionBreaks: e.target.checked })
                      }
                      className={chkClass}
                    />
                    <span>Session / Events breaks</span>
                  </label>
                  <SwatchPicker
                    id="ev-breaks"
                    color={settings.events.sessionBreaksColor}
                    disabled={!settings.events.sessionBreaks}
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    onChange={(c) => updateSection('events', { sessionBreaksColor: c })}
                    title="Session Break Line Color"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.events.latestNews}
                    onChange={(e) => updateSection('events', { latestNews: e.target.checked })}
                    className={chkClass}
                  />
                  <span>Latest news</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.events.newsNotification}
                    onChange={(e) =>
                      updateSection('events', { newsNotification: e.target.checked })
                    }
                    className={chkClass}
                  />
                  <span>News notification</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Footer: Template ⌄ | Cancel | Ok */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((v) => !v)}
              className="h-[34px] px-3 rounded-[7px] border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Template</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
                  templateMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {templateMenuOpen && (
              <div className="absolute left-0 bottom-10 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50 text-xs">
                {showSaveTpl ? (
                  <form onSubmit={handleSaveTemplateSubmit} className="px-2 py-1 flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="Template name..."
                      className="flex-1 h-7 px-2 rounded border border-[var(--accent)] bg-[var(--bg-app)] text-[var(--text-main)] outline-none"
                    />
                    <button
                      type="submit"
                      className="h-7 px-2 rounded bg-[var(--accent)] text-white font-semibold cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveTpl(true)}
                    className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium cursor-pointer"
                  >
                    Save As...
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onLiveChange(JSON.parse(JSON.stringify(DEFAULT_CHART_SETTINGS)));
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Apply Defaults
                </button>

                {templates.length > 0 && (
                  <div className="border-t border-[var(--border)] mt-1 pt-1 max-h-40 overflow-y-auto">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onLiveChange(JSON.parse(JSON.stringify(tpl.settings)));
                            setTemplateMenuOpen(false);
                          }}
                          className="flex-1 text-left text-[var(--text-main)] truncate cursor-pointer"
                        >
                          {tpl.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl.id)}
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--down)] cursor-pointer"
                          title="Delete template"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              className="h-[34px] px-4 rounded-[7px] border border-[#131722] dark:border-[var(--border)] bg-[var(--bg-surface)] text-[13px] font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-[34px] px-4 rounded-[7px] bg-[#1f2229] dark:bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 cursor-pointer"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
