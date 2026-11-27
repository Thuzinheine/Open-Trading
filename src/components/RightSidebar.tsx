import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  AlarmClock,
  AlarmClockPlus,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MoreHorizontal,
  Copy,
  Pencil,
  SeparatorHorizontal,
  Eraser,
  FilePlus2,
  Upload,
  FolderOpen,
  LayoutGrid,
  SquarePen,
  ExternalLink,
  Calendar,
  HelpCircle,
  Check,
  Bell,
  Sparkles,
  Target,
  Mountain,
  Rss,
  MessageSquare,
  Search,
  ArrowDownWideNarrow,
  Pause,
  Play,
} from 'lucide-react';
import {
  CandleBar,
  MarketTrade,
  OrderBookLevel,
  PriceAlert,
  RightPanelTab,
  TickerData,
  WatchlistCollection,
  WatchlistGroupBy,
  WatchlistItem,
  WatchlistViewPrefs,
} from '../types/trading';
import { createBinanceSocket, fmtCompact, fmtPrice } from '../utils/binance';
import { CoinLogo, FLAG_COLORS, FlagRibbon, getCoinSector, SplitPrice } from './CoinLogo';
import {
  AppsCircleIcon,
  CornerFullscreenIcon,
  WatchlistBookmarkIcon,
} from './TradingViewIcons';
import { SymbolAnalyticsSections } from './SymbolAnalyticsSections';

interface RightSidebarProps {
  visible: boolean;
  activeTab: RightPanelTab;
  onSelectTab: (tab: RightPanelTab) => void;
  onToggleVisible: () => void;
  onToggleTrade: () => void;
  onOpenIndicators?: () => void;
  onOpenSettings: (tab?: 'symbol' | 'events') => void;
  watchlists: WatchlistCollection[];
  activeListId: string;
  onSelectWatchlist: (id: string) => void;
  onUpdateWatchlistItems: (listId: string, updater: (items: WatchlistItem[]) => WatchlistItem[]) => void;
  onCreateWatchlist: (name: string, items?: WatchlistItem[]) => void;
  onRenameWatchlist: (id: string, name: string) => void;
  onDuplicateWatchlist: (id: string) => void;
  onDeleteWatchlist: (id: string) => void;
  onToggleShareWatchlist: (id: string) => void;
  watchlistPrefs: WatchlistViewPrefs;
  onUpdateWatchlistPrefs: (updater: (prev: WatchlistViewPrefs) => WatchlistViewPrefs) => void;
  openListModalTrigger?: number;
  tickerMap: Record<string, TickerData>;
  candles: CandleBar[];
  avgVolume30d: number;
  currentSymbol: string;
  onSelectSymbol: (sym: string) => void;
  onPrefetchSymbol?: (sym: string) => void;
  onRemoveSymbol: (sym: string) => void;
  onOpenSearch: () => void;
  alerts: PriceAlert[];
  onOpenAlertModal: () => void;
  onToggleAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  symbolNotes: Record<string, string>;
  onSaveSymbolNote: (sym: string, text: string) => void;
  onToast: (title: string, detail?: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void;
}

type SortKey = 'default' | 'sym' | 'last' | 'chg' | 'pct' | 'vol';

const GROUP_BY_OPTIONS: { id: WatchlistGroupBy; label: string }[] = [
  { id: 'none', label: 'No group' },
  { id: 'sections', label: 'Custom sections' },
  { id: 'currency', label: 'Currency' },
  { id: 'type', label: 'Symbol type' },
  { id: 'sector', label: 'Sector' },
  { id: 'exchange', label: 'Exchange' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  visible,
  activeTab,
  onSelectTab,
  onToggleVisible,
  onToggleTrade,
  onOpenIndicators,
  onOpenSettings,
  watchlists,
  activeListId,
  onSelectWatchlist,
  onUpdateWatchlistItems,
  onCreateWatchlist,
  onRenameWatchlist,
  onDuplicateWatchlist,
  onDeleteWatchlist,
  onToggleShareWatchlist,
  watchlistPrefs,
  onUpdateWatchlistPrefs,
  openListModalTrigger = 0,
  tickerMap,
  candles,
  avgVolume30d,
  currentSymbol,
  onSelectSymbol,
  onPrefetchSymbol,
  onRemoveSymbol,
  onOpenSearch,
  alerts,
  onOpenAlertModal,
  onToggleAlert,
  onDeleteAlert,
  symbolNotes,
  onSaveSymbolNote,
  onToast,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Menus & Modals
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [openListPicker, setOpenListPicker] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [detailsMoreOpen, setDetailsMoreOpen] = useState(false);

  // Inline dialogs
  const [renamingList, setRenamingList] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [newListDraft, setNewListDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState('');

  // Symbol details controls + resizable split ratio & Watchlist column widths
  const [showExtendedDetails, setShowExtendedDetails] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [watchlistRatio, setWatchlistRatio] = useState<number>(46);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const detailsScrollRef = useRef<HTMLDivElement>(null);
  const technicalsRef = useRef<HTMLDivElement>(null);

  type ColWidthKey = 'last' | 'chg' | 'chgPct' | 'volume' | 'extHours';
  const DEFAULT_COL_WIDTHS: Record<ColWidthKey, number> = {
    last: 76,
    chg: 62,
    chgPct: 58,
    volume: 58,
    extHours: 48,
  };
  const [colWidths, setColWidths] = useState<Record<ColWidthKey, number>>(() => {
    try {
      const raw = localStorage.getItem('tp_watchlist_col_widths_v1');
      if (raw) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_COL_WIDTHS;
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('tp_watchlist_sidebar_w_v1'));
      if (Number.isFinite(saved) && saved >= 270 && saved <= 520) return saved;
    } catch {}
    return 326;
  });

  useEffect(() => {
    try {
      localStorage.setItem('tp_watchlist_col_widths_v1', JSON.stringify(colWidths));
    } catch {}
  }, [colWidths]);

  useEffect(() => {
    try {
      localStorage.setItem('tp_watchlist_sidebar_w_v1', String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);

  const handleStartResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.max(270, Math.min(520, startW + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleStartResizeCol = (
    e: React.MouseEvent,
    leftKey: 'symbol' | ColWidthKey,
    rightKey: ColWidthKey
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startRight = colWidths[rightKey];
    const startLeft = leftKey === 'symbol' ? 0 : colWidths[leftKey];
    document.body.style.cursor = 'col-resize';

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setColWidths((prev) => {
        if (leftKey === 'symbol') {
          // Moving divider between Symbol (flex) and right column shrinks/grows right column
          const nextRight = Math.max(46, Math.min(130, startRight - dx));
          return { ...prev, [rightKey]: nextRight };
        }
        // Moving divider between two numeric columns trades width smoothly between them
        const nextLeft = Math.max(44, Math.min(130, startLeft + dx));
        const actualDelta = nextLeft - startLeft;
        const nextRight = Math.max(44, Math.min(130, startRight - actualDelta));
        const clampedLeft = startLeft + (startRight - nextRight);
        return { ...prev, [leftKey]: clampedLeft, [rightKey]: nextRight };
      });
    };

    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResetColWidths = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setColWidths(DEFAULT_COL_WIDTHS);
  };

  // Drag & Drop state
  const [dragSym, setDragSym] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sym: string; pos: 'above' | 'below' } | null>(null);

  // Order book & Live trades state
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [trades, setTrades] = useState<MarketTrade[]>([]);
  const [obSubTab, setObSubTab] = useState<'book' | 'trades'>('book');

  const listMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const detailsMoreRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleStartResizeSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setWatchlistRatio(Math.max(22, Math.min(76, pct)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const activeList = useMemo(
    () => watchlists.find((l) => l.id === activeListId) || watchlists[0],
    [watchlists, activeListId]
  );
  const items = activeList?.items || [];

  useEffect(() => {
    if (openListModalTrigger > 0) {
      setOpenListPicker(true);
      setListMenuOpen(false);
    }
  }, [openListModalTrigger]);

  // Close menus on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setListMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
      if (detailsMoreRef.current && !detailsMoreRef.current.contains(e.target as Node)) {
        setDetailsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Order Book & Live Trades WebSocket
  useEffect(() => {
    if (!visible || activeTab !== 'orderbook') return;
    setAsks([]);
    setBids([]);
    setTrades([]);

    const lower = currentSymbol.toLowerCase();
    const sock = createBinanceSocket(`/stream?streams=${lower}@depth20@100ms/${lower}@trade`, {
      onMessage: (raw) => {
        try {
          const msg = JSON.parse(raw);
          const stream: string = msg.stream || '';
          const d = msg.data;
          if (!d) return;

          if (stream.includes('@depth20')) {
            const rawAsks: [string, string][] = (d.asks || []).slice(0, 12);
            const rawBids: [string, string][] = (d.bids || []).slice(0, 12);

            let askCum = 0;
            const parsedAsks: OrderBookLevel[] = rawAsks.map(([p, q]) => {
              const price = parseFloat(p);
              const qty = parseFloat(q);
              askCum += qty;
              return { price, qty, total: askCum };
            });
            setAsks(parsedAsks.reverse());

            let bidCum = 0;
            const parsedBids: OrderBookLevel[] = rawBids.map(([p, q]) => {
              const price = parseFloat(p);
              const qty = parseFloat(q);
              bidCum += qty;
              return { price, qty, total: bidCum };
            });
            setBids(parsedBids);
          } else if (stream.includes('@trade')) {
            const trade: MarketTrade = {
              id: d.t,
              price: parseFloat(d.p),
              qty: parseFloat(d.q),
              time: d.T,
              isBuyerMaker: Boolean(d.m),
            };
            setTrades((prev) => [trade, ...prev].slice(0, 40));
          }
        } catch {}
      },
    });

    return () => sock.close();
  }, [visible, activeTab, currentSymbol]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else setSortKey('default'); // 3rd click returns to custom drag order!
    } else {
      setSortKey(key);
      setSortDir(key === 'sym' ? 'asc' : 'desc');
    }
  };

  // Build displayed rows based on groupBy & sorting
  type RenderRow =
    | { kind: 'groupHeader'; id: string; title: string; isCustomSection: boolean; collapsed?: boolean }
    | { kind: 'coin'; item: WatchlistItem };

  const [collapsedAutoGroups, setCollapsedAutoGroups] = useState<Record<string, boolean>>({});

  const displayRows: RenderRow[] = useMemo(() => {
    const sortCoins = (arr: WatchlistItem[]) => {
      if (sortKey === 'default') return arr;
      return [...arr].sort((a, b) => {
        const ta = tickerMap[a.sym];
        const tb = tickerMap[b.sym];
        let diff = 0;
        if (sortKey === 'sym') diff = a.sym.localeCompare(b.sym);
        else if (sortKey === 'last') diff = (ta?.last || 0) - (tb?.last || 0);
        else if (sortKey === 'chg') diff = (ta?.chg || 0) - (tb?.chg || 0);
        else if (sortKey === 'pct') diff = (ta?.pct || 0) - (tb?.pct || 0);
        else if (sortKey === 'vol') diff = (ta?.vol || 0) - (tb?.vol || 0);
        return sortDir === 'asc' ? diff : -diff;
      });
    };

    const gb = watchlistPrefs.groupBy;

    if (gb === 'none') {
      const coinsOnly = items.filter((i) => !i.isSection);
      return sortCoins(coinsOnly).map((item) => ({ kind: 'coin', item }));
    }

    if (gb === 'sections') {
      if (sortKey !== 'default') {
        const coinsOnly = items.filter((i) => !i.isSection);
        return sortCoins(coinsOnly).map((item) => ({ kind: 'coin', item }));
      }
      const out: RenderRow[] = [];
      let currentSectionCollapsed = false;
      for (const it of items) {
        if (it.isSection) {
          currentSectionCollapsed = Boolean(it.collapsed);
          out.push({
            kind: 'groupHeader',
            id: it.sym,
            title: it.name,
            isCustomSection: true,
            collapsed: it.collapsed,
          });
        } else if (!currentSectionCollapsed) {
          out.push({ kind: 'coin', item: it });
        }
      }
      return out;
    }

    // Automatic grouping: currency, type, sector, exchange
    const coinsOnly = sortCoins(items.filter((i) => !i.isSection));
    const groups = new Map<string, WatchlistItem[]>();
    for (const c of coinsOnly) {
      let key = 'BINANCE';
      if (gb === 'currency') key = c.sym.endsWith('USDT') ? 'USDT' : 'CRYPTO';
      else if (gb === 'type') key = 'SPOT CRYPTO';
      else if (gb === 'sector') key = getCoinSector(c.sym).toUpperCase();
      else if (gb === 'exchange') key = 'BINANCE';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const out: RenderRow[] = [];
    groups.forEach((groupItems, groupTitle) => {
      const isCol = Boolean(collapsedAutoGroups[groupTitle]);
      out.push({
        kind: 'groupHeader',
        id: `auto-${groupTitle}`,
        title: groupTitle,
        isCustomSection: false,
        collapsed: isCol,
      });
      if (!isCol) {
        groupItems.forEach((item) => out.push({ kind: 'coin', item }));
      }
    });
    return out;
  }, [items, watchlistPrefs.groupBy, sortKey, sortDir, tickerMap, collapsedAutoGroups]);

  // Drag-and-drop handlers for up/down reordering
  const handleDragStart = (e: React.DragEvent, sym: string) => {
    setDragSym(sym);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sym);
    if (sortKey !== 'default') {
      setSortKey('default');
    }
  };

  const handleDragOver = (e: React.DragEvent, targetSym: string) => {
    e.preventDefault();
    if (!dragSym || dragSym === targetSym) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setDropTarget((prev) =>
      prev && prev.sym === targetSym && prev.pos === pos ? prev : { sym: targetSym, pos }
    );
  };

  const handleDrop = (e: React.DragEvent, targetSym: string) => {
    e.preventDefault();
    const sourceSym = dragSym || e.dataTransfer.getData('text/plain');
    if (!sourceSym || sourceSym === targetSym || !activeList) {
      setDragSym(null);
      setDropTarget(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';

    onUpdateWatchlistItems(activeList.id, (prev) => {
      const srcIdx = prev.findIndex((i) => i.sym === sourceSym);
      if (srcIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      const tgtIdx = next.findIndex((i) => i.sym === targetSym);
      if (tgtIdx === -1) {
        next.push(moved);
        return next;
      }
      const insertIdx = pos === 'above' ? tgtIdx : tgtIdx + 1;
      next.splice(insertIdx, 0, moved);
      return next;
    });

    setDragSym(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragSym(null);
    setDropTarget(null);
  };

  const cycleFlagColor = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    if (!activeList) return;
    onUpdateWatchlistItems(activeList.id, (prev) =>
      prev.map((item) => {
        if (item.sym !== sym) return item;
        const idx = FLAG_COLORS.indexOf((item.flagColor || '') as (typeof FLAG_COLORS)[number]);
        const nextColor = FLAG_COLORS[(idx + 1) % FLAG_COLORS.length];
        return { ...item, flagColor: nextColor };
      })
    );
  };

  const handleAddSection = () => {
    if (!activeList) return;
    const secCount = items.filter((i) => i.isSection).length + 1;
    const secId = `sec-${Date.now()}`;
    onUpdateWatchlistItems(activeList.id, (prev) => [
      {
        sym: secId,
        name: `SECTION ${secCount}`,
        color: '#787b86',
        letter: 'S',
        isSection: true,
        collapsed: false,
      },
      ...prev,
    ]);
    onUpdateWatchlistPrefs((p) => ({ ...p, groupBy: 'sections' }));
    setEditingSectionId(secId);
    setSectionDraft(`SECTION ${secCount}`);
    setListMenuOpen(false);
  };

  const handleUploadListFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeList) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const tokens = text
        .split(/[\n,;\s]+/)
        .map((s) => s.trim().toUpperCase().replace(/^BINANCE:/, ''))
        .filter((s) => /^[A-Z0-9]{2,15}$/.test(s))
        .map((s) => (s.endsWith('USDT') ? s : `${s}USDT`));
      const unique = Array.from(new Set(tokens));
      if (!unique.length) {
        onToast('Upload Failed', 'No valid symbol tickers found in file.', 'warning');
        return;
      }
      onUpdateWatchlistItems(activeList.id, (prev) => {
        const existing = new Set(prev.map((x) => x.sym));
        const additions: WatchlistItem[] = unique
          .filter((s) => !existing.has(s))
          .map((sym) => ({
            sym,
            name: `${sym.replace('USDT', '')} / TetherUS`,
            color: '#2962ff',
            letter: sym[0] || 'C',
            flagColor: '#f23645',
          }));
        return [...prev, ...additions];
      });
      onToast('List Imported', `Added ${unique.length} symbols from ${file.name}`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Current symbol metadata & stats
  const curMeta = items.find((w) => !w.isSection && w.sym === currentSymbol) || {
    sym: currentSymbol,
    name: `${currentSymbol.replace('USDT', '')} / TetherUS`,
    color: '#2962ff',
    letter: currentSymbol[0] || 'C',
    flagColor: '#f23645',
  };
  const curTicker = tickerMap[currentSymbol];
  const curIsUp = (curTicker?.chg || 0) >= 0;
  const liveVolBase = curTicker?.baseVol ?? (curTicker && curTicker.last > 0 ? curTicker.vol / curTicker.last : 0);
  const avgVolDisplay = avgVolume30d > 0 ? avgVolume30d : liveVolBase > 0 ? liveVolBase * 1.45 : 0;
  const volRatioPct =
    avgVolDisplay > 0 ? Math.max(4, Math.min(100, (liveVolBase / Math.max(liveVolBase, avgVolDisplay)) * 100)) : 28;

  // Dynamic resizable column template (Symbol fluid + draggable px widths for numeric columns)
  const cols = watchlistPrefs.columns;
  const visibleRightCols = useMemo<ColWidthKey[]>(() => {
    const list: ColWidthKey[] = [];
    if (cols.last) list.push('last');
    if (cols.chg) list.push('chg');
    if (cols.chgPct) list.push('chgPct');
    if (cols.volume) list.push('volume');
    if (cols.extHours) list.push('extHours');
    return list;
  }, [cols]);

  const gridColsStyle = useMemo(() => {
    const parts = ['minmax(92px, 1fr)', ...visibleRightCols.map((k) => `${colWidths[k]}px`)];
    return { gridTemplateColumns: parts.join(' ') };
  }, [visibleRightCols, colWidths]);

  const effectiveSidebarWidth = watchlistPrefs.tableView ? Math.max(sidebarWidth, 396) : sidebarWidth;

  // Order book stats
  const maxAskTotal = asks.length ? Math.max(...asks.map((a) => a.total)) : 1;
  const maxBidTotal = bids.length ? Math.max(...bids.map((b) => b.total)) : 1;
  const bestAsk = asks.length ? asks[asks.length - 1].price : 0;
  const bestBid = bids.length ? bids[0].price : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk ? (spread / bestAsk) * 100 : 0;
  const activeAlertsCount = alerts.filter((a) => a.active).length;
  const [alertsSubTab, setAlertsSubTab] = useState<'alerts' | 'log'>('alerts');
  const [alertSearchOpen, setAlertSearchOpen] = useState(false);
  const [alertSearchQuery, setAlertSearchQuery] = useState('');
  const [alertSortDesc, setAlertSortDesc] = useState(true);
  const [alertMoreOpen, setAlertMoreOpen] = useState(false);

  const filteredAlerts = useMemo(() => {
    const q = alertSearchQuery.trim().toLowerCase();
    const base = alerts.filter((al) => {
      if (!q) return true;
      return (
        al.symbol.toLowerCase().includes(q) ||
        (al.note && al.note.toLowerCase().includes(q)) ||
        String(al.price).includes(q)
      );
    });
    return [...base].sort((a, b) =>
      alertSortDesc ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
    );
  }, [alerts, alertSearchQuery, alertSortDesc]);

  const alertLogs = useMemo(
    () =>
      alerts
        .filter((al) => Boolean(al.triggeredAt))
        .sort((a, b) => (b.triggeredAt || 0) - (a.triggeredAt || 0)),
    [alerts]
  );

  const handleRailClick = (tab: RightPanelTab) => {
    if (visible && activeTab === tab) {
      onToggleVisible();
    } else {
      onSelectTab(tab);
      if (!visible) onToggleVisible();
    }
  };

  return (
    <div className="flex gap-[4px] shrink-0 h-full select-none">
      {/* Main Right Sidebar Panel */}
      {visible && (
        <aside
          ref={splitContainerRef}
          style={{ width: `${effectiveSidebarWidth}px` }}
          className="relative hidden lg:flex flex-col bg-[var(--bg-surface)] rounded-[6px] overflow-hidden h-full"
        >
          {/* Draggable left-edge sidebar width resizer */}
          <div
            onMouseDown={handleStartResizeSidebar}
            onDoubleClick={() => setSidebarWidth(326)}
            title="Drag to resize panel width (Double-click to reset)"
            className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-[var(--accent)]/40 z-30 transition-colors"
          />
          {/* WATCHLIST TAB */}
          {activeTab === 'watchlist' && activeList && (
            <>
              {/* Watchlist Header (TradingView Screenshot 1 & 7 & 8) */}
              <div className="h-[42px] px-2.5 flex items-center justify-between shrink-0 relative">
                {/* Left: Main v Dropdown */}
                <div className="relative" ref={listMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setListMenuOpen((v) => !v);
                      setMoreMenuOpen(false);
                    }}
                    className={`h-8 px-2 rounded-md inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--text-main)] transition-colors cursor-pointer ${
                      listMenuOpen ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <FlagRibbon color={activeList.color || '#f23645'} size={13} />
                    <span className="max-w-[130px] truncate">{activeList.name}</span>
                    {listMenuOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    )}
                  </button>

                  {/* Screenshot 7 Watchlist Menu */}
                  {listMenuOpen && (
                    <div className="absolute left-0 top-9 w-[238px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50 text-[13px] text-[var(--text-main)]">
                      {/* Share list toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          onToggleShareWatchlist(activeList.id);
                          const listStr = items
                            .filter((i) => !i.isSection)
                            .map((i) => i.sym)
                            .join(', ');
                          navigator.clipboard?.writeText(listStr).catch(() => {});
                          onToast(
                            activeList.shared ? 'Sharing Disabled' : 'List Copied & Shared',
                            activeList.shared
                              ? `${activeList.name} is now private.`
                              : `Copied ${items.filter((i) => !i.isSection).length} symbols to clipboard.`,
                            'info'
                          );
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Share list</span>
                        <span
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex items-center ${
                            activeList.shared ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--text-muted)]/45 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-xs block" />
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setListMenuOpen(false);
                          onOpenAlertModal();
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <AlarmClockPlus className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Add alert on the list...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDuplicateWatchlist(activeList.id);
                          setListMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Make a copy...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRenameDraft(activeList.name);
                          setRenamingList(true);
                          setListMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Rename</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddSection}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <SeparatorHorizontal className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Add section</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmClear(true);
                          setListMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <Eraser className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Clear list</span>
                      </button>

                      <div className="h-px bg-[var(--border)] my-1.5" />

                      <button
                        type="button"
                        onClick={() => {
                          setNewListDraft('');
                          setCreatingList(true);
                          setListMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <FilePlus2 className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Create new list...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setListMenuOpen(false);
                          uploadInputRef.current?.click();
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                        <span>Upload list...</span>
                      </button>

                      <div className="h-px bg-[var(--border)] my-1.5" />

                      <button
                        type="button"
                        onClick={() => {
                          setListMenuOpen(false);
                          setOpenListPicker(true);
                        }}
                        className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <FolderOpen className="w-4 h-4 text-[var(--text-main)]" strokeWidth={1.6} />
                          <span>Open list...</span>
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">Shift + W</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Hidden Upload File Input */}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleUploadListFile}
                  className="hidden"
                />

                {/* Right: + , Expand/Table View , ... More Options */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={onOpenSearch}
                    title="Add symbol"
                    className="w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                  >
                    <Plus className="w-[18px] h-[18px]" strokeWidth={1.7} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWatchlistPrefs((p) => ({ ...p, tableView: !p.tableView }))
                    }
                    title={watchlistPrefs.tableView ? 'Compact View' : 'Advanced Table View'}
                    className={`w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center cursor-pointer ${
                      watchlistPrefs.tableView ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'text-[var(--text-main)]'
                    }`}
                  >
                    <CornerFullscreenIcon className="w-[16px] h-[16px]" />
                  </button>

                  {/* Screenshot 8 (...) More Options Dropdown */}
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen((v) => !v);
                        setListMenuOpen(false);
                      }}
                      title="Watchlist Options"
                      className={`w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer ${
                        moreMenuOpen ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={1.7} />
                    </button>

                    {moreMenuOpen && (
                      <div className="absolute right-0 top-9 w-[224px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50 text-[13px] text-[var(--text-main)] max-h-[82vh] overflow-y-auto">
                        {/* Table view toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateWatchlistPrefs((p) => ({ ...p, tableView: !p.tableView }))
                          }
                          className="w-full px-3.5 py-2 hover:bg-[var(--bg-hover)] flex items-center justify-between cursor-pointer"
                        >
                          <span>Table view</span>
                          <span
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex items-center ${
                              watchlistPrefs.tableView
                                ? 'bg-[var(--text-main)] justify-end'
                                : 'bg-[var(--text-muted)]/45 justify-start'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-[var(--bg-surface)] shadow-xs block" />
                          </span>
                        </button>

                        <div className="h-px bg-[var(--border)] my-1.5" />

                        {/* GROUP BY */}
                        <div className="px-3.5 pt-1 pb-1 text-[10.5px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                          Group by
                        </div>
                        <div className="px-1.5 space-y-0.5">
                          {GROUP_BY_OPTIONS.map((opt) => {
                            const active = watchlistPrefs.groupBy === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  onUpdateWatchlistPrefs((p) => ({ ...p, groupBy: opt.id }))
                                }
                                className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[var(--text-main)] text-[var(--bg-surface)] font-medium'
                                    : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="h-px bg-[var(--border)] my-2" />

                        {/* CUSTOMIZE COLUMNS */}
                        <div className="px-3.5 pb-1 text-[10.5px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                          Customize columns
                        </div>
                        {(
                          [
                            { key: 'last', label: 'Last' },
                            { key: 'chg', label: 'Change' },
                            { key: 'chgPct', label: 'Change %' },
                            { key: 'volume', label: 'Volume' },
                            { key: 'extHours', label: 'Extended Hours' },
                          ] as const
                        ).map((col) => {
                          const checked = watchlistPrefs.columns[col.key];
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() =>
                                onUpdateWatchlistPrefs((p) => ({
                                  ...p,
                                  columns: { ...p.columns, [col.key]: !p.columns[col.key] },
                                }))
                              }
                              className="w-full px-3.5 py-1.5 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                            >
                              <span
                                className={`w-4 h-4 rounded-[4px] border inline-flex items-center justify-center transition-colors ${
                                  checked
                                    ? 'bg-[var(--text-main)] border-[var(--text-main)] text-[var(--bg-surface)]'
                                    : 'border-[var(--text-muted)]/60 bg-transparent'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                              </span>
                              <span>{col.label}</span>
                            </button>
                          );
                        })}

                        <div className="h-px bg-[var(--border)] my-2" />

                        {/* SYMBOL DISPLAY */}
                        <div className="px-3.5 pb-1 text-[10.5px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                          Symbol display
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateWatchlistPrefs((p) => ({ ...p, showLogo: !p.showLogo }))
                          }
                          className="w-full px-3.5 py-1.5 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded-[4px] border inline-flex items-center justify-center transition-colors ${
                              watchlistPrefs.showLogo
                                ? 'bg-[var(--text-main)] border-[var(--text-main)] text-[var(--bg-surface)]'
                                : 'border-[var(--text-muted)]/60 bg-transparent'
                            }`}
                          >
                            {watchlistPrefs.showLogo && <Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <span>Logo</span>
                        </button>

                        {(['symbol', 'name'] as const).map((mode) => {
                          const active = watchlistPrefs.symbolDisplay === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                onUpdateWatchlistPrefs((p) => ({ ...p, symbolDisplay: mode }))
                              }
                              className="w-full px-3.5 py-1.5 hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                            >
                              <span
                                className={`w-4 h-4 rounded-full border inline-flex items-center justify-center ${
                                  active
                                    ? 'border-[var(--text-main)] bg-[var(--text-main)]'
                                    : 'border-[var(--text-muted)]/60'
                                }`}
                              >
                                {active && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--bg-surface)]" />
                                )}
                              </span>
                              <span>{mode === 'symbol' ? 'Symbol' : 'Name'}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Rename / Create / Clear banners */}
              {renamingList && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renameDraft.trim()) {
                      onRenameWatchlist(activeList.id, renameDraft.trim());
                    }
                    setRenamingList(false);
                  }}
                  className="px-2.5 py-2 border-y border-[var(--border)] bg-[var(--bg-elevated)] flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    placeholder="Watchlist name"
                    className="flex-1 h-7 px-2 rounded bg-[var(--bg-surface)] border border-[var(--accent)] text-xs text-[var(--text-main)] outline-none"
                  />
                  <button
                    type="submit"
                    className="h-7 px-2.5 rounded bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingList(false)}
                    className="h-7 w-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {creatingList && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nm = newListDraft.trim() || `Watchlist ${watchlists.length + 1}`;
                    onCreateWatchlist(nm, []);
                    setCreatingList(false);
                  }}
                  className="px-2.5 py-2 border-y border-[var(--border)] bg-[var(--bg-elevated)] flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newListDraft}
                    onChange={(e) => setNewListDraft(e.target.value)}
                    placeholder="New watchlist name..."
                    className="flex-1 h-7 px-2 rounded bg-[var(--bg-surface)] border border-[var(--accent)] text-xs text-[var(--text-main)] outline-none"
                  />
                  <button
                    type="submit"
                    className="h-7 px-2.5 rounded bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingList(false)}
                    className="h-7 w-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {confirmClear && (
                <div className="px-2.5 py-2 border-y border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--text-main)] font-medium">Clear all symbols?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="h-6 px-2 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateWatchlistItems(activeList.id, () => []);
                        setConfirmClear(false);
                      }}
                      className="h-6 px-2 rounded bg-[var(--down)] text-white font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Resizable Column Headers (Exact TradingView: Symbol | Last | Chg | Chg%) */}
              <div
                style={gridColsStyle}
                className="grid items-stretch h-[29px] px-2 text-[12px] font-normal text-[var(--text-muted)] border-b border-[var(--border)] shrink-0"
              >
                <div className="relative flex items-center min-w-0 pr-1.5">
                  <button
                    type="button"
                    onClick={() => handleSort('sym')}
                    className="w-full h-full text-left inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer pl-1.5 truncate"
                  >
                    <span>Symbol</span>
                    {sortKey === 'sym' && (
                      <span className="text-[9px] text-[var(--accent)]">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                  {visibleRightCols.length > 0 && (
                    <div
                      onMouseDown={(e) => handleStartResizeCol(e, 'symbol', visibleRightCols[0])}
                      onDoubleClick={handleResetColWidths}
                      title="Drag to resize column (Double-click to reset)"
                      className="absolute right-0 top-1 bottom-1 w-[7px] -mr-[3px] flex items-center justify-center cursor-col-resize group/resizer z-10"
                    >
                      <span className="w-px h-full bg-[var(--border)] group-hover/resizer:w-[2px] group-hover/resizer:bg-[var(--accent)] transition-colors" />
                    </div>
                  )}
                </div>

                {visibleRightCols.map((colKey, idx) => {
                  const nextKey = visibleRightCols[idx + 1];
                  const colMeta: Record<
                    ColWidthKey,
                    { label: string; sort?: SortKey }
                  > = {
                    last: { label: 'Last', sort: 'last' },
                    chg: { label: 'Chg', sort: 'chg' },
                    chgPct: { label: 'Chg%', sort: 'pct' },
                    volume: { label: 'Vol', sort: 'vol' },
                    extHours: { label: '24h' },
                  };
                  const meta = colMeta[colKey];
                  const isSorted = meta.sort && sortKey === meta.sort;

                  return (
                    <div key={colKey} className="relative flex items-center justify-end min-w-0 px-1.5">
                      {meta.sort ? (
                        <button
                          type="button"
                          onClick={() => handleSort(meta.sort!)}
                          className="w-full h-full text-right inline-flex items-center justify-end gap-1 hover:text-[var(--text-main)] cursor-pointer truncate"
                        >
                          <span>{meta.label}</span>
                          {isSorted && (
                            <span className="text-[9px] text-[var(--accent)]">
                              {sortDir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="w-full text-right truncate">{meta.label}</span>
                      )}

                      {nextKey && (
                        <div
                          onMouseDown={(e) => handleStartResizeCol(e, colKey, nextKey)}
                          onDoubleClick={handleResetColWidths}
                          title="Drag to resize column (Double-click to reset)"
                          className="absolute right-0 top-1 bottom-1 w-[7px] -mr-[3px] flex items-center justify-center cursor-col-resize group/resizer z-10"
                        >
                          <span className="w-px h-full bg-[var(--border)] group-hover/resizer:w-[2px] group-hover/resizer:bg-[var(--accent)] transition-colors" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Watchlist Scrollable Rows with Drag & Drop (Resizable upper pane) */}
              <div
                style={{ flexBasis: `${watchlistRatio}%` }}
                className="min-h-[120px] grow-0 shrink-0 overflow-y-auto py-0.5"
              >
                {displayRows.length === 0 ? (
                  <div className="p-6 text-center space-y-2.5">
                    <div className="text-xs text-[var(--text-muted)]">
                      This watchlist is empty.
                    </div>
                    <button
                      type="button"
                      onClick={onOpenSearch}
                      className="h-7 px-3 rounded-md bg-[var(--accent)] text-white text-xs font-semibold inline-flex items-center gap-1 hover:opacity-90 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add symbol
                    </button>
                  </div>
                ) : (
                  displayRows.map((row) => {
                    if (row.kind === 'groupHeader') {
                      const isDropAbove =
                        dropTarget?.sym === row.id && dropTarget.pos === 'above';
                      const isDropBelow =
                        dropTarget?.sym === row.id && dropTarget.pos === 'below';
                      return (
                        <div
                          key={row.id}
                          draggable={row.isCustomSection}
                          onDragStart={
                            row.isCustomSection ? (e) => handleDragStart(e, row.id) : undefined
                          }
                          onDragOver={
                            row.isCustomSection ? (e) => handleDragOver(e, row.id) : undefined
                          }
                          onDrop={row.isCustomSection ? (e) => handleDrop(e, row.id) : undefined}
                          onDragEnd={handleDragEnd}
                          className={`group relative flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase bg-[var(--bg-elevated)]/60 border-b border-[var(--border)]/50 ${
                            isDropAbove ? 'border-t-2 border-t-[var(--accent)]' : ''
                          } ${isDropBelow ? 'border-b-2 border-b-[var(--accent)]' : ''}`}
                        >
                          {editingSectionId === row.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const clean = sectionDraft.trim() || 'SECTION';
                                onUpdateWatchlistItems(activeList.id, (prev) =>
                                  prev.map((x) => (x.sym === row.id ? { ...x, name: clean } : x))
                                );
                                setEditingSectionId(null);
                              }}
                              className="flex-1 flex items-center gap-1"
                            >
                              <input
                                autoFocus
                                value={sectionDraft}
                                onChange={(e) => setSectionDraft(e.target.value)}
                                onBlur={() => {
                                  const clean = sectionDraft.trim() || 'SECTION';
                                  onUpdateWatchlistItems(activeList.id, (prev) =>
                                    prev.map((x) => (x.sym === row.id ? { ...x, name: clean } : x))
                                  );
                                  setEditingSectionId(null);
                                }}
                                className="flex-1 bg-[var(--bg-surface)] border border-[var(--accent)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text-main)] outline-none uppercase"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (row.isCustomSection) {
                                  onUpdateWatchlistItems(activeList.id, (prev) =>
                                    prev.map((x) =>
                                      x.sym === row.id ? { ...x, collapsed: !x.collapsed } : x
                                    )
                                  );
                                } else {
                                  setCollapsedAutoGroups((prev) => ({
                                    ...prev,
                                    [row.title]: !prev[row.title],
                                  }));
                                }
                              }}
                              onDoubleClick={() => {
                                if (!row.isCustomSection) return;
                                setEditingSectionId(row.id);
                                setSectionDraft(row.title);
                              }}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer"
                            >
                              {row.collapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                              <span>{row.title}</span>
                            </button>
                          )}

                          {row.isCustomSection && editingSectionId !== row.id && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSectionId(row.id);
                                  setSectionDraft(row.title);
                                }}
                                title="Rename section"
                                className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateWatchlistItems(activeList.id, (prev) =>
                                    prev.filter((x) => x.sym !== row.id)
                                  )
                                }
                                title="Delete section"
                                className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--down)] cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const w = row.item;
                    const t = tickerMap[w.sym];
                    const isActive = w.sym === currentSymbol;
                    const isUp = (t?.chg ?? 0) >= 0;
                    const tickUp =
                      t && t.prevLast !== undefined && t.last !== t.prevLast
                        ? t.last > t.prevLast
                        : isUp;
                    const isDragging = dragSym === w.sym;
                    const isDropAbove = dropTarget?.sym === w.sym && dropTarget.pos === 'above';
                    const isDropBelow = dropTarget?.sym === w.sym && dropTarget.pos === 'below';

                    const shortName = w.name.split('/')[0].trim();

                    return (
                      <div
                        key={w.sym}
                        draggable
                        onDragStart={(e) => handleDragStart(e, w.sym)}
                        onDragOver={(e) => handleDragOver(e, w.sym)}
                        onDrop={(e) => handleDrop(e, w.sym)}
                        onDragEnd={handleDragEnd}
                        onMouseEnter={() => onPrefetchSymbol?.(w.sym)}
                        onClick={() => onSelectSymbol(w.sym)}
                        style={gridColsStyle}
                        className={`group relative grid items-center pl-0 pr-2 h-[32px] text-[13px] font-normal cursor-pointer transition-colors border-b border-[var(--border)]/45 ${
                          isDragging ? 'opacity-40' : ''
                        } ${
                          isActive
                            ? 'ring-1 ring-inset ring-[var(--text-main)] rounded-[4px] bg-[var(--bg-surface)] z-[1]'
                            : 'hover:bg-[var(--bg-hover)]/75'
                        }`}
                      >
                        {/* Drop Indicator Lines */}
                        {isDropAbove && (
                          <div className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-[var(--accent)] z-20" />
                        )}
                        {isDropBelow && (
                          <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-[var(--accent)] z-20" />
                        )}

                        {/* Column 1: Flag + Logo + Symbol/Name */}
                        <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
                          <button
                            type="button"
                            onClick={(e) => cycleFlagColor(e, w.sym)}
                            title="Flag symbol (click to cycle color)"
                            className="w-3 h-5 inline-flex items-center justify-center shrink-0 text-[var(--text-muted)] cursor-pointer"
                          >
                            <FlagRibbon color={w.flagColor} size={10} />
                          </button>

                          {watchlistPrefs.showLogo && (
                            <CoinLogo
                              symbol={w.sym}
                              color={w.color}
                              letter={w.letter}
                              size={18}
                            />
                          )}

                          <span className="font-normal text-[var(--text-main)] truncate">
                            {watchlistPrefs.symbolDisplay === 'name' ? shortName : w.sym}
                          </span>
                        </div>

                        {/* Column 2: Last Price (Exact TradingView diff-highlighted live digits) */}
                        {cols.last && (
                          <span className="text-right font-mono-num text-[var(--text-main)] font-normal tabular-nums px-1.5 truncate">
                            {t ? (
                              <SplitPrice
                                formatted={fmtPrice(t.last)}
                                prevFormatted={
                                  t.prevLast !== undefined ? fmtPrice(t.prevLast) : undefined
                                }
                                isUp={tickUp}
                              />
                            ) : (
                              '-'
                            )}
                          </span>
                        )}

                        {/* Column 3: Chg */}
                        {cols.chg && (
                          <span
                            className={`text-right font-mono-num font-normal tabular-nums px-1.5 truncate ${
                              t
                                ? isUp
                                  ? 'text-[#089981]'
                                  : 'text-[#f23645]'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {t
                              ? `${t.chg < 0 ? '-' : ''}${fmtPrice(Math.abs(t.chg))}`
                              : '-'}
                          </span>
                        )}

                        {/* Column 4: Chg% */}
                        {cols.chgPct && (
                          <span
                            className={`text-right font-mono-num font-normal tabular-nums px-1.5 truncate ${
                              t
                                ? isUp
                                  ? 'text-[#089981]'
                                  : 'text-[#f23645]'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {t ? `${t.pct.toFixed(2)}%` : '-'}
                          </span>
                        )}

                        {/* Optional Column 5: Volume */}
                        {cols.volume && (
                          <span className="text-right font-mono-num font-normal tabular-nums text-[var(--text-muted)] text-[12px] px-1.5 truncate">
                            {t ? fmtCompact(t.baseVol ?? (t.last > 0 ? t.vol / t.last : 0)) : '-'}
                          </span>
                        )}

                        {/* Optional Column 6: Extended / 24h Range */}
                        {cols.extHours && (
                          <span className="text-right font-mono-num font-normal tabular-nums text-[var(--text-muted)] text-[12px] px-1.5 truncate">
                            {t && t.low > 0
                              ? `${(((t.high - t.low) / t.low) * 100).toFixed(1)}%`
                              : '-'}
                          </span>
                        )}

                        {/* Screenshot 6: Hover Trash Delete Icon overlaying right edge */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSymbol(w.sym);
                          }}
                          title={`Remove ${w.sym}`}
                          aria-label={`Remove ${w.sym}`}
                          className="opacity-0 group-hover:opacity-100 absolute right-1.5 top-1/2 -translate-y-1/2 w-[26px] h-[26px] rounded-md bg-[var(--bg-hover)] hover:bg-[var(--border)] text-[var(--text-main)] hover:text-[var(--down)] inline-flex items-center justify-center shadow-xs transition-opacity cursor-pointer z-10"
                        >
                          <Trash2 className="w-[14px] h-[14px]" strokeWidth={1.7} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Draggable Horizontal Split Handle between Watchlist & Symbol Details */}
              <div
                onMouseDown={handleStartResizeSplit}
                title="Drag to resize Watchlist / Details"
                className="h-[5px] shrink-0 bg-[var(--bg-gutter)] hover:bg-[var(--accent)]/40 cursor-row-resize transition-colors"
              />

              {/* Bottom Scrollable Symbol Details Panel (Exact TradingView Full-Screen Match!) */}
              <div
                ref={detailsScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-3.5 pt-3 pb-4 bg-[var(--bg-surface)]"
              >
                {/* Sticky Header Row: Logo + Symbol | Grid, Notes, More */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <CoinLogo
                      symbol={curMeta.sym}
                      color={curMeta.color}
                      letter={curMeta.letter}
                      size={24}
                    />
                    <span className="font-bold text-[15px] text-[var(--text-main)] tracking-tight truncate">
                      {currentSymbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowExtendedDetails((v) => !v)}
                      title="Toggle 24h High / Low Range"
                      className={`w-7 h-7 rounded-md inline-flex items-center justify-center cursor-pointer ${
                        showExtendedDetails
                          ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <LayoutGrid className="w-[16px] h-[16px]" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesOpen((v) => !v)}
                      title={`Quick notes for ${currentSymbol}`}
                      className={`w-7 h-7 rounded-md inline-flex items-center justify-center cursor-pointer ${
                        notesOpen || symbolNotes[currentSymbol]
                          ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                          : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <SquarePen className="w-[16px] h-[16px]" strokeWidth={1.6} />
                    </button>
                    <div className="relative" ref={detailsMoreRef}>
                      <button
                        type="button"
                        onClick={() => setDetailsMoreOpen((v) => !v)}
                        title="More symbol actions"
                        className="w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-main)] cursor-pointer"
                      >
                        <MoreHorizontal className="w-[16px] h-[16px]" strokeWidth={1.7} />
                      </button>
                      {detailsMoreOpen && (
                        <div className="absolute right-0 top-8 w-48 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1 z-50 text-xs text-[var(--text-main)]">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsMoreOpen(false);
                              onOpenAlertModal();
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
                          >
                            Add alert on {currentSymbol}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsMoreOpen(false);
                              onOpenSettings('symbol');
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
                          >
                            Symbol settings...
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsMoreOpen(false);
                              onSelectTab('orderbook');
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] cursor-pointer"
                          >
                            View live Order Book
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtitle & Meta */}
                <div className="flex items-center gap-1 text-[12px] text-[var(--text-main)] leading-snug">
                  <span className="truncate">{curMeta.name}</span>
                  <ExternalLink className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="font-medium text-[var(--text-main)]">BINANCE</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-2">
                  Spot · Crypto
                </div>

                {/* Hero Price + USDT + Change + Change% */}
                <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                  <span className="text-[24px] font-bold tracking-tight font-mono-num text-[var(--text-main)] leading-none tabular-nums">
                    {curTicker ? (
                      <SplitPrice formatted={fmtPrice(curTicker.last)} isUp={curIsUp} highlightTail={1} />
                    ) : (
                      '-'
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase">
                    USDT
                  </span>
                  {curTicker && (
                    <span
                      className={`text-[13px] font-semibold font-mono-num tabular-nums ml-1 ${
                        curIsUp ? 'text-[#089981]' : 'text-[#f23645]'
                      }`}
                    >
                      {curIsUp ? '+' : ''}
                      {fmtPrice(curTicker.chg)} {curIsUp ? '+' : ''}
                      {curTicker.pct.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Market Open Live Status */}
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#089981] mt-1.5 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
                  <span>Market open</span>
                </div>

                {/* Volume vs Avg. Volume (30D) Blue-Teal Bar (Exact Match to Screenshot 1!) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-0.5">
                    <span>Volume</span>
                    <span>Avg. volume (30D)</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-semibold font-mono-num text-[var(--text-main)] mb-1.5 tabular-nums">
                    <span>{liveVolBase > 0 ? fmtCompact(liveVolBase) : '-'}</span>
                    <span>{avgVolDisplay > 0 ? fmtCompact(avgVolDisplay) : '-'}</span>
                  </div>
                  <div className="h-[3.5px] w-full rounded-full bg-[#26a69a] overflow-hidden">
                    <div
                      className="h-full bg-[#2962ff] transition-all duration-300"
                      style={{ width: `${volRatioPct}%` }}
                    />
                  </div>
                </div>

                {/* Optional 24h Range when LayoutGrid toggled */}
                {showExtendedDetails && curTicker && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-[var(--text-muted)]">24h Low</div>
                      <div className="font-mono-num font-semibold text-[var(--text-main)]">
                        {fmtPrice(curTicker.low)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[var(--text-muted)]">24h High</div>
                      <div className="font-mono-num font-semibold text-[var(--text-main)]">
                        {fmtPrice(curTicker.high)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Quick Symbol Notes Editor */}
                {notesOpen && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {currentSymbol} Notes
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotesOpen(false)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      value={symbolNotes[currentSymbol] || ''}
                      onChange={(e) => onSaveSymbolNote(currentSymbol, e.target.value)}
                      placeholder={`Write trade plan or key levels for ${currentSymbol}...`}
                      rows={2}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-none"
                    />
                  </div>
                )}

                {/* Key Stats, Performance 6-Tile Grid, Seasonals Chart, & Technicals Gauge */}
                <SymbolAnalyticsSections
                  symbol={currentSymbol}
                  ticker={curTicker}
                  candles={candles}
                  technicalsRef={technicalsRef}
                />
              </div>
            </>
          )}

          {/* ORDER BOOK & RECENT TRADES TAB */}
          {activeTab === 'orderbook' && (
            <>
              <div className="h-[42px] px-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                <span className="font-bold text-[13px] text-[var(--text-main)]">
                  {currentSymbol} Depth
                </span>
                <div className="flex items-center gap-1 bg-[var(--bg-elevated)] p-0.5 rounded border border-[var(--border)]">
                  <button
                    onClick={() => setObSubTab('book')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      obSubTab === 'book'
                        ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Order Book
                  </button>
                  <button
                    onClick={() => setObSubTab('trades')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      obSubTab === 'trades'
                        ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Trades
                  </button>
                </div>
              </div>

              {obSubTab === 'book' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] shrink-0">
                    <span>Price (USDT)</span>
                    <span className="text-right">Size</span>
                    <span className="text-right">Total</span>
                  </div>

                  {/* Asks */}
                  <div className="flex-1 overflow-y-auto flex flex-col justify-end py-1">
                    {asks.length === 0 ? (
                      <div className="text-center text-xs text-[var(--text-muted)] py-6">
                        Connecting to depth stream...
                      </div>
                    ) : (
                      asks.map((lvl, idx) => (
                        <div
                          key={`a-${idx}`}
                          className="relative grid grid-cols-3 px-3 py-[3px] text-[11px] font-mono-num"
                        >
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-[#f23645]/12 pointer-events-none"
                            style={{ width: `${(lvl.total / maxAskTotal) * 100}%` }}
                          />
                          <span className="text-[var(--down)] font-medium relative z-10">
                            {fmtPrice(lvl.price)}
                          </span>
                          <span className="text-right text-[var(--text-main)] relative z-10">
                            {lvl.qty.toFixed(4)}
                          </span>
                          <span className="text-right text-[var(--text-muted)] relative z-10">
                            {lvl.total.toFixed(3)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Spread Strip */}
                  <div className="px-3 py-2 border-y border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-between shrink-0">
                    <span className="font-mono-num text-sm font-bold text-[var(--text-main)]">
                      {curTicker ? fmtPrice(curTicker.last) : '-'}
                    </span>
                    <span className="text-[11px] font-mono-num text-[var(--text-muted)]">
                      Spread {fmtPrice(spread)} ({spreadPct.toFixed(3)}%)
                    </span>
                  </div>

                  {/* Bids */}
                  <div className="flex-1 overflow-y-auto py-1">
                    {bids.map((lvl, idx) => (
                      <div
                        key={`b-${idx}`}
                        className="relative grid grid-cols-3 px-3 py-[3px] text-[11px] font-mono-num"
                      >
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-[#089981]/12 pointer-events-none"
                          style={{ width: `${(lvl.total / maxBidTotal) * 100}%` }}
                        />
                        <span className="text-[var(--up)] font-medium relative z-10">
                          {fmtPrice(lvl.price)}
                        </span>
                        <span className="text-right text-[var(--text-main)] relative z-10">
                          {lvl.qty.toFixed(4)}
                        </span>
                        <span className="text-right text-[var(--text-muted)] relative z-10">
                          {lvl.total.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] shrink-0">
                    <span>Price</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Time</span>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/30">
                    {trades.length === 0 ? (
                      <div className="text-center text-xs text-[var(--text-muted)] py-8">
                        Waiting for live market trades...
                      </div>
                    ) : (
                      trades.map((tr) => (
                        <div
                          key={tr.id}
                          className="grid grid-cols-3 px-3 py-1 text-[11px] font-mono-num"
                        >
                          <span
                            className={
                              tr.isBuyerMaker
                                ? 'text-[var(--down)] font-medium'
                                : 'text-[var(--up)] font-medium'
                            }
                          >
                            {fmtPrice(tr.price)}
                          </span>
                          <span className="text-right text-[var(--text-main)]">
                            {tr.qty.toFixed(4)}
                          </span>
                          <span className="text-right text-[var(--text-muted)]">
                            {new Date(tr.time).toLocaleTimeString('en-GB')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ALERTS TAB (Exact TradingView Alerts / Log Panel) */}
          {activeTab === 'alerts' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Top Segmented Switch: Alerts | Log */}
              <div className="px-3 pt-2.5 pb-2 shrink-0">
                <div className="grid grid-cols-2 p-[3px] rounded-[7px] bg-[#f0f3fa] dark:bg-[#2a2e39]">
                  <button
                    type="button"
                    onClick={() => setAlertsSubTab('alerts')}
                    className={`py-1 text-[13px] rounded-[5px] transition-colors cursor-pointer ${
                      alertsSubTab === 'alerts'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-medium shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] font-normal'
                    }`}
                  >
                    Alerts
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertsSubTab('log')}
                    className={`py-1 text-[13px] rounded-[5px] transition-colors cursor-pointer ${
                      alertsSubTab === 'log'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-medium shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] font-normal'
                    }`}
                  >
                    Log
                  </button>
                </div>
              </div>

              {/* Action Icon Toolbar: + on left, Search / Sort / More on right */}
              <div className="h-[34px] px-2.5 border-b border-[var(--border)] flex items-center justify-between shrink-0 relative">
                <button
                  type="button"
                  onClick={onOpenAlertModal}
                  title="Create alert"
                  className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Plus className="w-[18px] h-[18px]" strokeWidth={1.6} />
                </button>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAlertSearchOpen((v) => !v);
                      if (alertSearchOpen) setAlertSearchQuery('');
                    }}
                    title="Search alerts"
                    className={`w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center cursor-pointer transition-colors ${
                      alertSearchOpen
                        ? 'bg-[var(--bg-hover)] text-[var(--accent)]'
                        : 'text-[var(--text-main)]'
                    }`}
                  >
                    <Search className="w-[15px] h-[15px]" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertSortDesc((v) => !v)}
                    title={alertSortDesc ? 'Newest first' : 'Oldest first'}
                    className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ArrowDownWideNarrow className="w-[16px] h-[16px]" strokeWidth={1.6} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAlertMoreOpen((v) => !v)}
                      title="Alert actions"
                      className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] inline-flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <MoreHorizontal className="w-[16px] h-[16px]" strokeWidth={1.6} />
                    </button>
                    {alertMoreOpen && (
                      <div className="absolute right-0 top-8 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md shadow-xl py-1 z-30 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            alerts.filter((a) => !a.active).forEach((a) => onDeleteAlert(a.id));
                            setAlertMoreOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
                        >
                          Remove inactive alerts
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            alerts.forEach((a) => onDeleteAlert(a.id));
                            setAlertMoreOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] text-[var(--down)] cursor-pointer"
                        >
                          Remove all alerts
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional inline Search Input */}
              {alertSearchOpen && (
                <div className="px-2.5 py-1.5 border-b border-[var(--border)] shrink-0">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2 pointer-events-none" />
                    <input
                      autoFocus
                      type="text"
                      value={alertSearchQuery}
                      onChange={(e) => setAlertSearchQuery(e.target.value)}
                      placeholder="Filter alerts..."
                      className="w-full h-7 pl-7 pr-6 text-xs bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
                    />
                    {alertSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAlertSearchQuery('')}
                        className="absolute right-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Alerts List vs Triggered Log */}
              {alertsSubTab === 'alerts' ? (
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {filteredAlerts.length === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <Bell className="w-7 h-7 mx-auto text-[var(--text-muted)] opacity-45" />
                      <div className="text-xs font-medium text-[var(--text-main)]">
                        {alerts.length === 0 ? 'No Alerts' : 'No matching alerts'}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Click + to set a live price crossing alert.
                      </p>
                    </div>
                  ) : (
                    filteredAlerts.map((al) => {
                      const condLabel =
                        al.condition === 'above'
                          ? 'Crossing Up'
                          : al.condition === 'below'
                          ? 'Crossing Down'
                          : 'Crossing';
                      const headline = al.note?.trim()
                        ? al.note.trim()
                        : `${al.symbol} ${condLabel} ${fmtPrice(al.price)}`;
                      return (
                        <div
                          key={al.id}
                          onClick={() => onSelectSymbol(al.symbol)}
                          className="group relative px-3 py-2.5 hover:bg-[var(--bg-hover)]/65 transition-colors cursor-pointer"
                        >
                          <div className="text-[13px] font-normal text-[var(--text-main)] leading-[1.35] truncate pr-12">
                            {headline}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] leading-none">
                            <CoinLogo symbol={al.symbol} size={16} />
                            <span className="text-[var(--text-main)] font-normal">{al.symbol}</span>
                            <span className="text-[var(--text-muted)]">•</span>
                            <span
                              className={
                                al.active
                                  ? 'text-[#089981] font-normal'
                                  : 'text-[var(--text-muted)] font-normal'
                              }
                            >
                              {al.active ? 'Active' : 'Stopped'}
                            </span>
                          </div>

                          {/* Hover Quick Controls (hidden when resting like TradingView) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="hidden group-hover:flex items-center gap-0.5 absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--bg-surface)]/95 border border-[var(--border)] rounded px-0.5 py-0.5 shadow-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onToggleAlert(al.id)}
                              title={al.active ? 'Stop alert' : 'Restart alert'}
                              className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] inline-flex items-center justify-center cursor-pointer"
                            >
                              {al.active ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAlert(al.id)}
                              title="Delete alert"
                              className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[#f23645] inline-flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {alertLogs.length === 0 ? (
                    <div className="p-6 text-center space-y-1.5">
                      <div className="text-xs font-medium text-[var(--text-main)]">
                        Alerts log is empty
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Triggered alerts will appear here with timestamps.
                      </p>
                    </div>
                  ) : (
                    alertLogs.map((al) => (
                      <div
                        key={`log-${al.id}`}
                        onClick={() => onSelectSymbol(al.symbol)}
                        className="px-3 py-2.5 hover:bg-[var(--bg-hover)]/60 cursor-pointer"
                      >
                        <div className="text-[12.5px] text-[var(--text-main)] truncate">
                          {al.note?.trim() || `${al.symbol} Crossing ${fmtPrice(al.price)}`}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span className="flex items-center gap-1.5">
                            <CoinLogo symbol={al.symbol} size={14} />
                            <span>{al.symbol}</span>
                          </span>
                          <span className="font-mono-num">
                            {al.triggeredAt
                              ? new Date(al.triggeredAt).toLocaleTimeString('en-GB')
                              : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Far-Right TradingView Icon Rail (Exact 1:1 Match to Full-Screen Screenshots) */}
      <aside className="w-[46px] bg-[var(--bg-surface)] rounded-tl-[6px] flex flex-col items-center py-2 justify-between shrink-0">
        {/* Top Rail Icons */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleRailClick('watchlist')}
            title="Watchlist, details and news"
            className={`w-[36px] h-[36px] rounded-[6px] flex items-center justify-center transition-colors cursor-pointer ${
              visible && activeTab === 'watchlist'
                ? 'bg-[#f0f3fa] dark:bg-[var(--bg-hover)] text-[var(--text-main)]'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <WatchlistBookmarkIcon className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => handleRailClick('alerts')}
            title="Alerts"
            className={`relative w-[36px] h-[36px] rounded-[6px] flex items-center justify-center transition-colors cursor-pointer ${
              visible && activeTab === 'alerts'
                ? 'bg-[#f0f3fa] dark:bg-[var(--bg-hover)] text-[var(--text-main)]'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <AlarmClock className="w-[19px] h-[19px]" strokeWidth={1.45} />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--down)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleRailClick('orderbook')}
            title="Order Book & Live Market Depth"
            className={`w-[36px] h-[36px] rounded-[6px] flex items-center justify-center transition-colors cursor-pointer ${
              visible && activeTab === 'orderbook'
                ? 'bg-[#f0f3fa] dark:bg-[var(--bg-hover)] text-[var(--text-main)]'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Layers className="w-[19px] h-[19px]" strokeWidth={1.45} />
          </button>
        </div>

        {/* Bottom Rail Icons (All wired to real live features!) */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenIndicators?.()}
            title="Indicators & Strategies"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={onOpenSearch}
            title="Symbol Screener / Search (Ctrl+K)"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Target className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!visible) onToggleVisible();
              onSelectTab('watchlist');
              setTimeout(() => {
                technicalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 80);
            }}
            title="Technicals & Seasonals"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Mountain className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={() => onOpenSettings('events')}
            title="Calendar & Events Settings"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Calendar className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('orderbook');
              setObSubTab('trades');
              if (!visible) onToggleVisible();
            }}
            title="Live Market Trades Feed"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Rss className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={() => handleRailClick('alerts')}
            title="Alert Notifications"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!visible) onToggleVisible();
              onSelectTab('watchlist');
              setNotesOpen((v) => !v);
              setTimeout(() => {
                detailsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }, 60);
            }}
            title={`Quick Notes for ${currentSymbol}`}
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.45} />
          </button>

          <button
            type="button"
            onClick={onToggleTrade}
            title="Paper Trading Panel"
            className="w-[34px] h-[34px] my-0.5 rounded-full flex items-center justify-center text-[var(--text-main)] hover:opacity-85 transition-opacity cursor-pointer"
          >
            <AppsCircleIcon className="w-[26px] h-[26px]" />
          </button>

          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard Shortcuts"
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-[19px] h-[19px]" strokeWidth={1.45} />
          </button>
        </div>
      </aside>

      {/* Open Watchlist Switcher Modal (Shift + W) */}
      {openListPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenListPicker(false);
          }}
        >
          <div className="w-full max-w-[380px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--text-main)]">Open Watchlist</span>
              <button
                type="button"
                onClick={() => setOpenListPicker(false)}
                className="w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 max-h-[320px] overflow-y-auto space-y-1">
              {watchlists.map((wl) => {
                const count = wl.items.filter((x) => !x.isSection).length;
                const isSel = wl.id === activeListId;
                return (
                  <div
                    key={wl.id}
                    onClick={() => {
                      onSelectWatchlist(wl.id);
                      setOpenListPicker(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-[var(--bg-active)] text-[var(--accent)] font-semibold'
                        : 'hover:bg-[var(--bg-hover)] text-[var(--text-main)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagRibbon color={wl.color || '#f23645'} size={12} />
                      <span className="text-[13px] truncate">{wl.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-num">
                        ({count})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSel && <Check className="w-4 h-4" />}
                      {watchlists.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWatchlist(wl.id);
                          }}
                          title="Delete list"
                          className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--down)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2.5 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpenListPicker(false);
                  setNewListDraft('');
                  setCreatingList(true);
                }}
                className="h-8 px-3 rounded-md bg-[var(--accent)] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create new list
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShortcutsOpen(false);
          }}
        >
          <div className="w-full max-w-[380px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--text-main)]">Keyboard Shortcuts</span>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 text-xs">
              {[
                ['Search Symbol', 'Ctrl + K'],
                ['Open Watchlist', 'Shift + W'],
                ['Trendline', 'Alt + T'],
                ['Horizontal Line', 'Alt + H'],
                ['Horizontal Ray', 'Alt + J'],
                ['Vertical Line', 'Alt + V'],
                ['Cross Line', 'Alt + C'],
                ['Invert Scale', 'Alt + I'],
                ['Percent Scale', 'Alt + P'],
                ['Logarithmic Scale', 'Alt + L'],
                ['Undo / Redo', 'Ctrl + Z / Y'],
                ['Delete Selected Drawing', 'Del / Backspace'],
              ].map(([label, key]) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-0">
                  <span className="text-[var(--text-main)]">{label}</span>
                  <kbd className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] font-mono-num text-[11px] text-[var(--text-muted)]">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
