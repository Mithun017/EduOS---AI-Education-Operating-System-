import { useEffect, useState } from 'react';
import { useEduOSStore } from './store/store';
import { fetchAcademicContext, loginUser } from './lib/api';
import { TeacherAssistant } from './features/teacher-assistant/TeacherAssistant';
import { StudentAssistant } from './features/student-assistant/StudentAssistant';
import {
  Laptop,
  Users,
  Compass,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck
} from 'lucide-react';

function App() {
  const {
    user,
    setUser,
    subjects,
    setSubjects,
    selectedSubject,
    setSelectedSubject,
    selectedTopic,
    setSelectedTopic,
    viewMode,
    setViewMode,
    theme,
    toggleTheme
  } = useEduOSStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Identity Form State
  const [teacherName, setTeacherName] = useState('Prof. Sarah Jenkins');
  const [teacherId, setTeacherId] = useState('FAC-102');
  const [studentName, setStudentName] = useState('Alex Chen');
  const [rollNumber, setRollNumber] = useState('21CS045');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load academic context from API
  useEffect(() => {
    const loadAcademic = async () => {
      try {
        const data = await fetchAcademicContext();
        setSubjects(data);
      } catch (err) {
        console.warn("Could not load academic context from backend API.", err);
        setSubjects([]);
      }
    };
    loadAcademic();
  }, [setSubjects]);

  // Login handler
  const handleRoleLogin = async (role: 'teacher' | 'student') => {
    setAuthLoading(true);
    const email = role === 'teacher' ? 'teacher@demo.eduos.ai' : 'student@demo.eduos.ai';
    const password = 'password123';

    const activeName = role === 'teacher' ? teacherName : studentName;

    try {
      const session = await loginUser(email, password);
      setUser({
        token: session.access_token,
        role: session.role,
        fullName: activeName || session.full_name,
        institutionId: session.institution_id,
        email: email,
        rollNumber: role === 'student' ? rollNumber : undefined,
        employeeId: role === 'teacher' ? teacherId : undefined
      });
      setViewMode(role);
    } catch (err: any) {
      console.warn("FastAPI Authentication failed, updating local role profile.", err);
      setUser({
        token: "jwt-token-val-12345",
        role: role,
        fullName: activeName,
        institutionId: 'inst-001',
        email: email,
        rollNumber: role === 'student' ? rollNumber : undefined,
        employeeId: role === 'teacher' ? teacherId : undefined
      });
      setViewMode(role);
    } finally {
      setAuthLoading(false);
    }
  };

  // Apply profile changes directly
  const applyProfileChanges = () => {
    if (!user) return;
    if (viewMode === 'teacher') {
      setUser({
        ...user,
        role: 'teacher',
        fullName: teacherName || 'Teacher User',
        employeeId: teacherId
      });
    } else {
      setUser({
        ...user,
        role: 'student',
        fullName: studentName || 'Student User',
        rollNumber: rollNumber
      });
    }
  };

  // Perform initial login automatically on launch
  useEffect(() => {
    if (!user) {
      handleRoleLogin('teacher');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Top Header Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--glass-bg)] backdrop-blur-md sticky top-0 z-30 px-4 py-2 flex items-center justify-between gap-3 transition-all duration-300">
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
            <p className="text-[9px] text-[var(--text-secondary)] leading-tight mt-0.5">AI Education Operating System</p>
          </div>
        </div>

        {/* Global Controls & User Profile */}
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
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-3 md:p-4 flex gap-4 transition-all duration-300 relative">
        {/* Collapsible Left Side Panel: Role & Identity Selectors */}
        <div
          className={`transition-all duration-300 flex flex-col gap-3 shrink-0 ${
            sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden pointer-events-none p-0 border-0'
          }`}
        >
          {/* User & Role Configuration */}
          <div className="glass-panel p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-1.5">
              <Users className="w-3.5 h-3.5" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">User & Role Profile</h4>
            </div>

            {/* Role Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleRoleLogin('teacher')}
                disabled={authLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  viewMode === 'teacher'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Teacher</span>
              </button>

              <button
                onClick={() => handleRoleLogin('student')}
                disabled={authLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  viewMode === 'student'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Student</span>
              </button>
            </div>

            {/* Input Form based on Active Role */}
            {viewMode === 'teacher' ? (
              <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Teacher Name</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="e.g. Prof. Sarah Jenkins"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Faculty ID</label>
                  <input
                    type="text"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    placeholder="e.g. FAC-102"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <button
                  onClick={applyProfileChanges}
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-xs font-bold shadow hover:opacity-90 transition-all cursor-pointer mt-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Update Teacher Profile</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Student Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Alex Chen"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Roll Number</label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 21CS045"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <button
                  onClick={applyProfileChanges}
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-lg text-xs font-bold shadow hover:opacity-90 transition-all cursor-pointer mt-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Update Student Profile</span>
                </button>
              </div>
            )}
          </div>

          {/* Curriculum Scope Selector */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-1.5">
              <Compass className="w-3.5 h-3.5" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Curriculum Scope</h4>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Subject</label>
                <select
                  value={selectedSubject?.id || ''}
                  onChange={(e) => {
                    const match = subjects.find((s) => s.id === e.target.value);
                    if (match) setSelectedSubject(match);
                  }}
                  className="w-full bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  {subjects.length === 0 ? (
                    <option value="">No Subjects Loaded</option>
                  ) : (
                    subjects.map((sub) => (
                      <option key={sub.id} value={sub.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                        {sub.code} - {sub.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedSubject && selectedSubject.units.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Topic</label>
                  <select
                    value={selectedTopic?.id || ''}
                    onChange={(e) => {
                      const firstUnit = selectedSubject.units[0];
                      const match = firstUnit.topics.find((t) => t.id === e.target.value);
                      if (match) setSelectedTopic(match);
                    }}
                    className="w-full bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                  >
                    {selectedSubject.units[0].topics.map((top) => (
                      <option key={top.id} value={top.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                        {top.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Workspace */}
        <div className="flex-1 h-[84vh] min-h-[550px] transition-all duration-300 overflow-hidden">
          {viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />}
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-2 px-4 text-center text-[9px] text-[var(--text-secondary)] mt-auto bg-[var(--glass-bg)]/20">
        EduOS AI Education Operating System
      </footer>
    </div>
  );
}

export default App;
