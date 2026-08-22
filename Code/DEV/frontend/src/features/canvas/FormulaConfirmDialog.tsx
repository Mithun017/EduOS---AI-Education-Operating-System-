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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-850/80">
          <div className="flex items-center gap-2 text-indigo-400">
            <BarChart2 size={20} />
            <h3 className="font-semibold text-slate-100">Confirm Math Expression</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Interpreted Math Text
            </label>
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono text-lg transition-all"
              placeholder="e.g. y = x^2 - 4x + 3"
              autoFocus
            />
            <p className="text-xs text-slate-500">
              Check for correct symbols (e.g. use <code className="font-mono text-slate-400">^2</code> for squares, <code className="font-mono text-slate-400">*</code> for multiplication).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-350 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all"
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
