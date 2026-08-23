import React, { useState, useEffect } from 'react';
import { X, Check, BarChart2 } from 'lucide-react';

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

  useEffect(() => {
    setFormula(recognizedText);
  }, [recognizedText]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formula);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-[var(--accent-primary)]">
            <BarChart2 size={20} />
            <h3 className="font-bold text-[var(--text-primary)]">Confirm Math Expression</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Interpreted Math Text
            </label>
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono text-lg transition-all"
              placeholder="e.g. y = x^2 - 4x + 3"
              autoFocus
            />
            <p className="text-xs text-[var(--text-secondary)]">
              Check for correct symbols (e.g. use <code className="font-mono text-[var(--text-primary)]">^2</code> for squares, <code className="font-mono text-[var(--text-primary)]">*</code> for multiplication).
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
              <span>Plot Graph</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
