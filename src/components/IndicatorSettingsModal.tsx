import React, { useEffect, useRef, useState } from 'react';
import { X, Pin, ChevronDown, BarChart2, Activity } from 'lucide-react';
import {
  DrawingLineStyle,
  DrawingVisibility,
  IndicatorConfig,
  IndicatorPrecision,
  IndicatorSettingsTarget,
  MaLineConfig,
  PriceSource,
  SmaEmaBundleConfig,
  VolumeIndicatorConfig,
} from '../types/trading';
import {
  cloneVisibility,
  DEFAULT_SMA_EMA_INDICATOR,
  DEFAULT_VOLUME_INDICATOR,
  loadCustomIndicatorDefaults,
  saveCustomIndicatorDefaults,
} from '../utils/storage';
import { ColorPalettePopover } from './ColorPalettePopover';

interface IndicatorSettingsModalProps {
  open: boolean;
  target: IndicatorSettingsTarget | null;
  config: IndicatorConfig;
  onLiveChange: (next: IndicatorConfig) => void;
  onClose: () => void;
}

type ModalTab = 'inputs' | 'style' | 'visibility';

const SOURCE_OPTIONS: { value: PriceSource; label: string }[] = [
  { value: 'close', label: 'Close' },
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'hl2', label: 'HL2' },
  { value: 'hlc3', label: 'HLC3' },
  { value: 'ohlc4', label: 'OHLC4' },
];

const PRECISION_OPTIONS: { value: IndicatorPrecision; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
];

const LINE_STYLE_CYCLE: DrawingLineStyle[] = ['solid', 'dashed', 'dotted'];

const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d1d4dc 25%, transparent 25%), linear-gradient(-45deg, #d1d4dc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d4dc 75%), linear-gradient(-45deg, transparent 75%, #d1d4dc 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
  backgroundColor: '#ffffff',
};

/* TradingView-style Dark Square Checkbox */
const TvCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
    <span className="relative inline-flex items-center justify-center w-[18px] h-[18px] shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`w-[18px] h-[18px] rounded-[4px] border transition-colors flex items-center justify-center ${
          checked
            ? 'bg-[#131722] dark:bg-white border-[#131722] dark:border-white text-white dark:text-[#131722]'
            : 'bg-transparent border-[#9598a1] dark:border-[#5d606b] hover:border-[#131722] dark:hover:border-white'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 10" className="w-[11px] h-[11px]" fill="none">
            <path
              d="M1.5 5.2L4.5 8.2L10.5 1.8"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
    {label && <span className="text-[13px] text-[var(--text-main)]">{label}</span>}
  </label>
);

/* Interactive Dual-Thumb Range Slider (Matches TradingView Visibility Tab) */
const DualRangeSlider: React.FC<{
  minLimit: number;
  maxLimit: number;
  minVal: number;
  maxVal: number;
  disabled?: boolean;
  onChange: (minVal: number, maxVal: number) => void;
}> = ({ minLimit, maxLimit, minVal, maxVal, disabled, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const startDrag = (thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;

    const updateFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const raw = Math.round(minLimit + ratio * (maxLimit - minLimit));
      if (thumb === 'min') {
        onChange(Math.max(minLimit, Math.min(maxVal, raw)), maxVal);
      } else {
        onChange(minVal, Math.min(maxLimit, Math.max(minVal, raw)));
      }
    };

    updateFromClientX(e.clientX);
    const onMove = (ev: MouseEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const span = Math.max(1, maxLimit - minLimit);
  const leftPct = ((minVal - minLimit) / span) * 100;
  const rightPct = ((maxVal - minLimit) / span) * 100;

  return (
    <div
      ref={trackRef}
      className={`relative h-5 flex items-center select-none ${disabled ? 'opacity-35 pointer-events-none' : ''}`}
    >
      {/* Background track */}
      <div className="w-full h-[5px] rounded-full bg-[#d1d4dc] dark:bg-[#363a45]" />
      {/* Active filled track */}
      <div
        className="absolute h-[5px] rounded-full bg-[#2a2e39] dark:bg-[#d1d4dc]"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* Left thumb */}
      <button
        type="button"
        onMouseDown={startDrag('min')}
        className="absolute -translate-x-1/2 w-[13px] h-[13px] rounded-full bg-white border-[2px] border-[#131722] dark:border-[#d1d4dc] shadow-xs cursor-ew-resize hover:scale-110 transition-transform"
        style={{ left: `${leftPct}%` }}
        title={`Min: ${minVal}`}
      />
      {/* Right thumb */}
      <button
        type="button"
        onMouseDown={startDrag('max')}
        className="absolute -translate-x-1/2 w-[13px] h-[13px] rounded-full bg-white border-[2px] border-[#131722] dark:border-[#d1d4dc] shadow-xs cursor-ew-resize hover:scale-110 transition-transform"
        style={{ left: `${rightPct}%` }}
        title={`Max: ${maxVal}`}
      />
    </div>
  );
};

/* Line Style + Width Preview Swatch Button */
const ColorLineButton: React.FC<{
  color: string;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  showLinePreview?: boolean;
  dimmed?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onChangeColor: (color: string) => void;
  onChangeWidth?: (width: number) => void;
  onChangeStyle?: (style: DrawingLineStyle) => void;
  onClose: () => void;
}> = ({
  color,
  lineWidth = 1,
  lineStyle = 'solid',
  showLinePreview = true,
  dimmed = false,
  isOpen,
  onToggle,
  onChangeColor,
  onChangeWidth,
  onChangeStyle,
  onClose,
}) => {
  const dashStyle =
    lineStyle === 'dashed' ? 'dashed' : lineStyle === 'dotted' ? 'dotted' : 'solid';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`h-[32px] px-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] inline-flex items-center gap-2 cursor-pointer transition-colors ${
          dimmed ? 'opacity-65' : ''
        }`}
      >
        <span
          className="relative w-[22px] h-[22px] rounded-[4px] overflow-hidden border border-black/15 shrink-0"
          style={CHECKERBOARD_BG}
        >
          <span className="absolute inset-0" style={{ backgroundColor: color }} />
        </span>
        {showLinePreview && (
          <span className="w-[34px] flex items-center justify-center pr-1">
            <span
              className="w-full block"
              style={{
                borderTopWidth: `${Math.max(1, Math.min(4, lineWidth))}px`,
                borderTopStyle: dashStyle,
                borderTopColor: color,
              }}
            />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="relative z-50">
          <ColorPalettePopover
            value={color}
            onChange={onChangeColor}
            onClose={onChangeWidth || onChangeStyle ? undefined : onClose}
            align="left"
          />
          {(onChangeWidth || onChangeStyle) && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-[356px] w-[262px] px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl z-50 space-y-2"
            >
              {onChangeWidth && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Thickness</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onChangeWidth(w)}
                        className={`w-8 h-6 rounded border flex items-center justify-center cursor-pointer ${
                          lineWidth === w
                            ? 'border-[var(--text-main)] bg-[var(--bg-active)]'
                            : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span
                          className="w-4 block rounded-full bg-[var(--text-main)]"
                          style={{ height: `${w}px` }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {onChangeStyle && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Line style</span>
                  <div className="flex items-center gap-1">
                    {LINE_STYLE_CYCLE.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => onChangeStyle(st)}
                        className={`px-2 h-6 rounded border text-[10.5px] capitalize cursor-pointer ${
                          lineStyle === st
                            ? 'border-[var(--text-main)] bg-[var(--bg-active)] text-[var(--text-main)] font-semibold'
                            : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const IndicatorSettingsModal: React.FC<IndicatorSettingsModalProps> = ({
  open,
  target,
  config,
  onLiveChange,
  onClose,
}) => {
  const [tab, setTab] = useState<ModalTab>('inputs');
  const [pinned, setPinned] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<IndicatorConfig | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (open && target) {
      setTab('inputs');
      setDefaultsOpen(false);
      setActivePicker(null);
      setDragOffset({ x: 0, y: 0 });
      setSnapshot(JSON.parse(JSON.stringify(config)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  if (!open || !target) return null;

  const isVol = target === 'volume';
  const volCfg = config.volume;
  const smaEmaCfg = config.smaEma;
  const visibility: DrawingVisibility = isVol
    ? cloneVisibility(volCfg.visibility)
    : cloneVisibility(smaEmaCfg.visibility);

  const patchVolume = (patch: Partial<VolumeIndicatorConfig>) => {
    onLiveChange({
      ...config,
      volume: { ...config.volume, ...patch },
    });
  };

  const patchSmaEma = (patch: Partial<SmaEmaBundleConfig>) => {
    onLiveChange({
      ...config,
      smaEma: { ...config.smaEma, ...patch },
    });
  };

  const patchMaLine = (
    key: 'sma1' | 'sma2' | 'sma3' | 'ema1' | 'ema2' | 'ema3',
    patch: Partial<MaLineConfig>
  ) => {
    patchSmaEma({
      [key]: { ...smaEmaCfg[key], ...patch },
    } as Partial<SmaEmaBundleConfig>);
  };

  const patchVisibility = (patch: Partial<DrawingVisibility>) => {
    const nextVis = { ...visibility, ...patch };
    if (isVol) patchVolume({ visibility: nextVis });
    else patchSmaEma({ visibility: nextVis });
  };

  const handleCancel = () => {
    if (snapshot) onLiveChange(snapshot);
    onClose();
  };

  const handleApplyDefaults = () => {
    const custom = loadCustomIndicatorDefaults();
    if (isVol) {
      const def = custom.volume
        ? { ...DEFAULT_VOLUME_INDICATOR, ...custom.volume, enabled: volCfg.enabled, hidden: volCfg.hidden }
        : { ...DEFAULT_VOLUME_INDICATOR, enabled: volCfg.enabled, hidden: volCfg.hidden };
      patchVolume(def);
    } else {
      const def = custom.smaEma
        ? { ...DEFAULT_SMA_EMA_INDICATOR, ...custom.smaEma, enabled: smaEmaCfg.enabled, hidden: smaEmaCfg.hidden }
        : { ...DEFAULT_SMA_EMA_INDICATOR, enabled: smaEmaCfg.enabled, hidden: smaEmaCfg.hidden };
      patchSmaEma(def);
    }
    setDefaultsOpen(false);
  };

  const handleResetFactory = () => {
    if (isVol) {
      patchVolume({ ...DEFAULT_VOLUME_INDICATOR, enabled: volCfg.enabled, hidden: volCfg.hidden });
    } else {
      patchSmaEma({ ...DEFAULT_SMA_EMA_INDICATOR, enabled: smaEmaCfg.enabled, hidden: smaEmaCfg.hidden });
    }
    setDefaultsOpen(false);
  };

  const handleSaveAsDefault = () => {
    const existing = loadCustomIndicatorDefaults();
    if (isVol) {
      saveCustomIndicatorDefaults({ ...existing, volume: { ...volCfg } });
    } else {
      saveCustomIndicatorDefaults({ ...existing, smaEma: { ...smaEmaCfg } });
    }
    setDefaultsOpen(false);
  };

  const handleHeaderDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...dragOffset };
    const onMove = (ev: MouseEvent) => {
      setDragOffset({ x: orig.x + (ev.clientX - startX), y: orig.y + (ev.clientY - startY) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const maLines: {
    key: 'sma1' | 'sma2' | 'sma3' | 'ema1' | 'ema2' | 'ema3';
    label: string;
    lengthLabel: string;
    sourceLabel: string;
  }[] = [
    { key: 'sma1', label: 'SMA #1', lengthLabel: 'SMA #1 length', sourceLabel: 'SMA Source #1' },
    { key: 'sma2', label: 'SMA #2', lengthLabel: 'SMA #2 length', sourceLabel: 'SMA Source #2' },
    { key: 'sma3', label: 'SMA #3', lengthLabel: 'SMA #3 length', sourceLabel: 'SMA Source #3' },
    { key: 'ema1', label: 'EMA #1', lengthLabel: 'EMA #1 length', sourceLabel: 'EMA Source #1' },
    { key: 'ema2', label: 'EMA #2', lengthLabel: 'EMA #2 length', sourceLabel: 'EMA Source #2' },
    { key: 'ema3', label: 'EMA #3', lengthLabel: 'EMA #3 length', sourceLabel: 'EMA Source #3' },
  ];

  const cycleLineStyle = (cur: DrawingLineStyle): DrawingLineStyle => {
    const idx = LINE_STYLE_CYCLE.indexOf(cur);
    return LINE_STYLE_CYCLE[(idx + 1) % LINE_STYLE_CYCLE.length];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (activePicker) setActivePicker(null);
          if (defaultsOpen) setDefaultsOpen(false);
        }}
        style={{
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        }}
        className="pointer-events-auto w-full max-w-[392px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.2)] flex flex-col select-none"
      >
        {/* Header (Freely Draggable) */}
        <div
          onMouseDown={handleHeaderDrag}
          title="Drag to move anywhere on chart"
          className="px-5 pt-4 pb-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
        >
          <h2 className="text-[19px] font-bold tracking-tight text-[var(--text-main)]">
            {isVol ? 'Vol' : 'SMA/EMA'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              title={pinned ? 'Unpin dialog' : 'Keep dialog floating over chart'}
              className={`w-8 h-8 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors ${
                pinned
                  ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Pin className="w-[17px] h-[17px] rotate-45" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* Tabs: Inputs | Style | Visibility */}
        <div className="px-5 flex items-center gap-5 border-b border-[var(--border)]">
          {(
            [
              { id: 'inputs', label: 'Inputs' },
              { id: 'style', label: 'Style' },
              { id: 'visibility', label: 'Visibility' },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setActivePicker(null);
                }}
                className={`relative pb-2.5 pt-1 text-[13.5px] font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'text-[var(--text-main)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2.5px] rounded-t bg-[#131722] dark:bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Body */}
        <div className="px-5 py-4 max-h-[64vh] overflow-y-auto overflow-x-visible space-y-3.5 text-[13px]">
          {/* ==================== INPUTS TAB ==================== */}
          {tab === 'inputs' && isVol && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-main)]">MA Length</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={volCfg.maPeriod}
                  onChange={(e) =>
                    patchVolume({
                      maPeriod: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)),
                    })
                  }
                  className="w-[108px] h-[34px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <TvCheckbox
                  checked={volCfg.colorBasedOnPrevClose}
                  onChange={(checked) => patchVolume({ colorBasedOnPrevClose: checked })}
                  label="Color based on previous close"
                />
              </div>
            </div>
          )}

          {tab === 'inputs' && !isVol && (
            <div className="space-y-2.5">
              {maLines.map((item) => {
                const line = smaEmaCfg[item.key];
                return (
                  <React.Fragment key={item.key}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--text-main)]">{item.lengthLabel}</span>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={line.period}
                        onChange={(e) =>
                          patchMaLine(item.key, {
                            period: Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)),
                          })
                        }
                        className="w-[108px] h-[34px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[13px] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--text-main)]">{item.sourceLabel}</span>
                      <select
                        value={line.source}
                        onChange={(e) =>
                          patchMaLine(item.key, { source: e.target.value as PriceSource })
                        }
                        className="tv-select w-[108px] h-[34px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] text-[13px] outline-none focus:border-[var(--accent)] cursor-pointer"
                      >
                        {SOURCE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* ==================== STYLE TAB ==================== */}
          {tab === 'style' && isVol && (
            <div className="space-y-3">
              {/* Volume Checkbox + Growing / Falling */}
              <div className="space-y-2.5">
                <TvCheckbox
                  checked={volCfg.showVolume}
                  onChange={(checked) => patchVolume({ showVolume: checked })}
                  label="Volume"
                />

                <div className="pl-7 flex items-center justify-between gap-2">
                  <span className="text-[var(--text-main)] w-[94px]">Growing</span>
                  <div className="flex items-center gap-2 flex-1">
                    <ColorLineButton
                      color={volCfg.growingColor}
                      lineWidth={1}
                      dimmed={!volCfg.showVolume}
                      isOpen={activePicker === 'vol-grow'}
                      onToggle={() =>
                        setActivePicker(activePicker === 'vol-grow' ? null : 'vol-grow')
                      }
                      onChangeColor={(c) => patchVolume({ growingColor: c })}
                      onClose={() => setActivePicker(null)}
                    />
                    <span
                      title="Columns"
                      className="w-[34px] h-[32px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] inline-flex items-center justify-center text-[var(--text-main)]"
                    >
                      <BarChart2 className="w-4 h-4" strokeWidth={1.6} />
                    </span>
                  </div>
                </div>

                <div className="pl-7 flex items-center justify-between gap-2">
                  <span className="text-[var(--text-main)] w-[94px]">Falling</span>
                  <div className="flex items-center gap-2 flex-1">
                    <ColorLineButton
                      color={volCfg.fallingColor}
                      lineWidth={1}
                      dimmed={!volCfg.showVolume}
                      isOpen={activePicker === 'vol-fall'}
                      onToggle={() =>
                        setActivePicker(activePicker === 'vol-fall' ? null : 'vol-fall')
                      }
                      onChangeColor={(c) => patchVolume({ fallingColor: c })}
                      onClose={() => setActivePicker(null)}
                    />
                  </div>
                </div>
              </div>

              {/* Volume MA Row */}
              <div className="pt-1 flex items-center justify-between gap-2">
                <div className="w-[122px] shrink-0">
                  <TvCheckbox
                    checked={volCfg.showMa}
                    onChange={(checked) => patchVolume({ showMa: checked })}
                    label="Volume MA"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <ColorLineButton
                    color={volCfg.maColor}
                    lineWidth={volCfg.maLineWidth}
                    lineStyle={volCfg.maLineStyle}
                    dimmed={!volCfg.showMa}
                    isOpen={activePicker === 'vol-ma'}
                    onToggle={() => setActivePicker(activePicker === 'vol-ma' ? null : 'vol-ma')}
                    onChangeColor={(c) => patchVolume({ maColor: c })}
                    onChangeWidth={(w) => patchVolume({ maLineWidth: w })}
                    onChangeStyle={(st) => patchVolume({ maLineStyle: st })}
                    onClose={() => setActivePicker(null)}
                  />
                  <button
                    type="button"
                    onClick={() => patchVolume({ maLineStyle: cycleLineStyle(volCfg.maLineStyle) })}
                    title={`Line style: ${volCfg.maLineStyle} (click to cycle)`}
                    className="w-[34px] h-[32px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                  >
                    <Activity className="w-4 h-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>

              {/* OUTPUT VALUES */}
              <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  OUTPUT VALUES
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[var(--text-main)] w-[94px]">Precision</span>
                  <select
                    value={volCfg.precision}
                    onChange={(e) =>
                      patchVolume({ precision: e.target.value as IndicatorPrecision })
                    }
                    className="tv-select w-[116px] h-[34px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] text-[13px] outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    {PRECISION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <TvCheckbox
                    checked={volCfg.labelsOnPriceScale}
                    onChange={(checked) => patchVolume({ labelsOnPriceScale: checked })}
                    label="Labels on price scale"
                  />
                </div>
                <div>
                  <TvCheckbox
                    checked={volCfg.valuesInStatusLine}
                    onChange={(checked) => patchVolume({ valuesInStatusLine: checked })}
                    label="Values in status line"
                  />
                </div>
              </div>

              {/* INPUT VALUES */}
              <div className="pt-2 space-y-2">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  INPUT VALUES
                </div>
                <TvCheckbox
                  checked={volCfg.inputsInStatusLine}
                  onChange={(checked) => patchVolume({ inputsInStatusLine: checked })}
                  label="Inputs in status line"
                />
              </div>
            </div>
          )}

          {tab === 'style' && !isVol && (
            <div className="space-y-2.5">
              {maLines.map((item) => {
                const line = smaEmaCfg[item.key];
                const pickerId = `ma-${item.key}`;
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <div className="w-[104px] shrink-0">
                      <TvCheckbox
                        checked={line.enabled}
                        onChange={(checked) => patchMaLine(item.key, { enabled: checked })}
                        label={item.label}
                      />
                    </div>
                    <ColorLineButton
                      color={line.color}
                      lineWidth={line.lineWidth}
                      lineStyle={line.lineStyle}
                      dimmed={!line.enabled}
                      isOpen={activePicker === pickerId}
                      onToggle={() =>
                        setActivePicker(activePicker === pickerId ? null : pickerId)
                      }
                      onChangeColor={(c) => patchMaLine(item.key, { color: c })}
                      onChangeWidth={(w) => patchMaLine(item.key, { lineWidth: w })}
                      onChangeStyle={(st) => patchMaLine(item.key, { lineStyle: st })}
                      onClose={() => setActivePicker(null)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patchMaLine(item.key, { lineStyle: cycleLineStyle(line.lineStyle) })
                      }
                      title={`Line style: ${line.lineStyle} (click to cycle)`}
                      className={`w-[34px] h-[32px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer ${
                        !line.enabled ? 'opacity-50' : ''
                      }`}
                    >
                      <Activity className="w-4 h-4" strokeWidth={1.6} />
                    </button>
                  </div>
                );
              })}

              {/* Plots Background (Ribbon Fill between EMA #1 & EMA #2) */}
              <div className="pt-1 space-y-2">
                <TvCheckbox
                  checked={smaEmaCfg.plotsBackground}
                  onChange={(checked) => patchSmaEma({ plotsBackground: checked })}
                  label="Plots Background"
                />
                <div className="pl-7 flex items-center gap-2">
                  <span className="text-[var(--text-main)] w-[76px]">Color 0</span>
                  <ColorLineButton
                    color={smaEmaCfg.bgColor0}
                    showLinePreview={false}
                    dimmed={!smaEmaCfg.plotsBackground}
                    isOpen={activePicker === 'bg-0'}
                    onToggle={() => setActivePicker(activePicker === 'bg-0' ? null : 'bg-0')}
                    onChangeColor={(c) => patchSmaEma({ bgColor0: c })}
                    onClose={() => setActivePicker(null)}
                  />
                </div>
                <div className="pl-7 flex items-center gap-2">
                  <span className="text-[var(--text-main)] w-[76px]">Color 1</span>
                  <ColorLineButton
                    color={smaEmaCfg.bgColor1}
                    showLinePreview={false}
                    dimmed={!smaEmaCfg.plotsBackground}
                    isOpen={activePicker === 'bg-1'}
                    onToggle={() => setActivePicker(activePicker === 'bg-1' ? null : 'bg-1')}
                    onChangeColor={(c) => patchSmaEma({ bgColor1: c })}
                    onClose={() => setActivePicker(null)}
                  />
                </div>
              </div>

              {/* OUTPUT VALUES */}
              <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  OUTPUT VALUES
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[var(--text-main)] w-[94px]">Precision</span>
                  <select
                    value={smaEmaCfg.precision}
                    onChange={(e) =>
                      patchSmaEma({ precision: e.target.value as IndicatorPrecision })
                    }
                    className="tv-select w-[116px] h-[34px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] text-[13px] outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    {PRECISION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <TvCheckbox
                    checked={smaEmaCfg.labelsOnPriceScale}
                    onChange={(checked) => patchSmaEma({ labelsOnPriceScale: checked })}
                    label="Labels on price scale"
                  />
                </div>
                <div>
                  <TvCheckbox
                    checked={smaEmaCfg.valuesInStatusLine}
                    onChange={(checked) => patchSmaEma({ valuesInStatusLine: checked })}
                    label="Values in status line"
                  />
                </div>
              </div>

              {/* INPUT VALUES */}
              <div className="pt-2 space-y-2">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  INPUT VALUES
                </div>
                <TvCheckbox
                  checked={smaEmaCfg.inputsInStatusLine}
                  onChange={(checked) => patchSmaEma({ inputsInStatusLine: checked })}
                  label="Inputs in status line"
                />
              </div>
            </div>
          )}

          {/* ==================== VISIBILITY TAB ==================== */}
          {tab === 'visibility' && (
            <div className="space-y-3">
              <TvCheckbox
                checked={visibility.ticks}
                onChange={(checked) => patchVisibility({ ticks: checked })}
                label="Ticks"
              />

              {(
                [
                  { key: 'seconds', label: 'Seconds', maxLimit: 59 },
                  { key: 'minutes', label: 'Minutes', maxLimit: 59 },
                  { key: 'hours', label: 'Hours', maxLimit: 24 },
                  { key: 'days', label: 'Days', maxLimit: 366 },
                  { key: 'weeks', label: 'Weeks', maxLimit: 52 },
                  { key: 'months', label: 'Months', maxLimit: 12 },
                ] as const
              ).map((row) => {
                const rng = visibility[row.key];
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[88px_54px_1fr_54px] items-center gap-2"
                  >
                    <TvCheckbox
                      checked={rng.enabled}
                      onChange={(checked) =>
                        patchVisibility({ [row.key]: { ...rng, enabled: checked } })
                      }
                      label={row.label}
                    />

                    <input
                      type="number"
                      min={1}
                      max={rng.max}
                      disabled={!rng.enabled}
                      value={rng.min}
                      onChange={(e) =>
                        patchVisibility({
                          [row.key]: {
                            ...rng,
                            min: Math.max(1, Math.min(rng.max, parseInt(e.target.value, 10) || 1)),
                          },
                        })
                      }
                      className="h-[32px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[12.5px] outline-none focus:border-[var(--accent)] disabled:opacity-40"
                    />

                    <DualRangeSlider
                      minLimit={1}
                      maxLimit={row.maxLimit}
                      minVal={rng.min}
                      maxVal={rng.max}
                      disabled={!rng.enabled}
                      onChange={(minVal, maxVal) =>
                        patchVisibility({ [row.key]: { ...rng, min: minVal, max: maxVal } })
                      }
                    />

                    <input
                      type="number"
                      min={rng.min}
                      max={row.maxLimit}
                      disabled={!rng.enabled}
                      value={rng.max}
                      onChange={(e) =>
                        patchVisibility({
                          [row.key]: {
                            ...rng,
                            max: Math.max(
                              rng.min,
                              Math.min(row.maxLimit, parseInt(e.target.value, 10) || row.maxLimit)
                            ),
                          },
                        })
                      }
                      className="h-[32px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[12.5px] outline-none focus:border-[var(--accent)] disabled:opacity-40"
                    />
                  </div>
                );
              })}

              <div className="pt-0.5">
                <TvCheckbox
                  checked={visibility.ranges}
                  onChange={(checked) => patchVisibility({ ranges: checked })}
                  label="Ranges"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer: Defaults ⌄ | Cancel | Ok */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDefaultsOpen((v) => !v);
              }}
              className="h-[34px] px-3 rounded-[7px] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[13px] font-medium text-[var(--text-main)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Defaults</span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>

            {defaultsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 bottom-10 w-48 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl z-50 text-[12.5px] text-[var(--text-main)]"
              >
                <button
                  type="button"
                  onClick={handleApplyDefaults}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Apply defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsDefault}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Save as default
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  type="button"
                  onClick={handleResetFactory}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Reset settings
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="h-[34px] px-4 rounded-[7px] border border-[var(--text-main)]/70 bg-transparent hover:bg-[var(--bg-hover)] text-[13px] font-medium text-[var(--text-main)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-[34px] px-4 rounded-[7px] bg-[#131722] dark:bg-white text-white dark:text-[#131722] hover:opacity-90 text-[13px] font-semibold cursor-pointer"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
