import React from 'react';
import { PenTool, Eraser, Trash2, Undo2, Redo2, Grid, Move, BarChart2, Edit3, Shapes } from 'lucide-react';

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
  { label: 'Medium', value: 5, sizeClass: 'w-3 h-3' },
  { label: 'Bold', value: 10, sizeClass: 'w-4 h-4' },
  { label: 'Highlighter', value: 20, sizeClass: 'w-5 h-5 opacity-70' }
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
  hasSelection,
}) => {
  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50 transition-all flex-wrap">
      {/* 1. Mode Switcher: Writing vs Drawing */}
      <div className="flex items-center p-0.5 bg-[var(--card-bg)] rounded-xl border border-[var(--border-subtle)]">
        <button
          onClick={() => {
            setCanvasMode('writing');
            setActiveTool('pen');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            canvasMode === 'writing'
              ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Writing Mode: Keeps your freehand handwriting exactly as written"
        >
          <Edit3 size={13} />
          <span>Writing</span>
        </button>

        <button
          onClick={() => {
            setCanvasMode('drawing');
            setActiveTool('pen');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            canvasMode === 'drawing'
              ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Drawing Mode: Auto-snaps rough drawings into straight lines & perfect circles"
        >
          <Shapes size={13} />
          <span>Drawing</span>
        </button>
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* 2. Tools (Pen / Eraser / Lasso) */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveTool('pen')}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
          }`}
          title="Pen tool"
        >
          <PenTool size={15} />
        </button>

        <button
          onClick={() => setActiveTool('eraser')}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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

      {/* 3. Color Swatches */}
      <div className="flex items-center gap-1 bg-[var(--card-bg)] px-2 py-1 rounded-xl border border-[var(--border-subtle)]">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c.name}
            onClick={() => setStrokeColor(c.value)}
            className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer ${
              strokeColor === c.value ? 'ring-2 ring-offset-1 ring-[var(--accent-primary)] scale-110' : 'opacity-80'
            }`}
            style={{ backgroundColor: c.value }}
            title={`Color: ${c.name}`}
          />
        ))}
      </div>

      {/* 4. Marker Sizes */}
      <div className="flex items-center gap-1 bg-[var(--card-bg)] px-2 py-1 rounded-xl border border-[var(--border-subtle)]">
        {MARKER_SIZES.map((s) => (
          <button
            key={s.label}
            onClick={() => setStrokeWidth(s.value)}
            className={`flex items-center justify-center p-1 rounded-lg transition-all cursor-pointer ${
              strokeWidth === s.value
                ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={`Marker Size: ${s.label} (${s.value}px)`}
          >
            <div
              className={`rounded-full bg-[var(--accent-primary)] ${s.sizeClass}`}
            />
          </button>
        ))}
      </div>

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* Grid snap */}
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          snapToGrid
            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Snap to Grid"
      >
        <Grid size={15} />
      </button>

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded-lg transition-all ${
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
        className={`p-1.5 rounded-lg transition-all ${
          canRedo
            ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] cursor-pointer'
            : 'opacity-40 cursor-not-allowed text-[var(--text-secondary)]'
        }`}
        title="Redo"
      >
        <Redo2 size={15} />
      </button>

      {/* Interactive Selection Action (Plot Math) */}
      {hasSelection && (
        <button
          onClick={onRecognize}
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Recognize and plot selection"
        >
          <BarChart2 size={13} />
          <span>Plot Selection</span>
        </button>
      )}

      {/* Clear Canvas */}
      <button
        onClick={onClear}
        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer ml-0.5"
        title="Clear canvas"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};
