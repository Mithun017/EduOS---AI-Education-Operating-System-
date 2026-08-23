import { create } from 'zustand';
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

  setUser: (user: UserSession | null) => void;
  setSubjects: (subjects: AcademicSubject[]) => void;
  setSelectedSubject: (subject: AcademicSubject | null) => void;
  setSelectedTopic: (topic: AcademicTopic | null) => void;
  setViewMode: (mode: 'teacher' | 'student') => void;
  toggleMockMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setCanvasModeActive: (active: boolean) => void;

  // Dynamic Management Actions
  addTeacher: (name: string, employeeId: string) => void;
  addStudent: (name: string, rollNumber: string) => void;
  addSubject: (code: string, name: string) => void;
  addTopic: (subjectId: string, name: string, description?: string) => void;
}

const defaultSubjects: AcademicSubject[] = [
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

const defaultTeachers: TeacherProfile[] = [
  { id: 't-1', name: 'Prof. Sarah Jenkins', employeeId: 'FAC-102' },
  { id: 't-2', name: 'Dr. Alan Turing', employeeId: 'FAC-201' }
];

const defaultStudents: StudentProfile[] = [
  { id: 's-1', name: 'Alex Chen', rollNumber: '21CS045' },
  { id: 's-2', name: 'Maya Patel', rollNumber: '21CS089' }
];

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
  teachers: defaultTeachers,
  students: defaultStudents,
  subjects: defaultSubjects,
  selectedSubject: defaultSubjects[0],
  selectedTopic: defaultSubjects[0].units[0].topics[0],
  viewMode: 'teacher',
  mockMode: false,
  theme: getInitialTheme(),
  canvasModeActive: false,

  setUser: (user) => set({ user }),
  setSubjects: (subjects) => {
    const finalSubjects = subjects.length > 0 ? subjects : defaultSubjects;
    set({ subjects: finalSubjects });
    if (finalSubjects.length > 0) {
      set({ selectedSubject: finalSubjects[0] });
      const firstUnit = finalSubjects[0].units[0];
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
  })
}));
