import React, { useState, useEffect } from 'react';
import { X, Pencil, ChevronDown, Trash2 } from 'lucide-react';
import {
  CandleBar,
  DrawingLineStyle,
  DrawingObject,
  DrawingTemplate,
  DrawingVisibility,
  LineEndCap,
  LineExtendMode,
  StatsDisplayMode,
  StatsPosition,
  TextAlignH,
  TextAlignV,
  Timeframe,
} from '../types/trading';
import { ALL_TOOLS_MAP } from '../utils/drawingToolsCatalog';
import { DEFAULT_VISIBILITY } from '../utils/storage';
import { INTERVAL_SECONDS } from '../utils/binance';
import { ColorPalettePopover } from './ColorPalettePopover';

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

export type SettingsTab = 'style' | 'text' | 'coordinates' | 'visibility';

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24];

const LINE_TOOLS = new Set(['trendline', 'ray', 'infoline', 'extended', 'angle', 'arrow_line']);
const SHAPE_FILL_TOOLS = new Set([
  'rect',
  'ellipse',
  'triangle',
  'channel',
  'flat_channel',
  'disjoint_channel',
]);

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
  const [lineColorPickerOpen, setLineColorPickerOpen] = useState(false);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);

  useEffect(() => {
    if (open && drawing) {
      setTab(initialTab);
      setOriginalSnapshot(JSON.parse(JSON.stringify(drawing)));
      setEditingTitle(false);
      setTemplateMenuOpen(false);
      setShowSaveTplInput(false);
      setLineColorPickerOpen(false);
      setTextColorPickerOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawing?.id, initialTab]);

  if (!open || !drawing) return null;

  const toolDef = ALL_TOOLS_MAP[drawing.type];
  const displayTitle = drawing.title || toolDef?.label || 'Drawing';
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
      color: drawing.color || '#2962ff',
      lineWidth: drawing.lineWidth || 2,
      lineStyle: drawing.lineStyle || 'solid',
      extend: drawing.extend || 'none',
      leftEnd: drawing.leftEnd || 'normal',
      rightEnd: drawing.rightEnd || 'normal',
      showMiddlePoint: Boolean(drawing.showMiddlePoint),
      showPriceLabels: Boolean(drawing.showPriceLabels),
      statsMode: drawing.statsMode || 'hidden',
      statsPosition: drawing.statsPosition || 'right',
      alwaysShowStats: Boolean(drawing.alwaysShowStats),
      textColor: drawing.textColor || drawing.color || '#2962ff',
      fontSize: drawing.fontSize || 14,
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

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 select-none"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-[420px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-visible flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
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
                className="text-base font-bold bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--accent)] rounded px-2 py-0.5 outline-none w-52"
              />
            ) : (
              <>
                <h2 className="text-[17px] font-bold text-[var(--text-main)] truncate">
                  {displayTitle}
                </h2>
                <button
                  onClick={() => setEditingTitle(true)}
                  title="Rename drawing"
                  className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Tabs */}
        <div className="px-5 border-b border-[var(--border)] flex items-center gap-5 text-[13px] font-semibold">
          {(
            [
              { id: 'style', label: 'Style' },
              { id: 'text', label: 'Text' },
              { id: 'coordinates', label: 'Coordinates' },
              { id: 'visibility', label: 'Visibility' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2.5 border-b-2 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'border-[var(--text-main)] text-[var(--text-main)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div
          className={`px-5 py-4 min-h-[290px] text-[13px] space-y-3.5 ${
            tab === 'visibility' || tab === 'coordinates'
              ? 'max-h-[60vh] overflow-y-auto'
              : 'overflow-visible'
          }`}
        >
          {/* ===== TAB 1: STYLE ===== */}
          {tab === 'style' && (
            <>
              {/* Line Row: Color + Width + Style + Left/Right End Caps */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-main)] font-medium">Line</span>
                <div className="flex items-center gap-2">
                  {/* Color + Width + Style Pill */}
                  <div className="relative flex items-center gap-1.5 h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-app)]">
                    <button
                      type="button"
                      onClick={() => setLineColorPickerOpen((v) => !v)}
                      className="w-5 h-5 rounded border border-black/15 cursor-pointer shrink-0"
                      style={{ backgroundColor: drawing.color || '#2962ff' }}
                      title="Line Color"
                    />
                    <select
                      value={Math.round(drawing.lineWidth || 2)}
                      onChange={(e) => patch({ lineWidth: parseInt(e.target.value, 10) })}
                      className="bg-transparent text-xs font-mono-num text-[var(--text-main)] outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4].map((w) => (
                        <option key={w} value={w} className="bg-[var(--bg-surface)]">
                          {w}px
                        </option>
                      ))}
                    </select>
                    <select
                      value={drawing.lineStyle || 'solid'}
                      onChange={(e) => patch({ lineStyle: e.target.value as DrawingLineStyle })}
                      className="bg-transparent text-xs text-[var(--text-main)] outline-none cursor-pointer"
                    >
                      <option value="solid" className="bg-[var(--bg-surface)]">
                        Solid
                      </option>
                      <option value="dashed" className="bg-[var(--bg-surface)]">
                        Dashed
                      </option>
                      <option value="dotted" className="bg-[var(--bg-surface)]">
                        Dotted
                      </option>
                    </select>

                    {lineColorPickerOpen && (
                      <ColorPalettePopover
                        align="right"
                        value={drawing.color || '#2962ff'}
                        onChange={(c) => patch({ color: c })}
                        onClose={() => setLineColorPickerOpen(false)}
                      />
                    )}
                  </div>

                  {/* Left / Right End Cap Buttons (Normal vs Arrow — exact TradingView SVG) */}
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
                        className={`h-8 w-8 rounded-md border flex items-center justify-center cursor-pointer ${
                          drawing.leftEnd === 'arrow'
                            ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
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
                        className={`h-8 w-8 rounded-md border flex items-center justify-center cursor-pointer ${
                          drawing.rightEnd === 'arrow'
                            ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
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

              {/* Extend Dropdown (for Trendline / Ray / Info Line / Extended) */}
              {isLineLike && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-main)]">Extend</span>
                  <select
                    value={
                      drawing.extend ||
                      (drawing.type === 'ray'
                        ? 'right'
                        : drawing.type === 'extended'
                        ? 'both'
                        : 'none')
                    }
                    onChange={(e) => patch({ extend: e.target.value as LineExtendMode })}
                    className="w-48 h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="none" className="bg-[var(--bg-surface)]">
                      Don&apos;t extend
                    </option>
                    <option value="left" className="bg-[var(--bg-surface)]">
                      Extend left
                    </option>
                    <option value="right" className="bg-[var(--bg-surface)]">
                      Extend right
                    </option>
                    <option value="both" className="bg-[var(--bg-surface)]">
                      Extend both
                    </option>
                  </select>
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
                      className="flex-1 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="font-mono-num text-xs w-9 text-right text-[var(--text-muted)]">
                      {drawing.fillOpacity ?? 14}%
                    </span>
                  </div>
                </div>
              )}

              {/* Middle Point & Price Labels Checkboxes */}
              {isLineLike && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(drawing.showMiddlePoint)}
                    onChange={(e) => patch({ showMiddlePoint: e.target.checked })}
                    className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)] rounded"
                  />
                  <span className="text-[var(--text-main)]">Middle point</span>
                </label>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    drawing.type === 'hline' || drawing.type === 'hray' || drawing.type === 'crossline'
                      ? drawing.showPriceLabels !== false
                      : Boolean(drawing.showPriceLabels)
                  }
                  onChange={(e) => patch({ showPriceLabels: e.target.checked })}
                  className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)] rounded"
                />
                <span className="text-[var(--text-main)]">Price labels</span>
              </label>

              {/* INFO STATS SECTION */}
              {isLineLike && (
                <div className="pt-2 border-t border-[var(--border)] space-y-3">
                  <div className="text-[11px] font-bold tracking-wider text-[var(--text-muted)]">
                    INFO
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-main)]">Stats</span>
                    <select
                      value={
                        drawing.statsMode || (drawing.type === 'infoline' ? 'all' : 'hidden')
                      }
                      onChange={(e) => patch({ statsMode: e.target.value as StatsDisplayMode })}
                      className="w-48 h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none cursor-pointer"
                    >
                      <option value="hidden" className="bg-[var(--bg-surface)]">
                        Hidden
                      </option>
                      <option value="price" className="bg-[var(--bg-surface)]">
                        Price range
                      </option>
                      <option value="percent" className="bg-[var(--bg-surface)]">
                        Percent change
                      </option>
                      <option value="bars" className="bg-[var(--bg-surface)]">
                        Bars &amp; duration
                      </option>
                      <option value="all" className="bg-[var(--bg-surface)]">
                        All stats
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-main)]">Stats position</span>
                    <select
                      value={drawing.statsPosition || 'right'}
                      onChange={(e) => patch({ statsPosition: e.target.value as StatsPosition })}
                      className="w-48 h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none cursor-pointer"
                    >
                      <option value="left" className="bg-[var(--bg-surface)]">
                        Left
                      </option>
                      <option value="center" className="bg-[var(--bg-surface)]">
                        Center
                      </option>
                      <option value="right" className="bg-[var(--bg-surface)]">
                        Right
                      </option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        drawing.type === 'infoline'
                          ? drawing.alwaysShowStats !== false
                          : Boolean(drawing.alwaysShowStats)
                      }
                      onChange={(e) => patch({ alwaysShowStats: e.target.checked })}
                      className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)] rounded"
                    />
                    <span className="text-[var(--text-main)]">Always show stats</span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* ===== TAB 2: TEXT ===== */}
          {tab === 'text' && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                {/* Text Color Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTextColorPickerOpen((v) => !v)}
                    className="w-8 h-8 rounded-md border border-[var(--border)] bg-[var(--bg-app)] flex items-center justify-center cursor-pointer"
                    title="Text Color"
                  >
                    <span
                      className="w-5 h-5 rounded"
                      style={{ backgroundColor: drawing.textColor || drawing.color || '#2962ff' }}
                    />
                  </button>
                  {textColorPickerOpen && (
                    <ColorPalettePopover
                      align="left"
                      value={drawing.textColor || drawing.color || '#2962ff'}
                      onChange={(c) => patch({ textColor: c })}
                      onClose={() => setTextColorPickerOpen(false)}
                    />
                  )}
                </div>

                {/* Font Size */}
                <select
                  value={drawing.fontSize || 14}
                  onChange={(e) => patch({ fontSize: parseInt(e.target.value, 10) })}
                  className="h-8 w-20 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs font-mono-num outline-none cursor-pointer"
                >
                  {FONT_SIZES.map((sz) => (
                    <option key={sz} value={sz} className="bg-[var(--bg-surface)]">
                      {sz}
                    </option>
                  ))}
                </select>

                {/* Bold */}
                <button
                  type="button"
                  onClick={() => patch({ fontBold: !drawing.fontBold })}
                  className={`w-8 h-8 rounded-md border font-bold text-sm cursor-pointer ${
                    drawing.fontBold
                      ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  B
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => patch({ fontItalic: !drawing.fontItalic })}
                  className={`w-8 h-8 rounded-md border italic font-serif text-sm cursor-pointer ${
                    drawing.fontItalic
                      ? 'border-[var(--accent)] bg-[var(--bg-active)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  I
                </button>
              </div>

              <textarea
                rows={4}
                value={drawing.text || ''}
                onChange={(e) => patch({ text: e.target.value })}
                placeholder="Add text"
                className="w-full p-2.5 rounded-lg border border-[var(--border)] focus:border-[var(--accent)] bg-[var(--bg-app)] text-[var(--text-main)] text-sm outline-none resize-none"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-main)]">Text alignment</span>
                <div className="flex items-center gap-2">
                  <select
                    value={drawing.textAlignV || 'top'}
                    onChange={(e) => patch({ textAlignV: e.target.value as TextAlignV })}
                    className="h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none cursor-pointer"
                  >
                    <option value="top" className="bg-[var(--bg-surface)]">
                      Top
                    </option>
                    <option value="middle" className="bg-[var(--bg-surface)]">
                      Middle
                    </option>
                    <option value="bottom" className="bg-[var(--bg-surface)]">
                      Bottom
                    </option>
                  </select>
                  <select
                    value={drawing.textAlignH || 'center'}
                    onChange={(e) => patch({ textAlignH: e.target.value as TextAlignH })}
                    className="h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] text-xs outline-none cursor-pointer"
                  >
                    <option value="left" className="bg-[var(--bg-surface)]">
                      Left
                    </option>
                    <option value="center" className="bg-[var(--bg-surface)]">
                      Center
                    </option>
                    <option value="right" className="bg-[var(--bg-surface)]">
                      Right
                    </option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ===== TAB 3: COORDINATES ===== */}
          {tab === 'coordinates' && (
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
                    className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
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
                    className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}

              {(drawing.type === 'long_pos' || drawing.type === 'short_pos') && (
                <>
                  <div className="grid grid-cols-[120px_1fr] items-center gap-2.5">
                    <span className="text-[var(--up)] font-medium">Profit target</span>
                    <input
                      type="number"
                      step="any"
                      value={Number((drawing.targetPrice || 0).toFixed(6))}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v)) patch({ targetPrice: v });
                      }}
                      className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--up)]"
                    />
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center gap-2.5">
                    <span className="text-[var(--down)] font-medium">Stop loss</span>
                    <input
                      type="number"
                      step="any"
                      value={Number((drawing.stopPrice || 0).toFixed(6))}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v)) patch({ stopPrice: v });
                      }}
                      className="h-9 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--down)]"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== TAB 4: VISIBILITY ===== */}
          {tab === 'visibility' && (
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility.ticks}
                  onChange={(e) => patchVisibility({ ticks: e.target.checked })}
                  className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)]"
                />
                <span className="text-[var(--text-main)]">Ticks</span>
              </label>

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
                    className="grid grid-cols-[95px_64px_1fr_64px] items-center gap-2"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rng.enabled}
                        onChange={(e) =>
                          patchVisibility({ [row.key]: { ...rng, enabled: e.target.checked } })
                        }
                        className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)]"
                      />
                      <span className="text-[var(--text-main)] text-xs">{row.label}</span>
                    </label>

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
                      className="h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs disabled:opacity-40"
                    />

                    {/* Interactive Dual-Thumb Range Slider (matches TradingView Visibility tab) */}
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
                      className="h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs disabled:opacity-40"
                    />
                  </div>
                );
              })}

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility.ranges}
                  onChange={(e) => patchVisibility({ ranges: e.target.checked })}
                  className="w-4 h-4 accent-[#131722] dark:accent-[var(--accent)]"
                />
                <span className="text-[var(--text-main)]">Ranges</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer: Template ⌄ | Cancel | Ok */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-2 bg-[var(--bg-elevated)] rounded-b-xl">
          {/* Template Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((v) => !v)}
              className="h-8 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Template</span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>

            {templateMenuOpen && (
              <div className="absolute left-0 bottom-10 w-56 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-40 text-xs">
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
                    patch({
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
                    });
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
              className="h-8 px-4 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-5 rounded-md bg-[#131722] dark:bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
