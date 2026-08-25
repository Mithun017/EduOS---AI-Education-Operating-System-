import React, { useState, useRef } from 'react';
import { PenTool, Eraser, Trash2, Undo2, Redo2, Grid, Move, BarChart2, Edit3, Shapes, Globe, Sparkles, ChevronDown, X } from 'lucide-react';

interface ShapeToolbarProps {
  activeTool: 'pen' | 'eraser' | 'lasso' | 'select';
  setActiveTool: (tool: 'pen' | 'eraser' | 'lasso' | 'select') => void;
  canvasMode: 'writing' | 'drawing';
  setCanvasMode: (mode: 'writing' | 'drawing') => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRecognize: () => void;
  onWebSearch: () => void;
  onVisualize: () => void;
  onSaveCanvas: () => void;
  hasSelection: boolean;
}

const COLOR_PALETTE = [
  { name: 'Default', value: '#D6C8DF' },
  { name: 'Sky', value: '#38BDF8' },
  { name: 'Emerald', value: '#34D399' },
  { name: 'Pink', value: '#F472B6' },
  { name: 'Amber', value: '#FBBF24' },
  { name: 'Red', value: '#F87171' },
  { name: 'White', value: '#FFFFFF' }
];

const MARKER_SIZES = [
  { label: 'Fine', value: 2, sizeClass: 'w-2 h-2' },
  { label: 'Medium', value: 5, sizeClass: 'w-3.5 h-3.5' },
  { label: 'Bold', value: 10, sizeClass: 'w-5 h-5' },
  { label: 'Highlighter', value: 20, sizeClass: 'w-6 h-6 opacity-70' }
];

export const ShapeToolbar: React.FC<ShapeToolbarProps> = ({
  activeTool,
  setActiveTool,
  canvasMode,
  setCanvasMode,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  snapToGrid,
  setSnapToGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onRecognize,
  onWebSearch,
  onVisualize,
  onSaveCanvas,
  hasSelection: _hasSelection,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [_isDragging, setIsDragging] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    startToolbarLeft: number;
    startToolbarTop: number;
    hasMoved: boolean;
  } | null>(null);

  const [showPenPopover, setShowPenPopover] = useState(false);
  const [showAnalysisPopover, setShowAnalysisPopover] = useState(false);
  const popoverTimeoutRef = useRef<any>(null);
  const analysisTimeoutRef = useRef<any>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (toolbarRef.current) {
      try {
        toolbarRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      startToolbarLeft: 0,
      startToolbarTop: 0,
      hasMoved: false
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !toolbarRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragStartRef.current.hasMoved = true;
    }

    const rawX = dragStartRef.current.initialX + dx;
    const rawY = dragStartRef.current.initialY + dy;

    // Find parent canvas board container to clamp inside bounds
    const canvasContainer = toolbarRef.current.closest('.relative') || toolbarRef.current.parentElement;
    if (canvasContainer) {
      const canvasRect = canvasContainer.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();

      const padding = 12;
      const maxPosX = Math.max(0, canvasRect.width - toolbarRect.width - (padding * 2));
      const maxPosY = Math.max(0, canvasRect.height - toolbarRect.height - (padding * 2));

      const clampedX = Math.max(0, Math.min(maxPosX, rawX));
      const clampedY = Math.max(0, Math.min(maxPosY, rawY));

      setPosition({ x: clampedX, y: clampedY });
    } else {
      setPosition({ x: Math.max(0, rawX), y: Math.max(0, rawY) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (toolbarRef.current) {
      try {
        toolbarRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDragging(false);
    if (!isExpanded && dragStartRef.current && !dragStartRef.current.hasMoved) {
      setIsExpanded(true);
    }
    dragStartRef.current = null;
  };

  const handleMouseEnterPen = () => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    setShowPenPopover(true);
  };

  const handleMouseLeavePen = () => {
    popoverTimeoutRef.current = setTimeout(() => {
      setShowPenPopover(false);
    }, 300);
  };

  const handleMouseEnterAnalysis = () => {
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    setShowAnalysisPopover(true);
  };

  const handleMouseLeaveAnalysis = () => {
    analysisTimeoutRef.current = setTimeout(() => {
      setShowAnalysisPopover(false);
    }, 300);
  };

  // COLLAPSED MODE: Sleek round movable button widget with user reference SVG icon
  if (!isExpanded) {
    return (
      <div
        ref={toolbarRef}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-11 h-11 bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-full shadow-2xl z-50 flex items-center justify-center cursor-grab active:cursor-grabbing select-none group"
        title="Click to open Whiteboard Toolbar (Drag to move)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor" className="text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors group-hover:scale-110">
          <path d="m480-360 160-160H320l160 160Zm0 280q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
        </svg>
      </div>
    );
  }

  // EXPANDED MODE: Full movable toolbar container
  return (
    <div
      ref={toolbarRef}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50 flex-wrap relative justify-center select-none animate-fade-in cursor-grab active:cursor-grabbing"
    >
      {/* Drag Handle (User Reference SVG Icon) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-grab active:cursor-grabbing hover:bg-[var(--accent-primary-soft)] rounded-xl transition-colors flex items-center justify-center"
        title="Drag toolbar to move anywhere"
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
          <path d="m480-360 160-160H320l160 160Zm0 280q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
        </svg>
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />
      {/* 1. Pen Tool Button with Hover Popover */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnterPen}
        onMouseLeave={handleMouseLeavePen}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setActiveTool('pen');
            setShowPenPopover(!showPenPopover);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
          }`}
          title="Pen tool (Hover or click to customize colors, marker size & writing/drawing mode)"
        >
          <div className="relative flex items-center justify-center">
            <PenTool size={15} />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black"
              style={{ backgroundColor: strokeColor }}
            />
          </div>
          <span className="text-xs font-bold capitalize">{canvasMode}</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${showPenPopover ? 'rotate-180' : ''}`} />
        </button>

        {/* Hover / Click Popover Menu for Pen Customization */}
        {showPenPopover && (
          <div
            className="absolute top-full left-0 mt-2 p-3 bg-[var(--card-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50 min-w-[280px] space-y-3 animate-fade-in"
            onMouseEnter={handleMouseEnterPen}
            onMouseLeave={handleMouseLeavePen}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Mode Switcher */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">Canvas Mode</span>
              <div className="flex gap-1 p-1 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-subtle)]">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCanvasMode('writing')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    canvasMode === 'writing'
                      ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>Writing</span>
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCanvasMode('drawing')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    canvasMode === 'drawing'
                      ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Shapes size={13} />
                  <span>Drawing</span>
                </button>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">Ink Colors</span>
              <div className="flex items-center gap-1.5 p-1.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-subtle)] justify-between">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.name}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setStrokeColor(c.value)}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                      strokeColor === c.value ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] scale-110' : 'opacity-85'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={`Color: ${c.name}`}
                  />
                ))}
              </div>
            </div>

            {/* Marker Sizes */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">Marker Thickness</span>
              <div className="flex items-center gap-1.5 p-1.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-subtle)] justify-between">
                {MARKER_SIZES.map((s) => (
                  <button
                    key={s.label}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setStrokeWidth(s.value)}
                    className={`flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer ${
                      strokeWidth === s.value
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={`Marker Size: ${s.label} (${s.value}px)`}
                  >
                    <div className={`rounded-full bg-[var(--accent-primary)] ${s.sizeClass}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Tools (Eraser / Lasso) */}
      <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setActiveTool('eraser')}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
          }`}
          title="Eraser tool"
        >
          <Eraser size={15} />
        </button>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setActiveTool('lasso')}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            activeTool === 'lasso'
              ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
          }`}
          title="Lasso select"
        >
          <Move size={15} />
        </button>
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* Grid snap & Undo/Redo */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
          snapToGrid
            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Snap to Grid"
      >
        <Grid size={15} />
      </button>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded-xl transition-all ${
          canUndo
            ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] cursor-pointer'
            : 'opacity-40 cursor-not-allowed text-[var(--text-secondary)]'
        }`}
        title="Undo"
      >
        <Undo2 size={15} />
      </button>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded-xl transition-all ${
          canRedo
            ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] cursor-pointer'
            : 'opacity-40 cursor-not-allowed text-[var(--text-secondary)]'
        }`}
        title="Redo"
      >
        <Redo2 size={15} />
      </button>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* 3. AI ANALYSIS BUTTON WITH HOVER POPOVER */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnterAnalysis}
        onMouseLeave={handleMouseLeaveAnalysis}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setShowAnalysisPopover(!showAnalysisPopover)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
          title="AI Analysis Tools (Plot Math, Visualize AI, OCR & Web Search)"
        >
          <Sparkles size={14} />
          <span>Analysis</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${showAnalysisPopover ? 'rotate-180' : ''}`} />
        </button>

        {/* Hover / Click Popover Menu for AI Analysis Tools */}
        {showAnalysisPopover && (
          <div
            className="absolute top-full right-0 mt-2 p-2 bg-[var(--card-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50 min-w-[210px] space-y-1 animate-fade-in"
            onMouseEnter={handleMouseEnterAnalysis}
            onMouseLeave={handleMouseLeaveAnalysis}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 border-b border-[var(--border-subtle)] mb-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">AI Analysis Tools</span>
            </div>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onRecognize();
                setShowAnalysisPopover(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary)] transition-all cursor-pointer text-left"
            >
              <BarChart2 size={14} className="text-[var(--accent-primary)]" />
              <div>
                <div className="font-bold">Plot Math</div>
                <div className="text-[9px] font-normal text-[var(--text-secondary)]">OCR & curve plotting</div>
              </div>
            </button>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onVisualize();
                setShowAnalysisPopover(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary)] transition-all cursor-pointer text-left"
            >
              <Sparkles size={14} className="text-[var(--accent-primary)]" />
              <div>
                <div className="font-bold">Visualize AI</div>
                <div className="text-[9px] font-normal text-[var(--text-secondary)]">Conceptual breakdown card</div>
              </div>
            </button>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onWebSearch();
                setShowAnalysisPopover(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] hover:text-[var(--accent-primary)] transition-all cursor-pointer text-left"
            >
              <Globe size={14} className="text-[var(--accent-primary)]" />
              <div>
                <div className="font-bold">OCR & Web Search</div>
                <div className="text-[9px] font-normal text-[var(--text-secondary)]">Grounded Tavily web search</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* 4. SAVE CANVAS BUTTON (User reference SVG Icon) */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onSaveCanvas}
        className="p-1.5 text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-xl transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
        title="Save Canvas to History"
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
          <path d="m720-120 160-160-56-56-64 64v-167h-80v167l-64-64-56 56 160 160ZM560 0v-80h320V0H560ZM240-160q-33 0-56.5-23.5T160-240v-560q0-33 23.5-56.5T240-880h280l240 240v121h-80v-81H480v-200H240v560h240v80H240Zm0-80v-560 560Z"/>
        </svg>
      </button>

      {/* Clear Canvas */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClear}
        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer ml-0.5"
        title="Clear canvas"
      >
        <Trash2 size={15} />
      </button>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* Collapse button to shrink back to round icon */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setIsExpanded(false)}
        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] rounded-xl transition-all cursor-pointer"
        title="Collapse to round button widget"
      >
        <X size={15} />
      </button>
    </div>
  );
};
