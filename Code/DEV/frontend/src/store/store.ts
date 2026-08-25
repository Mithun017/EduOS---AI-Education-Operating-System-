import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AcademicSubject, AcademicTopic } from '../lib/api';

export interface UserSession {
  token: string;
  role: string;
  fullName: string;
  institutionId: string;
  email: string;
  rollNumber?: string;
  employeeId?: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  employeeId: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  rollNumber: string;
}

export interface SavedCanvasSession {
  id: string;
  title: string;
  timestamp: string;
  objects: any[];
  objectCount: number;
}

interface EduOSStore {
  user: UserSession | null;
  teachers: TeacherProfile[];
  students: StudentProfile[];
  subjects: AcademicSubject[];
  selectedSubject: AcademicSubject | null;
  selectedTopic: AcademicTopic | null;
  viewMode: 'teacher' | 'student';
  mockMode: boolean;
  theme: 'light' | 'dark';
  canvasModeActive: boolean;
  savedCanvasHistory: SavedCanvasSession[];
  activeCanvasSessionToLoad: SavedCanvasSession | null;

  setUser: (user: UserSession | null) => void;
  setSubjects: (subjects: AcademicSubject[]) => void;
  setSelectedSubject: (subject: AcademicSubject | null) => void;
  setSelectedTopic: (topic: AcademicTopic | null) => void;
  setViewMode: (mode: 'teacher' | 'student') => void;
  toggleMockMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setCanvasModeActive: (active: boolean) => void;
  saveCanvasToHistory: (objects: any[], title?: string) => void;
  deleteCanvasFromHistory: (id: string) => void;
  loadCanvasSession: (session: SavedCanvasSession | null) => void;

  // Dynamic Management Actions
  addTeacher: (name: string, employeeId: string) => void;
  deleteTeacher: (id: string) => void;
  addStudent: (name: string, rollNumber: string) => void;
  deleteStudent: (id: string) => void;
  addSubject: (code: string, name: string) => void;
  deleteSubject: (id: string) => void;
  addTopic: (subjectId: string, name: string, description?: string) => void;
  deleteTopic: (subjectId: string, topicId: string) => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    return media.matches ? 'dark' : 'light';
  }
  return 'dark';
};

export const useEduOSStore = create<EduOSStore>()(
  persist(
    (set) => ({
      user: null,
      teachers: [],
      students: [],
      subjects: [],
      selectedSubject: null,
      selectedTopic: null,
      viewMode: 'teacher',
      mockMode: false,
      theme: getInitialTheme(),
      canvasModeActive: true,
      savedCanvasHistory: [],
      activeCanvasSessionToLoad: null,

      setUser: (user) => set({ user }),
      saveCanvasToHistory: (objects: any[], title?: string) => {
        if (!objects || objects.length === 0) return;
        const newSession: SavedCanvasSession = {
          id: `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: title || `Whiteboard Note #${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          objects,
          objectCount: objects.length
        };
        set((state) => ({
          savedCanvasHistory: [newSession, ...state.savedCanvasHistory]
        }));
      },
      deleteCanvasFromHistory: (id: string) => set((state) => ({
        savedCanvasHistory: state.savedCanvasHistory.filter(s => s.id !== id)
      })),
      loadCanvasSession: (session: SavedCanvasSession | null) => set({ activeCanvasSessionToLoad: session }),
  setSubjects: (subjects) => {
    set({ subjects });
    if (subjects.length > 0) {
      set({ selectedSubject: subjects[0] });
      const firstUnit = subjects[0].units[0];
      if (firstUnit && firstUnit.topics.length > 0) {
        set({ selectedTopic: firstUnit.topics[0] });
      }
    } else {
      set({ selectedSubject: null, selectedTopic: null });
    }
  },
  setSelectedSubject: (subject) => {
    set({ selectedSubject: subject });
    if (subject && subject.units.length > 0) {
      const firstUnit = subject.units[0];
      if (firstUnit && firstUnit.topics.length > 0) {
        set({ selectedTopic: firstUnit.topics[0] });
      } else {
        set({ selectedTopic: null });
      }
    } else {
      set({ selectedTopic: null });
    }
  },
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleMockMode: () => set((state) => ({ mockMode: !state.mockMode })),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    return { theme: newTheme };
  }),
  setCanvasModeActive: (canvasModeActive) => set({ canvasModeActive }),

  // Add Teacher
  addTeacher: (name, employeeId) => set((state) => {
    const newTeacher: TeacherProfile = {
      id: `t-${Date.now()}`,
      name,
      employeeId
    };
    const updated = [...state.teachers, newTeacher];
    return { teachers: updated };
  }),

  // Add Student
  addStudent: (name, rollNumber) => set((state) => {
    const newStudent: StudentProfile = {
      id: `s-${Date.now()}`,
      name,
      rollNumber
    };
    const updated = [...state.students, newStudent];
    return { students: updated };
  }),

  // Add Subject
  addSubject: (code, name) => set((state) => {
    const newSubj: AcademicSubject = {
      id: `subj-${Date.now()}`,
      code,
      name,
      units: [
        {
          id: `unit-${Date.now()}`,
          name: "Unit 1: Fundamentals",
          unit_number: 1,
          topics: [
            {
              id: `top-${Date.now()}`,
              name: `${name} Fundamentals`,
              description: `Core concepts and fundamentals of ${name}.`
            }
          ]
        }
      ]
    };
    const updated = [...state.subjects, newSubj];
    return {
      subjects: updated,
      selectedSubject: newSubj,
      selectedTopic: newSubj.units[0].topics[0]
    };
  }),

  // Add Topic
  addTopic: (subjectId, name, description) => set((state) => {
    const updatedSubjects = state.subjects.map((s) => {
      if (s.id === subjectId) {
        const unit = s.units[0] || {
          id: `unit-${Date.now()}`,
          name: "Unit 1",
          unit_number: 1,
          topics: []
        };
        const newTopic: AcademicTopic = {
          id: `top-${Date.now()}`,
          name,
          description: description || `Study topic for ${name}.`
        };
        const updatedUnits = s.units.length > 0
          ? s.units.map((u, idx) => idx === 0 ? { ...u, topics: [...u.topics, newTopic] } : u)
          : [{ ...unit, topics: [newTopic] }];

        return { ...s, units: updatedUnits };
      }
      return s;
    });

    const updatedSelectedSubject = updatedSubjects.find(s => s.id === subjectId) || state.selectedSubject;
    const newAddedTopic = updatedSelectedSubject?.units[0]?.topics?.slice(-1)[0] || state.selectedTopic;

    return {
      subjects: updatedSubjects,
      selectedSubject: updatedSelectedSubject,
      selectedTopic: newAddedTopic
    };
  }),

  // Delete Teacher
  deleteTeacher: (id) => set((state) => {
    const updated = state.teachers.filter(t => t.id !== id);
    const activeTeacher = updated.length > 0 ? updated[0] : null;
    return {
      teachers: updated,
      user: state.user && state.user.role === 'teacher' && activeTeacher
        ? { ...state.user, fullName: activeTeacher.name, employeeId: activeTeacher.employeeId }
        : state.user
    };
  }),

  // Delete Student
  deleteStudent: (id) => set((state) => {
    const updated = state.students.filter(s => s.id !== id);
    const activeStudent = updated.length > 0 ? updated[0] : null;
    return {
      students: updated,
      user: state.user && state.user.role === 'student' && activeStudent
        ? { ...state.user, fullName: activeStudent.name, rollNumber: activeStudent.rollNumber }
        : state.user
    };
  }),

  // Delete Subject
  deleteSubject: (id) => set((state) => {
    const updated = state.subjects.filter(s => s.id !== id);
    const newSelectedSubj = updated.length > 0 ? updated[0] : null;
    const newSelectedTop = newSelectedSubj?.units[0]?.topics[0] || null;
    return {
      subjects: updated,
      selectedSubject: state.selectedSubject?.id === id ? newSelectedSubj : state.selectedSubject,
      selectedTopic: state.selectedSubject?.id === id ? newSelectedTop : state.selectedTopic
    };
  }),

  // Delete Topic
  deleteTopic: (subjectId, topicId) => set((state) => {
    const updatedSubjects = state.subjects.map((s) => {
      if (s.id === subjectId) {
        const updatedUnits = s.units.map((u) => ({
          ...u,
          topics: u.topics.filter(t => t.id !== topicId)
        }));
        return { ...s, units: updatedUnits };
      }
      return s;
    });

    const currentSubj = updatedSubjects.find(s => s.id === subjectId) || state.selectedSubject;
    const remainingTopics = currentSubj?.units.flatMap(u => u.topics) || [];
    const newSelectedTopic = remainingTopics.length > 0 ? remainingTopics[0] : null;

    return {
      subjects: updatedSubjects,
      selectedSubject: currentSubj,
      selectedTopic: state.selectedTopic?.id === topicId ? newSelectedTopic : state.selectedTopic
    };
  })
}), { name: 'eduos-state-storage' }));
