import { create } from 'zustand';
import type { AcademicSubject, AcademicTopic } from '../lib/api';

export interface UserSession {
  token: string;
  role: string;
  fullName: string;
  institutionId: string;
  email: string;
}

interface EduOSStore {
  user: UserSession | null;
  subjects: AcademicSubject[];
  selectedSubject: AcademicSubject | null;
  selectedTopic: AcademicTopic | null;
  viewMode: 'teacher' | 'student';
  mockMode: boolean; // Toggle simulation mock mode if API keys are missing
  theme: 'light' | 'dark';
  canvasModeActive: boolean;

  setUser: (user: UserSession | null) => void;
  setSubjects: (subjects: AcademicSubject[]) => void;
  setSelectedSubject: (subject: AcademicSubject | null) => void;
  setSelectedTopic: (topic: AcademicTopic | null) => void;
  setViewMode: (mode: 'teacher' | 'student') => void;
  toggleMockMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setCanvasModeActive: (active: boolean) => void;
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

export const useEduOSStore = create<EduOSStore>((set) => ({
  user: null,
  subjects: [],
  selectedSubject: null,
  selectedTopic: null,
  viewMode: 'teacher',
  mockMode: true, // Default to true so that it works out of the box with zero API key config
  theme: getInitialTheme(),
  canvasModeActive: false,

  setUser: (user) => set({ user }),
  setSubjects: (subjects) => {
    set({ subjects });
    // Automatically select the first subject and topic if available
    if (subjects.length > 0) {
      set({ selectedSubject: subjects[0] });
      const firstUnit = subjects[0].units[0];
      if (firstUnit && firstUnit.topics.length > 0) {
        set({ selectedTopic: firstUnit.topics[0] });
      }
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
}));
