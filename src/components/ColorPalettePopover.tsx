import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

interface ColorPalettePopoverProps {
  value: string;
  onChange: (nextColor: string) => void;
  onClose?: () => void;
  align?: 'left' | 'right';
  extraAction?: {
    label: string;
    onClick: () => void;
  };
}

const CUSTOM_COLORS_KEY = 'tp_custom_colors_v1';

// Row 1: 10 Grayscale steps (White -> Black)
const GRAYSCALE_ROW = [
  '#ffffff',
  '#d1d4dc',
  '#b2b5be',
  '#9598a1',
  '#787b86',
  '#5d606b',
  '#434651',
  '#2a2e39',
  '#131722',
  '#000000',
];

// Row 2: 10 Vivid Primary colors
const PRIMARY_ROW = [
  '#f23645',
  '#ff9800',
  '#ffeb3b',
  '#4caf50',
  '#089981',
  '#00bcd4',
  '#2962ff',
  '#673ab7',
  '#9c27b0',
  '#e91e63',
];

// Rows 3-8: 6 lightness tiers x 10 hues (exact TradingView shade grid)
const SHADE_ROWS: string[][] = [
  ['#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#ace5dc', '#b2ebf2', '#bbd9fb', '#d1c4e9', '#e1bee7', '#f8bbd0'],
  ['#faa1a4', '#ffcc80', '#fff59d', '#a5d6a7', '#70ccbd', '#80deea', '#90bff9', '#b39ddb', '#ce93d8', '#f48fb1'],
  ['#f77c80', '#ffb74d', '#fff176', '#81c784', '#42bda8', '#4dd0e1', '#5b9cf6', '#9575cd', '#ba68c8', '#f06292'],
  ['#f7525f', '#ffa726', '#ffee58', '#66bb6a', '#22ab94', '#26c6da', '#3179f5', '#7e57c2', '#ab47bc', '#ec407a'],
  ['#b22833', '#f57c00', '#fbc02d', '#388e3c', '#056656', '#0097a7', '#1848cc', '#512da8', '#7b1fa2', '#c2185b'],
  ['#801922', '#e65100', '#f57f17', '#1b5e20', '#00332a', '#006064', '#0c3299', '#311b92', '#4a148c', '#880e4f'],
];

function parseColor(input: string): { hex: string; alpha: number } {
  if (!input) return { hex: '#2962ff', alpha: 1 };
  const trimmed = input.trim();
  if (trimmed.startsWith('#')) {
    const clean = trimmed.slice(1);
    if (clean.length === 6) return { hex: `#${clean.toLowerCase()}`, alpha: 1 };
    if (clean.length === 3) {
      const expanded = clean
        .split('')
        .map((c) => c + c)
        .join('');
      return { hex: `#${expanded.toLowerCase()}`, alpha: 1 };
    }
  }
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10)));
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    return { hex, alpha: a };
  }
  return { hex: '#2962ff', alpha: 1 };
}

function buildColorString(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 0.995) return `#${clean.toLowerCase()}`;
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
  }
  return hex;
}

function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 9) : [];
  } catch {
    return [];
  }
}

function saveCustomColors(colors: string[]) {
  try {
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors.slice(0, 9)));
  } catch {}
}

export const ColorPalettePopover: React.FC<ColorPalettePopoverProps> = ({
  value,
  onChange,
  onClose,
  align = 'left',
  extraAction,
}) => {
  const { hex: activeHex, alpha } = parseColor(value);
  const opacityPct = Math.round(alpha * 100);
  const [customColors, setCustomColors] = useState<string[]>(() => loadCustomColors());
  const colorInputRef = useRef<HTMLInputElement>(null);

  const selectHex = (hex: string, closeAfter = true) => {
    onChange(buildColorString(hex, alpha));
    if (closeAfter && onClose) onClose();
  };

  const handleOpacityChange = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    onChange(buildColorString(activeHex, clamped / 100));
  };

  const handleAddCustomColor = (hex: string) => {
    const normalized = hex.toLowerCase();
    const next = [normalized, ...customColors.filter((c) => c !== normalized)].slice(0, 9);
    setCustomColors(next);
    saveCustomColors(next);
    onChange(buildColorString(normalized, alpha));
  };

  const renderSwatch = (hex: string) => {
    const isSelected = activeHex === hex.toLowerCase();
    const isWhite = hex.toLowerCase() === '#ffffff';
    return (
      <button
        key={hex}
        type="button"
        onClick={() => selectHex(hex)}
        title={hex}
        className={`w-[20px] h-[20px] rounded-[4px] shrink-0 cursor-pointer transition-transform hover:scale-110 ${
          isSelected
            ? 'ring-2 ring-[var(--text-main)] ring-offset-1 ring-offset-[var(--bg-surface)] z-10'
            : isWhite
            ? 'border border-[var(--border)]'
            : 'border border-black/10 dark:border-white/10'
        }`}
        style={{ backgroundColor: hex }}
      />
    );
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${
        align === 'right' ? 'right-0' : 'left-0'
      } top-9 w-[262px] p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl z-50 select-none`}
    >
      {/* Row 1: Grayscale */}
      <div className="grid grid-cols-10 gap-[4px] mb-[5px]">
        {GRAYSCALE_ROW.map(renderSwatch)}
      </div>

      {/* Row 2: Vivid Primaries */}
      <div className="grid grid-cols-10 gap-[4px] mb-2.5">
        {PRIMARY_ROW.map(renderSwatch)}
      </div>

      {/* Rows 3-8: Shade Matrix */}
      <div className="space-y-[4px] mb-3">
        {SHADE_ROWS.map((row, idx) => (
          <div key={idx} className="grid grid-cols-10 gap-[4px]">
            {row.map(renderSwatch)}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)] my-2.5" />

      {/* Custom Colors Row + Plus Button */}
      <div className="flex items-center gap-[5px] mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          title="Add custom color"
          className="w-[22px] h-[22px] rounded-[4px] border border-[var(--border)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={activeHex}
          onChange={(e) => handleAddCustomColor(e.target.value)}
          className="sr-only"
        />
        {customColors.map((hex) => renderSwatch(hex))}
      </div>

      {/* Opacity Slider (TradingView Checkerboard Style) */}
      <div>
        <div className="text-[11px] text-[var(--text-muted)] font-medium mb-1.5">Opacity</div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 h-3 rounded-full overflow-hidden border border-[var(--border)]">
            {/* Checkerboard backdrop */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #d1d4dc 25%, transparent 25%), linear-gradient(-45deg, #d1d4dc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d4dc 75%), linear-gradient(-45deg, transparent 75%, #d1d4dc 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                backgroundColor: '#ffffff',
              }}
            />
            {/* Color gradient from transparent to solid activeHex */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, transparent, ${activeHex})`,
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={opacityPct}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title={`Opacity ${opacityPct}%`}
            />
            {/* Thumb indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#131722] shadow pointer-events-none"
              style={{ left: `${opacityPct}%` }}
            />
          </div>

          <div className="w-12 h-7 px-1.5 rounded border border-[var(--border)] bg-[var(--bg-app)] flex items-center justify-center font-mono-num text-[11px] text-[var(--text-main)] shrink-0">
            {opacityPct}%
          </div>
        </div>
      </div>

      {extraAction && (
        <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={extraAction.onClick}
            className="w-full py-1.5 px-2.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-main)] cursor-pointer"
          >
            {extraAction.label}
          </button>
        </div>
      )}
    </div>
  );
};
