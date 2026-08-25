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
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; hasMoved: boolean } | null>(null);

  const [showPenPopover, setShowPenPopover] = useState(false);
  const [showAnalysisPopover, setShowAnalysisPopover] = useState(false);
  const popoverTimeoutRef = useRef<any>(null);
  const analysisTimeoutRef = useRef<any>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragStartRef.current.hasMoved = true;
    }
    setPosition({
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    if (dragStartRef.current && !dragStartRef.current.hasMoved) {
      setIsExpanded((prev) => !prev);
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
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-11 h-11 bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-full shadow-2xl z-50 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-all select-none group"
        title="Click to open Whiteboard Toolbar (Drag to move)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor" className="text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors">
          <path d="M106-386q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-160q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm105.5 334.5Q200-223 200-240t11.5-28.5Q223-280 240-280t28.5 11.5Q280-257 280-240t-11.5 28.5Q257-200 240-200t-28.5-11.5Zm0-160Q200-383 200-400t11.5-28.5Q223-440 240-440t28.5 11.5Q280-417 280-400t-11.5 28.5Q257-360 240-360t-28.5-11.5Zm0-160Q200-543 200-560t11.5-28.5Q223-600 240-600t28.5 11.5Q280-577 280-560t-11.5 28.5Q257-520 240-520t-28.5-11.5Zm0-160Q200-703 200-720t11.5-28.5Q223-760 240-760t28.5 11.5Q280-737 280-720t-11.5 28.5Q257-680 240-680t-28.5-11.5Zm146 334Q340-375 340-400t17.5-42.5Q375-460 400-460t42.5 17.5Q460-425 460-400t-17.5 42.5Q425-340 400-340t-42.5-17.5Zm0-160Q340-535 340-560t17.5-42.5Q375-620 400-620t42.5 17.5Q460-585 460-560t-17.5 42.5Q425-500 400-500t-42.5-17.5Zm14 306Q360-223 360-240t11.5-28.5Q383-280 400-280t28.5 11.5Q440-257 440-240t-11.5 28.5Q417-200 400-200t-28.5-11.5Zm0-480Q360-703 360-720t11.5-28.5Q383-760 400-760t28.5 11.5Q440-737 440-720t-11.5 28.5Q417-680 400-680t-28.5-11.5ZM386-106q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-720q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm131.5 468.5Q500-375 500-400t17.5-42.5Q535-460 560-460t42.5 17.5Q620-425 620-400t-17.5 42.5Q585-340 560-340t-42.5-17.5Zm0-160Q500-535 500-560t17.5-42.5Q535-620 560-620t42.5 17.5Q620-585 620-560t-17.5 42.5Q585-500 560-500t-42.5-17.5Zm14 306Q520-223 520-240t11.5-28.5Q543-280 560-280t28.5 11.5Q600-257 600-240t-11.5 28.5Q577-200 560-200t-28.5-11.5Zm0-480Q520-703 520-720t11.5-28.5Q543-760 560-760t28.5 11.5Q600-737 600-720t-11.5 28.5Q577-680 560-680t-28.5-11.5ZM546-106q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-720q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm145.5 614.5Q680-223 680-240t11.5-28.5Q703-280 720-280t28.5 11.5Q760-257 760-240t-11.5 28.5Q737-200 720-200t-28.5-11.5Zm0-160Q680-383 680-400t11.5-28.5Q703-440 720-440t28.5 11.5Q760-417 760-400t-11.5 28.5Q737-360 720-360t-28.5-11.5Zm0-160Q680-543 680-560t11.5-28.5Q703-600 720-600t28.5 11.5Q760-577 720-560t-11.5 28.5Q737-520 720-520t-28.5-11.5Zm0-160Q680-703 680-720t11.5-28.5Q703-760 720-760t28.5 11.5Q760-737 760-720t-11.5 28.5Q737-680 720-680t-28.5-11.5ZM826-386q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-160q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Z"/>
        </svg>
      </div>
    );
  }

  // EXPANDED MODE: Full movable toolbar container
  return (
    <div
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50 transition-all flex-wrap relative justify-center select-none animate-fade-in"
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
          <path d="M106-386q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-160q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm105.5 334.5Q200-223 200-240t11.5-28.5Q223-280 240-280t28.5 11.5Q280-257 280-240t-11.5 28.5Q257-200 240-200t-28.5-11.5Zm0-160Q200-383 200-400t11.5-28.5Q223-440 240-440t28.5 11.5Q280-417 280-400t-11.5 28.5Q257-360 240-360t-28.5-11.5Zm0-160Q200-543 200-560t11.5-28.5Q223-600 240-600t28.5 11.5Q280-577 280-560t-11.5 28.5Q257-520 240-520t-28.5-11.5Zm0-160Q200-703 200-720t11.5-28.5Q223-760 240-760t28.5 11.5Q280-737 280-720t-11.5 28.5Q257-680 240-680t-28.5-11.5Zm146 334Q340-375 340-400t17.5-42.5Q375-460 400-460t42.5 17.5Q460-425 460-400t-17.5 42.5Q425-340 400-340t-42.5-17.5Zm0-160Q340-535 340-560t17.5-42.5Q375-620 400-620t42.5 17.5Q460-585 460-560t-17.5 42.5Q425-500 400-500t-42.5-17.5Zm14 306Q360-223 360-240t11.5-28.5Q383-280 400-280t28.5 11.5Q440-257 440-240t-11.5 28.5Q417-200 400-200t-28.5-11.5Zm0-480Q360-703 360-720t11.5-28.5Q383-760 400-760t28.5 11.5Q440-737 440-720t-11.5 28.5Q417-680 400-680t-28.5-11.5ZM386-106q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-720q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm131.5 468.5Q500-375 500-400t17.5-42.5Q535-460 560-460t42.5 17.5Q620-425 620-400t-17.5 42.5Q585-340 560-340t-42.5-17.5Zm0-160Q500-535 500-560t17.5-42.5Q535-620 560-620t42.5 17.5Q620-585 620-560t-17.5 42.5Q585-500 560-500t-42.5-17.5Zm14 306Q520-223 520-240t11.5-28.5Q543-280 560-280t28.5 11.5Q600-257 600-240t-11.5 28.5Q577-200 560-200t-28.5-11.5Zm0-480Q520-703 520-720t11.5-28.5Q543-760 560-760t28.5 11.5Q600-737 600-720t-11.5 28.5Q577-680 560-680t-28.5-11.5ZM546-106q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-720q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm145.5 614.5Q680-223 680-240t11.5-28.5Q703-280 720-280t28.5 11.5Q760-257 760-240t-11.5 28.5Q737-200 720-200t-28.5-11.5Zm0-160Q680-383 680-400t11.5-28.5Q703-440 720-440t28.5 11.5Q760-417 760-400t-11.5 28.5Q737-360 720-360t-28.5-11.5Zm0-160Q680-543 680-560t11.5-28.5Q703-600 720-600t28.5 11.5Q760-577 720-560t-11.5 28.5Q737-520 720-520t-28.5-11.5Zm0-160Q680-703 680-720t11.5-28.5Q703-760 720-760t28.5 11.5Q760-737 760-720t-11.5 28.5Q737-680 720-680t-28.5-11.5ZM826-386q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Zm0-160q-6-6-6-14t6-14q6-6 14-6t14 6q6 6 6 14t-6 14q-6 6-14 6t-14-6Z"/>
        </svg>
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />
      {/* 1. Pen Tool Button with Hover Popover */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnterPen}
        onMouseLeave={handleMouseLeavePen}
      >
        <button
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
          >
            {/* Mode Switcher */}
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">Canvas Mode</span>
              <div className="flex gap-1 p-1 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-subtle)]">
                <button
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
      <div className="flex items-center gap-1">
        <button
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
      >
        <button
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
          >
            <div className="px-2 py-1 border-b border-[var(--border-subtle)] mb-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">AI Analysis Tools</span>
            </div>

            <button
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
        onClick={onClear}
        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer ml-0.5"
        title="Clear canvas"
      >
        <Trash2 size={15} />
      </button>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* Collapse button to shrink back to round icon */}
      <button
        onClick={() => setIsExpanded(false)}
        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] rounded-xl transition-all cursor-pointer"
        title="Collapse to round button widget"
      >
        <X size={15} />
      </button>
    </div>
  );
};
