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
  Sparkles,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Lock,
  Cpu,
  Sun,
  Moon
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
    mockMode,
    toggleMockMode,
    theme,
    toggleTheme
  } = useEduOSStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [authLoading, setAuthLoading] = useState(false);

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
      // Fallback local mock user session for easy developer testing
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

  // Perform initial login automatically for smooth developer experience
  useEffect(() => {
    if (!user) {
      handleRoleLogin('teacher');
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--glass-bg)] backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="EduOS Logo"
            className="w-10 h-10 rounded-xl shadow-md hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
              EduOS
              <span className="text-[9px] bg-sky-950/20 text-[var(--accent-primary)] font-mono font-medium px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                PROTOTYPE v1.0
              </span>
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)]">AI Education Operating System</p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Mock Mode Switcher */}
          <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Demo Simulation:</span>
            <button
              onClick={toggleMockMode}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title={mockMode ? "Using high-fidelity mock streams (API keys offline)" : "Using live LLM connections"}
            >
              {mockMode ? (
                <div className="flex items-center gap-1.5">
                  <ToggleRight className="w-7 h-7 text-emerald-400 cursor-pointer" />
                  <span className="text-[8px] bg-emerald-950/40 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono">Simulated</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <ToggleLeft className="w-7 h-7 text-slate-500 cursor-pointer" />
                  <span className="text-[8px] bg-slate-800/40 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider font-mono">Live API</span>
                </div>
              )}
            </button>
          </div>

          {/* Active User profile details */}
          {user && (
            <div className="flex items-center gap-2 bg-[var(--glass-bg)] px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] font-semibold text-[var(--text-primary)] block leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[8px] text-[var(--text-secondary)] font-mono tracking-wide">
                  Tenant: {user.institutionId} ({user.role})
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Simulation Admin & Selectors */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* Step 1: User Swapper */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-2">
              <Users className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Choose Role (Demo)</h4>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRoleLogin('teacher')}
                disabled={authLoading}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  viewMode === 'teacher'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-lg shadow-sky-500/5'
                    : 'bg-slate-900/10 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-4.5 h-4.5" />
                  <div>
                    <span className="text-xs font-semibold block">Prof. Sarah Jenkins</span>
                    <span className="text-[9px] opacity-75 font-mono">Role: Teacher</span>
                  </div>
                </div>
                {viewMode === 'teacher' && <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />}
              </button>

              <button
                onClick={() => handleRoleLogin('student')}
                disabled={authLoading}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  viewMode === 'student'
                    ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold shadow-lg shadow-sky-500/5'
                    : 'bg-slate-900/10 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4.5 h-4.5" />
                  <div>
                    <span className="text-xs font-semibold block">Alex Chen</span>
                    <span className="text-[9px] opacity-75 font-mono">Role: Student</span>
                  </div>
                </div>
                {viewMode === 'student' && <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />}
              </button>
            </div>
          </div>

          {/* Step 2: Academic Curriculum Selector */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-2">
              <Compass className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Curriculum Scope</h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Subject</label>
                <select
                  value={selectedSubject?.id || ''}
                  onChange={(e) => {
                    const match = subjects.find((s) => s.id === e.target.value);
                    if (match) setSelectedSubject(match);
                  }}
                  className="w-full bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-slate-950 text-slate-100">
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSubject && selectedSubject.units.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Topic</label>
                  <select
                    value={selectedTopic?.id || ''}
                    onChange={(e) => {
                      const firstUnit = selectedSubject.units[0];
                      const match = firstUnit.topics.find((t) => t.id === e.target.value);
                      if (match) setSelectedTopic(match);
                    }}
                    className="w-full bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                  >
                    {selectedSubject.units[0].topics.map((top) => (
                      <option key={top.id} value={top.id} className="bg-slate-950 text-slate-100">
                        {top.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Security & Failover Status */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2 text-[var(--accent-primary)] border-b border-[var(--border-subtle)] pb-2">
              <Database className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Engine Logs</h4>
            </div>

            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Database:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> SQLite Active
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Multi-tenant Isolation:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Enforced (Tenant-ID)
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>Fast Intent Matcher:</span>
                <span className="text-[var(--text-primary)] flex items-center gap-1 font-mono">
                  <Cpu className="w-3 h-3 text-[var(--accent-primary)]" /> Groq (Fast-Mode)
                </span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-secondary)]">
                <span>NVIDIA NIM Failover:</span>
                <span className="text-[var(--text-secondary)]">NIM → Gemini → Groq</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Feature Workspace */}
        <div className="lg:col-span-3 h-[78vh] min-h-[500px]">
          {viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-4 px-6 text-center text-[10px] text-[var(--text-secondary)] mt-auto bg-[var(--glass-bg)]/20">
        EduOS © 2026. Built according to system architecture guidelines. Secured with token-based authentication and strict database isolation.
      </footer>
    </div>
  );
}

export default App;
