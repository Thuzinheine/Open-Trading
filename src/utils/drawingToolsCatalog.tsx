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
  className = 'w-[18px] h-[18px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

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
            <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
          </SvgIcon>
        ),
      },
      {
        id: 'dot',
        label: 'Dot',
        section: 'CURSORS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </SvgIcon>
        ),
      },
      {
        id: 'arrow',
        label: 'Arrow',
        section: 'CURSORS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M5 4l13 7-6 1.8L9.8 19 5 4z" />
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
            <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
            <circle cx="5" cy="19" r="1.8" fill="var(--bg-surface)" />
            <circle cx="19" cy="5" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'ray',
        label: 'Ray',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="5" y1="19" x2="20" y2="4" />
            <circle cx="5" cy="19" r="1.8" fill="var(--bg-surface)" />
            <circle cx="12.5" cy="11.5" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'infoline',
        label: 'Info line',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4.5" y1="18.5" x2="17.5" y2="5.5" />
            <circle cx="4.5" cy="18.5" r="1.6" fill="var(--bg-surface)" />
            <circle cx="17.5" cy="5.5" r="1.6" fill="var(--bg-surface)" />
            <rect x="13" y="14" width="7" height="5" rx="1.2" />
          </SvgIcon>
        ),
      },
      {
        id: 'extended',
        label: 'Extended line',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="3" y1="21" x2="21" y2="3" />
            <circle cx="8.5" cy="15.5" r="1.6" fill="var(--bg-surface)" />
            <circle cx="15.5" cy="8.5" r="1.6" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'angle',
        label: 'Trend angle',
        section: 'LINES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4" y1="18" x2="20" y2="18" />
            <line x1="4" y1="18" x2="18" y2="5" />
            <path d="M11 18a7 7 0 00-2.1-5" />
            <circle cx="4" cy="18" r="1.5" fill="var(--bg-surface)" />
            <circle cx="18" cy="5" r="1.5" fill="var(--bg-surface)" />
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
            <line x1="3" y1="12" x2="21" y2="12" />
            <circle cx="12" cy="12" r="2" fill="var(--bg-surface)" />
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
            <line x1="6" y1="12" x2="21" y2="12" />
            <circle cx="5.5" cy="12" r="2" fill="var(--bg-surface)" />
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
            <line x1="12" y1="3" x2="12" y2="21" />
            <circle cx="12" cy="12" r="2" fill="var(--bg-surface)" />
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
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <circle cx="12" cy="12" r="1.8" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'channel',
        label: 'Parallel channel',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4" y1="14" x2="15" y2="4" />
            <line x1="9" y1="20" x2="20" y2="10" />
            <circle cx="5.5" cy="12.5" r="1.4" fill="var(--bg-surface)" />
            <circle cx="14" cy="5" r="1.4" fill="var(--bg-surface)" />
            <circle cx="14.5" cy="15" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'flat_channel',
        label: 'Flat top/bottom',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="18" x2="20" y2="12" />
            <circle cx="5" cy="7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="19" cy="7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="5" cy="17.5" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'disjoint_channel',
        label: 'Disjoint channel',
        section: 'CHANNELS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4" y1="11" x2="20" y2="5" />
            <line x1="4" y1="14" x2="20" y2="19" />
            <circle cx="5" cy="10.7" r="1.4" fill="var(--bg-surface)" />
            <circle cx="19" cy="5.4" r="1.4" fill="var(--bg-surface)" />
            <circle cx="19" cy="18.7" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'pitchfork',
        label: 'Pitchfork',
        section: 'PITCHFORKS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="4" y1="19" x2="18" y2="5" />
            <line x1="8" y1="11" x2="15" y2="4" />
            <line x1="12" y1="17" x2="20" y2="9" />
            <line x1="8" y1="11" x2="12" y2="17" strokeDasharray="2 2" />
            <circle cx="4" cy="19" r="1.4" fill="var(--bg-surface)" />
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
        section: 'FIBONACCI',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="14" x2="21" y2="14" />
            <line x1="3" y1="18" x2="21" y2="18" />
            <circle cx="6" cy="18" r="1.5" fill="var(--bg-surface)" />
            <circle cx="18" cy="6" r="1.5" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'fib_ext',
        label: 'Trend-based fib extension',
        section: 'FIBONACCI',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <polyline points="4,18 11,8 15,13" />
            <line x1="12" y1="5" x2="21" y2="5" />
            <line x1="12" y1="9" x2="21" y2="9" />
            <line x1="12" y1="15" x2="21" y2="15" />
            <circle cx="4" cy="18" r="1.4" fill="var(--bg-surface)" />
            <circle cx="11" cy="8" r="1.4" fill="var(--bg-surface)" />
            <circle cx="15" cy="13" r="1.4" fill="var(--bg-surface)" />
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
            <rect x="4" y="4" width="16" height="9" rx="1" stroke="#089981" />
            <rect x="4" y="13" width="16" height="7" rx="1" stroke="#f23645" />
            <line x1="4" y1="13" x2="20" y2="13" />
          </SvgIcon>
        ),
      },
      {
        id: 'short_pos',
        label: 'Short position',
        section: 'PROJECTION',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <rect x="4" y="4" width="16" height="7" rx="1" stroke="#f23645" />
            <rect x="4" y="11" width="16" height="9" rx="1" stroke="#089981" />
            <line x1="4" y1="11" x2="20" y2="11" />
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
            <path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3" />
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
            <path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'shapes',
    title: 'Brushes & Geometric Shapes',
    defaultTool: 'rect',
    tools: [
      {
        id: 'brush',
        label: 'Brush',
        section: 'BRUSHES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M18.5 3.5a2.8 2.8 0 014 4L10 20l-5.5 1.5L6 16 18.5 3.5z" />
          </SvgIcon>
        ),
      },
      {
        id: 'highlighter',
        label: 'Highlighter',
        section: 'BRUSHES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M15 4l5 5-9 9H6v-5l9-9z" />
            <line x1="4" y1="20" x2="18" y2="20" strokeWidth="2.4" />
          </SvgIcon>
        ),
      },
      {
        id: 'rect',
        label: 'Rectangle',
        section: 'SHAPES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <rect x="4" y="6" width="16" height="12" rx="1" />
            <circle cx="4" cy="6" r="1.4" fill="var(--bg-surface)" />
            <circle cx="20" cy="18" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'ellipse',
        label: 'Circle / Ellipse',
        section: 'SHAPES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <ellipse cx="12" cy="12" rx="8" ry="6" />
          </SvgIcon>
        ),
      },
      {
        id: 'triangle',
        label: 'Triangle',
        section: 'SHAPES',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <polygon points="12,4 20,19 4,19" />
            <circle cx="12" cy="4" r="1.4" fill="var(--bg-surface)" />
            <circle cx="20" cy="19" r="1.4" fill="var(--bg-surface)" />
            <circle cx="4" cy="19" r="1.4" fill="var(--bg-surface)" />
          </SvgIcon>
        ),
      },
      {
        id: 'arrow_line',
        label: 'Arrow',
        section: 'ARROWS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <line x1="5" y1="19" x2="19" y2="5" />
            <polyline points="12,5 19,5 19,12" />
          </SvgIcon>
        ),
      },
      {
        id: 'path',
        label: 'Path (Multi-point)',
        section: 'ARROWS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <polyline points="4,17 9,8 14,15 20,6" />
            <polyline points="16,6 20,6 20,10" />
          </SvgIcon>
        ),
      },
    ],
  },
  {
    id: 'annotations',
    title: 'Text & Annotations',
    defaultTool: 'text',
    tools: [
      {
        id: 'text',
        label: 'Text',
        section: 'ANNOTATIONS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M5 6h14M12 6v13M9 19h6" />
          </SvgIcon>
        ),
      },
      {
        id: 'callout',
        label: 'Callout',
        section: 'ANNOTATIONS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M5 5h14v10H11l-4 4v-4H5V5z" />
          </SvgIcon>
        ),
      },
      {
        id: 'price_label',
        label: 'Price label',
        section: 'ANNOTATIONS',
        renderIcon: (c) => (
          <SvgIcon className={c}>
            <path d="M4 12l4-5h12v10H8l-4-5z" />
            <circle cx="9" cy="12" r="1.2" fill="currentColor" />
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
      <path d="M3 17L17 3l4 4L7 21 3 17z" />
      <path d="M9.5 10.5l2 2M13 7l2 2M6.5 13.5l2 2" />
    </SvgIcon>
  ),
};

export const ZOOM_TOOL: ToolDefinition = {
  id: 'zoom_in',
  label: 'Zoom In (Drag Box)',
  renderIcon: (c) => (
    <SvgIcon className={c}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.2" y2="16.2" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
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
