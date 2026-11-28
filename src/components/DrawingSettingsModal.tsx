import React, { useState, useEffect } from 'react';
import { X, Pencil, ChevronDown, Trash2, Check } from 'lucide-react';
import {
  CandleBar,
  DrawingLineStyle,
  DrawingObject,
  DrawingTemplate,
  DrawingVisibility,
  LineExtendMode,
  StatsDisplayMode,
  StatsPosition,
  TextAlignH,
  TextAlignV,
  Timeframe,
} from '../types/trading';
import { ALL_TOOLS_MAP } from '../utils/drawingToolsCatalog';
import { getTickSizeForPrice } from '../utils/drawingRenderer';
import { DEFAULT_VISIBILITY } from '../utils/storage';
import { INTERVAL_SECONDS } from '../utils/binance';
import { ColorPalettePopover } from './ColorPalettePopover';
import { TvSelect } from './TvSelect';

interface DrawingSettingsModalProps {
  open: boolean;
  drawing: DrawingObject | null;
  candles: CandleBar[];
  interval: Timeframe;
  templates: DrawingTemplate[];
  initialTab?: SettingsTab;
  onClose: () => void;
  onLiveUpdate: (updated: DrawingObject) => void;
  onSaveTemplate: (tpl: DrawingTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

export type SettingsTab = 'inputs' | 'style' | 'text' | 'coordinates' | 'visibility';

const FONT_SIZES = [8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40];
const FONT_SIZE_OPTIONS = FONT_SIZES.map((sz) => ({ value: sz, label: String(sz) }));
const ACCOUNT_CURRENCY_OPTIONS = ['Default', 'USD', 'USDT', 'EUR', 'BTC'].map((v) => ({
  value: v,
  label: v,
}));
const QTY_PRECISION_OPTIONS = ['Default', '0', '1', '2', '3', '4', '5', '6', '8'].map((v) => ({
  value: v,
  label: v,
}));

const LINE_TOOLS = new Set(['trendline', 'ray', 'infoline', 'extended', 'angle', 'arrow_line']);
const SHAPE_FILL_TOOLS = new Set([
  'rect',
  'ellipse',
  'triangle',
  'channel',
  'flat_channel',
  'disjoint_channel',
]);

const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d1d4dc 25%, transparent 25%), linear-gradient(-45deg, #d1d4dc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d4dc 75%), linear-gradient(-45deg, transparent 75%, #d1d4dc 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
  backgroundColor: '#ffffff',
};

const TvCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
        checked
          ? 'bg-[#131722] dark:bg-[var(--accent)] border-[#131722] dark:border-[var(--accent)] text-white'
          : 'bg-[var(--bg-surface)] border-[#b2b5be] dark:border-[#5d606b] hover:border-[var(--text-main)]'
      }`}
    >
      {checked && <Check className="w-3 h-3" strokeWidth={3} />}
    </button>
    {label && <span className="text-[13px] text-[var(--text-main)]">{label}</span>}
  </label>
);

const VisibilityDualSlider: React.FC<{
  minLimit: number;
  maxLimit: number;
  minVal: number;
  maxVal: number;
  disabled?: boolean;
  onChange: (nextMin: number, nextMax: number) => void;
}> = ({ minLimit, maxLimit, minVal, maxVal, disabled, onChange }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);

  const startDrag = (which: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const updateFromClientX = (clientX: number) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const raw = Math.round(minLimit + ratio * (maxLimit - minLimit));
      if (which === 'min') {
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
      className={`relative h-5 flex items-center select-none ${disabled ? 'opacity-35' : ''}`}
    >
      <div className="w-full h-[5px] rounded-full bg-[var(--border)] relative">
        <div
          className="absolute top-0 bottom-0 rounded-full bg-[#434651] dark:bg-[#787b86]"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={startDrag('min')}
        aria-label="Minimum"
        style={{ left: `${leftPct}%` }}
        className="absolute -translate-x-1/2 w-[13px] h-[13px] rounded-full bg-white border-[1.75px] border-[#131722] dark:border-[#d1d4dc] shadow-xs cursor-ew-resize"
      />
      <button
        type="button"
        disabled={disabled}
        onMouseDown={startDrag('max')}
        aria-label="Maximum"
        style={{ left: `${rightPct}%` }}
        className="absolute -translate-x-1/2 w-[13px] h-[13px] rounded-full bg-white border-[1.75px] border-[#131722] dark:border-[#d1d4dc] shadow-xs cursor-ew-resize"
      />
    </div>
  );
};

export const DrawingSettingsModal: React.FC<DrawingSettingsModalProps> = ({
  open,
  drawing,
  candles,
  interval,
  templates,
  initialTab = 'style',
  onClose,
  onLiveUpdate,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [originalSnapshot, setOriginalSnapshot] = useState<DrawingObject | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTplInput, setShowSaveTplInput] = useState(false);
  const [activePopover, setActivePopover] = useState<
    'none' | 'line' | 'text' | 'stopColor' | 'targetColor'
  >('none');
  const [modalOffset, setModalOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = React.useRef<{
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
    if (open && drawing) {
      const isPos = drawing.type === 'long_pos' || drawing.type === 'short_pos';
      if (isPos) {
        setTab(
          initialTab === 'style' || initialTab === 'visibility' || initialTab === 'inputs'
            ? initialTab
            : 'inputs'
        );
      } else {
        setTab(initialTab === 'inputs' ? 'style' : initialTab);
      }
      setOriginalSnapshot(JSON.parse(JSON.stringify(drawing)));
      setEditingTitle(false);
      setTemplateMenuOpen(false);
      setShowSaveTplInput(false);
      setActivePopover('none');
      setModalOffset({ x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawing?.id, initialTab]);

  if (!open || !drawing) return null;

  const isPositionTool = drawing.type === 'long_pos' || drawing.type === 'short_pos';
  const isLong = drawing.type === 'long_pos';
  const toolDef = ALL_TOOLS_MAP[drawing.type];
  const displayTitle =
    drawing.title ||
    (drawing.type === 'long_pos'
      ? 'Long position'
      : drawing.type === 'short_pos'
      ? 'Short position'
      : toolDef?.label || 'Drawing');

  const visibility: DrawingVisibility = drawing.visibility
    ? {
        ...DEFAULT_VISIBILITY,
        ...drawing.visibility,
        seconds: { ...DEFAULT_VISIBILITY.seconds, ...drawing.visibility.seconds },
        minutes: { ...DEFAULT_VISIBILITY.minutes, ...drawing.visibility.minutes },
        hours: { ...DEFAULT_VISIBILITY.hours, ...drawing.visibility.hours },
        days: { ...DEFAULT_VISIBILITY.days, ...drawing.visibility.days },
        weeks: { ...DEFAULT_VISIBILITY.weeks, ...drawing.visibility.weeks },
        months: { ...DEFAULT_VISIBILITY.months, ...drawing.visibility.months },
      }
    : DEFAULT_VISIBILITY;

  const patch = (partial: Partial<DrawingObject>) => {
    onLiveUpdate({ ...drawing, ...partial });
  };

  const patchVisibility = (partial: Partial<DrawingVisibility>) => {
    patch({ visibility: { ...visibility, ...partial } });
  };

  const handleCancel = () => {
    if (originalSnapshot) {
      onLiveUpdate(originalSnapshot);
    }
    onClose();
  };

  // Convert timestamp <-> bar index for Coordinates tab
  const stepSec = INTERVAL_SECONDS[interval] || 86400;
  const timeToBarIndex = (t: number): number => {
    if (!candles.length) return 0;
    if (t <= candles[0].time) return Math.round((t - candles[0].time) / stepSec);
    const lastIdx = candles.length - 1;
    if (t >= candles[lastIdx].time) {
      return lastIdx + Math.round((t - candles[lastIdx].time) / stepSec);
    }
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const d = Math.abs(candles[i].time - t);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  };

  const barIndexToTime = (idx: number): number => {
    if (!candles.length) return Math.floor(Date.now() / 1000);
    if (idx < 0) return candles[0].time + idx * stepSec;
    if (idx >= candles.length) {
      return candles[candles.length - 1].time + (idx - (candles.length - 1)) * stepSec;
    }
    return candles[idx].time;
  };

  const applyTemplate = (tpl: DrawingTemplate) => {
    patch({
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
    });
    setTemplateMenuOpen(false);
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    onSaveTemplate({
      id: `tpl-${Date.now()}`,
      name,
      color: drawing.color || (isPositionTool ? '#787b86' : '#2962ff'),
      lineWidth: drawing.lineWidth || (isPositionTool ? 1 : 2),
      lineStyle: drawing.lineStyle || 'solid',
      extend: drawing.extend || 'none',
      leftEnd: drawing.leftEnd || 'normal',
      rightEnd: drawing.rightEnd || 'normal',
      showMiddlePoint: Boolean(drawing.showMiddlePoint),
      showPriceLabels: isPositionTool ? drawing.showPriceLabels !== false : Boolean(drawing.showPriceLabels),
      statsMode: drawing.statsMode || (isPositionTool ? 'all' : 'hidden'),
      statsPosition: drawing.statsPosition || 'right',
      alwaysShowStats: Boolean(drawing.alwaysShowStats),
      textColor: drawing.textColor || (isPositionTool ? '#ffffff' : drawing.color || '#2962ff'),
      fontSize: drawing.fontSize || (isPositionTool ? 12 : 14),
      fontBold: Boolean(drawing.fontBold),
      fontItalic: Boolean(drawing.fontItalic),
      textAlignV: drawing.textAlignV || 'top',
      textAlignH: drawing.textAlignH || 'center',
    });
    setNewTemplateName('');
    setShowSaveTplInput(false);
    setTemplateMenuOpen(false);
  };

  const isLineLike = LINE_TOOLS.has(drawing.type);
  const isShapeFill = SHAPE_FILL_TOOLS.has(drawing.type);

  // Position tool derived live values
  const posEntry = drawing.p1?.price ?? 0;
  const posTarget = drawing.targetPrice ?? (isLong ? posEntry * 1.04 : posEntry * 0.96);
  const posStop = drawing.stopPrice ?? (isLong ? posEntry * 0.98 : posEntry * 1.02);
  const posTick = getTickSizeForPrice(posEntry || 100);
  const profitTicks = Math.max(0, Math.round(Math.abs(posTarget - posEntry) / posTick));
  const stopTicks = Math.max(0, Math.round(Math.abs(posEntry - posStop) / posTick));
  const posPriceDecimals = posEntry >= 100 ? 2 : posEntry >= 1 ? 4 : 6;

  const inputCls =
    'h-[34px] px-2.5 rounded-[7px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] font-mono-num text-[13px] outline-none focus:border-[#131722] dark:focus:border-[var(--accent)] transition-colors';

  const tabsList: { id: SettingsTab; label: string }[] = isPositionTool
    ? [
        { id: 'inputs', label: 'Inputs' },
        { id: 'style', label: 'Style' },
        { id: 'visibility', label: 'Visibility' },
      ]
    : [
        { id: 'style', label: 'Style' },
        { id: 'text', label: 'Text' },
        { id: 'coordinates', label: 'Coordinates' },
        { id: 'visibility', label: 'Visibility' },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 select-none pointer-events-none">
      <div
        style={{ transform: `translate3d(${modalOffset.x}px, ${modalOffset.y}px, 0)` }}
        className="pointer-events-auto w-full max-w-[388px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.18)] overflow-visible flex flex-col"
        onClick={(e) => {
          e.stopPropagation();
          if (activePopover !== 'none') setActivePopover('none');
          if (templateMenuOpen) setTemplateMenuOpen(false);
        }}
      >
        {/* Freely Draggable Header (TradingView Hand Grab Cursor) */}
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
          className="px-5 pt-4 pb-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
          title="Drag to move anywhere on chart"
        >
          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                value={drawing.title ?? displayTitle}
                onChange={(e) => patch({ title: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingTitle(false);
                }}
                className="text-base font-bold bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--accent)] rounded-[6px] px-2 py-0.5 outline-none w-52"
              />
            ) : (
              <>
                <h2 className="text-[18px] font-bold tracking-tight text-[var(--text-main)] truncate">
                  {displayTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  title="Rename drawing"
                  className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <Pencil className="w-[15px] h-[15px]" strokeWidth={1.6} />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
        </div>

        {/* Tabs (Clean TradingView inset hairline divider) */}
        <div className="px-5">
          <div className="border-b border-[var(--border)] flex items-center gap-5 text-[13.5px] font-semibold">
            {tabsList.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setActivePopover('none');
                  }}
                  className={`relative pb-2 pt-1 transition-colors cursor-pointer ${
                    active
                      ? 'text-[var(--text-main)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {t.label}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded-t bg-[#131722] dark:bg-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Body (Fits content cleanly — no dead empty whitespace gap!) */}
        <div
          className={`px-5 py-4 text-[13px] space-y-3.5 ${
            tab === 'visibility' || tab === 'coordinates' || tab === 'inputs'
              ? 'max-h-[64vh] overflow-y-auto'
              : 'overflow-visible'
          }`}
        >
          {/* ===== LONG / SHORT POSITION: INPUTS TAB (Exact TradingView Layout) ===== */}
          {tab === 'inputs' && isPositionTool && (
            <div className="space-y-3">
              {/* Account size + Currency */}
              <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">Account size</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={drawing.accountSize ?? 1000}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) patch({ accountSize: Math.max(0, v) });
                  }}
                  className={`${inputCls} w-full`}
                />
                <TvSelect
                  value={drawing.accountCurrency || 'Default'}
                  options={ACCOUNT_CURRENCY_OPTIONS}
                  onChange={(val) => patch({ accountCurrency: val })}
                  className="w-full"
                />
              </div>

              {/* Lot size */}
              <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">Lot size</span>
                <input
                  type="number"
                  step="any"
                  min={0.0001}
                  value={drawing.lotSize ?? 1}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) patch({ lotSize: Math.max(0.0001, v) });
                  }}
                  className={`${inputCls} w-full`}
                />
                <div />
              </div>

              {/* Risk + Unit (% / Currency) */}
              <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">Risk</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={Number((drawing.risk ?? 25).toFixed(2))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) patch({ risk: Math.max(0, v) });
                  }}
                  className={`${inputCls} w-full`}
                />
                <TvSelect
                  value={drawing.riskUnit || '%'}
                  options={[
                    { value: '%', label: '%' },
                    {
                      value: 'currency',
                      label:
                        drawing.accountCurrency && drawing.accountCurrency !== 'Default'
                          ? drawing.accountCurrency
                          : 'USDT',
                    },
                  ]}
                  onChange={(val) => patch({ riskUnit: val as '%' | 'currency' })}
                  className="w-full"
                />
              </div>

              {/* Entry price */}
              <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">Entry price</span>
                <input
                  type="number"
                  step="any"
                  value={Number(posEntry.toFixed(posPriceDecimals))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && drawing.p1 && drawing.p2) {
                      patch({
                        p1: { ...drawing.p1, price: v },
                        p2: { ...drawing.p2, price: v },
                      });
                    }
                  }}
                  className={`${inputCls} w-full`}
                />
                <div />
              </div>

              {/* Leverage */}
              <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">Leverage</span>
                <input
                  type="number"
                  step="any"
                  min={1}
                  value={drawing.leverage ?? 10000}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) patch({ leverage: Math.max(1, v) });
                  }}
                  className={`${inputCls} w-full`}
                />
                <div />
              </div>

              {/* PROFIT LEVEL */}
              <div className="pt-2 space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  PROFIT LEVEL
                </div>
                <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">Ticks</span>
                  <input
                    type="number"
                    step={1}
                    min={1}
                    value={profitTicks}
                    onChange={(e) => {
                      const t = parseInt(e.target.value, 10);
                      if (!Number.isNaN(t) && t >= 0) {
                        const nextTarget = isLong
                          ? posEntry + t * posTick
                          : posEntry - t * posTick;
                        patch({ targetPrice: Number(nextTarget.toFixed(posPriceDecimals)) });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <div />
                </div>
                <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">Price</span>
                  <input
                    type="number"
                    step="any"
                    value={Number(posTarget.toFixed(posPriceDecimals))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) patch({ targetPrice: v });
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <div />
                </div>
              </div>

              {/* STOP LEVEL */}
              <div className="pt-2 space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  STOP LEVEL
                </div>
                <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">Ticks</span>
                  <input
                    type="number"
                    step={1}
                    min={1}
                    value={stopTicks}
                    onChange={(e) => {
                      const t = parseInt(e.target.value, 10);
                      if (!Number.isNaN(t) && t >= 0) {
                        const nextStop = isLong
                          ? posEntry - t * posTick
                          : posEntry + t * posTick;
                        patch({ stopPrice: Number(nextStop.toFixed(posPriceDecimals)) });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <div />
                </div>
                <div className="grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">Price</span>
                  <input
                    type="number"
                    step="any"
                    value={Number(posStop.toFixed(posPriceDecimals))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) patch({ stopPrice: v });
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <div />
                </div>
              </div>

              {/* QTY precision */}
              <div className="pt-1 grid grid-cols-[112px_1fr_1fr] items-center gap-2.5">
                <span className="text-[var(--text-main)]">QTY precision</span>
                <TvSelect
                  value={drawing.qtyPrecision || 'Default'}
                  options={QTY_PRECISION_OPTIONS}
                  onChange={(val) => patch({ qtyPrecision: val })}
                  className="w-full"
                />
                <div />
              </div>
            </div>
          )}

          {/* ===== LONG / SHORT POSITION: STYLE TAB (Exact TradingView Layout) ===== */}
          {tab === 'style' && isPositionTool && (
            <div className="space-y-3.5">
              {/* Lines Row */}
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <span className="text-[var(--text-main)]">Lines</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover((p) => (p === 'line' ? 'none' : 'line'));
                    }}
                    title="Line Color, Thickness & Style"
                    className="h-[34px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] inline-flex items-center gap-2.5 cursor-pointer"
                  >
                    <span
                      className="w-[22px] h-[22px] rounded-[4px] border border-black/15 shrink-0"
                      style={{ backgroundColor: drawing.color || '#787b86' }}
                    />
                    <svg width="32" height="12" viewBox="0 0 32 12" fill="none">
                      <line
                        x1="1"
                        y1="6"
                        x2="31"
                        y2="6"
                        stroke={drawing.color || '#787b86'}
                        strokeWidth={Math.max(1.2, Math.min(3.5, drawing.lineWidth || 1))}
                        strokeDasharray={
                          drawing.lineStyle === 'dashed'
                            ? '6 3'
                            : drawing.lineStyle === 'dotted'
                            ? '2 2.5'
                            : undefined
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {activePopover === 'line' && (
                    <div
                      className="absolute left-0 top-10 z-50 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3 w-[256px] space-y-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ColorPalettePopover
                        inline
                        value={drawing.color || '#787b86'}
                        onChange={(c) => patch({ color: c })}
                        onClose={() => setActivePopover('none')}
                      />
                      <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                        <div className="text-[11px] font-medium text-[var(--text-muted)]">Thickness</div>
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => patch({ lineWidth: w })}
                              className={`h-7 rounded-[5px] border flex items-center justify-center cursor-pointer ${
                                Math.round(drawing.lineWidth || 1) === w
                                  ? 'border-[var(--accent)] bg-[var(--bg-active)]'
                                  : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <span
                                className="w-6 rounded-full bg-[var(--text-main)]"
                                style={{ height: `${w}px` }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                        <div className="text-[11px] font-medium text-[var(--text-muted)]">Line style</div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['solid', 'dashed', 'dotted'] as DrawingLineStyle[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => patch({ lineStyle: st })}
                              className={`h-7 rounded-[5px] border flex items-center justify-center cursor-pointer ${
                                (drawing.lineStyle || 'solid') === st
                                  ? 'border-[var(--accent)] bg-[var(--bg-active)]'
                                  : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <svg width="32" height="6" viewBox="0 0 32 6" fill="none">
                                <line
                                  x1="1"
                                  y1="3"
                                  x2="31"
                                  y2="3"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeDasharray={
                                    st === 'dashed' ? '5 3' : st === 'dotted' ? '2 2.5' : undefined
                                  }
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stop color (checkerboard translucent swatch) */}
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <span className="text-[var(--text-main)]">Stop color</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover((p) => (p === 'stopColor' ? 'none' : 'stopColor'));
                    }}
                    title="Stop zone color & opacity"
                    className="w-[34px] h-[34px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] p-[4px] flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className="w-full h-full rounded-[4px] border border-black/10 relative overflow-hidden block"
                      style={CHECKERBOARD_BG}
                    >
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: drawing.stopColor || 'rgba(242, 54, 69, 0.2)' }}
                      />
                    </span>
                  </button>
                  {activePopover === 'stopColor' && (
                    <ColorPalettePopover
                      align="left"
                      value={drawing.stopColor || 'rgba(242, 54, 69, 0.2)'}
                      onChange={(c) => patch({ stopColor: c })}
                      onClose={() => setActivePopover('none')}
                    />
                  )}
                </div>
              </div>

              {/* Target color (checkerboard translucent swatch) */}
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <span className="text-[var(--text-main)]">Target color</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover((p) => (p === 'targetColor' ? 'none' : 'targetColor'));
                    }}
                    title="Target zone color & opacity"
                    className="w-[34px] h-[34px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] p-[4px] flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className="w-full h-full rounded-[4px] border border-black/10 relative overflow-hidden block"
                      style={CHECKERBOARD_BG}
                    >
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: drawing.targetColor || 'rgba(8, 153, 129, 0.2)' }}
                      />
                    </span>
                  </button>
                  {activePopover === 'targetColor' && (
                    <ColorPalettePopover
                      align="left"
                      value={drawing.targetColor || 'rgba(8, 153, 129, 0.2)'}
                      onChange={(c) => patch({ targetColor: c })}
                      onClose={() => setActivePopover('none')}
                    />
                  )}
                </div>
              </div>

              {/* Text color + Font Size */}
              <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                <span className="text-[var(--text-main)]">Text</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover((p) => (p === 'text' ? 'none' : 'text'));
                      }}
                      title="Stats Text Color"
                      className="w-[34px] h-[34px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] p-[4px] flex items-center justify-center cursor-pointer"
                    >
                      <span
                        className="w-full h-full rounded-[4px] border border-[var(--border)] block"
                        style={{ backgroundColor: drawing.textColor || '#ffffff' }}
                      />
                    </button>
                    {activePopover === 'text' && (
                      <ColorPalettePopover
                        align="left"
                        value={drawing.textColor || '#ffffff'}
                        onChange={(c) => patch({ textColor: c })}
                        onClose={() => setActivePopover('none')}
                      />
                    )}
                  </div>

                  <TvSelect
                    value={drawing.fontSize || 12}
                    options={FONT_SIZE_OPTIONS}
                    onChange={(val) => patch({ fontSize: Number(val) })}
                    mono
                    className="w-[96px]"
                  />
                </div>
              </div>

              {/* Price labels checkbox */}
              <div className="pt-0.5">
                <TvCheckbox
                  checked={drawing.showPriceLabels !== false}
                  onChange={(checked) => patch({ showPriceLabels: checked })}
                  label="Price labels"
                />
              </div>

              {/* INFO Section */}
              <div className="pt-2 space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  INFO
                </div>

                <div className="grid grid-cols-[112px_1fr] items-center gap-3">
                  <span className="text-[var(--text-main)]">Stats</span>
                  <TvSelect
                    value={drawing.statsMode || 'all'}
                    options={[
                      { value: 'all', label: 'TP price offset, TP %, R/R, PnL' },
                      { value: 'price', label: 'TP/SL price offset & %' },
                      { value: 'percent', label: 'Open PnL, Qty & R/R' },
                      { value: 'hidden', label: 'Hidden' },
                    ]}
                    onChange={(val) => patch({ statsMode: val as StatsDisplayMode })}
                    className="w-full"
                  />
                </div>

                <div>
                  <TvCheckbox
                    checked={Boolean(drawing.compactStatsMode)}
                    onChange={(checked) => patch({ compactStatsMode: checked })}
                    label="Compact stats mode"
                  />
                </div>

                <div>
                  <TvCheckbox
                    checked={Boolean(drawing.alwaysShowStats)}
                    onChange={(checked) => patch({ alwaysShowStats: checked })}
                    label="Always show stats"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===== ALL OTHER TOOLS: STYLE TAB ===== */}
          {tab === 'style' && !isPositionTool && (
            <>
              {/* Line Row: Swatch + Line Preview Popover + Left/Right End Caps */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-main)] font-normal">Line</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover((p) => (p === 'line' ? 'none' : 'line'));
                      }}
                      title="Line Color, Thickness & Style"
                      className="h-[34px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className="w-[22px] h-[22px] rounded-[4px] border border-black/15 shrink-0"
                        style={{ backgroundColor: drawing.color || '#2962ff' }}
                      />
                      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                        <line
                          x1="1"
                          y1="6"
                          x2="33"
                          y2="6"
                          stroke={drawing.color || '#2962ff'}
                          strokeWidth={Math.max(1.2, Math.min(3.5, drawing.lineWidth || 2))}
                          strokeDasharray={
                            drawing.lineStyle === 'dashed'
                              ? '6 3'
                              : drawing.lineStyle === 'dotted'
                              ? '2 2.5'
                              : undefined
                          }
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    {activePopover === 'line' && (
                      <div
                        className="absolute right-0 top-10 z-50 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3 w-[256px] space-y-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ColorPalettePopover
                          inline
                          value={drawing.color || '#2962ff'}
                          onChange={(c) => patch({ color: c })}
                          onClose={() => setActivePopover('none')}
                        />
                        <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                          <div className="text-[11px] font-medium text-[var(--text-muted)]">Thickness</div>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => patch({ lineWidth: w })}
                                className={`h-7 rounded-[5px] border flex items-center justify-center cursor-pointer ${
                                  Math.round(drawing.lineWidth || 2) === w
                                    ? 'border-[var(--accent)] bg-[var(--bg-active)]'
                                    : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                <span
                                  className="w-6 rounded-full bg-[var(--text-main)]"
                                  style={{ height: `${w}px` }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                          <div className="text-[11px] font-medium text-[var(--text-muted)]">Line style</div>
                          <div className="grid grid-cols-3 gap-1">
                            {(['solid', 'dashed', 'dotted'] as DrawingLineStyle[]).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => patch({ lineStyle: st })}
                                className={`h-7 rounded-[5px] border flex items-center justify-center cursor-pointer ${
                                  (drawing.lineStyle || 'solid') === st
                                    ? 'border-[var(--accent)] bg-[var(--bg-active)]'
                                    : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                <svg width="32" height="6" viewBox="0 0 32 6" fill="none">
                                  <line
                                    x1="1"
                                    y1="3"
                                    x2="31"
                                    y2="3"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeDasharray={
                                      st === 'dashed' ? '5 3' : st === 'dotted' ? '2 2.5' : undefined
                                    }
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Left / Right End Cap Buttons (Normal vs Arrow) */}
                  {isLineLike && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            leftEnd: (drawing.leftEnd || 'normal') === 'normal' ? 'arrow' : 'normal',
                          })
                        }
                        title={`Left end: ${drawing.leftEnd === 'arrow' ? 'Arrow' : 'Normal'}`}
                        className={`h-[34px] w-[34px] rounded-[6px] border flex items-center justify-center cursor-pointer ${
                          drawing.leftEnd === 'arrow'
                            ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {drawing.leftEnd === 'arrow' ? (
                          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                            <path d="M16 6H3M3 6L7 2.5M3 6L7 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                            <circle cx="4.5" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                            <line x1="6.7" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            rightEnd:
                              (drawing.rightEnd || 'normal') === 'normal' ? 'arrow' : 'normal',
                          })
                        }
                        title={`Right end: ${drawing.rightEnd === 'arrow' ? 'Arrow' : 'Normal'}`}
                        className={`h-[34px] w-[34px] rounded-[6px] border flex items-center justify-center cursor-pointer ${
                          drawing.rightEnd === 'arrow'
                            ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {drawing.rightEnd === 'arrow' ? (
                          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                            <path d="M2 6H15M15 6L11 2.5M15 6L11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                            <line x1="2" y1="6" x2="11.3" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <circle cx="13.5" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Extend Dropdown */}
              {isLineLike && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-main)]">Extend</span>
                  <TvSelect
                    value={
                      drawing.extend ||
                      (drawing.type === 'ray'
                        ? 'right'
                        : drawing.type === 'extended'
                        ? 'both'
                        : 'none')
                    }
                    options={[
                      { value: 'none', label: "Don't extend" },
                      { value: 'left', label: 'Extend left' },
                      { value: 'right', label: 'Extend right' },
                      { value: 'both', label: 'Extend both' },
                    ]}
                    onChange={(val) => patch({ extend: val as LineExtendMode })}
                    className="w-48"
                  />
                </div>
              )}

              {/* Fill Opacity for Shapes & Channels */}
              {isShapeFill && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-main)]">Background opacity</span>
                  <div className="flex items-center gap-2 w-48">
                    <input
                      type="range"
                      min={0}
                      max={70}
                      value={drawing.fillOpacity ?? 14}
                      onChange={(e) => patch({ fillOpacity: parseInt(e.target.value, 10) })}
                      className="flex-1 accent-[#131722] dark:accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="font-mono-num text-xs w-9 text-right text-[var(--text-muted)]">
                      {drawing.fillOpacity ?? 14}%
                    </span>
                  </div>
                </div>
              )}

              {/* Middle Point & Price Labels */}
              {isLineLike && (
                <div>
                  <TvCheckbox
                    checked={Boolean(drawing.showMiddlePoint)}
                    onChange={(checked) => patch({ showMiddlePoint: checked })}
                    label="Middle point"
                  />
                </div>
              )}

              <div>
                <TvCheckbox
                  checked={
                    drawing.type === 'hline' || drawing.type === 'hray' || drawing.type === 'crossline'
                      ? drawing.showPriceLabels !== false
                      : Boolean(drawing.showPriceLabels)
                  }
                  onChange={(checked) => patch({ showPriceLabels: checked })}
                  label={
                    drawing.type === 'hline' || drawing.type === 'hray'
                      ? 'Price label'
                      : 'Price labels'
                  }
                />
              </div>

              {/* INFO STATS SECTION */}
              {isLineLike && (
                <div className="pt-2.5 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    INFO
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-main)]">Stats</span>
                    <TvSelect
                      value={
                        drawing.statsMode || (drawing.type === 'infoline' ? 'all' : 'hidden')
                      }
                      options={[
                        { value: 'hidden', label: 'Hidden' },
                        { value: 'price', label: 'Price range' },
                        { value: 'percent', label: 'Percent change' },
                        { value: 'bars', label: 'Bars & duration' },
                        { value: 'all', label: 'All stats' },
                      ]}
                      onChange={(val) => patch({ statsMode: val as StatsDisplayMode })}
                      className="w-48"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-main)]">Stats position</span>
                    <TvSelect
                      value={drawing.statsPosition || 'right'}
                      options={[
                        { value: 'left', label: 'Left' },
                        { value: 'center', label: 'Center' },
                        { value: 'right', label: 'Right' },
                      ]}
                      onChange={(val) => patch({ statsPosition: val as StatsPosition })}
                      className="w-48"
                    />
                  </div>

                  <div>
                    <TvCheckbox
                      checked={
                        drawing.type === 'infoline'
                          ? drawing.alwaysShowStats !== false
                          : Boolean(drawing.alwaysShowStats)
                      }
                      onChange={(checked) => patch({ alwaysShowStats: checked })}
                      label="Always show stats"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== TEXT TAB (Non-Position Tools) ===== */}
          {tab === 'text' && !isPositionTool && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                {/* Text Color Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover((p) => (p === 'text' ? 'none' : 'text'));
                    }}
                    className="w-[34px] h-[34px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)] p-[4px] flex items-center justify-center cursor-pointer"
                    title="Text Color"
                  >
                    <span
                      className="w-full h-full rounded-[4px] border border-black/10 block"
                      style={{ backgroundColor: drawing.textColor || drawing.color || '#2962ff' }}
                    />
                  </button>
                  {activePopover === 'text' && (
                    <ColorPalettePopover
                      align="left"
                      value={drawing.textColor || drawing.color || '#2962ff'}
                      onChange={(c) => patch({ textColor: c })}
                      onClose={() => setActivePopover('none')}
                    />
                  )}
                </div>

                {/* Font Size */}
                <TvSelect
                  value={drawing.fontSize || (drawing.type === 'hline' ? 12 : 14)}
                  options={FONT_SIZE_OPTIONS}
                  onChange={(val) => patch({ fontSize: Number(val) })}
                  mono
                  className="w-[96px]"
                />

                {/* Bold */}
                <button
                  type="button"
                  onClick={() => patch({ fontBold: !drawing.fontBold })}
                  className={`w-[34px] h-[34px] rounded-[7px] border font-bold text-sm cursor-pointer ${
                    drawing.fontBold
                      ? 'border-[#131722] dark:border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  B
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => patch({ fontItalic: !drawing.fontItalic })}
                  className={`w-[34px] h-[34px] rounded-[7px] border italic font-serif text-sm cursor-pointer ${
                    drawing.fontItalic
                      ? 'border-[#131722] dark:border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  I
                </button>
              </div>

              <textarea
                rows={3}
                value={drawing.text || ''}
                onChange={(e) => patch({ text: e.target.value })}
                placeholder="Add text"
                className="w-full h-[88px] p-2.5 rounded-[8px] border border-[var(--border)] focus:border-[#131722] dark:focus:border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-main)] text-[13.5px] outline-none resize-none"
              />

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[var(--text-main)]">Text alignment</span>
                <div className="flex items-center gap-2">
                  <TvSelect
                    value={
                      drawing.textAlignV ||
                      (drawing.type === 'hline' || drawing.type === 'rect' || drawing.type === 'ellipse'
                        ? 'middle'
                        : 'top')
                    }
                    options={[
                      { value: 'top', label: 'Top' },
                      { value: 'middle', label: 'Middle' },
                      { value: 'bottom', label: 'Bottom' },
                    ]}
                    onChange={(val) => patch({ textAlignV: val as TextAlignV })}
                    className="w-[104px]"
                  />
                  <TvSelect
                    value={drawing.textAlignH || 'center'}
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                    onChange={(val) => patch({ textAlignH: val as TextAlignH })}
                    className="w-[104px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===== COORDINATES TAB (Non-Position Tools) ===== */}
          {tab === 'coordinates' && !isPositionTool && (
            <div className="space-y-3">
              {drawing.price !== undefined && (
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <span className="text-[var(--text-main)]">#1 (price)</span>
                  <input
                    type="number"
                    step="any"
                    value={drawing.price}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) patch({ price: v });
                    }}
                    className={`${inputCls} w-full`}
                  />
                </div>
              )}

              {drawing.time !== undefined && (
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <span className="text-[var(--text-main)]">#1 (bar)</span>
                  <input
                    type="number"
                    step={1}
                    value={timeToBarIndex(drawing.time)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) patch({ time: barIndexToTime(v) });
                    }}
                    className={`${inputCls} w-full`}
                  />
                </div>
              )}

              {drawing.p1 && (
                <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">#1 (price, bar)</span>
                  <input
                    type="number"
                    step="any"
                    value={Number(drawing.p1.price.toFixed(6))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && drawing.p1) {
                        patch({ p1: { ...drawing.p1, price: v } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <input
                    type="number"
                    step={1}
                    value={timeToBarIndex(drawing.p1.time)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && drawing.p1) {
                        patch({ p1: { ...drawing.p1, time: barIndexToTime(v) } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                </div>
              )}

              {drawing.p2 && (
                <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">#2 (price, bar)</span>
                  <input
                    type="number"
                    step="any"
                    value={Number(drawing.p2.price.toFixed(6))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && drawing.p2) {
                        patch({ p2: { ...drawing.p2, price: v } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <input
                    type="number"
                    step={1}
                    value={timeToBarIndex(drawing.p2.time)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && drawing.p2) {
                        patch({ p2: { ...drawing.p2, time: barIndexToTime(v) } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                </div>
              )}

              {drawing.p3 && (
                <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-2.5">
                  <span className="text-[var(--text-main)]">#3 (price, bar)</span>
                  <input
                    type="number"
                    step="any"
                    value={Number(drawing.p3.price.toFixed(6))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && drawing.p3) {
                        patch({ p3: { ...drawing.p3, price: v } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                  <input
                    type="number"
                    step={1}
                    value={timeToBarIndex(drawing.p3.time)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && drawing.p3) {
                        patch({ p3: { ...drawing.p3, time: barIndexToTime(v) } });
                      }
                    }}
                    className={`${inputCls} w-full`}
                  />
                </div>
              )}
            </div>
          )}

          {/* ===== VISIBILITY TAB (Shared across ALL tools — matches Screenshot 4) ===== */}
          {tab === 'visibility' && (
            <div className="space-y-3">
              <div>
                <TvCheckbox
                  checked={visibility.ticks}
                  onChange={(checked) => patchVisibility({ ticks: checked })}
                  label="Ticks"
                />
              </div>

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
                    className="grid grid-cols-[96px_66px_1fr_66px] items-center gap-2"
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

                    <VisibilityDualSlider
                      minLimit={1}
                      maxLimit={row.maxLimit}
                      minVal={rng.min}
                      maxVal={rng.max}
                      disabled={!rng.enabled}
                      onChange={(nextMin, nextMax) =>
                        patchVisibility({
                          [row.key]: { ...rng, min: nextMin, max: nextMax },
                        })
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

        {/* Footer: Template ⌄ | Cancel | Ok */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-2 bg-[var(--bg-surface)] rounded-b-[12px]">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTemplateMenuOpen((v) => !v);
              }}
              className="h-[34px] px-3 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Template</span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>

            {templateMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 bottom-10 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-40 text-xs"
              >
                {showSaveTplInput ? (
                  <form onSubmit={handleCreateTemplate} className="px-2 py-1 flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
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
                    onClick={() => setShowSaveTplInput(true)}
                    className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium cursor-pointer"
                  >
                    Save As...
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isPositionTool) {
                      patch({
                        color: '#787b86',
                        lineWidth: 1,
                        lineStyle: 'solid',
                        stopColor: 'rgba(242, 54, 69, 0.2)',
                        targetColor: 'rgba(8, 153, 129, 0.2)',
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
                        visibility: DEFAULT_VISIBILITY,
                      });
                    } else {
                      patch({
                        color: '#2962ff',
                        lineWidth: 2,
                        lineStyle: 'solid',
                        extend: 'none',
                        leftEnd: 'normal',
                        rightEnd: 'normal',
                        showMiddlePoint: false,
                        showPriceLabels: drawing.type === 'hline' || drawing.type === 'hray',
                        statsMode: 'hidden',
                        alwaysShowStats: false,
                        visibility: DEFAULT_VISIBILITY,
                      });
                    }
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Apply Defaults
                </button>

                {templates.length > 0 && (
                  <div className="border-t border-[var(--border)] mt-1 pt-1">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="px-3 py-1.5 hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => applyTemplate(tpl)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tpl.color }}
                          />
                          <span className="truncate text-[var(--text-main)]">{tpl.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTemplate(tpl.id);
                          }}
                          className="text-[var(--text-muted)] hover:text-[var(--down)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="h-[34px] px-4 rounded-[8px] border border-[#131722] dark:border-[var(--border)] bg-[var(--bg-surface)] text-[13px] font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-[34px] px-5 rounded-[8px] bg-[#131722] dark:bg-white text-white dark:text-[#131722] text-[13px] font-semibold hover:opacity-90 cursor-pointer"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
