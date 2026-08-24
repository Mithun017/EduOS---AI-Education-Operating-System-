import React, { useState, useEffect } from 'react';
import { X, Check, BarChart2, GripHorizontal } from 'lucide-react';

interface FormulaConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recognizedText: string;
  onConfirm: (finalFormula: string) => void;
}

export const FormulaConfirmDialog: React.FC<FormulaConfirmDialogProps> = ({
  isOpen,
  onClose,
  recognizedText,
  onConfirm,
}) => {
  const [formula, setFormula] = useState(recognizedText);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setFormula(recognizedText);
    // Reset position when re-opened
    setPosition({ x: 0, y: 0 });
  }, [recognizedText, isOpen]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formula);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none pointer-events-auto"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel transition-transform"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing hover:bg-[var(--accent-primary-soft)]/30 transition-colors"
          title="Click and drag header to move window anywhere on screen"
        >
          <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold">
            <GripHorizontal className="w-5 h-5 opacity-70" />
            <BarChart2 size={18} />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Confirm Math / Handwriting Text</h3>
          </div>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Interpreted Math & Text
            </label>
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono text-base transition-all"
              placeholder="e.g. y = x^2 - 4x + 3 or Random scribble lines"
              autoFocus
            />
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Check for correct equations or plain text. (Use <code className="font-mono text-[var(--text-primary)]">^2</code> for powers, <code className="font-mono text-[var(--text-primary)]">*</code> for multiplication).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--border-subtle)] rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Check size={16} />
              <span>Plot / Confirm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
