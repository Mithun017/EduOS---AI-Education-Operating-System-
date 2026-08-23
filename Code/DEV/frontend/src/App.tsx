import { useEffect, useState } from 'react';
import { useEduOSStore } from './store/store';
import { fetchAcademicContext, loginUser, type AcademicSubject } from './lib/api';
import { TeacherAssistant } from './features/teacher-assistant/TeacherAssistant';
import { StudentAssistant } from './features/student-assistant/StudentAssistant';
import {
  Laptop,
  Users,
  Compass,
  Database,
  CheckCircle2,
  Lock,
  Cpu,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Radio
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Seed academic context from backend
  useEffect(() => {
    const loadAcademic = async () => {
      try {
        const data = await fetchAcademicContext();
        setSubjects(data);
      } catch (err) {
        console.warn("Could not load academic context from backend, seeding fallback hierarchy.", err);
        // Fallback demo hierarchy
        const mockHierarchy: AcademicSubject[] = [
          {
            id: "subj-dl-001",
            name: "Deep Learning & Neural Networks",
            code: "CS601DL",
            units: [
              {
                id: "unit-3-001",
                name: "Computer Vision & Spatial Networks",
                unit_number: 3,
                topics: [
                  {
                    id: "topic-cnn-001",
                    name: "Convolutional Neural Networks (CNN)",
                    description: "Architecture, kernels, feature maps, pooling layers, and image classification."
                  },
                  {
                    id: "topic-rnn-002",
                    name: "Recurrent Neural Networks (RNN)",
                    description: "Sequential data, LSTM cells, GRU units, and language models."
                  }
                ]
              }
            ]
          }
        ];
        setSubjects(mockHierarchy);
      }
    };
    loadAcademic();
  }, [setSubjects]);

  // Login handler
  const handleRoleLogin = async (role: 'teacher' | 'student') => {
    setAuthLoading(true);
    const email = role === 'teacher' ? 'teacher@demo.eduos.ai' : 'student@demo.eduos.ai';
    const password = 'password123';

    try {
      // Connect to auth API
      const session = await loginUser(email, password);
      setUser({
        token: session.access_token,
        role: session.role,
        fullName: session.full_name,
        institutionId: session.institution_id,
        email: email
      });
      setViewMode(role);
      console.log(`Successfully authenticated via API as ${session.full_name}`);
    } catch (err: any) {
      console.warn("FastAPI Authentication failed, starting simulated mock session.", err);
      setUser({
        token: "mock-jwt-token-val-12345",
        role: role,
        fullName: role === 'teacher' ? 'Prof. Sarah Jenkins' : 'Alex Chen',
        institutionId: 'demo-inst-001',
        email: email
      });
      setViewMode(role);
    } finally {
      setAuthLoading(false);
    }
  };

  // Perform initial login automatically
  useEffect(() => {
    if (!user) {
      handleRoleLogin('teacher');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Top Header Bar - Compact & Streamlined */}
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
              <span className="text-[8px] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-medium px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                v1.0 LIVE
              </span>
            </h1>
            <p className="text-[9px] text-[var(--text-secondary)] leading-tight mt-0.5">AI Education Operating System</p>
          </div>
        </div>

        {/* Global Controls & Live Status */}
        <div className="flex items-center gap-2.5">
          {/* Live Engine Indicator */}
          <div className="flex items-center gap-1.5 bg-[var(--glass-bg)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Live System Engine</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Active User profile details */}
          {user && (
            <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-1 rounded-lg border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] font-semibold text-[var(--text-primary)] block leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[8px] text-[var(--text-secondary)] font-mono tracking-wide block leading-none">
                  {user.role} ({user.institutionId})
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-3 md:p-4 flex gap-4 transition-all duration-300 relative">
        {/* Collapsible Left Side Panel: Role & Scope Selectors */}
        <div
          className={`transition-all duration-300 flex flex-col gap-3 shrink-0 ${
            sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden pointer-events-none p-0 border-0'
          }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">Control Panel</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step 1: User Swapper */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-1.5">
              <Users className="w-3.5 h-3.5" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Choose Role</h4>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleRoleLogin('teacher')}
                disabled={authLoading}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  viewMode === 'teacher'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4" />
                  <div>
                    <span className="text-xs font-semibold block leading-tight">Prof. Sarah Jenkins</span>
                    <span className="text-[8px] opacity-75 font-mono">Role: Teacher</span>
                  </div>
                </div>
                {viewMode === 'teacher' && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
              </button>

              <button
                onClick={() => handleRoleLogin('student')}
                disabled={authLoading}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  viewMode === 'student'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-sm'
                    : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <div>
                    <span className="text-xs font-semibold block leading-tight">Alex Chen</span>
                    <span className="text-[8px] opacity-75 font-mono">Role: Student</span>
                  </div>
                </div>
                {viewMode === 'student' && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
              </button>
            </div>
          </div>

          {/* Step 2: Academic Curriculum Selector */}
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
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                      {sub.code} - {sub.name}
                    </option>
                  ))}
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

          {/* Step 3: Security & Failover Engine Status */}
          <div className="glass-panel p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-1.5">
              <Database className="w-3.5 h-3.5" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Live Engine Status</h4>
            </div>

            <div className="space-y-1.5 text-[9px]">
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Database:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> SQLite Active
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Multi-tenant:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Enforced
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Fast Matcher:</span>
                <span className="text-[var(--text-primary)] flex items-center gap-1 font-mono">
                  <Cpu className="w-3 h-3 text-[var(--accent-primary)]" /> Groq
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>LLM Priority:</span>
                <span className="text-[var(--text-primary)] font-mono">NIM ➔ Groq ➔ Gemini</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Enriched & Enlarged Feature Workspace */}
        <div className="flex-1 h-[84vh] min-h-[550px] transition-all duration-300 overflow-hidden">
          {viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />}
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-2 px-4 text-center text-[9px] text-[var(--text-secondary)] mt-auto bg-[var(--glass-bg)]/20">
        EduOS © 2026. Live multi-tenant AI Education Operating System.
      </footer>
    </div>
  );
}

export default App;
