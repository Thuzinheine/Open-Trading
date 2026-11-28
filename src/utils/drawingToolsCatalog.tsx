import React from 'react';
import { DrawingTool } from '../types/trading';

export interface ToolDefinition {
  id: DrawingTool;
  label: string;
  shortcut?: string;
  section?: string;
  renderIcon: (className?: string) => React.ReactNode;
}

export interface ToolGroup {
  id: string;
  title: string;
  defaultTool: DrawingTool;
  tools: ToolDefinition[];
}

const SvgIcon: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = 'w-[24px] h-[24px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

/**
 * Exact 8 top-level Drawing Tool Groups matching the TradingView Left Toolbox screenshot 1:1:
 * 1. Crosshair
 * 2. Trendline (diagonal + 2 hollow end circles)
 * 3. Fib Retracement (4 horizontal lines, hollow circle right of line 2 & left of line 4)
 * 4. Patterns (XABCD 5-node geometric web)
 * 5. Projection / Long Position (monochrome L between horizontal lines with 2 left circles)
 * 6. Brush (curved teardrop artist paintbrush)
 * 7. Text (serif T with hanging top serifs and foot)
 * 8. Icons / Markers (smiley face circle)
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'cursors',
    title: 'Cursors',
    defaultTool: 'cursor',
    tools: [
      {
        id: 'cursor',
        label: 'Crosshair',
        shortcut: 'Esc',
        section: 'CURSORS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="12" y1="4.5" x2="12" y2="9.2" />
            <line x1="12" y1="14.8" x2="12" y2="19.5" />
            <line x1="4.5" y1="12" x2="9.2" y2="12" />
            <line x1="14.8" y1="12" x2="19.5" y2="12" />
          </SvgIcon>
        ),
      },
      {
        id: 'dot',
        label: 'Dot',
        section: 'CURSORS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <circle cx="12" cy="12" r="2.1" fill="currentColor" />
          </SvgIcon>
        ),
      },
      {
        id: 'arrow',
        label: 'Arrow',
        section: 'CURSORS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M5.5 4.5l12.5 6.8-5.7 1.7-2.2 5.8-4.6-14.3z" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'lines',
    title: 'Trend Line Tools',
    defaultTool: 'trendline',
    tools: [
      {
        id: 'trendline',
        label: 'Trendline',
        shortcut: 'Alt + T',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="6.4" y1="17.6" x2="17.6" y2="6.4" />
            <circle cx="5.2" cy="18.8" r="1.75" fill="var(--bg-surface)" />
            <circle cx="18.8" cy="5.2" r="1.75" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'ray',
        label: 'Ray',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="5.2" y1="18.8" x2="19.8" y2="4.2" />
            <circle cx="5.2" cy="18.8" r="1.7" fill="var(--bg-surface)" />
            <circle cx="12.5" cy="11.5" r="1.7" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'infoline',
        label: 'Info line',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.8" y1="18.5" x2="17.2" y2="6.1" />
            <circle cx="4.8" cy="18.5" r="1.55" fill="var(--bg-surface)" />
            <circle cx="17.2" cy="6.1" r="1.55" fill="var(--bg-surface)" />
            <rect x="13" y="14" width="6.8" height="4.8" rx="1.1" />
          </SvgIcon>
        ),
      },
      {
        id: 'extended',
        label: 'Extended line',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" />
            <circle cx="8.5" cy="15.5" r="1.55" fill="var(--bg-surface)" />
            <circle cx="15.5" cy="8.5" r="1.55" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'angle',
        label: 'Trend angle',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="18" x2="19.5" y2="18" />
            <line x1="4.5" y1="18" x2="17.5" y2="5.5" />
            <path d="M11 18a6.5 6.5 0 0 0-2-4.7" />
            <circle cx="4.5" cy="18" r="1.5" fill="var(--bg-surface)" />
            <circle cx="17.5" cy="5.5" r="1.5" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'hline',
        label: 'Horizontal line',
        shortcut: 'Alt + H',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="3.5" y1="12" x2="20.5" y2="12" />
            <circle cx="12" cy="12" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'hray',
        label: 'Horizontal ray',
        shortcut: 'Alt + J',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="6.5" y1="12" x2="20.5" y2="12" />
            <circle cx="5.5" cy="12" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'vline',
        label: 'Vertical line',
        shortcut: 'Alt + V',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="12" y1="3.5" x2="12" y2="20.5" />
            <circle cx="12" cy="12" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'crossline',
        label: 'Crossline',
        shortcut: 'Alt + C',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="3.5" y1="12" x2="20.5" y2="12" />
            <line x1="12" y1="3.5" x2="12" y2="20.5" />
            <circle cx="12" cy="12" r="1.7" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'channel',
        label: 'Parallel channel',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="14" x2="15" y2="4.5" />
            <line x1="9" y1="19.5" x2="19.5" y2="10" />
            <circle cx="5.8" cy="12.8" r="1.4" fill="var(--bg-surface)" />
            <circle cx="14" cy="5.4" r="1.4" fill="var(--bg-surface)" />
            <circle cx="14.5" cy="14.6" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'flat_channel',
        label: 'Flat top/bottom',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="7" x2="19.5" y2="7" />
            <line x1="4.5" y1="18" x2="19.5" y2="12" />
            <circle cx="5.2" cy="7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="18.8" cy="7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="5.2" cy="17.7" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'disjoint_channel',
        label: 'Disjoint channel',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="11" x2="19.5" y2="5.5" />
            <line x1="4.5" y1="14" x2="19.5" y2="19" />
            <circle cx="5.2" cy="10.7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="18.8" cy="5.7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="18.8" cy="18.7" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'pitchfork',
        label: 'Pitchfork',
        section: 'PITCHFORKS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="19" x2="18" y2="5.5" />
            <line x1="8" y1="11" x2="15" y2="4.5" />
            <line x1="12" y1="17" x2="19.5" y2="9.5" />
            <line x1="8" y1="11" x2="12" y2="17" strokeDasharray="2 2" />
            <circle cx="4.5" cy="19" r="1.4" fill="var(--bg-surface)" />
            <circle cx="8" cy="11" r="1.4" fill="var(--bg-surface)" />
            <circle cx="12" cy="17" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'fib',
    title: 'Fib & Gann Tools',
    defaultTool: 'fib',
    tools: [
      {
        id: 'fib',
        label: 'Fib retracement',
        shortcut: 'Alt + F',
        section: 'FIBONACCI',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView 4-line Fib icon: circle on line 2 (right) & line 4 (left) */}
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="10" x2="17" y2="10" />
            <line x1="4" y1="14" x2="20" y2="14" />
            <line x1="7" y1="18" x2="20" y2="18" />
            <circle cx="18.6" cy="10" r="1.65" fill="var(--bg-surface)" />
            <circle cx="5.4" cy="18" r="1.65" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'fib_ext',
        label: 'Trend-based fib extension',
        section: 'FIBONACCI',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <polyline points="4.5,18 11,8 15,13" />
            <line x1="12" y1="5.5" x2="20.5" y2="5.5" />
            <line x1="12" y1="9.5" x2="20.5" y2="9.5" />
            <line x1="12" y1="15" x2="20.5" y2="15" />
            <circle cx="4.5" cy="18" r="1.4" fill="var(--bg-surface)" />
            <circle cx="11" cy="8" r="1.4" fill="var(--bg-surface)" />
            <circle cx="15" cy="13" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'patterns',
    title: 'Patterns',
    defaultTool: 'path',
    tools: [
      {
        id: 'path',
        label: 'XABCD Pattern / Path',
        section: 'PATTERNS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView 5-node XABCD Harmonic Pattern icon */}
            <line x1="5.5" y1="18.5" x2="8.2" y2="7" />
            <line x1="8.2" y1="7" x2="12" y2="12.5" />
            <line x1="12" y1="12.5" x2="16.5" y2="7.5" />
            <line x1="16.5" y1="7.5" x2="19" y2="17" />
            <line x1="5.5" y1="18.5" x2="12" y2="12.5" />
            <line x1="12" y1="12.5" x2="19" y2="17" />
            <circle cx="5.5" cy="18.5" r="1.55" fill="var(--bg-surface)" />
            <circle cx="8.2" cy="7" r="1.55" fill="var(--bg-surface)" />
            <circle cx="12" cy="12.5" r="1.55" fill="var(--bg-surface)" />
            <circle cx="16.5" cy="7.5" r="1.55" fill="var(--bg-surface)" />
            <circle cx="19" cy="17" r="1.55" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'triangle',
        label: 'Triangle pattern',
        section: 'PATTERNS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <polygon points="12,4.8 19.5,18.5 4.5,18.5" />
            <circle cx="12" cy="4.8" r="1.5" fill="var(--bg-surface)" />
            <circle cx="19.5" cy="18.5" r="1.5" fill="var(--bg-surface)" />
            <circle cx="4.5" cy="18.5" r="1.5" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'forecast',
    title: 'Prediction & Measurement',
    defaultTool: 'long_pos',
    tools: [
      {
        id: 'long_pos',
        label: 'Long position',
        section: 'PROJECTION',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView monochrome Projection [o--- / L / --- / o---] icon */}
            <line x1="7.5" y1="6.2" x2="19.5" y2="6.2" />
            <line x1="5.5" y1="14.2" x2="19.5" y2="14.2" />
            <line x1="7.5" y1="18.2" x2="19.5" y2="18.2" />
            <path d="M11.6 8.3v3.9h2.7" />
            <circle cx="5.7" cy="6.2" r="1.6" fill="var(--bg-surface)" />
            <circle cx="5.7" cy="18.2" r="1.6" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'short_pos',
        label: 'Short position',
        section: 'PROJECTION',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="7.5" y1="6.2" x2="19.5" y2="6.2" />
            <line x1="5.5" y1="10.2" x2="19.5" y2="10.2" />
            <line x1="7.5" y1="18.2" x2="19.5" y2="18.2" />
            <path d="M13.8 12.2c-1.5-.3-2.3.4-1.4 1.3.9.8.2 2-1.5 1.8" />
            <circle cx="5.7" cy="6.2" r="1.6" fill="var(--bg-surface)" />
            <circle cx="5.7" cy="18.2" r="1.6" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'price_range',
        label: 'Price range',
        section: 'MEASUREMENT',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <rect x="5" y="5" width="14" height="14" rx="1" strokeDasharray="2 2" />
            <path d="M12 7.5v9M9.5 10l2.5-2.5 2.5 2.5M9.5 14l2.5 2.5 2.5-2.5" />
          </SvgIcon>
        ),
      },
      {
        id: 'date_range',
        label: 'Date range',
        section: 'MEASUREMENT',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <rect x="5" y="5" width="14" height="14" rx="1" strokeDasharray="2 2" />
            <path d="M7.5 12h9M10 9.5L7.5 12 10 14.5M14 9.5l2.5 2.5-2.5 2.5" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'shapes',
    title: 'Brushes & Geometric Shapes',
    defaultTool: 'brush',
    tools: [
      {
        id: 'brush',
        label: 'Brush',
        section: 'BRUSHES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView teardrop artist paintbrush */}
            <path d="M4.2 18.8c3.6.3 6.9-.6 8.3-2.6 1.1-1.6.5-3.6-1-4.5-1.5-.9-3.3-.3-4.1 1.2-1 1.8-1.1 4.1-3.2 5.9z" />
            <path d="M12.2 12.2l1.8-1.9c.7-.7 1.2-1.8.8-2.6" />
            <path d="M14.3 13.4l5.2-4.6" />
            <path d="M12.2 12.2l2.1 1.2" />
          </SvgIcon>
        ),
      },
      {
        id: 'highlighter',
        label: 'Highlighter',
        section: 'BRUSHES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M15 4.5l4.5 4.5-8.5 8.5H6.5V13L15 4.5z" />
            <line x1="4.5" y1="19.5" x2="18.5" y2="19.5" strokeWidth="2" />
          </SvgIcon>
        ),
      },
      {
        id: 'rect',
        label: 'Rectangle',
        section: 'SHAPES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <rect x="4.5" y="6.5" width="15" height="11" rx="0.8" />
            <circle cx="4.5" cy="6.5" r="1.4" fill="var(--bg-surface)" />
            <circle cx="19.5" cy="17.5" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'ellipse',
        label: 'Circle / Ellipse',
        section: 'SHAPES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <ellipse cx="12" cy="12" rx="7.8" ry="5.8" />
          </SvgIcon>
        ),
      },
      {
        id: 'arrow_line',
        label: 'Arrow',
        section: 'ARROWS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
            <polyline points="12.5,5.5 18.5,5.5 18.5,11.5" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'annotations',
    title: 'Text',
    defaultTool: 'text',
    tools: [
      {
        id: 'text',
        label: 'Text',
        section: 'ANNOTATIONS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView serif T with hanging top serifs & foot */}
            <path d="M6.2 7.8V5.8h11.6v2" />
            <line x1="12" y1="5.8" x2="12" y2="18.4" />
            <line x1="9.2" y1="18.4" x2="14.8" y2="18.4" />
          </SvgIcon>
        ),
      },
      {
        id: 'callout',
        label: 'Callout',
        section: 'ANNOTATIONS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M5 5.5h14v9.5h-8l-3.8 3.8V15H5V5.5z" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'icons',
    title: 'Icons & Labels',
    defaultTool: 'price_label',
    tools: [
      {
        id: 'price_label',
        label: 'Price label / Marker',
        section: 'ICONS & LABELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            {/* Exact TradingView Smiley Face Icon */}
            <circle cx="12" cy="12" r="7.8" />
            <circle cx="9.4" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="14.6" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
            <path d="M8.8 14.1a4 4 0 0 0 6.4 0" />
          </SvgIcon>
        ),
      },
    ],
  },
];

export const MEASURE_TOOL: ToolDefinition = {
  id: 'measure',
  label: 'Measure',
  renderIcon: (c) => (
    <SvgIcon className={c}>
      {/* Exact TradingView 45-degree ruler with 4 inner ticks along top-left edge */}
      <path d="M4.2 16.4L16.4 4.2l3.4 3.4L7.6 19.8 4.2 16.4z" />
      <line x1="14" y1="6.6" x2="15.5" y2="8.1" />
      <line x1="11.7" y1="8.9" x2="13.2" y2="10.4" />
      <line x1="9.4" y1="11.2" x2="10.9" y2="12.7" />
      <line x1="7.1" y1="13.5" x2="8.6" y2="15" />
    </SvgIcon>
  ),
};

export const ZOOM_TOOL: ToolDefinition = {
  id: 'zoom_in',
  label: 'Zoom In (Drag Box)',
  renderIcon: (c) => (
    <SvgIcon className={c}>
      {/* Exact TradingView Magnifying Glass + */}
      <circle cx="10.8" cy="10.8" r="6.1" />
      <line x1="19.5" y1="19.5" x2="15.3" y2="15.3" />
      <line x1="10.8" y1="8.1" x2="10.8" y2="13.5" />
      <line x1="8.1" y1="10.8" x2="13.5" y2="10.8" />
    </SvgIcon>
  ),
};

export const ALL_TOOLS_MAP: Record<DrawingTool, ToolDefinition> = [
  ...TOOL_GROUPS.flatMap((g) => g.tools),
  MEASURE_TOOL,
  ZOOM_TOOL,
].reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<DrawingTool, ToolDefinition>);

export function findGroupForTool(tool: DrawingTool): ToolGroup | undefined {
  return TOOL_GROUPS.find((g) => g.tools.some((t) => t.id === tool));
}
