import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import {
  DrawingLineStyle,
  DrawingObject,
  FibLevelConfig,
  LineExtendMode,
  TextAlignH,
  TextAlignV,
} from '../types/trading';
import { getEffectiveFibLevels } from '../utils/drawingRenderer';
import { ColorPalettePopover } from './ColorPalettePopover';
import { TvSelect } from './TvSelect';

interface FibSettingsStyleTabProps {
  drawing: DrawingObject;
  onPatch: (partial: Partial<DrawingObject>) => void;
}

const FIB_FONT_SIZE_OPTIONS = [8, 10, 11, 12, 14, 16, 18, 20, 22, 24].map((sz) => ({
  value: sz,
  label: String(sz),
}));

const CHECKERBOARD_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #d1d4dc 25%, transparent 25%), linear-gradient(-45deg, #d1d4dc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d4dc 75%), linear-gradient(-45deg, transparent 75%, #d1d4dc 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
  backgroundColor: '#ffffff',
};

const FibCheckbox: React.FC<{
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

const LineStylePreview: React.FC<{
  style: DrawingLineStyle;
  width?: number;
  className?: string;
}> = ({ style, width = 1.6, className = 'w-7 h-3' }) => (
  <svg viewBox="0 0 36 12" className={className} fill="none" stroke="currentColor" aria-hidden="true">
    <line
      x1="1"
      y1="6"
      x2="35"
      y2="6"
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={style === 'dashed' ? '5 3.5' : style === 'dotted' ? '1.5 3.5' : undefined}
    />
  </svg>
);

type PopoverState =
  | null
  | {
      kind: 'trendLine' | 'levelsWidth' | 'levelsStyle' | 'extend' | 'oneColor' | 'levelColor';
      levelIndex?: number;
      top: number;
      left: number;
      minWidth?: number;
    };

function computePortalCoords(
  el: HTMLElement,
  popW: number,
  popH: number
): { top: number; left: number; minWidth: number } {
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const openUp = spaceBelow < popH && rect.top > spaceBelow;
  const top = openUp
    ? Math.max(8, rect.top - popH - 5)
    : Math.min(window.innerHeight - popH - 8, rect.bottom + 5);
  const left = Math.max(8, Math.min(window.innerWidth - popW - 8, rect.left));
  return { top, left, minWidth: rect.width };
}

export const FibSettingsStyleTab: React.FC<FibSettingsStyleTabProps> = ({ drawing, onPatch }) => {
  const [popover, setPopover] = useState<PopoverState>(null);
  const popoverElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverElRef.current?.contains(target)) return;
      if ((target as HTMLElement)?.closest?.('[data-fib-pop-trigger]')) return;
      setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPopover(null);
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [popover]);

  const levels: FibLevelConfig[] = getEffectiveFibLevels(drawing);
  const trendEnabled = drawing.fibTrendLineEnabled !== false;
  const trendColor = drawing.fibTrendLineColor || '#787b86';
  const trendWidth = drawing.fibTrendLineWidth || 1;
  const trendStyle: DrawingLineStyle = drawing.fibTrendLineStyle || 'dashed';

  const levelsWidth = drawing.lineWidth || 1;
  const levelsStyle: DrawingLineStyle = drawing.lineStyle || 'solid';

  const extLeft = drawing.extend === 'left' || drawing.extend === 'both';
  const extRight = drawing.extend === 'right' || drawing.extend === 'both';
  const extendLabel =
    extLeft && extRight
      ? 'Extend both'
      : extLeft
      ? 'Extend lines left'
      : extRight
      ? 'Extend lines right'
      : "Don't extend";

  const setExtendFlags = (nextLeft: boolean, nextRight: boolean) => {
    const next: LineExtendMode =
      nextLeft && nextRight ? 'both' : nextLeft ? 'left' : nextRight ? 'right' : 'none';
    onPatch({ extend: next });
  };

  const updateLevel = (idx: number, partial: Partial<FibLevelConfig>) => {
    const next = levels.map((lvl, i) => (i === idx ? { ...lvl, ...partial } : lvl));
    onPatch({ fibLevels: next });
  };

  const bgEnabled = drawing.fibBackgroundEnabled !== false;
  const bgOpacity = drawing.fibBackgroundOpacity ?? 12;

  const openPopover = (
    kind: NonNullable<PopoverState>['kind'],
    el: HTMLElement,
    popW: number,
    popH: number,
    levelIndex?: number
  ) => {
    if (popover && popover.kind === kind && popover.levelIndex === levelIndex) {
      setPopover(null);
      return;
    }
    const { top, left, minWidth } = computePortalCoords(el, popW, popH);
    setPopover({ kind, levelIndex, top, left, minWidth });
  };

  const isTrendOpen = popover?.kind === 'trendLine';
  const isLvlWidthOpen = popover?.kind === 'levelsWidth';
  const isLvlStyleOpen = popover?.kind === 'levelsStyle';
  const isExtendOpen = popover?.kind === 'extend';
  const isOneColorOpen = popover?.kind === 'oneColor';

  return (
    <div className="space-y-3 text-[13px]">
      {/* 1. Trend line: [✓] Trend line   [ ■ ---- ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <FibCheckbox
          checked={trendEnabled}
          onChange={(v) => onPatch({ fibTrendLineEnabled: v })}
          label="Trend line"
        />
        <div className="flex items-center">
          <button
            type="button"
            data-fib-pop-trigger="true"
            disabled={!trendEnabled}
            onClick={(e) => openPopover('trendLine', e.currentTarget, 266, 420)}
            className={`h-[34px] px-2 rounded-[7px] border bg-[var(--bg-surface)] inline-flex items-center gap-2 transition-colors ${
              !trendEnabled
                ? 'opacity-40 cursor-not-allowed border-[var(--border)]'
                : isTrendOpen
                ? 'border-[#2962ff] ring-1 ring-[#2962ff]/25 cursor-pointer'
                : 'border-[var(--border)] hover:border-[#9598a1] cursor-pointer'
            }`}
            title="Trend line color, opacity, thickness & style"
          >
            <span
              className="w-[20px] h-[20px] rounded-[4px] border border-black/10 shrink-0"
              style={{ backgroundColor: trendColor }}
            />
            <LineStylePreview
              style={trendStyle}
              width={Math.min(3, trendWidth + 0.5)}
              className="w-7 h-3 text-[var(--text-muted)]"
            />
          </button>
        </div>
      </div>

      {/* 2. Levels line: [ ——— ] [ — ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <span className="text-[var(--text-main)]">Levels line</span>
        <div className="flex items-center gap-2">
          {/* Thickness button */}
          <button
            type="button"
            data-fib-pop-trigger="true"
            onClick={(e) => openPopover('levelsWidth', e.currentTarget, 92, 166)}
            title="Levels line thickness"
            className={`h-[34px] w-[72px] px-2.5 rounded-[7px] border bg-[var(--bg-surface)] inline-flex items-center justify-center transition-colors cursor-pointer ${
              isLvlWidthOpen
                ? 'border-[#2962ff] ring-1 ring-[#2962ff]/25'
                : 'border-[var(--border)] hover:border-[#9598a1]'
            }`}
          >
            <span
              className="w-full rounded-full bg-[var(--text-main)] block"
              style={{ height: `${levelsWidth}px` }}
            />
          </button>

          {/* Line style button */}
          <button
            type="button"
            data-fib-pop-trigger="true"
            onClick={(e) => openPopover('levelsStyle', e.currentTarget, 148, 128)}
            title="Levels line style"
            className={`h-[34px] w-[36px] px-1.5 rounded-[7px] border bg-[var(--bg-surface)] inline-flex items-center justify-center text-[var(--text-main)] transition-colors cursor-pointer ${
              isLvlStyleOpen
                ? 'border-[#2962ff] ring-1 ring-[#2962ff]/25'
                : 'border-[var(--border)] hover:border-[#9598a1]'
            }`}
          >
            <LineStylePreview style={levelsStyle} width={1.6} className="w-5 h-3" />
          </button>
        </div>
      </div>

      {/* 3. Extend: [ Don't extend ⌄ ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <span className="text-[var(--text-main)]">Extend</span>
        <div>
          <button
            type="button"
            data-fib-pop-trigger="true"
            onClick={(e) => openPopover('extend', e.currentTarget, 178, 86)}
            className={`h-[34px] w-[166px] px-2.5 rounded-[7px] border bg-[var(--bg-surface)] text-[13px] text-[var(--text-main)] inline-flex items-center justify-between gap-2 transition-colors cursor-pointer ${
              isExtendOpen
                ? 'border-[#131722] dark:border-[#d1d4dc]'
                : 'border-[var(--border)] hover:border-[#9598a1]'
            }`}
          >
            <span className="truncate">{extendLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${
                isExtendOpen ? 'rotate-180 text-[var(--text-main)]' : ''
              }`}
              strokeWidth={1.7}
            />
          </button>
        </div>
      </div>

      {/* 4. Exact 24 Fibonacci Levels — 2-Column Grid (12 rows × 2 columns) */}
      <div className="pt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {levels.map((lvl, idx) => {
          const isColorOpen = popover?.kind === 'levelColor' && popover.levelIndex === idx;
          return (
            <div key={idx} className="flex items-center gap-2 min-w-0">
              <FibCheckbox
                checked={lvl.enabled}
                onChange={(v) => updateLevel(idx, { enabled: v })}
              />
              <input
                type="number"
                step="any"
                value={lvl.ratio}
                disabled={!lvl.enabled}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) updateLevel(idx, { ratio: v });
                }}
                className={`h-[34px] flex-1 min-w-0 px-2.5 rounded-[7px] border font-mono-num text-[13px] outline-none transition-colors ${
                  lvl.enabled
                    ? 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-main)] focus:border-[#2962ff]'
                    : 'border-transparent bg-[#f0f3fa] dark:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-default'
                }`}
              />
              <button
                type="button"
                data-fib-pop-trigger="true"
                onClick={(e) => openPopover('levelColor', e.currentTarget, 266, 336, idx)}
                title={`Level ${lvl.ratio} color`}
                className={`w-[34px] h-[34px] rounded-[7px] border bg-[var(--bg-surface)] p-[5px] flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  isColorOpen
                    ? 'border-[#2962ff] ring-1 ring-[#2962ff]/25'
                    : 'border-[var(--border)] hover:border-[#9598a1]'
                }`}
              >
                <span
                  className="w-full h-full rounded-[4px] border border-black/10 transition-opacity"
                  style={{
                    backgroundColor: lvl.color,
                    opacity: lvl.enabled ? 1 : 0.55,
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* 5. Use one color (Iconic Diagonal Teal/Red Split Swatch when multi-color) */}
      <div className="pt-2 grid grid-cols-[106px_1fr] items-center gap-2.5">
        <span className="text-[var(--text-main)]">Use one color</span>
        <div>
          <button
            type="button"
            data-fib-pop-trigger="true"
            onClick={(e) => openPopover('oneColor', e.currentTarget, 266, 376)}
            title={drawing.fibUseOneColor ? 'Single color active (click to change)' : 'Multi-color per level (click to set one color)'}
            className={`w-[34px] h-[34px] rounded-[7px] border bg-[var(--bg-surface)] p-[5px] flex items-center justify-center cursor-pointer transition-colors ${
              isOneColorOpen
                ? 'border-[#2962ff] ring-1 ring-[#2962ff]/25'
                : 'border-[var(--border)] hover:border-[#9598a1]'
            }`}
          >
            <span
              className="w-full h-full rounded-[4px] border border-black/10"
              style={
                drawing.fibUseOneColor && drawing.fibOneColor
                  ? { backgroundColor: drawing.fibOneColor }
                  : { background: 'linear-gradient(225deg, #089981 50%, #f23645 50%)' }
              }
            />
          </button>
        </div>
      </div>

      {/* 6. Background opacity checkered-to-blue slider */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <FibCheckbox
          checked={bgEnabled}
          onChange={(v) => onPatch({ fibBackgroundEnabled: v })}
          label="Background"
        />
        <div
          className={`relative h-[10px] w-[148px] rounded-full border border-black/10 dark:border-white/10 ${
            !bgEnabled ? 'opacity-40 pointer-events-none' : ''
          }`}
          style={CHECKERBOARD_BG}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'linear-gradient(to right, rgba(41,98,255,0), #2962ff)' }}
          />
          <input
            type="range"
            min={0}
            max={100}
            disabled={!bgEnabled}
            value={bgOpacity}
            onChange={(e) => onPatch({ fibBackgroundOpacity: parseInt(e.target.value, 10) })}
            aria-label="Background opacity"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-white border-[1.75px] border-[#131722] shadow pointer-events-none"
            style={{ left: `${bgOpacity}%` }}
          />
        </div>
      </div>

      {/* 7. Reverse */}
      <div className="pt-0.5">
        <FibCheckbox
          checked={Boolean(drawing.fibReverse)}
          onChange={(v) => onPatch({ fibReverse: v })}
          label="Reverse"
        />
      </div>

      {/* 8. Prices */}
      <div className="pt-0.5">
        <FibCheckbox
          checked={drawing.fibShowPrices !== false}
          onChange={(v) => onPatch({ fibShowPrices: v })}
          label="Prices"
        />
      </div>

      {/* 9. Levels: [✓] Levels   [ Values / Percents ⌄ ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <FibCheckbox
          checked={drawing.fibShowLevels !== false}
          onChange={(v) => onPatch({ fibShowLevels: v })}
          label="Levels"
        />
        <TvSelect
          disabled={drawing.fibShowLevels === false}
          value={drawing.fibLevelsFormat || 'values'}
          options={[
            { value: 'values', label: 'Values' },
            { value: 'percents', label: 'Percents' },
          ]}
          onChange={(val) => onPatch({ fibLevelsFormat: val as 'values' | 'percents' })}
          className="w-[104px]"
        />
      </div>

      {/* 10. Labels: [ Left/Center/Right ⌄ ] [ Top/Middle/Bottom ⌄ ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <span className="text-[var(--text-main)]">Labels</span>
        <div className="flex items-center gap-2">
          <TvSelect
            value={drawing.fibLabelH || 'left'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(val) => onPatch({ fibLabelH: val as TextAlignH })}
            className="w-[104px]"
          />
          <TvSelect
            value={drawing.fibLabelV || 'middle'}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            onChange={(val) => onPatch({ fibLabelV: val as TextAlignV })}
            className="w-[104px]"
          />
        </div>
      </div>

      {/* 11. Text: [✓] Text   [ Left/Center/Right ⌄ ] [ Top/Middle/Bottom ⌄ ] */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <FibCheckbox
          checked={drawing.fibTextEnabled !== false}
          onChange={(v) => onPatch({ fibTextEnabled: v })}
          label="Text"
        />
        <div className="flex items-center gap-2">
          <TvSelect
            disabled={drawing.fibTextEnabled === false}
            value={drawing.textAlignH || 'center'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(val) => onPatch({ textAlignH: val as TextAlignH })}
            className="w-[104px]"
          />
          <TvSelect
            disabled={drawing.fibTextEnabled === false}
            value={drawing.textAlignV || 'middle'}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            onChange={(val) => onPatch({ textAlignV: val as TextAlignV })}
            className="w-[104px]"
          />
        </div>
      </div>

      {/* 12. Font size */}
      <div className="grid grid-cols-[106px_1fr] items-center gap-2.5">
        <span className="text-[var(--text-main)]">Font size</span>
        <TvSelect
          value={drawing.fibFontSize || 12}
          options={FIB_FONT_SIZE_OPTIONS}
          onChange={(val) => onPatch({ fibFontSize: Number(val) })}
          mono
          className="w-[104px]"
        />
      </div>

      {/* 13. Fib levels based on log scale */}
      <div className="pt-0.5 pb-1">
        <FibCheckbox
          checked={Boolean(drawing.fibLogScale)}
          onChange={(v) => onPatch({ fibLogScale: v })}
          label="Fib levels based on log scale"
        />
      </div>

      {/* ===== FLOATING PORTAL POPOVERS (NEVER CLIP INSIDE SCROLLABLE MODAL) ===== */}
      {popover &&
        createPortal(
          <div
            ref={popoverElRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: popover.top,
              left: popover.left,
              zIndex: 9999,
            }}
            className="select-none"
          >
            {/* A. Trend Line Combined Popover (Color + Opacity + Thickness + Line Style) */}
            {popover.kind === 'trendLine' && (
              <div className="w-[266px] p-3 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_28px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
                <ColorPalettePopover
                  inline
                  value={trendColor}
                  onChange={(c) => onPatch({ fibTrendLineColor: c })}
                />

                <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1.5">
                    Thickness
                  </div>
                  <div className="grid grid-cols-4 rounded-[7px] border border-[var(--border)] overflow-hidden">
                    {[1, 2, 3, 4].map((w, i) => {
                      const active = trendWidth === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => onPatch({ fibTrendLineWidth: w })}
                          className={`h-[30px] flex items-center justify-center cursor-pointer transition-colors ${
                            i > 0 ? 'border-l border-[var(--border)]' : ''
                          } ${
                            active
                              ? 'bg-[#1f2229] dark:bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <span
                            className="w-7 rounded-full block"
                            style={{ height: `${w}px`, backgroundColor: 'currentColor' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2.5">
                  <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1.5">
                    Line style
                  </div>
                  <div className="grid grid-cols-3 rounded-[7px] border border-[var(--border)] overflow-hidden">
                    {(['solid', 'dashed', 'dotted'] as DrawingLineStyle[]).map((st, i) => {
                      const active = trendStyle === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onPatch({ fibTrendLineStyle: st })}
                          className={`h-[30px] flex items-center justify-center cursor-pointer transition-colors ${
                            i > 0 ? 'border-l border-[var(--border)]' : ''
                          } ${
                            active
                              ? 'bg-[#1f2229] dark:bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <LineStylePreview style={st} width={1.6} className="w-8 h-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* B. Levels Line Thickness Dropdown */}
            {popover.kind === 'levelsWidth' && (
              <div className="w-[92px] p-1.5 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_24px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.5)] space-y-0.5">
                {[1, 2, 3, 4].map((w) => {
                  const active = levelsWidth === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        onPatch({ lineWidth: w });
                        setPopover(null);
                      }}
                      className={`w-full h-[34px] px-3 rounded-[6px] flex items-center justify-center cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#1f2229] dark:bg-[var(--accent)] text-white'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span
                        className="w-full rounded-full block"
                        style={{ height: `${w}px`, backgroundColor: 'currentColor' }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* C. Levels Line Style Dropdown */}
            {popover.kind === 'levelsStyle' && (
              <div className="w-[152px] p-1.5 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_24px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.5)] space-y-0.5">
                {(
                  [
                    { value: 'solid', label: 'Line' },
                    { value: 'dashed', label: 'Dashed line' },
                    { value: 'dotted', label: 'Dotted line' },
                  ] as const
                ).map((item) => {
                  const active = levelsStyle === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onPatch({ lineStyle: item.value });
                        setPopover(null);
                      }}
                      className={`w-full px-2.5 py-[7px] rounded-[6px] text-[13px] flex items-center gap-2.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#1f2229] dark:bg-[var(--accent)] text-white font-semibold'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <LineStylePreview style={item.value} width={1.5} className="w-5 h-3 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* D. Extend Multi-Checkbox Popover */}
            {popover.kind === 'extend' && (
              <div className="w-[184px] p-2.5 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_24px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.5)] space-y-2.5">
                <FibCheckbox
                  checked={extLeft}
                  onChange={(v) => setExtendFlags(v, extRight)}
                  label="Extend lines left"
                />
                <div className="block">
                  <FibCheckbox
                    checked={extRight}
                    onChange={(v) => setExtendFlags(extLeft, v)}
                    label="Extend lines right"
                  />
                </div>
              </div>
            )}

            {/* E. Per-Level Color Palette Popover */}
            {popover.kind === 'levelColor' && popover.levelIndex !== undefined && (
              <div className="w-[266px] p-3 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_28px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
                <ColorPalettePopover
                  inline
                  value={levels[popover.levelIndex]?.color || '#787b86'}
                  onChange={(c) => updateLevel(popover.levelIndex!, { color: c })}
                  onClose={() => setPopover(null)}
                />
              </div>
            )}

            {/* F. Use One Color Popover */}
            {popover.kind === 'oneColor' && (
              <div className="w-[266px] p-3 rounded-[10px] bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_28px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
                <ColorPalettePopover
                  inline
                  value={drawing.fibOneColor || '#2962ff'}
                  onChange={(c) => onPatch({ fibUseOneColor: true, fibOneColor: c })}
                  onClose={() => setPopover(null)}
                  extraAction={
                    drawing.fibUseOneColor
                      ? {
                          label: 'Use per-level colors (Multi-color)',
                          onClick: () => {
                            onPatch({ fibUseOneColor: false });
                            setPopover(null);
                          },
                        }
                      : undefined
                  }
                />
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
