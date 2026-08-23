import React from 'react';
import { PenTool, Eraser, Trash2, Undo2, Redo2, Grid, Sparkles, Move } from 'lucide-react';

interface ShapeToolbarProps {
  activeTool: 'pen' | 'eraser' | 'lasso' | 'select';
  setActiveTool: (tool: 'pen' | 'eraser' | 'lasso' | 'select') => void;
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

export const ShapeToolbar: React.FC<ShapeToolbarProps> = ({
  activeTool,
  setActiveTool,
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
    <div className="flex items-center gap-1.5 p-2 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl z-50">
      {/* Drawing tools */}
      <button
        onClick={() => setActiveTool('pen')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'pen'
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-md'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Pen tool"
      >
        <PenTool size={18} />
      </button>

      <button
        onClick={() => setActiveTool('eraser')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'eraser'
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-md'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Eraser tool"
      >
        <Eraser size={18} />
      </button>

      <button
        onClick={() => setActiveTool('lasso')}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          activeTool === 'lasso'
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-md'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Lasso select"
      >
        <Move size={18} />
      </button>

      <div className="h-6 w-[1px] bg-[var(--border-subtle)] mx-1" />

      {/* Grid snap */}
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          snapToGrid
            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Snap to Grid"
      >
        <Grid size={18} />
      </button>

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2.5 rounded-xl transition-all ${
          canUndo
            ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] cursor-pointer'
            : 'opacity-40 cursor-not-allowed text-[var(--text-secondary)]'
        }`}
        title="Undo"
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-2.5 rounded-xl transition-all ${
          canRedo
            ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)] cursor-pointer'
            : 'opacity-40 cursor-not-allowed text-[var(--text-secondary)]'
        }`}
        title="Redo"
      >
        <Redo2 size={18} />
      </button>

      <div className="h-6 w-[1px] bg-[var(--border-subtle)] mx-1" />

      {/* Action buttons */}
      {hasSelection && (
        <button
          onClick={onRecognize}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-xl text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Recognize handwritten math"
        >
          <Sparkles size={14} />
          <span>Plot Math</span>
        </button>
      )}

      <button
        onClick={onClear}
        className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
        title="Clear canvas"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};
