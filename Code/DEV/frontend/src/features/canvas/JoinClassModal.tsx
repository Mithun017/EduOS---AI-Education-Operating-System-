import React, { useState } from 'react';
import { User, LogIn, ShieldAlert } from 'lucide-react';

interface JoinClassModalProps {
  isOpen: boolean;
  roomCode: string;
  onJoin: (name: string) => void;
}

export const JoinClassModal: React.FC<JoinClassModalProps> = ({ isOpen, roomCode, onJoin }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] text-center space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-2">
            <User size={20} />
          </div>
          <h3 className="font-bold text-base text-[var(--text-primary)]">Join Live Classroom</h3>
          <p className="text-[10px] text-[var(--text-secondary)]">Enter your name to join session <span className="font-mono font-bold text-[var(--accent-primary)]">{roomCode}</span></p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Your Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-xs font-semibold text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-all"
              autoFocus
            />
          </div>

          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center gap-2 text-sky-400 text-[10px] leading-relaxed">
            <ShieldAlert size={16} className="shrink-0" />
            <span>You are joining as a Student in <strong>Read-Only Live View</strong>. You can chat with the teacher in real-time.</span>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold text-xs rounded-xl shadow-lg transition-all ${
              !name.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-102 cursor-pointer'
            }`}
          >
            <LogIn size={15} />
            <span>Join Classroom Session</span>
          </button>
        </form>
      </div>
    </div>
  );
};
