import React, { useState, useEffect } from 'react';
import { X, Save, Layers, AlertCircle, Download } from 'lucide-react';

interface SaveCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  onExportImage?: (title: string) => void;
  defaultTitle: string;
  objectCount: number;
}

export const SaveCanvasModal: React.FC<SaveCanvasModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onExportImage,
  defaultTitle,
  objectCount,
}) => {
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectCount === 0) return;
    onSave(title.trim() || defaultTitle);
  };

  const handleExport = () => {
    if (objectCount === 0 || !onExportImage) return;
    onExportImage(title.trim() || defaultTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold">
            <Save size={18} />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Save & Export Canvas</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {objectCount === 0 ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-amber-400 text-xs leading-relaxed">
              <AlertCircle size={18} className="shrink-0" />
              <span>Canvas is empty! Draw, write, or upload a file before saving.</span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] rounded-xl text-xs">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                <Layers size={15} className="text-[var(--accent-primary)]" />
                <span>Active Whiteboard Elements & Markings</span>
              </div>
              <span className="px-2 py-0.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold font-mono rounded-md text-[10px]">
                {objectCount} {objectCount === 1 ? 'item' : 'items'}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Session Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-all font-medium"
              placeholder="e.g. Calculus Derivative Notes"
              disabled={objectCount === 0}
              autoFocus
            />
          </div>

          {/* Action Buttons: Export Image, Save & Cancel */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]/50 gap-2 flex-wrap">
            {onExportImage && (
              <button
                type="button"
                onClick={handleExport}
                disabled={objectCount === 0}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30 font-bold rounded-xl transition-all ${
                  objectCount === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer shadow-sm'
                }`}
                title="Download PNG image with all your uploaded files and drawings combined"
              >
                <Download size={14} />
                <span>Export PNG with Markings</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--border-subtle)] rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={objectCount === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold rounded-xl shadow-lg transition-all ${
                  objectCount === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'
                }`}
              >
                <Save size={14} />
                <span>Save Session</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
