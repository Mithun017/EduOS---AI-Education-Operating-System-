import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { useEduOSStore } from './store/store';
import { TeacherAssistant } from './features/teacher-assistant/TeacherAssistant';
import { StudentAssistant } from './features/student-assistant/StudentAssistant';
import { FloatingChatWidget } from './features/chat/FloatingChatWidget';
import { ShareClassModal } from './features/canvas/ShareClassModal';
import { JoinClassModal } from './features/canvas/JoinClassModal';
import { LoginModal } from './features/auth/LoginModal';
import {
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Trash2,
  History,
  FolderOpen,
  Share2,
  LogOut,
  UserCheck
} from 'lucide-react';

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    setUser,
    viewMode,
    setViewMode,
    theme,
    toggleTheme,
    savedCanvasHistory,
    deleteCanvasFromHistory,
    loadCanvasSession,
    roomId,
    roomCode,
    roomSecret,
    roomRole,
    studentDisplayName,
    setRoomSession
  } = useEduOSStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [pendingJoinRoomSecret, setPendingJoinRoomSecret] = useState<string | null>(null);

  // Sync route path with viewMode and handle query parameters
  useEffect(() => {
    const pathname = location.pathname;
    const params = new URLSearchParams(location.search);
    const roomParam = params.get('room');
    const secretParam = params.get('secret');

    if (pathname === '/student' || pathname === '/join' || roomParam) {
      if (viewMode !== 'student') setViewMode('student');

      if (roomParam && secretParam) {
        setUser(null);
        const savedName = localStorage.getItem('eduos_student_name');
        const activeName = (savedName && savedName.trim()) || (studentDisplayName && studentDisplayName.trim() !== 'Student' ? studentDisplayName : '');

        setRoomSession({
          roomId: roomParam,
          roomCode: 'CLASSROOM',
          roomSecret: secretParam,
          roomRole: 'student',
          studentDisplayName: activeName || 'Student'
        });
        setPendingJoinRoomId(roomParam);
        setPendingJoinRoomSecret(secretParam);

        if (activeName && activeName !== 'Student') {
          setIsJoinModalOpen(false);
        } else {
          setIsJoinModalOpen(true);
        }
      }
    } else if (pathname === '/teacher') {
      if (viewMode !== 'teacher') setViewMode('teacher');
      if (!user) {
        setUser({
          token: 'jwt-token-val-12345',
          role: 'teacher',
          fullName: 'Prof. Sarah Jenkins',
          institutionId: 'demo-inst-001',
          email: 'teacher@demo.eduos.ai'
        });
      }
      if (roomRole !== 'teacher') setRoomSession({ roomId, roomRole: 'teacher' });
      if (!roomId) {
        handleOpenShareClass(false);
      }
    } else if (pathname === '/login') {
      setIsLoginModalOpen(true);
    }
  }, [location.pathname, location.search]);

  // Theme attribute handler
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('eduos_student_name');
    setRoomSession({ roomId: null });
    setIsLoginModalOpen(true);
    navigate('/login');
  };

  const handleOpenShareClass = async (openModal: boolean = true) => {
    if (roomId && roomSecret) {
      if (openModal) setIsShareModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/v1/classroom/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRoomSession({
          roomId: data.room_id,
          roomCode: data.room_code,
          roomSecret: data.secret_token,
          roomRole: 'teacher'
        });
        if (openModal) setIsShareModalOpen(true);
      }
    } catch (e) {
      console.warn("Classroom HTTP create failed, using client room generation", e);
      const fallbackRoomId = `room-${Math.random().toString(36).substring(2, 8)}`;
      const fallbackSecret = `sec-${Math.random().toString(36).substring(2, 12)}`;
      const fallbackCode = `ROOM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setRoomSession({
        roomId: fallbackRoomId,
        roomCode: fallbackCode,
        roomSecret: fallbackSecret,
        roomRole: 'teacher'
      });
      if (openModal) setIsShareModalOpen(true);
    }
  };

  const handleJoinClassSubmit = (displayName: string) => {
    if (!pendingJoinRoomId || !pendingJoinRoomSecret) return;

    localStorage.setItem('eduos_student_name', displayName);

    setRoomSession({
      roomId: pendingJoinRoomId,
      roomCode: 'CLASSROOM',
      roomSecret: pendingJoinRoomSecret,
      roomRole: 'student',
      studentDisplayName: displayName
    });
    setViewMode('student');
    setIsJoinModalOpen(false);
    navigate(`/student?room=${pendingJoinRoomId}&secret=${pendingJoinRoomSecret}`);
  };

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
          {/* Share Class Button for Teachers */}
          {user?.role === 'teacher' && (
            <button
              onClick={() => handleOpenShareClass(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] hover:text-white text-[var(--accent-primary)] text-xs font-bold transition-all cursor-pointer border border-[var(--border-subtle)] shadow-sm active:scale-95 shrink-0"
              title="Share Live Classroom Session with Students"
            >
              <Share2 size={14} />
              <span>Share Class</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Active User or Student Guest details */}
          {user ? (
            <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-1 rounded-lg border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] font-semibold text-[var(--text-primary)] block leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[8px] text-[var(--text-secondary)] font-mono tracking-wide block leading-none">
                  Faculty Educator
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 p-1 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Log Out / Switch Account"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : roomRole === 'student' ? (
            <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-1 rounded-lg border border-sky-500/30">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] font-semibold text-sky-300 block leading-tight">
                  {studentDisplayName}
                </span>
                <span className="text-[8px] text-[var(--text-secondary)] font-mono tracking-wide block leading-none">
                  Student (Guest View)
                </span>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="ml-1 p-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] rounded-lg transition-colors cursor-pointer"
                title="Switch User / Login as Teacher"
              >
                <UserCheck size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold text-xs shadow-sm hover:scale-105 transition-all cursor-pointer"
            >
              <UserCheck size={14} />
              <span>Log In / Join</span>
            </button>
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

            {/* Session History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {savedCanvasHistory.length > 0 ? (
                savedCanvasHistory.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 bg-[var(--glass-bg)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-xl transition-all flex items-center justify-between gap-2 group"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-xs text-[var(--text-primary)] truncate">{sess.title}</h5>
                      <span className="text-[9px] text-[var(--text-secondary)] block mt-0.5">{sess.timestamp} • {sess.objectCount} items</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadCanvasSession(sess)}
                        className="p-1.5 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--text-inverse)] rounded-lg transition-all cursor-pointer"
                        title="Open Canvas Session"
                      >
                        <FolderOpen size={13} />
                      </button>

                      <button
                        onClick={() => deleteCanvasFromHistory(sess.id)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center border border-dashed border-[var(--border-subtle)] rounded-xl space-y-2 my-auto">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center mx-auto">
                    <History size={18} />
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

        {/* Feature Workspace with React Router Paths */}
        <div className="flex-1 h-full min-h-0 transition-all duration-300 overflow-hidden">
          <Routes>
            <Route path="/teacher" element={<TeacherAssistant />} />
            <Route path="/student" element={<StudentAssistant />} />
            <Route path="/join" element={<StudentAssistant />} />
            <Route path="/login" element={viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />} />
            <Route path="*" element={<Navigate to={viewMode === 'student' ? '/student' : '/teacher'} replace />} />
          </Routes>
        </div>
      </main>

      {/* Floating Bottom-Right Chat Access & Interface */}
      <FloatingChatWidget />

      {/* Real-Time Classroom Modals */}
      <ShareClassModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />
      <JoinClassModal isOpen={isJoinModalOpen} roomCode={roomCode || 'CLASSROOM'} onJoin={handleJoinClassSubmit} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}

export default App;
