import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface TvSelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface TvSelectProps<T extends string | number = string> {
  value: T;
  options: readonly TvSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  mono?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export function TvSelect<T extends string | number = string>({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  mono = false,
  placeholder,
  ariaLabel,
}: TvSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxHeight: number;
  } | null>(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayText = selectedOption?.label ?? placeholder ?? String(value);

  const updatePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedH = Math.min(340, options.length * 34 + 14);
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openUp = spaceBelow < Math.min(estimatedH, 180) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(340, openUp ? spaceAbove - 6 : spaceBelow - 6));
    const actualH = Math.min(estimatedH, maxHeight);
    const top = openUp
      ? Math.max(8, rect.top - actualH - 4)
      : Math.min(window.innerHeight - actualH - 8, rect.bottom + 4);
    const left = Math.max(8, Math.min(window.innerWidth - Math.max(rect.width, 96) - 8, rect.left));
    setCoords({
      top,
      left,
      minWidth: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleRelayout = () => updatePosition();
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleRelayout);
    window.addEventListener('scroll', handleRelayout, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleRelayout);
      window.removeEventListener('scroll', handleRelayout, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll active item smoothly into view when menu opens
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const activeEl = menuRef.current.querySelector<HTMLElement>('[data-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        className={`h-[34px] px-2.5 rounded-[7px] border bg-[var(--bg-surface)] text-[13px] text-[var(--text-main)] inline-flex items-center justify-between gap-2 transition-colors outline-none select-none ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-[var(--border)]'
            : open
            ? 'border-[#131722] dark:border-[#d1d4dc] cursor-pointer'
            : 'border-[var(--border)] hover:border-[#9598a1] dark:hover:border-[#787b86] cursor-pointer'
        } ${mono ? 'font-mono-num' : ''} ${className}`}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${
            open ? 'rotate-180 text-[var(--text-main)]' : ''
          }`}
          strokeWidth={1.7}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
              maxHeight: coords.maxHeight,
              zIndex: 9999,
            }}
            className="bg-[var(--bg-surface)] border border-black/[0.08] dark:border-white/[0.12] rounded-[10px] shadow-[0_6px_24px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 overflow-y-auto select-none"
          >
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-[6.5px] rounded-[6px] text-[13px] leading-[18px] transition-colors cursor-pointer block whitespace-nowrap ${
                    mono ? 'font-mono-num' : ''
                  } ${
                    isSelected
                      ? 'bg-[#1f2229] dark:bg-[var(--accent)] text-white font-semibold'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)] font-normal'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
