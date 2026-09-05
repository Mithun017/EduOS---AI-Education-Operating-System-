export const API_BASE_URL = "";

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

// Canvas & Drawing System Interfaces
export interface CanvasObject {
  id: string;
  type: 'stroke' | 'shape' | 'formula' | 'text';
  geometry_json: string;
  style_json?: string | null;
  recognized_as?: string | null;
  order_index: number;
}

export interface CanvasSession {
  id: string;
  topic_id: string;
  conversation_id: string | null;
  owner_user_id: string;
  objects: CanvasObject[];
}

export const fetchCanvasSession = async (
  token: string,
  topicId: string,
  conversationId: string | null = null
): Promise<CanvasSession> => {
  let url = `${API_BASE_URL}/api/v1/canvas/session?topic_id=${topicId}`;
  if (conversationId) {
    url += `&conversation_id=${conversationId}`;
  }
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error("Failed to fetch canvas session");
  }
  return response.json();
};

export const saveCanvasObjects = async (
  token: string,
  sessionId: string,
  objects: CanvasObject[]
): Promise<{ status: string; saved_count: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/${sessionId}/objects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ objects })
  });
  if (!response.ok) {
    throw new Error("Failed to save canvas objects");
  }
  return response.json();
};

export const recognizeFormula = async (
  token: string,
  sessionId: string,
  strokesJson?: string,
  imageBase64?: string
): Promise<{ formula_text: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/${sessionId}/recognize-formula`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ strokes_json: strokesJson, image_base64: imageBase64 })
  });
  if (!response.ok) {
    throw new Error("Failed to recognize formula");
  }
  return response.json();
};

export const plotFormula = async (
  token: string,
  sessionId: string,
  formulaText: string
): Promise<{ chart_type: string; labels: string[]; series: any[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/${sessionId}/plot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ formula_text: formulaText })
  });
  if (!response.ok) {
    throw new Error("Failed to plot formula");
  }
  return response.json();
};

export const fetch3DKnowledgeGraph = async (
  token: string,
  topic: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/knowledge-graph`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ topic })
  });
  if (!response.ok) {
    throw new Error("Failed to generate 3D knowledge graph");
  }
  return response.json();
};

export const searchWebForSelection = async (
  token: string,
  query: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/web-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });
  if (!response.ok) {
    throw new Error("Failed to perform web search for selection");
  }
  return response.json();
};

export const visualizeConceptForSelection = async (
  token: string,
  text: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/canvas/visualize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    throw new Error("Failed to visualize concept");
  }
  return response.json();
};

export const uploadClassroomDocument = async (file: File): Promise<{
  file_url: string;
  filename: string;
  file_size: number;
  content_type: string;
  extension?: string;
}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/v1/classroom/upload-document`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        file_url: data.file_url,
        filename: data.filename || file.name,
        file_size: data.file_size || file.size,
        content_type: data.content_type || file.type || 'application/octet-stream',
        extension: data.extension || file.name.split('.').pop()?.toLowerCase() || ''
      };
    }
  } catch (err) {
    console.warn("Classroom document upload endpoint unreachable, falling back to local object data URL", err);
  }

  // Fallback: Read as base64 data URL for offline / resilient delivery across network
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      resolve({
        file_url: result || URL.createObjectURL(file),
        filename: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        extension: ext
      });
    };
    reader.onerror = () => {
      resolve({
        file_url: URL.createObjectURL(file),
        filename: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        extension: file.name.split('.').pop()?.toLowerCase() || ''
      });
    };
    reader.readAsDataURL(file);
  });
};


