export const API_BASE_URL = "http://localhost:8000";

export interface AcademicTopic {
  id: string;
  name: string;
  description: string | null;
}

export interface AcademicUnit {
  id: string;
  name: string;
  unit_number: number;
  topics: AcademicTopic[];
}

export interface AcademicSubject {
  id: string;
  name: string;
  code: string;
  units: AcademicUnit[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  full_name: string;
  institution_id: string;
}

export const fetchAcademicContext = async (): Promise<AcademicSubject[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/academic/context`);
  if (!response.ok) {
    throw new Error("Failed to fetch academic context");
  }
  return response.json();
};

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Authentication failed");
  }
  return response.json();
};

export const askTeacherHTTP = async (
  token: string,
  topicId: string,
  message: string,
  responseModeHint: string | null = "hybrid"
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/teacher-assistant/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      topic_id: topicId,
      message,
      response_mode_hint: responseModeHint
    })
  });
  if (!response.ok) {
    throw new Error("Failed to communicate with Teacher Assistant");
  }
  return response.json();
};

export const askStudentHTTP = async (
  token: string,
  topicId: string,
  conversationId: string | null,
  message: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/student-assistant/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      topic_id: topicId,
      conversation_id: conversationId,
      message
    })
  });
  if (!response.ok) {
    throw new Error("Failed to communicate with Student Assistant");
  }
  return response.json();
};
