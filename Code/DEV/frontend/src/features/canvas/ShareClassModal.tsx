import React, { useState } from 'react';
import { X, Copy, Check, Users, Share2, ShieldCheck } from 'lucide-react';
import { useEduOSStore } from '../../store/store';

interface ShareClassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareClassModal: React.FC<ShareClassModalProps> = ({ isOpen, onClose }) => {
  const { roomId, roomCode, roomSecret, connectedStudents } = useEduOSStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !roomId || !roomSecret) return null;

  const shareUrl = `${window.location.origin}/?room=${roomId}&secret=${roomSecret}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold">
            <Share2 size={18} />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Share Classroom Session</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Room Code Badge */}
          <div className="p-3 bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider block">Classroom Room Code</span>
              <span className="text-base font-extrabold font-mono text-[var(--accent-primary)] tracking-widest">{roomCode}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <ShieldCheck size={14} />
              <span>Live Broadcast Active</span>
            </div>
          </div>

          {/* Share Link Input + Copy Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Student Invitation Link
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 min-w-0 px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--text-inverse)] transition-all cursor-pointer shadow-md shrink-0 ${
                  copied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-[var(--accent-primary)] hover:scale-105'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Real-Time Connected Students List */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
              <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                <Users size={15} />
                <span>Connected Students ({connectedStudents.length})</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">Live Presence</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {connectedStudents.length > 0 ? (
                connectedStudents.map((std) => (
                  <div
                    key={std.conn_id}
                    className="flex items-center justify-between p-2 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold flex items-center justify-center text-[10px]">
                        {std.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-[var(--text-primary)]">{std.display_name}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Viewing</span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center border border-dashed border-[var(--border-subtle)] rounded-xl text-[10px] text-[var(--text-secondary)]">
                  No students connected yet. Share the link above for students to join!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
