import { useEffect, useState } from 'react';
import { useEduOSStore } from './store/store';
import { loginUser } from './lib/api';
import { TeacherAssistant } from './features/teacher-assistant/TeacherAssistant';
import { StudentAssistant } from './features/student-assistant/StudentAssistant';
import { FloatingChatWidget } from './features/chat/FloatingChatWidget';
import {
  Laptop,
  Users,
  Compass,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  PlusCircle,
  BookPlus,
  FolderPlus,
  Trash2
} from 'lucide-react';

function App() {
  const {
    user,
    setUser,
    teachers,
    students,
    subjects,
    selectedSubject,
    setSelectedSubject,
    selectedTopic,
    setSelectedTopic,
    viewMode,
    setViewMode,
    theme,
    toggleTheme,
    addTeacher,
    deleteTeacher,
    addStudent,
    deleteStudent,
    addSubject,
    deleteSubject,
    addTopic,
    deleteTopic
  } = useEduOSStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Identity Form State
  const [teacherName, setTeacherName] = useState('Educator');
  const [teacherId, setTeacherId] = useState('FAC-001');
  const [studentName, setStudentName] = useState('Learner');
  const [rollNumber, setRollNumber] = useState('STU-001');

  // Creation Toggle Forms
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);

  // New Subject & Topic Input State
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjName, setNewSubjName] = useState('');
  const [newTopicName, setNewTopicName] = useState('');

  // Theme attribute handler
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  // Apply teacher/student profile changes
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

  // Add & select new teacher
  const handleAddNewTeacher = () => {
    if (!teacherName.trim()) return;
    addTeacher(teacherName.trim(), teacherId.trim() || `FAC-${Math.floor(Math.random() * 900 + 100)}`);
    applyProfileChanges();
    setShowAddTeacher(false);
  };

  // Add & select new student
  const handleAddNewStudent = () => {
    if (!studentName.trim()) return;
    addStudent(studentName.trim(), rollNumber.trim() || `21CS${Math.floor(Math.random() * 90 + 10)}`);
    applyProfileChanges();
    setShowAddStudent(false);
  };

  // Add & select new subject
  const handleAddNewSubject = () => {
    if (!newSubjName.trim()) return;
    const code = newSubjCode.trim() || `CS${Math.floor(Math.random() * 900 + 100)}`;
    addSubject(code, newSubjName.trim());
    setNewSubjCode('');
    setNewSubjName('');
    setShowAddSubject(false);
  };

  // Add & select new topic
  const handleAddNewTopic = () => {
    if (!newTopicName.trim() || !selectedSubject) return;
    addTopic(selectedSubject.id, newTopicName.trim());
    setNewTopicName('');
    setShowAddTopic(false);
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
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-3 md:p-4 flex gap-4 transition-all duration-300 relative">
        {/* Collapsible Left Side Panel */}
        <div
          className={`transition-all duration-300 flex flex-col gap-3 shrink-0 ${
            sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden pointer-events-none p-0 border-0'
          }`}
        >
          {/* 1. TEACHER & STUDENT PROFILE MANAGER */}
          <div className="glass-panel p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Users className="w-3.5 h-3.5" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Role & Profile Manager</h4>
              </div>
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

            {/* TEACHER MANAGEMENT */}
            {viewMode === 'teacher' ? (
              <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Select Saved Teacher</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowAddTeacher(!showAddTeacher)}
                      className="text-[9px] text-[var(--accent-primary)] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>{showAddTeacher ? "Cancel" : "+ Add"}</span>
                    </button>
                    {teachers.length > 0 && (
                      <button
                        onClick={() => {
                          const match = teachers.find(t => t.name === teacherName) || teachers[0];
                          if (match && confirm(`Remove teacher profile '${match.name}'?`)) {
                            deleteTeacher(match.id);
                            const remaining = teachers.filter(t => t.id !== match.id);
                            if (remaining.length > 0) {
                              setTeacherName(remaining[0].name);
                              setTeacherId(remaining[0].employeeId);
                            }
                          }
                        }}
                        className="text-[9px] text-rose-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Remove Active Teacher"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>- Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown of Saved Teachers + Delete Button or Empty AI Badge */}
                {teachers.length > 0 ? (
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={teachers.find(t => t.name === teacherName)?.id || ''}
                      onChange={(e) => {
                        const match = teachers.find(t => t.id === e.target.value);
                        if (match) {
                          setTeacherName(match.name);
                          setTeacherId(match.employeeId);
                          setUser({ ...user!, fullName: match.name, employeeId: match.employeeId });
                        }
                      }}
                      className="flex-1 min-w-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                          {t.name} ({t.employeeId})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const match = teachers.find(t => t.name === teacherName) || teachers[0];
                        if (match && confirm(`Remove teacher profile '${match.name}'?`)) {
                          deleteTeacher(match.id);
                          const remaining = teachers.filter(t => t.id !== match.id);
                          if (remaining.length > 0) {
                            setTeacherName(remaining[0].name);
                            setTeacherId(remaining[0].employeeId);
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all cursor-pointer shadow-sm"
                      title="Remove Selected Teacher Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    ✨ <span className="font-semibold text-[var(--text-primary)]">AI Dynamic Mode:</span> No mandatory teacher required. AI handles analysis dynamically.
                  </div>
                )}

                {/* Inline Add Teacher Form */}
                {showAddTeacher ? (
                  <div className="p-2 rounded-lg bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] space-y-2 animate-fade-in">
                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Teacher Full Name"
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                    <input
                      type="text"
                      value={teacherId}
                      onChange={(e) => setTeacherId(e.target.value)}
                      placeholder="Faculty ID (e.g. FAC-102)"
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                    <button
                      onClick={handleAddNewTeacher}
                      className="w-full py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded text-xs font-bold shadow cursor-pointer"
                    >
                      Save & Activate Teacher
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={applyProfileChanges}
                    className="w-full flex items-center justify-center gap-1 py-1.5 bg-[var(--glass-bg)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Set Active Profile</span>
                  </button>
                )}
              </div>
            ) : (
              /* STUDENT MANAGEMENT */
              <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Select Saved Student</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowAddStudent(!showAddStudent)}
                      className="text-[9px] text-[var(--accent-primary)] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>{showAddStudent ? "Cancel" : "+ Add"}</span>
                    </button>
                    {students.length > 0 && (
                      <button
                        onClick={() => {
                          const match = students.find(s => s.name === studentName) || students[0];
                          if (match && confirm(`Remove student profile '${match.name}'?`)) {
                            deleteStudent(match.id);
                            const remaining = students.filter(s => s.id !== match.id);
                            if (remaining.length > 0) {
                              setStudentName(remaining[0].name);
                              setRollNumber(remaining[0].rollNumber);
                            }
                          }
                        }}
                        className="text-[9px] text-rose-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Remove Active Student"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>- Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown of Saved Students + Delete Button */}
                {students.length > 0 ? (
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={students.find(s => s.name === studentName)?.id || ''}
                      onChange={(e) => {
                        const match = students.find(s => s.id === e.target.value);
                        if (match) {
                          setStudentName(match.name);
                          setRollNumber(match.rollNumber);
                          setUser({ ...user!, fullName: match.name, rollNumber: match.rollNumber });
                        }
                      }}
                      className="flex-1 min-w-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                          {s.name} (Roll #{s.rollNumber})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const match = students.find(s => s.name === studentName) || students[0];
                        if (match && confirm(`Remove student profile '${match.name}'?`)) {
                          deleteStudent(match.id);
                          const remaining = students.filter(s => s.id !== match.id);
                          if (remaining.length > 0) {
                            setStudentName(remaining[0].name);
                            setRollNumber(remaining[0].rollNumber);
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all cursor-pointer shadow-sm"
                      title="Remove Selected Student Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    ✨ <span className="font-semibold text-[var(--text-primary)]">AI Dynamic Mode:</span> No mandatory student required. AI handles analysis dynamically.
                  </div>
                )}

                {/* Inline Add Student Form */}
                {showAddStudent ? (
                  <div className="p-2 rounded-lg bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] space-y-2 animate-fade-in">
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Student Full Name"
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="Roll Number (e.g. 21CS045)"
                      className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                    />
                    <button
                      onClick={handleAddNewStudent}
                      className="w-full py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded text-xs font-bold shadow cursor-pointer"
                    >
                      Save & Activate Student
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={applyProfileChanges}
                    className="w-full flex items-center justify-center gap-1 py-1.5 bg-[var(--glass-bg)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Set Active Profile</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. CURRICULUM & SUBJECT MANAGER */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Compass className="w-3.5 h-3.5" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Curriculum Scope</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAddSubject(!showAddSubject)}
                  className="text-[9px] text-[var(--accent-primary)] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  title="Add New Subject"
                >
                  <BookPlus className="w-3 h-3" />
                  <span>+ Add Subject</span>
                </button>
                {selectedSubject && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove subject '${selectedSubject.name}' and all its topics?`)) {
                        deleteSubject(selectedSubject.id);
                      }
                    }}
                    className="text-[9px] text-rose-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Remove Active Subject"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>- Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inline Add Subject Form */}
            {showAddSubject && (
              <div className="p-2 rounded-lg bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] space-y-2 animate-fade-in">
                <input
                  type="text"
                  value={newSubjCode}
                  onChange={(e) => setNewSubjCode(e.target.value)}
                  placeholder="Code (e.g. CS701)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  placeholder="Subject Name (e.g. Quantum Computing)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAddNewSubject}
                    className="flex-1 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded text-xs font-bold cursor-pointer"
                  >
                    Create Subject
                  </button>
                  <button
                    onClick={() => setShowAddSubject(false)}
                    className="px-2 py-1 bg-[var(--glass-bg)] text-[var(--text-secondary)] rounded text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* Subject Select + Delete Button or Empty AI Badge */}
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Subject Scope</label>
                {subjects.length > 0 ? (
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={selectedSubject?.id || ''}
                      onChange={(e) => {
                        const match = subjects.find((s) => s.id === e.target.value);
                        if (match) setSelectedSubject(match);
                      }}
                      className="flex-1 min-w-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                          {sub.code} - {sub.name}
                        </option>
                      ))}
                    </select>
                    {selectedSubject && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove subject '${selectedSubject.name}' and all its topics?`)) {
                            deleteSubject(selectedSubject.id);
                          }
                        }}
                        className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all cursor-pointer shadow-sm"
                        title="Remove Selected Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    ✨ <span className="font-semibold text-[var(--text-primary)]">AI Dynamic Scope:</span> No static subject needed. AI infers topic & domain from prompt/canvas.
                  </div>
                )}
              </div>

              {/* Topic Select & Add Topic */}
              {subjects.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Topic</label>
                    {selectedSubject && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowAddTopic(!showAddTopic)}
                          className="text-[8px] text-[var(--accent-primary)] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <FolderPlus className="w-2.5 h-2.5" />
                          <span>+ Add Topic</span>
                        </button>
                        {selectedTopic && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove topic '${selectedTopic.name}'?`)) {
                                deleteTopic(selectedSubject.id, selectedTopic.id);
                              }
                            }}
                            className="text-[8px] text-rose-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            title="Remove Active Topic"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>- Remove</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline Add Topic Form */}
                  {showAddTopic && (
                    <div className="p-2 rounded-lg bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] space-y-2 my-1 animate-fade-in">
                      <input
                        type="text"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        placeholder="Topic Name (e.g. Qubits & Superposition)"
                        className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAddNewTopic}
                          className="flex-1 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded text-xs font-bold cursor-pointer"
                        >
                          Add Topic
                        </button>
                        <button
                          onClick={() => setShowAddTopic(false)}
                          className="px-2 py-1 bg-[var(--glass-bg)] text-[var(--text-secondary)] rounded text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSubject && selectedSubject.units.length > 0 && selectedSubject.units[0].topics.length > 0 && (
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={selectedTopic?.id || ''}
                        onChange={(e) => {
                          const firstUnit = selectedSubject.units[0];
                          const match = firstUnit.topics.find((t) => t.id === e.target.value);
                          if (match) setSelectedTopic(match);
                        }}
                        className="flex-1 min-w-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                      >
                        {selectedSubject.units[0].topics.map((top) => (
                          <option key={top.id} value={top.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                            {top.name}
                          </option>
                        ))}
                      </select>
                      {selectedTopic && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove topic '${selectedTopic.name}'?`)) {
                              deleteTopic(selectedSubject.id, selectedTopic.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all cursor-pointer shadow-sm"
                          title="Remove Selected Topic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Workspace */}
        <div className="flex-1 h-[88vh] min-h-[550px] transition-all duration-300 overflow-hidden">
          {viewMode === 'teacher' ? <TeacherAssistant /> : <StudentAssistant />}
        </div>
      </main>

      {/* Floating Bottom-Right Chat Access & Interface */}
      <FloatingChatWidget />
    </div>
  );
}

export default App;
