import React from 'react';

interface IconProps {
  className?: string;
}

/** TradingView Hexagon Nut Settings Icon (used in TopBar, Indicator hover row, Price Scale corner) */
export const HexSettingsIcon: React.FC<IconProps> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2.75l7.75 4.5v9.5L12 21.25l-7.75-4.5v-9.5L12 2.75z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
);

/** Tiny two-candlestick icon inside the TopBar Symbol Pill (matches TradingView LTCUSDT [00]) */
export const TwoCandlesPillIcon: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="6" y1="3" x2="6" y2="5.5" />
    <rect x="4.2" y="5.5" width="3.6" height="6.5" rx="0.8" />
    <line x1="6" y1="12" x2="6" y2="15" />
    <line x1="12" y1="3.5" x2="12" y2="6.5" />
    <rect x="10.2" y="6.5" width="3.6" height="5.5" rx="0.8" />
    <line x1="12" y1="12" x2="12" y2="14.5" />
  </svg>
);

/** TopBar Hollow Candles Chart Style Icon */
export const HollowCandlesIcon: React.FC<IconProps> = ({ className = 'w-[19px] h-[19px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="8" y1="3.5" x2="8" y2="6.5" />
    <rect x="6" y="6.5" width="4" height="10.5" rx="0.6" />
    <line x1="8" y1="17" x2="8" y2="20.5" />
    <line x1="16" y1="5.5" x2="16" y2="9.5" />
    <rect x="14" y="9.5" width="4" height="6" rx="0.6" />
    <line x1="16" y1="15.5" x2="16" y2="19.5" />
  </svg>
);

/** TopBar Indicators Icon (line over 3 mini bars) */
export const IndicatorsChartIcon: React.FC<IconProps> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="4 11 9.5 6.5 14 10 20 4.5" />
    <rect x="5" y="15.5" width="2.8" height="4.5" rx="0.4" />
    <rect x="10.6" y="13.5" width="2.8" height="6.5" rx="0.4" />
    <rect x="16.2" y="11" width="2.8" height="9" rx="0.4" />
  </svg>
);

/** TopBar Alert Alarm Clock + Plus Icon */
export const AlertClockSparkleIcon: React.FC<IconProps> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 6.5A6.5 6.5 0 1 0 18.5 13" />
    <path d="M5 4.5L3 6.5" />
    <path d="M19 4.5l2 2" />
    <path d="M12 9.5v3.5l2.2 1.2" />
    <path d="M17.5 15.5v5" />
    <path d="M15 18h5" />
  </svg>
);

/** TopBar Replay Double Hollow Left Chevrons Icon */
export const ReplayChevronsIcon: React.FC<IconProps> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="11.5 7 5 12 11.5 17 11.5 7" />
    <polygon points="19 7 12.5 12 19 17 19 7" />
  </svg>
);

/** TopBar Single Pane Layout Icon */
export const LayoutPaneIcon: React.FC<IconProps> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="4" y="4.5" width="16" height="15" rx="2" />
  </svg>
);

/** TradingView 4-Corner Brackets Fullscreen / Expand Icon (TopBar + Watchlist Header) */
export const CornerFullscreenIcon: React.FC<IconProps> = ({ className = 'w-[17px] h-[17px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4.5 9V6.5a2 2 0 0 1 2-2H9" />
    <path d="M15 4.5h2.5a2 2 0 0 1 2 2V9" />
    <path d="M19.5 15v2.5a2 2 0 0 1-2 2H15" />
    <path d="M9 19.5H6.5a2 2 0 0 1-2-2V15" />
  </svg>
);

/** Right Rail Watchlist Bookmark-Lines Icon */
export const WatchlistBookmarkIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.45"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 4h12a1 1 0 0 1 1 1v15.5l-7-3.8-7 3.8V5a1 1 0 0 1 1-1z" />
    <line x1="9" y1="8.5" x2="15" y2="8.5" />
    <line x1="9" y1="12" x2="15" y2="12" />
  </svg>
);

/** Left Toolbar |✦| Sparkle / Pattern Tool Icon */
export const SparkleBarsIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="4.5" y1="5" x2="4.5" y2="19" />
    <line x1="19.5" y1="5" x2="19.5" y2="19" />
    <path d="M12 7.5C12.35 10.1 13.9 11.65 16.5 12C13.9 12.35 12.35 13.9 12 16.5C11.65 13.9 10.1 12.35 7.5 12C10.1 11.65 11.65 10.1 12 7.5Z" />
  </svg>
);

/** Left Toolbar Exact TradingView Downward Horseshoe Magnet (arch on top, capped legs at bottom) */
export const MagnetTvIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6.5 19V11.5a5.5 5.5 0 0 1 11 0V19h-3.3v-7.5a2.2 2.2 0 0 0-4.4 0V19H6.5z" />
    <line x1="6.5" y1="15.8" x2="9.8" y2="15.8" />
    <line x1="14.2" y1="15.8" x2="17.5" y2="15.8" />
  </svg>
);

/** Left Toolbar Stay in Drawing Mode (Diagonal Pencil + Tiny Closed Padlock) */
export const StayInDrawingIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.2 4.6l2.6 2.6-8.4 8.4-3.2.6.6-3.2 8.4-8.4z" />
    <line x1="12.2" y1="6.6" x2="14.8" y2="9.2" />
    <rect x="13.5" y="14.2" width="6.2" height="5.3" rx="1.1" />
    <path d="M15 14.2v-1.4a1.6 1.6 0 0 1 3.2 0v1.4" />
    <line x1="16.6" y1="16.3" x2="16.6" y2="17.5" />
  </svg>
);

/** Left Toolbar Open/Closed Padlock (Exact TradingView proportions & keyhole) */
export const PadlockTvIcon: React.FC<IconProps & { locked?: boolean }> = ({
  className = 'w-[20px] h-[20px]',
  locked = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="6.5" y="11" width="11" height="8.5" rx="2" />
    {locked ? (
      <path d="M9 11V8.5a3 3 0 0 1 6 0V11" />
    ) : (
      <path d="M9 11V7.8a3.1 3.1 0 0 1 5.6-1.8" />
    )}
    <circle cx="12" cy="15" r="0.7" fill="currentColor" />
    <line x1="12" y1="15.3" x2="12" y2="16.8" />
  </svg>
);

/** Left Toolbar Hide Drawings (Eye + Mini Paintbrush) */
export const EyeBrushIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3.2 10.5C5.2 7.2 8.2 5.6 11.4 5.6s6.2 1.6 8.2 4.9c-2 3.3-5 4.9-8.2 4.9s-6.2-1.6-8.2-4.9z" />
    <circle cx="11.4" cy="10.5" r="2.35" />
    <path d="M13.5 19.8c1.7.1 3-.6 3.5-1.8.4-.9-.4-1.7-1.3-1.4-1 .3-1.2 1.3-2.2 3.2z" />
    <path d="M17.2 16.7l2.6-2.4" />
  </svg>
);

/** Left Toolbar Minimal Trash Icon (Clean tapered bin + flat lid + handle, no inner lines) */
export const TrashMinimalIcon: React.FC<IconProps> = ({ className = 'w-[20px] h-[20px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5.5 7.2h13" />
    <path d="M9.6 7.2V5.4a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.8" />
    <path d="M7.3 7.2l1 11.6a1.1 1.1 0 0 0 1.1 1h5.2a1.1 1.1 0 0 0 1.1-1l1-11.6" />
  </svg>
);

/** Right Rail Dark Circular Apps Grid Icon */
export const AppsCircleIcon: React.FC<IconProps> = ({ className = 'w-[28px] h-[28px]' }) => (
  <svg viewBox="0 0 28 28" className={className}>
    <circle cx="14" cy="14" r="13" fill="currentColor" />
    {[9.5, 14, 18.5].map((y) =>
      [9.5, 14, 18.5].map((x) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.45" fill="var(--bg-surface)" />
      ))
    )}
  </svg>
);
