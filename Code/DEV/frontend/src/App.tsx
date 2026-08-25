import { useEffect, useState } from 'react';
import { useEduOSStore } from './store/store';
import { loginUser } from './lib/api';
import { TeacherAssistant } from './features/teacher-assistant/TeacherAssistant';
import { StudentAssistant } from './features/student-assistant/StudentAssistant';
import { FloatingChatWidget } from './features/chat/FloatingChatWidget';
import {
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Trash2,
  History,
  FolderOpen
} from 'lucide-react';

function App() {
  const {
    user,
    setUser,
    viewMode,
    theme,
    toggleTheme,
    savedCanvasHistory,
    deleteCanvasFromHistory,
    loadCanvasSession
  } = useEduOSStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Theme attribute handler
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Perform initial login automatically on launch
  useEffect(() => {
    if (!user) {
      loginUser('teacher@demo.eduos.ai', 'password123')
        .then((session) => {
          setUser({
            token: session.access_token,
            role: session.role,
            fullName: session.full_name || 'Educator',
            institutionId: session.institution_id,
            email: 'teacher@demo.eduos.ai'
          });
        })
        .catch(() => {
          setUser({
            token: 'jwt-token-val-12345',
            role: 'teacher',
            fullName: 'Educator',
            institutionId: 'inst-001',
            email: 'teacher@demo.eduos.ai'
          });
        });
    }
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen w-screen max-w-[100vw] overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Top Header Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--glass-bg)] backdrop-blur-md sticky top-0 z-30 px-4 py-2 flex items-center justify-between gap-3 shrink-0 transition-all duration-300">
        {/* Brand + Sidebar Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            title={sidebarOpen ? "Collapse Left Panel" : "Expand Left Panel"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4 text-[var(--accent-primary)]" />}
          </button>

          <img
            src="/favicon.svg"
            alt="EduOS Logo"
            className="w-7 h-7 rounded-lg shadow-sm hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5 leading-none">
              EduOS
            </h1>
          </div>
        </div>

        {/* Global Controls & Active Profile */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Active User details */}
          {user && (
            <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-1 rounded-lg border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] font-semibold text-[var(--text-primary)] block leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[8px] text-[var(--text-secondary)] font-mono tracking-wide block leading-none">
                  {user.role === 'teacher'
                    ? `Faculty ${user.employeeId ? `#${user.employeeId}` : ''}`
                    : `Roll #${user.rollNumber || '21CS045'}`
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex overflow-hidden p-3 md:p-4 gap-3 md:gap-4 transition-all duration-300 relative min-h-0">
        {/* Collapsible Left Side Panel: Saved Whiteboard History */}
        <div
          className={`transition-all duration-300 flex flex-col gap-3 shrink-0 h-full max-h-full overflow-y-auto scrollbar-thin ${
            sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden pointer-events-none p-0 border-0'
          }`}
        >
          <div className="glass-panel p-3.5 space-y-3 flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold">
                <History size={16} />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">Canvas History</h4>
              </div>
              <button
                onClick={() => {
                  loadCanvasSession({ id: 'blank', title: 'New Canvas', timestamp: '', objects: [], objectCount: 0 });
                }}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--text-inverse)] rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                title="Start fresh blank canvas"
              >
                <PlusCircle size={12} />
                <span>New Canvas</span>
              </button>
            </div>

            {/* Saved Canvas History List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {savedCanvasHistory.length > 0 ? (
                savedCanvasHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)]/20 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-xl transition-all space-y-1.5 group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[170px]" title={item.title}>
                        {item.title}
                      </h5>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold">
                        {item.objectCount} {item.objectCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                      {item.timestamp}
                    </p>

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]/50">
                      <button
                        onClick={() => loadCanvasSession(item)}
                        className="flex-1 flex items-center justify-center gap-1 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-[10px] font-bold shadow hover:scale-102 transition-transform cursor-pointer"
                        title="Load this saved whiteboard session"
                      >
                        <FolderOpen size={12} />
                        <span>Open Canvas</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete saved canvas history '${item.title}'?`)) {
                            deleteCanvasFromHistory(item.id);
                          }
                        }}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
                        title="Delete from history"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center space-y-2 border border-dashed border-[var(--border-subtle)] rounded-xl my-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
                    <History size={16} />
                  </div>
                  <h6 className="text-xs font-bold text-[var(--text-primary)]">No Saved Sessions</h6>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    Write or draw on the whiteboard, then click the <strong>Save</strong> button on the toolbar to store your sessions here!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Workspace */}
        <div className="flex-1 h-full min-h-0 transition-all duration-300 overflow-hidden">
          {viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />}
        </div>
      </main>

      {/* Floating Bottom-Right Chat Access & Interface */}
      <FloatingChatWidget />
    </div>
  );
}

export default App;
