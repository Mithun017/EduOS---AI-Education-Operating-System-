import React from 'react';
import { PenTool, Eraser, Trash2, Undo2, Redo2, Grid, Sparkles, Move, Network } from 'lucide-react';

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
  onOpenGraphicalView?: () => void;
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
  onOpenGraphicalView,
}) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-xl shadow-xl z-50">
      {/* Drawing tools */}
      <button
        onClick={() => setActiveTool('pen')}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          activeTool === 'pen'
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-sm'
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
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-sm'
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
            ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
        }`}
        title="Lasso select"
      >
        <Move size={15} />
      </button>

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

      <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-0.5" />

      {/* Action buttons */}
      {hasSelection && (
        <button
          onClick={onRecognize}
          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Recognize handwritten math"
        >
          <Sparkles size={13} />
          <span>Plot Math</span>
        </button>
      )}

      {/* Graphical View / Second Brain */}
      <button
        onClick={onOpenGraphicalView}
        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title="Open Real-time Graphical View (Second Brain Knowledge Graph)"
      >
        <Network size={14} />
        <span>Graphical View</span>
      </button>

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
