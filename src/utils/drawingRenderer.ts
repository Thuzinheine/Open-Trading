import { AnchorPoint, DrawingLineStyle, DrawingObject, FibLevelConfig } from '../types/trading';
import { fmtPrice } from './binance';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CoordBridge {
  ptToScreen: (pt: AnchorPoint) => ScreenPoint | null;
  priceToY: (price: number) => number | null;
  timeToX: (time: number) => number | null;
  timeToLogical: (time: number) => number | null;
  width: number;
  height: number;
  plotLeft?: number;
  plotWidth?: number;
  intervalSec: number;
  lastClose?: number;
}

export function getTickSizeForPrice(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 100) return 0.01;
  if (abs >= 1) return 0.0001;
  if (abs >= 0.01) return 0.00001;
  return 0.00000001;
}

function getHlineHandleX(bridge: CoordBridge): number {
  const plotLeft = bridge.plotLeft ?? 0;
  const plotW = bridge.plotWidth ?? Math.max(80, bridge.width - 70);
  const inset = Math.min(112, Math.max(62, Math.round(plotW * 0.11)));
  return plotLeft + Math.max(24, plotW - inset);
}

export interface HandleHit {
  drawingId: string;
  handleKey: 'p1' | 'p2' | 'p3' | 'price' | 'time' | 'target' | 'stop';
  x: number;
  y: number;
}

// Exact 24 TradingView Fib Retracement levels (12 rows × 2 columns in exact TradingView order & colors)
export const DEFAULT_FIB_LEVELS: FibLevelConfig[] = [
  { ratio: 0, enabled: true, color: '#787b86' },
  { ratio: 0.236, enabled: true, color: '#f23645' },
  { ratio: 0.382, enabled: true, color: '#ff9800' },
  { ratio: 0.5, enabled: true, color: '#4caf50' },
  { ratio: 0.618, enabled: true, color: '#089981' },
  { ratio: 0.786, enabled: true, color: '#00bcd4' },
  { ratio: 1, enabled: true, color: '#787b86' },
  { ratio: 1.618, enabled: true, color: '#2962ff' },
  { ratio: 2.618, enabled: true, color: '#f23645' },
  { ratio: 3.618, enabled: true, color: '#9c27b0' },
  { ratio: 4.236, enabled: true, color: '#e91e63' },
  { ratio: 1.272, enabled: false, color: '#ff9800' },
  { ratio: 1.414, enabled: false, color: '#f23645' },
  { ratio: 2.272, enabled: false, color: '#ff9800' },
  { ratio: 2.414, enabled: false, color: '#4caf50' },
  { ratio: 2, enabled: false, color: '#089981' },
  { ratio: 3, enabled: false, color: '#00bcd4' },
  { ratio: 3.272, enabled: false, color: '#787b86' },
  { ratio: 3.414, enabled: false, color: '#2962ff' },
  { ratio: 4, enabled: false, color: '#f23645' },
  { ratio: 4.272, enabled: false, color: '#9c27b0' },
  { ratio: 4.414, enabled: false, color: '#e91e63' },
  { ratio: 4.618, enabled: false, color: '#ff9800' },
  { ratio: 4.764, enabled: false, color: '#089981' },
];

export function getEffectiveFibLevels(s: DrawingObject): FibLevelConfig[] {
  if (s.fibLevels && s.fibLevels.length > 0) return s.fibLevels;
  return DEFAULT_FIB_LEVELS;
}

export function computeFibLevelPrice(
  p1Price: number,
  p2Price: number,
  ratio: number,
  reverse?: boolean,
  logScale?: boolean
): number {
  const start = reverse ? p2Price : p1Price;
  const end = reverse ? p1Price : p2Price;
  if (logScale && start > 0 && end > 0) {
    const logStart = Math.log(start);
    const logEnd = Math.log(end);
    return Math.exp(logEnd - (logEnd - logStart) * ratio);
  }
  return end - (end - start) * ratio;
}

const FIB_EXT_LEVELS = [
  { ratio: 0, label: '0%', color: '#787b86' },
  { ratio: 0.618, label: '61.8%', color: '#089981' },
  { ratio: 1, label: '100%', color: '#2962ff' },
  { ratio: 1.618, label: '161.8%', color: '#f59e0b' },
  { ratio: 2.618, label: '261.8%', color: '#f23645' },
];

function applyLineDash(ctx: CanvasRenderingContext2D, style?: DrawingLineStyle) {
  if (style === 'dashed') ctx.setLineDash([6, 4]);
  else if (style === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);
}

function hexWithOpacity(color: string, opacity01: number): string {
  const clamped = Math.max(0, Math.min(1, opacity01));
  const trimmed = (color || '#2962ff').trim();
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgbaMatch) {
    const baseA = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    const finalA = Math.max(0, Math.min(1, baseA * clamped));
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${finalA})`;
  }
  const clean = trimmed.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  return color;
}

// TradingView-style crisp blue ring + white center anchor circle (ONLY shown when selected or hovered)
function drawHandleDot(ctx: CanvasRenderingContext2D, x: number, y: number, active = false) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2962ff';
  ctx.lineWidth = active ? 1.85 : 1.55;
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), active ? 4.3 : 3.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size = 11
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
  ctx.restore();
}

function fmtDuration(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const TV_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

function drawPriceTag(ctx: CanvasRenderingContext2D, x: number, y: number, price: number, color: string) {
  const lbl = fmtPrice(price);
  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `400 10.5px ${TV_FONT_STACK}`;
  const tw = ctx.measureText(lbl).width + 10;
  ctx.fillStyle = color;
  drawRoundedRect(ctx, Math.round(x - tw / 2), Math.round(y - 21), Math.round(tw), 17, 3);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lbl, Math.round(x), Math.round(y - 12.5));
  ctx.restore();
}

// Compute normalized left->right line text metrics & stroke line with automatic clean gap when alignV === 'middle'
function strokeLineWithText(
  ctx: CanvasRenderingContext2D,
  s: DrawingObject,
  lineStart: ScreenPoint,
  lineEnd: ScreenPoint,
  anchorA: ScreenPoint,
  anchorB: ScreenPoint,
  edgeInset = 8
) {
  const hasText = Boolean(s.text && s.text.trim());
  const defaultAlignV = s.type === 'hline' ? 'middle' : 'top';
  const alignV = s.textAlignV || defaultAlignV;
  const alignH = s.textAlignH || 'center';

  // Ensure readable direction (left-to-right; for perfectly vertical lines, bottom-to-top)
  let pLeft = anchorA;
  let pRight = anchorB;
  const rawDx = anchorB.x - anchorA.x;
  const rawDy = anchorB.y - anchorA.y;
  if (rawDx < -0.5 || (Math.abs(rawDx) <= 0.5 && rawDy > 0)) {
    pLeft = anchorB;
    pRight = anchorA;
  }

  const dx = pRight.x - pLeft.x;
  const dy = pRight.y - pLeft.y;
  const len = Math.hypot(dx, dy);

  if (!hasText || len < 1) {
    ctx.beginPath();
    ctx.moveTo(lineStart.x, lineStart.y);
    ctx.lineTo(lineEnd.x, lineEnd.y);
    ctx.stroke();
    return;
  }

  const ux = dx / len;
  const uy = dy / len;
  const angle = Math.atan2(uy, ux);
  const lines = s.text!.split('\n');
  const fontSize = s.fontSize || (s.type === 'hline' ? 12 : 13);
  const weight = s.fontBold ? '700' : '400';
  const italic = s.fontItalic ? 'italic ' : '';
  const fontStr = `${italic}${weight} ${fontSize}px ${TV_FONT_STACK}`;
  const textColor = s.textColor || s.color || '#2962ff';

  ctx.save();
  ctx.font = fontStr;
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  ctx.restore();

  const inset = Math.min(edgeInset, Math.max(4, len * 0.15));
  let textAnchorS = len / 2;
  let gapStartS = len / 2 - maxW / 2 - 6;
  let gapEndS = len / 2 + maxW / 2 + 6;
  let canvasAlign: CanvasTextAlign = 'center';

  if (alignH === 'left') {
    textAnchorS = inset;
    canvasAlign = 'left';
    gapStartS = textAnchorS - 5;
    gapEndS = textAnchorS + maxW + 5;
  } else if (alignH === 'right') {
    textAnchorS = len - inset;
    canvasAlign = 'right';
    gapStartS = textAnchorS - maxW - 5;
    gapEndS = textAnchorS + 5;
  }

  const ptAt = (distAlong: number): ScreenPoint => ({
    x: pLeft.x + ux * distAlong,
    y: pLeft.y + uy * distAlong,
  });

  // Project full lineStart -> lineEnd onto the pLeft -> pRight axis
  const s0 = (lineStart.x - pLeft.x) * ux + (lineStart.y - pLeft.y) * uy;
  const s1 = (lineEnd.x - pLeft.x) * ux + (lineEnd.y - pLeft.y) * uy;
  const minS = Math.min(s0, s1);
  const maxS = Math.max(s0, s1);

  // Stroke line (with crisp clean break around text when vertical alignment is Middle!)
  if (alignV === 'middle') {
    const seg1End = Math.min(maxS, gapStartS);
    if (seg1End > minS + 0.5) {
      const a1 = ptAt(minS);
      const b1 = ptAt(seg1End);
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.stroke();
    }
    const seg2Start = Math.max(minS, gapEndS);
    if (maxS > seg2Start + 0.5) {
      const a2 = ptAt(seg2Start);
      const b2 = ptAt(maxS);
      ctx.beginPath();
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(lineStart.x, lineStart.y);
    ctx.lineTo(lineEnd.x, lineEnd.y);
    ctx.stroke();
  }

  // Draw Text positioned crisply at Top / Middle / Bottom x Left / Center / Right
  const anchorPt = ptAt(textAnchorS);
  const lineH = fontSize * 1.24;
  const gapY = (s.lineWidth || 2) / 2 + 4;

  ctx.save();
  ctx.setLineDash([]);
  ctx.translate(anchorPt.x, anchorPt.y);
  ctx.rotate(angle);
  ctx.font = fontStr;
  ctx.fillStyle = textColor;
  ctx.textAlign = canvasAlign;

  if (alignV === 'top') {
    ctx.textBaseline = 'bottom';
    const startY = -gapY - (lines.length - 1) * lineH;
    lines.forEach((line, idx) => ctx.fillText(line, 0, startY + idx * lineH));
  } else if (alignV === 'bottom') {
    ctx.textBaseline = 'top';
    const startY = gapY;
    lines.forEach((line, idx) => ctx.fillText(line, 0, startY + idx * lineH));
  } else {
    ctx.textBaseline = 'middle';
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, idx) => ctx.fillText(line, 0, startY + idx * lineH));
  }
  ctx.restore();
}

// Render custom Text attached to a line segment (used for channels where stroke is already drawn)
function drawLineText(ctx: CanvasRenderingContext2D, s: DrawingObject, a: ScreenPoint, b: ScreenPoint) {
  if (!s.text || !s.text.trim()) return;
  const lines = s.text.split('\n');
  const fontSize = s.fontSize || 13;
  const weight = s.fontBold ? '700' : '400';
  const italic = s.fontItalic ? 'italic ' : '';
  const textColor = s.textColor || s.color || '#2962ff';
  const alignH = s.textAlignH || 'center';
  const alignV = s.textAlignV || 'top';

  let pLeft = a;
  let pRight = b;
  if (a.x > b.x) {
    pLeft = b;
    pRight = a;
  }
  const dx = pRight.x - pLeft.x;
  const dy = pRight.y - pLeft.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const angle = Math.atan2(uy, ux);

  const inset = Math.min(8, Math.max(4, len * 0.15));
  const anchorS = alignH === 'left' ? inset : alignH === 'right' ? len - inset : len / 2;
  const ax = pLeft.x + ux * anchorS;
  const ay = pLeft.y + uy * anchorS;
  const lineH = fontSize * 1.24;
  const gapY = (s.lineWidth || 2) / 2 + 4;

  ctx.save();
  ctx.setLineDash([]);
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.font = `${italic}${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = alignH === 'left' ? 'left' : alignH === 'right' ? 'right' : 'center';

  if (alignV === 'top') {
    ctx.textBaseline = 'bottom';
    const startY = -gapY - (lines.length - 1) * lineH;
    lines.forEach((line, idx) => ctx.fillText(line, 0, startY + idx * lineH));
  } else if (alignV === 'bottom') {
    ctx.textBaseline = 'top';
    lines.forEach((line, idx) => ctx.fillText(line, 0, gapY + idx * lineH));
  } else {
    ctx.textBaseline = 'middle';
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, idx) => ctx.fillText(line, 0, startY + idx * lineH));
  }
  ctx.restore();
}

// Render custom Text attached to a rectangle / ellipse box
function drawBoxText(
  ctx: CanvasRenderingContext2D,
  s: DrawingObject,
  leftX: number,
  rightX: number,
  topY: number,
  bottomY: number
) {
  if (!s.text || !s.text.trim()) return;
  const lines = s.text.split('\n');
  const fontSize = s.fontSize || 13;
  const weight = s.fontBold ? '700' : '400';
  const italic = s.fontItalic ? 'italic ' : '';
  const textColor = s.textColor || s.color || '#2962ff';
  const alignH = s.textAlignH || 'center';
  const alignV = s.textAlignV || 'middle';

  const x =
    alignH === 'left' ? leftX + 8 : alignH === 'right' ? rightX - 8 : (leftX + rightX) / 2;
  const lineH = fontSize * 1.24;

  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `${italic}${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = alignH === 'left' ? 'left' : alignH === 'right' ? 'right' : 'center';

  if (alignV === 'top') {
    ctx.textBaseline = 'top';
    lines.forEach((line, idx) => ctx.fillText(line, x, topY + 6 + idx * lineH));
  } else if (alignV === 'bottom') {
    ctx.textBaseline = 'bottom';
    const startY = bottomY - 6 - (lines.length - 1) * lineH;
    lines.forEach((line, idx) => ctx.fillText(line, x, startY + idx * lineH));
  } else {
    ctx.textBaseline = 'middle';
    const startY = (topY + bottomY) / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, idx) => ctx.fillText(line, x, startY + idx * lineH));
  }
  ctx.restore();
}

// Render optional Stats info box on Trendline / Ray / Extended / InfoLine
function drawLineStats(
  ctx: CanvasRenderingContext2D,
  s: DrawingObject,
  a: ScreenPoint,
  b: ScreenPoint,
  bridge: CoordBridge,
  isSelected: boolean
) {
  const mode = s.statsMode || (s.type === 'infoline' ? 'all' : 'hidden');
  if (mode === 'hidden') return;
  const always = s.type === 'infoline' ? true : Boolean(s.alwaysShowStats);
  if (!always && !isSelected) return;
  if (!s.p1 || !s.p2) return;

  const diff = s.p2.price - s.p1.price;
  const pct = s.p1.price ? (diff / s.p1.price) * 100 : 0;
  const l1 = bridge.timeToLogical(s.p1.time) ?? 0;
  const l2 = bridge.timeToLogical(s.p2.time) ?? 0;
  const bars = Math.abs(Math.round(l2 - l1));
  const deg = (-Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

  const rows: string[] = [];
  if (mode === 'price') rows.push(`${diff >= 0 ? '+' : ''}${fmtPrice(diff)}`);
  else if (mode === 'percent') rows.push(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`);
  else if (mode === 'bars') rows.push(`${bars} bars · ${fmtDuration(s.p2.time - s.p1.time)}`);
  else {
    rows.push(`${diff >= 0 ? '+' : ''}${fmtPrice(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`);
    rows.push(`${bars} bars · ${fmtDuration(s.p2.time - s.p1.time)} · ${deg.toFixed(1)}°`);
  }

  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `400 11px ${TV_FONT_STACK}`;
  const tw = Math.max(...rows.map((r) => ctx.measureText(r).width)) + 14;
  const th = rows.length * 15 + 8;

  const pos = s.statsPosition || 'right';
  const anchor =
    pos === 'left'
      ? a.x <= b.x
        ? a
        : b
      : pos === 'center'
      ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      : a.x >= b.x
      ? a
      : b;

  const bx = Math.round(
    Math.min(
      bridge.width - tw - 72,
      Math.max(8, anchor.x + (pos === 'right' ? 10 : pos === 'left' ? -tw - 10 : -tw / 2))
    )
  );
  const by = Math.round(Math.min(bridge.height - th - 36, Math.max(8, anchor.y - th / 2)));

  ctx.fillStyle = 'rgba(19, 23, 34, 0.9)';
  drawRoundedRect(ctx, bx, by, Math.round(tw), th, 4);
  ctx.fill();
  ctx.strokeStyle = s.color || '#2962ff';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  rows.forEach((r, idx) => {
    ctx.fillStyle = idx === 0 ? '#ffffff' : '#b2b5be';
    ctx.fillText(r, bx + 7, by + 11.5 + idx * 15);
  });
  ctx.restore();
}

export function getDrawingHandles(s: DrawingObject, bridge: CoordBridge): HandleHit[] {
  const handles: HandleHit[] = [];
  if (s.type === 'hline' && s.price !== undefined) {
    const y = bridge.priceToY(s.price);
    if (y !== null) handles.push({ drawingId: s.id, handleKey: 'price', x: getHlineHandleX(bridge), y });
    return handles;
  }
  if (s.type === 'vline' && s.time !== undefined) {
    const x = bridge.timeToX(s.time);
    if (x !== null) handles.push({ drawingId: s.id, handleKey: 'time', x, y: bridge.height * 0.5 });
    return handles;
  }
  if (s.type === 'long_pos' || s.type === 'short_pos') {
    if (s.p1 && s.p2) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      const x1 = a && b ? Math.min(a.x, b.x) : a?.x ?? 0;
      const x2 = a && b ? Math.max(a.x, b.x, x1 + 60) : (b?.x ?? 0);
      if (a) handles.push({ drawingId: s.id, handleKey: 'p1', x: x1, y: a.y });
      if (a && b) handles.push({ drawingId: s.id, handleKey: 'p2', x: x2, y: a.y });
      if (a && s.targetPrice !== undefined) {
        const ty = bridge.priceToY(s.targetPrice);
        if (ty !== null) handles.push({ drawingId: s.id, handleKey: 'target', x: x1, y: ty });
      }
      if (a && s.stopPrice !== undefined) {
        const sy = bridge.priceToY(s.stopPrice);
        if (sy !== null) handles.push({ drawingId: s.id, handleKey: 'stop', x: x1, y: sy });
      }
    }
    return handles;
  }

  if (s.p1) {
    const a = bridge.ptToScreen(s.p1);
    if (a) handles.push({ drawingId: s.id, handleKey: 'p1', x: a.x, y: a.y });
  }
  if (s.p2) {
    const b = bridge.ptToScreen(s.p2);
    if (b) handles.push({ drawingId: s.id, handleKey: 'p2', x: b.x, y: b.y });
  }
  if (s.p3) {
    const c = bridge.ptToScreen(s.p3);
    if (c) handles.push({ drawingId: s.id, handleKey: 'p3', x: c.x, y: c.y });
  }
  return handles;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const num = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1);
  const den = Math.hypot(y2 - y1, x2 - x1);
  return den === 0 ? Infinity : num / den;
}

export function hitTestDrawings(
  drawings: DrawingObject[],
  x: number,
  y: number,
  bridge: CoordBridge,
  selectedId: string | null
): { drawingId: string; handleKey?: HandleHit['handleKey'] } | null {
  if (selectedId) {
    const sel = drawings.find((d) => d.id === selectedId);
    if (sel) {
      const handles = getDrawingHandles(sel, bridge);
      for (const h of handles) {
        if (Math.hypot(x - h.x, y - h.y) <= 9) {
          return { drawingId: sel.id, handleKey: h.handleKey };
        }
      }
    }
  }

  for (let i = drawings.length - 1; i >= 0; i--) {
    const s = drawings[i];
    const handles = getDrawingHandles(s, bridge);
    for (const h of handles) {
      if (Math.hypot(x - h.x, y - h.y) <= 8) {
        return { drawingId: s.id, handleKey: h.handleKey };
      }
    }

    if (s.type === 'hline' && s.price !== undefined) {
      const ly = bridge.priceToY(s.price);
      if (ly !== null && Math.abs(y - ly) <= 7) return { drawingId: s.id };
    } else if (s.type === 'vline' && s.time !== undefined) {
      const lx = bridge.timeToX(s.time);
      if (lx !== null && Math.abs(x - lx) <= 7) return { drawingId: s.id };
    } else if (s.type === 'hray' && s.p1) {
      const a = bridge.ptToScreen(s.p1);
      if (a && x >= a.x - 6 && Math.abs(y - a.y) <= 7) return { drawingId: s.id };
    } else if (s.type === 'crossline' && s.p1) {
      const a = bridge.ptToScreen(s.p1);
      if (a && (Math.abs(x - a.x) <= 7 || Math.abs(y - a.y) <= 7)) return { drawingId: s.id };
    } else if (
      (s.type === 'trendline' ||
        s.type === 'infoline' ||
        s.type === 'angle' ||
        s.type === 'arrow_line' ||
        s.type === 'callout') &&
      s.p1 &&
      s.p2
    ) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (a && b) {
        const ext = s.extend || 'none';
        if (ext === 'both' && distToLine(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
        if (ext === 'right') {
          const dot = (x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y);
          if (dot >= -10 && distToLine(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
        }
        if (ext === 'left') {
          const dot = (x - b.x) * (a.x - b.x) + (y - b.y) * (a.y - b.y);
          if (dot >= -10 && distToLine(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
        }
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
      }
    } else if (s.type === 'ray' && s.p1 && s.p2) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (a && b) {
        const dot = (x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y);
        if (dot >= -10 && distToLine(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
      }
    } else if (s.type === 'extended' && s.p1 && s.p2) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (a && b && distToLine(x, y, a.x, a.y, b.x, b.y) <= 8) return { drawingId: s.id };
    } else if (s.type === 'fib' && s.p1 && s.p2) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (a && b) {
        if (s.fibTrendLineEnabled !== false && distToSegment(x, y, a.x, a.y, b.x, b.y) <= 8) {
          return { drawingId: s.id };
        }
        const leftX = Math.min(a.x, b.x);
        const rightX = Math.max(a.x, b.x, leftX + 130);
        const extLeft = s.extend === 'left' || s.extend === 'both';
        const extRight = s.extend === 'right' || s.extend === 'both';
        const lineX1 = extLeft ? 0 : leftX;
        const lineX2 = extRight ? 100000 : rightX;
        const enabledLevels = getEffectiveFibLevels(s).filter((l) => l.enabled);
        for (const lvl of enabledLevels) {
          const price = computeFibLevelPrice(
            s.p1.price,
            s.p2.price,
            lvl.ratio,
            s.fibReverse,
            s.fibLogScale
          );
          const ly = bridge.priceToY(price);
          if (ly !== null && x >= lineX1 - 8 && x <= lineX2 + 8 && Math.abs(y - ly) <= 7) {
            return { drawingId: s.id };
          }
        }
        const minY = Math.min(a.y, b.y) - 5;
        const maxY = Math.max(a.y, b.y) + 5;
        if (x >= lineX1 - 5 && x <= lineX2 + 5 && y >= minY && y <= maxY) {
          return { drawingId: s.id };
        }
      }
    } else if (
      (s.type === 'rect' ||
        s.type === 'ellipse' ||
        s.type === 'price_range' ||
        s.type === 'date_range' ||
        s.type === 'measure') &&
      s.p1 &&
      s.p2
    ) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (a && b) {
        const minX = Math.min(a.x, b.x) - 5;
        const maxX = Math.max(a.x, b.x) + 5;
        const minY = Math.min(a.y, b.y) - 5;
        const maxY = Math.max(a.y, b.y) + 5;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return { drawingId: s.id };
      }
    } else if ((s.type === 'long_pos' || s.type === 'short_pos') && s.p1 && s.p2) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      const ty = s.targetPrice !== undefined ? bridge.priceToY(s.targetPrice) : null;
      const sy = s.stopPrice !== undefined ? bridge.priceToY(s.stopPrice) : null;
      if (a && b && ty !== null && sy !== null) {
        const minX = Math.min(a.x, b.x) - 5;
        const maxX = Math.max(a.x, b.x) + 5;
        const minY = Math.min(a.y, ty, sy) - 5;
        const maxY = Math.max(a.y, ty, sy) + 5;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return { drawingId: s.id };
      }
    } else if (
      (s.type === 'channel' ||
        s.type === 'flat_channel' ||
        s.type === 'disjoint_channel' ||
        s.type === 'pitchfork' ||
        s.type === 'fib_ext' ||
        s.type === 'triangle') &&
      s.p1 &&
      s.p2
    ) {
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      const c = s.p3 ? bridge.ptToScreen(s.p3) : null;
      if (a && b && distToSegment(x, y, a.x, a.y, b.x, b.y) <= 9) return { drawingId: s.id };
      if (b && c && distToSegment(x, y, b.x, b.y, c.x, c.y) <= 9) return { drawingId: s.id };
      if (a && c && distToSegment(x, y, a.x, a.y, c.x, c.y) <= 9) return { drawingId: s.id };
    } else if ((s.type === 'text' || s.type === 'price_label') && s.p1) {
      const a = bridge.ptToScreen(s.p1);
      if (a && x >= a.x - 10 && x <= a.x + 160 && y >= a.y - 24 && y <= a.y + 24) {
        return { drawingId: s.id };
      }
    } else if ((s.type === 'brush' || s.type === 'highlighter' || s.type === 'path') && s.points) {
      const pts = s.points.map(bridge.ptToScreen).filter(Boolean) as ScreenPoint[];
      for (let k = 0; k < pts.length - 1; k++) {
        if (distToSegment(x, y, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y) <= 8) {
          return { drawingId: s.id };
        }
      }
    }
  }
  return null;
}

export function renderDrawingObject(
  ctx: CanvasRenderingContext2D,
  s: DrawingObject,
  bridge: CoordBridge,
  isSelected: boolean,
  isHovered = false,
  isDraft = false
) {
  const { width, height } = bridge;
  const color = s.color || '#2962ff';
  const showHandles = isSelected || isHovered;
  const fillAlpha = s.fillOpacity !== undefined ? s.fillOpacity / 100 : 0.14;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s.lineWidth || 2;
  applyLineDash(ctx, s.lineStyle);

  switch (s.type) {
    case 'hline': {
      if (s.price === undefined) break;
      const y = bridge.priceToY(s.price);
      if (y === null) break;
      if (!s.lineStyle) ctx.setLineDash([]);
      const pLeft = bridge.plotLeft ?? 0;
      const pRight = pLeft + (bridge.plotWidth ?? width - 70);
      strokeLineWithText(
        ctx,
        s,
        { x: pLeft, y },
        { x: pRight, y },
        { x: pLeft, y },
        { x: pRight, y },
        12
      );
      ctx.setLineDash([]);
      if (showHandles) drawHandleDot(ctx, getHlineHandleX(bridge), y, isSelected);
      break;
    }

    case 'hray': {
      if (!s.p1) break;
      const a = bridge.ptToScreen(s.p1);
      if (!a) break;
      const pLeft = bridge.plotLeft ?? 0;
      const pRight = pLeft + (bridge.plotWidth ?? width - 70);
      strokeLineWithText(
        ctx,
        s,
        a,
        { x: pRight, y: a.y },
        a,
        { x: pRight, y: a.y },
        10
      );
      ctx.setLineDash([]);
      if (showHandles) drawHandleDot(ctx, a.x, a.y, isSelected);
      break;
    }

    case 'vline': {
      if (s.time === undefined) break;
      const x = bridge.timeToX(s.time);
      if (x === null) break;
      const plotBottom = Math.max(40, height - 28);
      strokeLineWithText(
        ctx,
        s,
        { x, y: 0 },
        { x, y: plotBottom },
        { x, y: plotBottom },
        { x, y: 0 },
        14
      );
      ctx.setLineDash([]);
      const d = new Date(s.time * 1000);
      const lbl = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      ctx.font = `400 10.5px ${TV_FONT_STACK}`;
      const tw = ctx.measureText(lbl).width + 12;
      ctx.fillStyle = color;
      ctx.fillRect(x - tw / 2, height - 46, tw, 18);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x, height - 34);
      if (showHandles) drawHandleDot(ctx, x, height * 0.5, isSelected);
      break;
    }

    case 'crossline': {
      if (!s.p1) break;
      const a = bridge.ptToScreen(s.p1);
      if (!a) break;
      const pLeft = bridge.plotLeft ?? 0;
      const pRight = pLeft + (bridge.plotWidth ?? width - 70);
      ctx.beginPath();
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, height);
      ctx.stroke();
      strokeLineWithText(
        ctx,
        s,
        { x: pLeft, y: a.y },
        { x: pRight, y: a.y },
        { x: pLeft, y: a.y },
        { x: pRight, y: a.y },
        12
      );
      ctx.setLineDash([]);
      if (s.showPriceLabels !== false) {
        const lbl = fmtPrice(s.p1.price);
        ctx.font = `400 10.5px ${TV_FONT_STACK}`;
        const tw = ctx.measureText(lbl).width + 12;
        ctx.fillStyle = color;
        ctx.fillRect(width - tw - 66, a.y - 9, tw, 18);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, width - tw / 2 - 66, a.y + 3.5);
      }
      if (showHandles) drawHandleDot(ctx, a.x, a.y, isSelected);
      break;
    }

    case 'trendline':
    case 'ray':
    case 'extended':
    case 'infoline': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;

      const ext =
        s.extend ||
        (s.type === 'ray' ? 'right' : s.type === 'extended' ? 'both' : 'none');

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const scale = dist > 0.5 ? ((width + height) * 1.6) / dist : 0;

      const startPt =
        ext === 'left' || ext === 'both'
          ? { x: a.x - dx * scale, y: a.y - dy * scale }
          : a;
      const endPt =
        ext === 'right' || ext === 'both'
          ? { x: a.x + dx * scale, y: a.y + dy * scale }
          : b;

      strokeLineWithText(ctx, s, startPt, endPt, a, b, 8);

      if (s.leftEnd === 'arrow' && ext !== 'left' && ext !== 'both') {
        drawArrowHead(ctx, b.x, b.y, a.x, a.y, 11);
      }
      if (s.rightEnd === 'arrow' && ext !== 'right' && ext !== 'both') {
        drawArrowHead(ctx, a.x, a.y, b.x, b.y, 11);
      }

      if (s.showMiddlePoint) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(mx, my, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (s.showPriceLabels) {
        drawPriceTag(ctx, a.x, a.y, s.p1.price, color);
        drawPriceTag(ctx, b.x, b.y, s.p2.price, color);
      }

      drawLineStats(ctx, s, a, b, bridge, isSelected);

      // Endpoints ONLY appear when selected or hovered; while actively drawing (draft), only p1 shows the blue circle!
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        if (!isDraft) {
          drawHandleDot(ctx, b.x, b.y, isSelected);
        }
      }
      break;
    }

    case 'angle': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      strokeLineWithText(ctx, s, a, b, a, b, 8);

      const refLen = Math.min(90, Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.5));
      const dir = b.x >= a.x ? 1 : -1;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + dir * refLen, a.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const rad = Math.atan2(b.y - a.y, b.x - a.x);
      const baseRad = dir === 1 ? 0 : Math.PI;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 26, Math.min(baseRad, rad), Math.max(baseRad, rad));
      ctx.stroke();

      const deg = (-Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 180) / Math.PI;
      ctx.fillStyle = color;
      ctx.font = `500 11px ${TV_FONT_STACK}`;
      ctx.textAlign = dir === 1 ? 'left' : 'right';
      ctx.fillText(
        `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`,
        a.x + dir * 32,
        a.y + (b.y < a.y ? -8 : 14)
      );
      ctx.restore();

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        if (!isDraft) drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'channel': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const c = s.p3 ? bridge.ptToScreen(s.p3) : { x: b.x, y: b.y - 45 };
      if (!c) break;

      const dx = b.x - a.x;
      const lineYatC = Math.abs(dx) > 0.5 ? a.y + ((b.y - a.y) * (c.x - a.x)) / dx : a.y;
      const offsetY = c.y - lineYatC;

      const a2 = { x: a.x, y: a.y + offsetY };
      const b2 = { x: b.x, y: b.y + offsetY };

      ctx.fillStyle = hexWithOpacity(color, fillAlpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + offsetY / 2);
      ctx.lineTo(b.x, b.y + offsetY / 2);
      ctx.stroke();
      ctx.restore();

      drawLineText(ctx, s, a, b);
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (s.p3) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'flat_channel': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const c = s.p3 ? bridge.ptToScreen(s.p3) : { x: a.x, y: Math.min(a.y, b.y) - 40 };
      if (!c) break;

      ctx.fillStyle = hexWithOpacity(color, fillAlpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, c.y);
      ctx.lineTo(a.x, c.y);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(a.x, c.y);
      ctx.lineTo(b.x, c.y);
      ctx.stroke();

      drawLineText(ctx, s, a, b);
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (s.p3) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'disjoint_channel': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const c = s.p3 ? bridge.ptToScreen(s.p3) : { x: b.x, y: b.y + 50 };
      if (!c) break;

      const slope1 = Math.abs(b.x - a.x) > 0.5 ? (b.y - a.y) / (b.x - a.x) : 0;
      const otherStartY = c.y + slope1 * (b.x - a.x);

      ctx.fillStyle = hexWithOpacity(color, fillAlpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, c.y);
      ctx.lineTo(a.x, otherStartY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(a.x, otherStartY);
      ctx.lineTo(b.x, c.y);
      ctx.stroke();

      drawLineText(ctx, s, a, b);
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (s.p3) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'pitchfork': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const c = s.p3 ? bridge.ptToScreen(s.p3) : { x: b.x + 40, y: b.y + 60 };
      if (!c) break;

      const midX = (b.x + c.x) / 2;
      const midY = (b.y + c.y) / 2;
      const dx = midX - a.x;
      const dy = midY - a.y;
      const dist = Math.hypot(dx, dy);
      const ext = dist > 0.5 ? ((width + height) * 0.9) / dist : 1;

      const medEnd = { x: a.x + dx * ext, y: a.y + dy * ext };
      const bEnd = { x: b.x + dx * ext, y: b.y + dy * ext };
      const cEnd = { x: c.x + dx * ext, y: c.y + dy * ext };

      ctx.fillStyle = 'rgba(41, 98, 255, 0.09)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(bEnd.x, bEnd.y);
      ctx.lineTo(medEnd.x, medEnd.y);
      ctx.lineTo(midX, midY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(242, 54, 69, 0.09)';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(cEnd.x, cEnd.y);
      ctx.lineTo(medEnd.x, medEnd.y);
      ctx.lineTo(midX, midY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(medEnd.x, medEnd.y);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(bEnd.x, bEnd.y);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(cEnd.x, cEnd.y);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (s.p3) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'fib': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;

      const baseLeftX = Math.min(a.x, b.x);
      const baseRightX = Math.max(a.x, b.x, baseLeftX + 130);
      const extLeft = s.extend === 'left' || s.extend === 'both';
      const extRight = s.extend === 'right' || s.extend === 'both';
      const drawLeftX = extLeft ? 0 : baseLeftX;
      const drawRightX = extRight ? width : baseRightX;

      const levels = getEffectiveFibLevels(s)
        .filter((l) => l.enabled)
        .map((lvl) => {
          const price = computeFibLevelPrice(
            s.p1!.price,
            s.p2!.price,
            lvl.ratio,
            s.fibReverse,
            s.fibLogScale
          );
          const y = bridge.priceToY(price);
          return {
            ...lvl,
            price,
            y,
            effColor: s.fibUseOneColor && s.fibOneColor ? s.fibOneColor : lvl.color,
          };
        })
        .filter((item): item is typeof item & { y: number } => item.y !== null)
        .sort((u, v) => u.y - v.y);

      // 1. Background bands between adjacent enabled levels
      const bgEnabled = s.fibBackgroundEnabled !== false;
      const bgOpacity01 = (s.fibBackgroundOpacity ?? 12) / 100;
      if (bgEnabled && bgOpacity01 > 0 && levels.length > 1) {
        ctx.save();
        for (let i = 1; i < levels.length; i++) {
          const prev = levels[i - 1];
          const curr = levels[i];
          ctx.fillStyle = hexWithOpacity(curr.effColor, bgOpacity01);
          ctx.fillRect(
            drawLeftX,
            Math.min(prev.y, curr.y),
            drawRightX - drawLeftX,
            Math.abs(curr.y - prev.y)
          );
        }
        ctx.restore();
      }

      // 2. Diagonal Trend Line connecting p1 -> p2
      if (s.fibTrendLineEnabled !== false) {
        ctx.save();
        ctx.strokeStyle = s.fibTrendLineColor || '#787b86';
        ctx.lineWidth = s.fibTrendLineWidth || 1;
        applyLineDash(ctx, s.fibTrendLineStyle || 'dashed');
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Level horizontal lines + labels
      const lvlWidth = s.lineWidth || 1;
      const lvlStyle: DrawingLineStyle = s.lineStyle || 'solid';
      const showLevels = s.fibShowLevels !== false;
      const showPrices = s.fibShowPrices !== false;
      const levelsFmt = s.fibLevelsFormat || 'values';
      const labelH = s.fibLabelH || 'left';
      const labelV = s.fibLabelV || 'middle';
      const fontSize = s.fibFontSize || 12;

      ctx.save();
      ctx.lineWidth = lvlWidth;
      applyLineDash(ctx, lvlStyle);

      for (const lvl of levels) {
        const py = Math.round(lvl.y) + 0.5;
        ctx.strokeStyle = lvl.effColor;
        ctx.beginPath();
        ctx.moveTo(drawLeftX, py);
        ctx.lineTo(drawRightX, py);
        ctx.stroke();
      }
      ctx.restore();

      if (showLevels || showPrices) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.font = `400 ${fontSize}px ${TV_FONT_STACK}`;
        for (const lvl of levels) {
          const ratioStr =
            levelsFmt === 'percents'
              ? `${Number((lvl.ratio * 100).toFixed(2))}%`
              : `${lvl.ratio}`;
          const parts: string[] = [];
          if (showLevels) parts.push(ratioStr);
          if (showPrices) parts.push(`(${fmtPrice(lvl.price)})`);
          const labelText = parts.join(' ');
          if (!labelText) continue;

          let tx = drawLeftX;
          if (labelH === 'left') {
            if (extLeft) {
              ctx.textAlign = 'left';
              tx = 8;
            } else {
              ctx.textAlign = 'right';
              tx = drawLeftX - 6;
            }
          } else if (labelH === 'center') {
            ctx.textAlign = 'center';
            tx = (drawLeftX + drawRightX) / 2;
          } else {
            if (extRight) {
              ctx.textAlign = 'right';
              tx = width - 8;
            } else {
              ctx.textAlign = 'left';
              tx = drawRightX + 6;
            }
          }

          let ty = lvl.y;
          if (labelV === 'top') {
            ctx.textBaseline = 'bottom';
            ty = lvl.y - 3;
          } else if (labelV === 'bottom') {
            ctx.textBaseline = 'top';
            ty = lvl.y + 4;
          } else {
            ctx.textBaseline = 'middle';
            ty = lvl.y;
          }

          ctx.fillStyle = lvl.effColor;
          ctx.fillText(labelText, tx, ty);
        }
        ctx.restore();
      }

      // Optional custom text on Fib Retracement
      if (s.fibTextEnabled !== false && s.text && s.text.trim()) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.font = `400 ${fontSize}px ${TV_FONT_STACK}`;
        ctx.fillStyle = s.textColor || (s.fibUseOneColor && s.fibOneColor ? s.fibOneColor : '#787b86');
        const th = s.textAlignH || 'center';
        const tv = s.textAlignV || 'middle';
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const tx =
          th === 'left'
            ? drawLeftX + 8
            : th === 'right'
            ? drawRightX - 8
            : (drawLeftX + drawRightX) / 2;
        const ty = tv === 'top' ? minY - 6 : tv === 'bottom' ? maxY + 6 : (minY + maxY) / 2;
        ctx.textAlign = th;
        ctx.textBaseline = tv === 'top' ? 'bottom' : tv === 'bottom' ? 'top' : 'middle';
        ctx.fillText(s.text.trim(), tx, ty);
        ctx.restore();
      }

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'fib_ext': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const cAnchor = s.p3 || s.p2;
      const c = bridge.ptToScreen(cAnchor);
      if (!c) break;

      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(120,123,134,0.75)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const wave = s.p2.price - s.p1.price;
      const leftX = c.x;
      const rightX = Math.max(leftX + 160, Math.min(width - 70, leftX + 260));

      FIB_EXT_LEVELS.forEach((lvl) => {
        const price = cAnchor.price + wave * lvl.ratio;
        const y = bridge.priceToY(price);
        if (y === null) return;
        ctx.strokeStyle = lvl.color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();
        ctx.fillStyle = lvl.color;
        ctx.font = `400 10.5px ${TV_FONT_STACK}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${lvl.label} (${fmtPrice(price)})`, leftX + 4, y - 3);
      });

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (s.p3) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'long_pos':
    case 'short_pos': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const isLong = s.type === 'long_pos';
      const entry = s.p1.price;
      const target = s.targetPrice ?? (isLong ? entry * 1.04 : entry * 0.96);
      const stop = s.stopPrice ?? (isLong ? entry * 0.98 : entry * 1.02);

      const tyRaw = bridge.priceToY(target);
      const syRaw = bridge.priceToY(stop);
      if (tyRaw === null || syRaw === null) break;

      // Snap to crisp pixel boundaries for native TradingView sharpness
      const x1 = Math.round(Math.min(a.x, b.x));
      const x2 = Math.round(Math.max(a.x, b.x, x1 + 60));
      const boxW = x2 - x1;
      const ay = Math.round(a.y);
      const ty = Math.round(tyRaw);
      const sy = Math.round(syRaw);

      const targetFill = s.targetColor || 'rgba(8, 153, 129, 0.2)';
      const stopFill = s.stopColor || 'rgba(242, 54, 69, 0.2)';
      const lineCol = s.color || '#787b86';

      // Clean translucent Target & Stop zones (no heavy borders)
      ctx.fillStyle = targetFill;
      ctx.fillRect(x1, Math.min(ay, ty), boxW, Math.abs(ty - ay));

      // Subtle outer target accent hairline (pixel-snapped)
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexWithOpacity(targetFill, 1).replace(/,\s*[\d.]+\)$/, ', 0.42)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, ty + 0.5);
      ctx.lineTo(x2, ty + 0.5);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = stopFill;
      ctx.fillRect(x1, Math.min(ay, sy), boxW, Math.abs(sy - ay));

      // Crisp pixel-snapped Entry divider line
      ctx.save();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = s.lineWidth || 1;
      applyLineDash(ctx, s.lineStyle);
      const entryLineY = (s.lineWidth || 1) % 2 === 1 ? ay + 0.5 : ay;
      ctx.beginPath();
      ctx.moveTo(x1, entryLineY);
      ctx.lineTo(x2, entryLineY);
      ctx.stroke();
      ctx.restore();

      // Stats pills: ONLY show when selected, hovered, or Always Show Stats is enabled
      const statsMode = s.statsMode || 'all';
      const showStats = statsMode !== 'hidden' && (showHandles || Boolean(s.alwaysShowStats));

      if (showStats) {
        const reward = Math.abs(target - entry);
        const riskDist = Math.abs(entry - stop);
        const rr = riskDist > 0 ? reward / riskDist : 0;
        const tpPct = entry > 0 ? (reward / entry) * 100 : 0;
        const slPct = entry > 0 ? (riskDist / entry) * 100 : 0;
        const tickSize = getTickSizeForPrice(entry);
        const tpTicks = Math.round(reward / tickSize);
        const slTicks = Math.round(riskDist / tickSize);

        const accountSize = s.accountSize ?? 1000;
        const lotSize = Math.max(0.000001, s.lotSize ?? 1);
        const riskInput = s.risk ?? 25;
        const riskUnit = s.riskUnit ?? '%';
        const riskMoney = riskUnit === '%' ? accountSize * (riskInput / 100) : riskInput;
        const rawQty = riskDist > 0 ? riskMoney / (riskDist * lotSize) : 0;

        let qtyStr: string;
        if (s.qtyPrecision && s.qtyPrecision !== 'Default') {
          const dp = parseInt(s.qtyPrecision, 10);
          qtyStr = Number.isFinite(dp) ? rawQty.toFixed(dp) : rawQty.toFixed(3);
        } else {
          qtyStr =
            rawQty >= 1000
              ? rawQty.toFixed(0)
              : rawQty >= 10
              ? rawQty.toFixed(2)
              : rawQty.toFixed(3);
        }

        const targetAmount = accountSize + rawQty * reward * lotSize;
        const stopAmount = accountSize - rawQty * riskDist * lotSize;
        const liveClose = bridge.lastClose ?? entry;
        const openPnl = (isLong ? liveClose - entry : entry - liveClose) * rawQty * lotSize;

        // Match exact TradingView number formatting (e.g., 1474.08, 750, 1.9)
        const fmtAmt = (n: number) => Number(n.toFixed(2)).toString();
        const fmtRR = (n: number) => Number(n.toFixed(2)).toString();
        const fmtPnl = (n: number) => {
          const absFmt = Math.abs(n).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return n < 0 ? `−${absFmt}` : absFmt;
        };

        // Sleek regular-weight TradingView typography (delicate, crisp, never bloated/chunky)
        const userFontSize = s.fontSize || 12;
        const renderFs = Math.max(9.5, userFontSize - 1);
        const textCol = s.textColor || '#ffffff';
        const compact = Boolean(s.compactStatsMode);
        const cx = x1 + boxW / 2;

        ctx.save();
        ctx.setLineDash([]);
        ctx.font = `400 ${renderFs}px ${TV_FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const pillH = Math.round(renderFs * 1.72); // ~19px at default 12 setting
        const padX = compact ? 6 : 7;

        const drawPill = (label: string, centerX: number, topY: number, bg: string) => {
          const tw = Math.ceil(ctx.measureText(label).width + padX * 2);
          const clampedX = Math.round(Math.max(6, Math.min(width - tw - 6, centerX - tw / 2)));
          const py = Math.round(topY);
          ctx.fillStyle = bg;
          drawRoundedRect(ctx, clampedX, py, tw, pillH, 3);
          ctx.fill();
          ctx.fillStyle = textCol;
          ctx.fillText(label, clampedX + tw / 2, py + pillH / 2 + 0.5);
        };

        // 1. Target Pill (above Target zone for Long, below Target zone for Short)
        if (statsMode === 'all' || statsMode === 'price') {
          const tpLabel = compact
            ? `Target: ${fmtPrice(reward)} (${tpPct.toFixed(2)}%)`
            : `Target: ${fmtPrice(reward)} (${tpPct.toFixed(3)}%) ${tpTicks.toLocaleString('en-US')}, Amount: ${fmtAmt(targetAmount)}`;
          const tpPillY = isLong ? ty - pillH - 9 : ty + 9;
          drawPill(tpLabel, cx, tpPillY, '#089981');
        }

        // 2. Stop Pill (below Stop zone for Long, above Stop zone for Short)
        if (statsMode === 'all' || statsMode === 'price') {
          const slLabel = compact
            ? `Stop: ${fmtPrice(riskDist)} (${slPct.toFixed(2)}%)`
            : `Stop: ${fmtPrice(riskDist)} (${slPct.toFixed(3)}%) ${slTicks.toLocaleString('en-US')}, Amount: ${fmtAmt(stopAmount)}`;
          const slPillY = isLong ? sy + 9 : sy - pillH - 9;
          drawPill(slLabel, cx, slPillY, '#f23645');
        }

        // 3. Center Open PnL & Risk/Reward Pill (compact + crisp 1px white outline — exact TradingView!)
        if (statsMode === 'all' || statsMode === 'percent') {
          const pnlBg = openPnl >= 0 ? '#089981' : '#f23645';
          if (compact) {
            const cLabel = `R/R: ${fmtRR(rr)}, Qty: ${qtyStr}`;
            const cTop = isLong ? ay - pillH - 6 : ay + 6;
            drawPill(cLabel, cx, cTop, pnlBg);
          } else {
            const line1 = `Open PnL: ${fmtPnl(openPnl)}, Qty: ${qtyStr}`;
            const line2 = `Risk/reward ratio: ${fmtRR(rr)}`;
            const lineH = Math.round(renderFs * 1.32); // ~14.5px tight spacing
            const padY = 4;
            const tw = Math.ceil(
              Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 14
            );
            const th = lineH * 2 + padY * 2;
            const clampedX = Math.round(Math.max(6, Math.min(width - tw - 6, cx - tw / 2)));
            const boxTop = Math.round(isLong ? ay - th - 7 : ay + 7);
            ctx.fillStyle = pnlBg;
            drawRoundedRect(ctx, clampedX, boxTop, tw, th, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, clampedX + 0.5, boxTop + 0.5, tw - 1, th - 1, 4);
            ctx.stroke();
            ctx.fillStyle = textCol;
            ctx.fillText(line1, clampedX + tw / 2, boxTop + padY + lineH * 0.5 + 0.5);
            ctx.fillText(line2, clampedX + tw / 2, boxTop + padY + lineH * 1.5 + 0.5);
          }
        }

        ctx.restore();
      }

      if (showHandles) {
        // Exact TradingView handles: Entry left (p1) is a CIRCLE; Target, Stop, and Width (p2) are ROUNDED SQUARES!
        const drawPosSquare = (hx: number, hy: number) => {
          ctx.save();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#2962ff';
          ctx.lineWidth = isSelected ? 1.8 : 1.5;
          drawRoundedRect(ctx, Math.round(hx) - 4, Math.round(hy) - 4, 8, 8, 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        };
        drawPosSquare(x1, ty);
        drawHandleDot(ctx, x1, ay, isSelected);
        drawPosSquare(x2, ay);
        drawPosSquare(x1, sy);
      }
      break;
    }

    case 'rect': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      ctx.fillStyle = hexWithOpacity(color, fillAlpha);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      drawBoxText(ctx, s, Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y));
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'ellipse': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.max(2, Math.abs(b.x - a.x) / 2);
      const ry = Math.max(2, Math.abs(b.y - a.y) / 2);
      ctx.fillStyle = hexWithOpacity(color, fillAlpha);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawBoxText(ctx, s, cx - rx, cx + rx, cy - ry, cy + ry);
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'triangle': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const c = s.p3 ? bridge.ptToScreen(s.p3) : null;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (c) {
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = hexWithOpacity(color, fillAlpha);
        ctx.fill();
      }
      ctx.stroke();
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
        if (c) drawHandleDot(ctx, c.x, c.y, isSelected);
      }
      break;
    }

    case 'arrow_line': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      strokeLineWithText(ctx, s, a, b, a, b, 10);
      drawArrowHead(ctx, a.x, a.y, b.x, b.y, 11);
      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        if (!isDraft) drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'path': {
      if (!s.points || s.points.length < 2) break;
      const pts = s.points.map(bridge.ptToScreen).filter(Boolean) as ScreenPoint[];
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      const prev = pts[pts.length - 2];
      const last = pts[pts.length - 1];
      drawArrowHead(ctx, prev.x, prev.y, last.x, last.y, 10);
      if (showHandles) {
        pts.forEach((p) => drawHandleDot(ctx, p.x, p.y, isSelected));
      }
      break;
    }

    case 'brush':
    case 'highlighter': {
      if (!s.points || s.points.length < 2) break;
      const pts = s.points.map(bridge.ptToScreen).filter(Boolean) as ScreenPoint[];
      if (pts.length < 2) break;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.type === 'highlighter') {
        ctx.lineWidth = Math.max(12, (s.lineWidth || 2) * 5);
        ctx.globalAlpha = 0.28;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }

    case 'text': {
      if (!s.p1) break;
      const a = bridge.ptToScreen(s.p1);
      if (!a) break;
      const lines = (s.text || 'Note').split('\n');
      const fs = s.fontSize || 13;
      const weight = s.fontBold ? '700' : '400';
      const italic = s.fontItalic ? 'italic ' : '';
      ctx.setLineDash([]);
      ctx.font = `${italic}${weight} ${fs}px ${TV_FONT_STACK}`;
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
      const lh = fs * 1.3;
      const th = lines.length * lh + 10;
      ctx.fillStyle = 'rgba(19, 23, 34, 0.88)';
      drawRoundedRect(ctx, a.x, a.y - 14, tw, th, 4);
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#2962ff' : color;
      ctx.lineWidth = isSelected ? 1.8 : 1.1;
      ctx.stroke();
      ctx.fillStyle = s.textColor || '#ffffff';
      ctx.textAlign = 'left';
      lines.forEach((l, i) => ctx.fillText(l, a.x + 8, a.y - 14 + fs + 4 + i * lh));
      if (showHandles) drawHandleDot(ctx, a.x, a.y, isSelected);
      break;
    }

    case 'callout': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const txt = s.text || 'Callout';
      const fs = s.fontSize || 12;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.font = `${s.fontItalic ? 'italic ' : ''}${s.fontBold ? '700' : '400'} ${fs}px ${TV_FONT_STACK}`;
      const tw = ctx.measureText(txt).width + 18;
      ctx.fillStyle = color;
      drawRoundedRect(ctx, b.x - tw / 2, b.y - 14, tw, fs + 14, 5);
      ctx.fill();
      ctx.fillStyle = s.textColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(txt, b.x, b.y + 3);

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }

    case 'price_label': {
      if (!s.p1) break;
      const a = bridge.ptToScreen(s.p1);
      if (!a) break;
      const lbl = fmtPrice(s.p1.price);
      ctx.setLineDash([]);
      ctx.font = `500 11px ${TV_FONT_STACK}`;
      const tw = ctx.measureText(lbl).width + 16;
      const h = 22;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + 9, a.y - h / 2);
      ctx.lineTo(a.x + 9 + tw, a.y - h / 2);
      ctx.lineTo(a.x + 9 + tw, a.y + h / 2);
      ctx.lineTo(a.x + 9, a.y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(lbl, a.x + 15, a.y + 4);
      if (showHandles) drawHandleDot(ctx, a.x, a.y, isSelected);
      break;
    }

    case 'price_range':
    case 'date_range':
    case 'measure': {
      if (!s.p1 || !s.p2) break;
      const a = bridge.ptToScreen(s.p1);
      const b = bridge.ptToScreen(s.p2);
      if (!a || !b) break;
      const diff = s.p2.price - s.p1.price;
      const pct = s.p1.price ? (diff / s.p1.price) * 100 : 0;
      const up = pct >= 0;
      const l1 = bridge.timeToLogical(s.p1.time) ?? 0;
      const l2 = bridge.timeToLogical(s.p2.time) ?? 0;
      const bars = Math.abs(Math.round(l2 - l1));
      const dur = fmtDuration(s.p2.time - s.p1.time);

      const boxCol = s.type === 'date_range' ? '#2962ff' : up ? '#2962ff' : '#f23645';
      ctx.fillStyle = `${boxCol}22`;
      ctx.strokeStyle = boxCol;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.beginPath();
      if (s.type === 'date_range') {
        ctx.moveTo(a.x, my);
        ctx.lineTo(b.x, my);
      } else {
        ctx.moveTo(mx, a.y);
        ctx.lineTo(mx, b.y);
      }
      ctx.stroke();

      const label =
        s.type === 'price_range'
          ? `${up ? '+' : ''}${fmtPrice(diff)} (${up ? '+' : ''}${pct.toFixed(2)}%)`
          : s.type === 'date_range'
          ? `${bars} bars · ${dur}`
          : `${up ? '+' : ''}${fmtPrice(diff)} (${up ? '+' : ''}${pct.toFixed(2)}%) · ${bars} bars (${dur})`;

      ctx.setLineDash([]);
      ctx.font = `400 11px ${TV_FONT_STACK}`;
      const tw = Math.ceil(ctx.measureText(label).width + 14);
      const boxY = Math.round(Math.max(8, Math.min(height - 34, Math.max(a.y, b.y) + 8)));
      ctx.fillStyle = boxCol;
      drawRoundedRect(ctx, mx - tw / 2, boxY, tw, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, mx, boxY + 14.5);

      if (showHandles) {
        drawHandleDot(ctx, a.x, a.y, isSelected);
        drawHandleDot(ctx, b.x, b.y, isSelected);
      }
      break;
    }
  }

  ctx.restore();
}
