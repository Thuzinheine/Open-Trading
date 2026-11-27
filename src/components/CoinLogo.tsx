import React from 'react';

interface CoinLogoProps {
  symbol: string;
  color?: string;
  letter?: string;
  size?: number;
  className?: string;
}

export const FLAG_COLORS = ['#f23645', '#2962ff', '#089981', '#f59e0b', '#9c27b0', ''] as const;

export function getCoinSector(sym: string): string {
  const base = sym.replace(/USDT$|BUSD$|FDUSD$|USDC$|BTC$/, '');
  if (['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'SUI', 'ADA', 'LTC', 'INJ', 'AVAX', 'DOT', 'NEAR', 'ATOM', 'APT', 'SEI', 'TON'].includes(base)) {
    return 'Layer 1';
  }
  if (['TAO', 'RENDER', 'FET', 'WLD', 'RNDR', 'ARKM', 'AGIX'].includes(base)) {
    return 'AI & Compute';
  }
  if (['LINK', 'UNI', 'PENDLE', 'ONDO', 'CAKE', 'JUP', 'ENA', 'AAVE', 'MKR', 'LDO', 'CRV', 'SNX'].includes(base)) {
    return 'DeFi';
  }
  if (['DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK'].includes(base)) {
    return 'Meme';
  }
  return 'Crypto';
}

export const CoinLogo: React.FC<CoinLogoProps> = ({
  symbol,
  color = '#2962ff',
  letter,
  size = 18,
  className = '',
}) => {
  const base = symbol.replace(/USDT$|BUSD$|FDUSD$|USDC$/, '').toUpperCase();
  const s = size;

  if (base === 'BTC') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#F7931A" />
        <path
          d="M15.9 10.6c.25-1.66-1.02-2.55-2.75-3.15l.56-2.25-1.37-.34-.55 2.19c-.36-.09-.73-.17-1.1-.26l.55-2.2-1.37-.34-.56 2.25c-.3-.07-.59-.14-.87-.21l-1.89-.47-.36 1.46s1.02.23 1 .25c.56.14.66.51.64.8l-.64 2.57c.04.01.09.02.14.05l-.14-.04-.9 3.6c-.07.17-.24.42-.63.33.01.02-1-.25-1-.25l-.68 1.57 1.78.44c.33.08.66.17.98.25l-.57 2.28 1.37.34.56-2.25c.37.1.74.19 1.1.28l-.56 2.24 1.37.34.57-2.27c2.34.44 4.1.26 4.84-1.85.6-1.71-.03-2.69-1.26-3.33.9-.21 1.57-.8 1.75-2.02zm-3.13 4.39c-.42 1.71-3.3.78-4.23.55l.75-3.02c.93.23 3.92.69 3.48 2.47zm.43-4.42c-.39 1.55-2.78.76-3.55.57l.68-2.74c.78.19 3.27.56 2.87 2.17z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (base === 'ETH') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#5468B5" />
        <path d="M12 4.3L7.2 12.2 12 15l4.8-2.8L12 4.3z" fill="#FFFFFF" fillOpacity="0.92" />
        <path d="M12 4.3v10.7l4.8-2.8L12 4.3z" fill="#DCE3FF" />
        <path d="M12 16.1l-4.8-2.8L12 20l4.8-6.7-4.8 2.8z" fill="#FFFFFF" fillOpacity="0.92" />
        <path d="M12 16.1V20l4.8-6.7-4.8 2.8z" fill="#C7D2FE" />
      </svg>
    );
  }

  if (base === 'BNB') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#1E2026" />
        <path
          d="M12 5.4l2.4 2.4-4.2 4.2-2.4-2.4L12 5.4zm4.2 4.2l2.4 2.4-6.6 6.6-6.6-6.6 2.4-2.4 4.2 4.2 4.2-4.2zM12 10.2l1.8 1.8-1.8 1.8-1.8-1.8 1.8-1.8z"
          fill="#F3BA2F"
        />
      </svg>
    );
  }

  if (base === 'SOL') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <defs>
          <linearGradient id="solGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="50%" stopColor="#14F195" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill="#0B0E14" />
        <path d="M7.2 8.2h8.6l1.4-1.6H8.6L7.2 8.2z" fill="url(#solGrad)" />
        <path d="M16.8 12.8H8.2l-1.4-1.6h8.6l1.4 1.6z" fill="url(#solGrad)" />
        <path d="M7.2 17.4h8.6l1.4-1.6H8.6l-1.4 1.6z" fill="url(#solGrad)" />
      </svg>
    );
  }

  if (base === 'SUI') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#EEF6FF" />
        <path
          d="M12 5.2C12 5.2 7.2 10.6 7.2 14a4.8 4.8 0 009.6 0c0-3.4-4.8-8.8-4.8-8.8zm0 11.7a3 3 0 01-3-3c0-1.1.7-2.6 1.7-4.1.6.9 1.6 1.8 2.6 2.5.9.6 1.7 1.1 1.7 1.6a3 3 0 01-3 3z"
          fill="#4DA2FF"
        />
      </svg>
    );
  }

  if (base === 'INJ') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <defs>
          <linearGradient id="injGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B5BFF" />
            <stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill="url(#injGrad)" />
        <path
          d="M9.5 7.2c-2.3 1.4-3.1 4.4-1.8 6.8.7 1.3 1.9 2.2 3.3 2.5-.9-1.1-1-2.7-.2-3.9l2-2.9c.7-1 .6-2.3-.2-3.2-1-.2-2.1.1-3.1.7zm5 9.6c2.3-1.4 3.1-4.4 1.8-6.8-.7-1.3-1.9-2.2-3.3-2.5.9 1.1 1 2.7.2 3.9l-2 2.9c-.7 1-.6 2.3.2 3.2 1 .2 2.1-.1 3.1-.7z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (base === 'TAO') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="0.7" />
        <path
          d="M7.5 8.5h9v1.8h-3.6v5.2c0 .9.5 1.3 1.2 1.3h.6v1.6h-1.1c-1.8 0-2.7-1-2.7-2.8v-5.3H7.5V8.5z"
          fill="#0F172A"
        />
      </svg>
    );
  }

  if (base === 'XRP') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#23292F" />
        <path
          d="M7.2 7.2h2l2.8 2.9 2.8-2.9h2l-3.8 3.9a1.4 1.4 0 01-2 0L7.2 7.2zm9.6 9.6h-2L12 13.9l-2.8 2.9h-2l3.8-3.9a1.4 1.4 0 012 0l3.8 3.9z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (base === 'LINK') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#2A5ADA" />
        <path
          d="M12 5.8L6.8 8.8v6.4L12 18.2l5.2-3V8.8L12 5.8zm2.9 8.1L12 15.6l-2.9-1.7v-3.8L12 8.4l2.9 1.7v3.8z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (base === 'DOGE') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#C2A633" />
        <path
          d="M8.5 7h3.8c3 0 5 1.8 5 5s-2 5-5 5H8.5V7zm2.2 2v6h1.5c1.7 0 2.8-1 2.8-3s-1.1-3-2.8-3h-1.5zM7 11.2h6.5v1.6H7v-1.6z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (base === 'ADA') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#0033AD" />
        <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
        <circle cx="12" cy="7.4" r="1.1" fill="#FFFFFF" />
        <circle cx="12" cy="16.6" r="1.1" fill="#FFFFFF" />
        <circle cx="8" cy="9.7" r="1.1" fill="#FFFFFF" />
        <circle cx="16" cy="9.7" r="1.1" fill="#FFFFFF" />
        <circle cx="8" cy="14.3" r="1.1" fill="#FFFFFF" />
        <circle cx="16" cy="14.3" r="1.1" fill="#FFFFFF" />
      </svg>
    );
  }

  if (base === 'LTC') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
        <circle cx="12" cy="12" r="12" fill="#345D9D" />
        <path
          d="M11.3 6.5h2.5l-1.4 5.2 1.8-.6-.4 1.6-1.8.6-.7 2.5h5.2l-.5 1.9H8.3l1.3-4.9-1.5.5.4-1.6 1.5-.5 1.3-4.7z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  return (
    <span
      style={{ width: s, height: s, backgroundColor: color, fontSize: Math.max(8, Math.round(s * 0.5)) }}
      className={`rounded-full text-white font-extrabold inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {letter || base[0] || 'C'}
    </span>
  );
};

interface FlagRibbonProps {
  color?: string;
  size?: number;
  className?: string;
}

export const FlagRibbon: React.FC<FlagRibbonProps> = ({
  color = '#f23645',
  size = 12,
  className = '',
}) => {
  if (!color) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 12 12"
        className={`shrink-0 opacity-0 group-hover:opacity-45 hover:!opacity-100 transition-opacity ${className}`}
      >
        <path d="M1 2h10L8.5 6 11 10H1V2z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={`shrink-0 ${className}`}>
      <path d="M1 2h10L8.5 6 11 10H1V2z" fill={color} />
    </svg>
  );
};

interface SplitPriceProps {
  formatted: string;
  isUp: boolean;
  className?: string;
  highlightTail?: number;
}

export const SplitPrice: React.FC<SplitPriceProps> = ({
  formatted,
  isUp,
  className = '',
  highlightTail,
}) => {
  if (!formatted || formatted === '-') {
    return <span className={className}>-</span>;
  }
  const dotIdx = formatted.indexOf('.');
  if (dotIdx === -1) {
    return <span className={className}>{formatted}</span>;
  }
  const decimals = formatted.slice(dotIdx + 1);
  const tailLen = highlightTail ?? (decimals.length >= 3 ? 2 : 1);
  const splitAt = Math.max(dotIdx + 1, formatted.length - tailLen);
  const head = formatted.slice(0, splitAt);
  const tail = formatted.slice(splitAt);
  return (
    <span className={className}>
      <span>{head}</span>
      <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>{tail}</span>
    </span>
  );
};
