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
    <div className="flex items-center gap-1.5 p-2 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl z-50">
      {/* Drawing tools */}
      <button
        onClick={() => setActiveTool('pen')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTool === 'pen'
            ? 'bg-sky-500 text-slate-950 font-semibold shadow-lg shadow-sky-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="Pen tool"
      >
        <PenTool size={18} />
      </button>

      <button
        onClick={() => setActiveTool('eraser')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTool === 'eraser'
            ? 'bg-sky-500 text-slate-950 font-semibold shadow-lg shadow-sky-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="Eraser tool"
      >
        <Eraser size={18} />
      </button>

      <button
        onClick={() => setActiveTool('lasso')}
        className={`p-2.5 rounded-lg transition-all ${
          activeTool === 'lasso'
            ? 'bg-sky-500 text-slate-950 font-semibold shadow-lg shadow-sky-500/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="Lasso select"
      >
        <Move size={18} />
      </button>

      <div className="h-6 w-[1px] bg-slate-800 mx-1" />

      {/* Grid snap */}
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`p-2.5 rounded-lg transition-all ${
          snapToGrid
            ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title="Snap to Grid"
      >
        <Grid size={18} />
      </button>

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2.5 rounded-lg transition-all ${
          canUndo
            ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Undo"
      >
        <Undo2 size={18} />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-2.5 rounded-lg transition-all ${
          canRedo
            ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Redo"
      >
        <Redo2 size={18} />
      </button>

      <div className="h-6 w-[1px] bg-slate-800 mx-1" />

      {/* Action buttons */}
      {hasSelection && (
        <button
          onClick={onRecognize}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 rounded-lg text-xs font-semibold shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
          title="Recognize handwritten math"
        >
          <Sparkles size={14} />
          <span>Plot Math</span>
        </button>
      )}

      <button
        onClick={onClear}
        className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg transition-all"
        title="Clear canvas"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};
