import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Star,
  Magnet,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  PenTool,
  ZoomOut,
} from 'lucide-react';
import { DrawingTool, MagnetMode } from '../types/trading';
import {
  ALL_TOOLS_MAP,
  findGroupForTool,
  MEASURE_TOOL,
  TOOL_GROUPS,
  ZOOM_TOOL,
} from '../utils/drawingToolsCatalog';

interface LeftToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  favoriteTools: DrawingTool[];
  onToggleFavoriteTool: (tool: DrawingTool) => void;
  magnetMode: MagnetMode;
  onChangeMagnetMode: (mode: MagnetMode) => void;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  lockDrawings: boolean;
  onToggleLockDrawings: () => void;
  drawingsHidden: boolean;
  onToggleHideDrawings: () => void;
  drawingsCount: number;
  selectedDrawingId: string | null;
  onDeleteSelectedDrawing: () => void;
  onClearDrawings: () => void;
  onZoomOut: () => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  onSelectTool,
  favoriteTools,
  onToggleFavoriteTool,
  magnetMode,
  onChangeMagnetMode,
  stayInDrawingMode,
  onToggleStayInDrawingMode,
  lockDrawings,
  onToggleLockDrawings,
  drawingsHidden,
  onToggleHideDrawings,
  drawingsCount,
  selectedDrawingId,
  onDeleteSelectedDrawing,
  onClearDrawings,
  onZoomOut,
}) => {
  // Remember the last chosen tool per group so the left rail icon updates just like TradingView
  const [groupActiveTool, setGroupActiveTool] = useState<Record<string, DrawingTool>>(() =>
    TOOL_GROUPS.reduce((acc, g) => {
      acc[g.id] = g.defaultTool;
      return acc;
    }, {} as Record<string, DrawingTool>)
  );

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuTop, setMenuTop] = useState<number>(48);
  const railRef = useRef<HTMLDivElement>(null);

  // Sync group active tool when activeTool changes externally (e.g. keyboard shortcut or favorite bar)
  useEffect(() => {
    const grp = findGroupForTool(activeTool);
    if (grp) {
      setGroupActiveTool((prev) =>
        prev[grp.id] === activeTool ? prev : { ...prev, [grp.id]: activeTool }
      );
    }
  }, [activeTool]);

  // Close flyout on click outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleOutside = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openMenuId]);

  const openFlyout = (id: string, buttonEl: HTMLElement | null) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      const maxTop = window.innerHeight - 360;
      setMenuTop(Math.max(46, Math.min(rect.top, maxTop)));
    }
    setOpenMenuId(id);
  };

  const handlePickTool = (toolId: DrawingTool) => {
    const grp = findGroupForTool(toolId);
    if (grp) {
      setGroupActiveTool((prev) => ({ ...prev, [grp.id]: toolId }));
    }
    onSelectTool(toolId);
    setOpenMenuId(null);
  };

  const openGroup = TOOL_GROUPS.find((g) => g.id === openMenuId);

  return (
    <aside
      ref={railRef}
      className="relative w-[52px] bg-[var(--bg-surface)] border-r border-[var(--border)] flex flex-col items-center py-2 gap-1 shrink-0 select-none z-30"
    >
      {/* Category Tool Slots with Flyout Chevron */}
      <div className="flex flex-col items-center gap-1 w-full overflow-y-auto overflow-x-hidden pb-2">
        {TOOL_GROUPS.map((group) => {
          const currentId = groupActiveTool[group.id] || group.defaultTool;
          const toolDef = ALL_TOOLS_MAP[currentId];
          const isGroupActive = group.tools.some((t) => t.id === activeTool);
          const isMenuOpen = openMenuId === group.id;

          return (
            <div key={group.id} className="relative group/slot flex items-center justify-center w-full">
              <button
                onClick={() => onSelectTool(currentId)}
                title={`${toolDef.label}${toolDef.shortcut ? ` (${toolDef.shortcut})` : ''}`}
                className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  isGroupActive
                    ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {toolDef.renderIcon('w-[19px] h-[19px]')}
              </button>

              {/* Tiny right-edge flyout chevron trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openFlyout(group.id, e.currentTarget.parentElement);
                }}
                title={`${group.title} menu`}
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-3 h-7 rounded-r flex items-center justify-center transition-opacity cursor-pointer ${
                  isMenuOpen
                    ? 'opacity-100 bg-[var(--bg-hover)] text-[var(--accent)]'
                    : 'opacity-0 group-hover/slot:opacity-100 hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
                }`}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <div className="w-7 h-px bg-[var(--border)] my-1 shrink-0" />

        {/* Measure Tool */}
        <button
          onClick={() => onSelectTool('measure')}
          title="Measure Price & Bars (Drag)"
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'measure'
              ? 'bg-[var(--bg-active)] text-[var(--accent)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {MEASURE_TOOL.renderIcon('w-[19px] h-[19px]')}
        </button>

        {/* Zoom In Box Tool + Zoom Out */}
        <div className="relative group/slot flex items-center justify-center w-full">
          <button
            onClick={() => onSelectTool('zoom_in')}
            title="Zoom In (Drag Box on Chart)"
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === 'zoom_in'
                ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {ZOOM_TOOL.renderIcon('w-[19px] h-[19px]')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoomOut();
            }}
            title="Zoom Out"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 w-3 h-7 rounded-r flex items-center justify-center opacity-0 group-hover/slot:opacity-100 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
        </div>

        <div className="w-7 h-px bg-[var(--border)] my-1 shrink-0" />

        {/* Magnet Mode (TradingView dark toggle + Weak/Strong flyout) */}
        <div className="relative group/slot flex items-center justify-center w-full">
          <button
            onClick={() => onChangeMagnetMode(magnetMode === 'off' ? 'weak' : 'off')}
            title={
              magnetMode === 'off'
                ? 'Magnet Mode: OFF (Click to enable Weak Magnet)'
                : magnetMode === 'weak'
                ? 'Weak Magnet: ON (Snaps near candle OHLC)'
                : 'Strong Magnet: ON (Always snaps to candle OHLC)'
            }
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              magnetMode !== 'off'
                ? 'bg-[#131722] dark:bg-[var(--accent)] text-white'
                : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Magnet className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openFlyout('magnet', e.currentTarget.parentElement);
            }}
            title="Magnet Mode Options"
            className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-3 h-7 rounded-r flex items-center justify-center transition-opacity cursor-pointer ${
              openMenuId === 'magnet'
                ? 'opacity-100 bg-[var(--bg-hover)] text-[var(--accent)]'
                : 'opacity-0 group-hover/slot:opacity-100 hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
            }`}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Stay in Drawing Mode */}
        <button
          onClick={onToggleStayInDrawingMode}
          title={
            stayInDrawingMode
              ? 'Stay in Drawing Mode: ON (Keep tool active after drawing)'
              : 'Stay in Drawing Mode: OFF (Return to cursor after drawing)'
          }
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            stayInDrawingMode
              ? 'bg-[var(--bg-active)] text-[var(--accent)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <PenTool className="w-[17px] h-[17px]" />
        </button>

        {/* Lock All Drawings */}
        <button
          onClick={onToggleLockDrawings}
          title={
            lockDrawings
              ? 'All Drawings Locked (Click to unlock dragging/editing)'
              : 'Lock All Drawing Tools'
          }
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            lockDrawings
              ? 'bg-[var(--bg-active)] text-[var(--accent)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {lockDrawings ? <Lock className="w-[17px] h-[17px]" /> : <Unlock className="w-[17px] h-[17px]" />}
        </button>

        {/* Hide All Drawings */}
        <button
          onClick={onToggleHideDrawings}
          title={drawingsHidden ? 'Show All Drawings' : 'Hide All Drawings'}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            drawingsHidden
              ? 'bg-[var(--bg-active)] text-[var(--accent)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {drawingsHidden ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
        </button>

        {/* Remove Drawings (Click or flyout) */}
        <div className="relative group/slot flex items-center justify-center w-full">
          <button
            onClick={() => {
              if (selectedDrawingId) onDeleteSelectedDrawing();
              else onClearDrawings();
            }}
            disabled={drawingsCount === 0}
            title={
              selectedDrawingId
                ? 'Delete Selected Drawing (Del)'
                : `Remove All Drawings (${drawingsCount})`
            }
            className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] hover:text-[var(--down)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Trash2 className="w-[17px] h-[17px]" />
          </button>
          {drawingsCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openFlyout('trash', e.currentTarget.parentElement);
              }}
              title="Remove Options"
              className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-3 h-7 rounded-r flex items-center justify-center transition-opacity cursor-pointer ${
                openMenuId === 'trash'
                  ? 'opacity-100 bg-[var(--bg-hover)] text-[var(--accent)]'
                  : 'opacity-0 group-hover/slot:opacity-100 hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
              }`}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* FLYOUT SUBMENU FOR TOOL GROUPS (TradingView Style) */}
      {openGroup && (
        <div
          style={{ top: `${menuTop}px` }}
          className="fixed left-[54px] w-[248px] max-h-[calc(100vh-64px)] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-2 z-50"
        >
          {openGroup.tools.map((tool, idx) => {
            const prevSection = idx > 0 ? openGroup.tools[idx - 1].section : null;
            const showSection = tool.section && tool.section !== prevSection;
            const isSelected = activeTool === tool.id;
            const isFav = favoriteTools.includes(tool.id);

            return (
              <React.Fragment key={tool.id}>
                {showSection && (
                  <div
                    className={`px-3.5 pt-2 pb-1 text-[10px] font-bold tracking-wider text-[var(--text-muted)] ${
                      idx > 0 ? 'mt-1.5 border-t border-[var(--border)] pt-2.5' : ''
                    }`}
                  >
                    {tool.section}
                  </div>
                )}
                <div
                  onClick={() => handlePickTool(tool.id)}
                  className={`group/item px-3 py-1.5 mx-1 rounded flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--bg-active)] text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 opacity-90">
                      {tool.renderIcon('w-[17px] h-[17px]')}
                    </span>
                    <span className="text-[13px] truncate">{tool.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {tool.shortcut && (
                      <span className="text-[11px] font-mono-num text-[var(--text-muted)]">
                        {tool.shortcut}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavoriteTool(tool.id);
                      }}
                      title={isFav ? 'Remove from Favorites bar' : 'Add to Favorites bar'}
                      className={`p-0.5 rounded transition-opacity cursor-pointer ${
                        isFav
                          ? 'opacity-100 text-[var(--amber)]'
                          : 'opacity-0 group-hover/item:opacity-100 text-[var(--text-muted)] hover:text-[var(--amber)]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* MAGNET FLYOUT */}
      {openMenuId === 'magnet' && (
        <div
          style={{ top: `${menuTop}px` }}
          className="fixed left-[54px] w-[210px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50"
        >
          <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-[var(--text-muted)]">
            MAGNET MODE
          </div>
          {(
            [
              { id: 'weak', label: 'Weak Magnet', desc: 'Snaps when close to OHLC' },
              { id: 'strong', label: 'Strong Magnet', desc: 'Always snaps to candle OHLC' },
              { id: 'off', label: 'Off', desc: 'Free placement' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChangeMagnetMode(m.id);
                setOpenMenuId(null);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] flex flex-col cursor-pointer ${
                magnetMode === m.id ? 'bg-[var(--bg-active)] text-[var(--accent)]' : 'text-[var(--text-main)]'
              }`}
            >
              <span className="text-xs font-semibold">{m.label}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* TRASH FLYOUT */}
      {openMenuId === 'trash' && (
        <div
          style={{ top: `${menuTop}px` }}
          className="fixed left-[54px] w-[210px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-2xl py-1.5 z-50 text-xs"
        >
          {selectedDrawingId && (
            <button
              onClick={() => {
                onDeleteSelectedDrawing();
                setOpenMenuId(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] text-[var(--text-main)] cursor-pointer"
            >
              Remove Selected Drawing
            </button>
          )}
          <button
            onClick={() => {
              onClearDrawings();
              setOpenMenuId(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] text-[var(--down)] font-semibold cursor-pointer"
          >
            Remove All {drawingsCount} Drawings
          </button>
        </div>
      )}
    </aside>
  );
};
