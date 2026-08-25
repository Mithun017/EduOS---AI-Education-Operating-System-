import React, { useState } from 'react';
import { X, Save, LogOut, Sparkles, StopCircle } from 'lucide-react';

interface EndClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmEnd: (title: string, saveCanvas: boolean) => void;
}

export const EndClassModal: React.FC<EndClassModalProps> = ({ isOpen, onClose, onConfirmEnd }) => {
  const [sessionTitle, setSessionTitle] = useState(() => {
    const today = new Date();
    const dateStr = today.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Classroom Session - ${dateStr} (${timeStr})`;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--accent-primary-soft)]/20">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <StopCircle size={20} />
            <h3 className="font-extrabold text-sm text-[var(--text-primary)]">End Classroom Session</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs leading-relaxed flex items-start gap-2">
            <Sparkles size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              Ending this session will complete the live broadcast for all connected students and allow you to save the final whiteboard canvas into your history.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Classroom Session Title
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. Mathematics - Integration Lecture"
              className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => onConfirmEnd(sessionTitle, true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--accent-primary)] hover:opacity-90 text-[var(--text-inverse)] font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer active:scale-98"
            >
              <Save size={15} />
              <span>Save Canvas & End Session</span>
            </button>

            <button
              onClick={() => onConfirmEnd(sessionTitle, false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs rounded-xl transition-all cursor-pointer border border-rose-500/30"
            >
              <LogOut size={14} />
              <span>End Session Without Saving</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
