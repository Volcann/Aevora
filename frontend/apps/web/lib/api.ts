export interface UserProfile {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  theme_config?: Record<string, unknown>;
  is_active?: boolean;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string | null;
}

export interface AIModelItem {
  id: string;
  name: string;
  quota?: string | number;
  created_at?: string;
}

export interface MessageItem {
  id: string;
  role: "user" | "model";
  content: string;
  created_at?: string;
  model?: AIModelItem | string | null;
  model_name?: string | null;
}

export interface ChatSessionDetail extends ChatSessionItem {
  messages: MessageItem[];
}

export interface ToolItem {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

const ACCESS_TOKEN_KEY = "aevora_access_token";
const REFRESH_TOKEN_KEY = "aevora_refresh_token";
const USER_KEY = "aevora_user";
const API_URL_KEY = "aevora_api_base_url";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem(API_URL_KEY);
    if (custom) return custom;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8002";
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(API_URL_KEY, url);
  }
}

export function getSavedTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const access = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!access) return null;
  return { access, refresh: refresh || "" };
}

export function saveTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  if (tokens.refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }
  document.cookie = `access_token=${tokens.access}; path=/; max-age=86400; SameSite=Lax`;
  if (tokens.refresh) {
    document.cookie = `refresh_token=${tokens.refresh}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = "refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getSavedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: UserProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function requestWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const tokens = getSavedTokens();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.access) {
    headers.set("Authorization", `Bearer ${tokens.access}`);
  }

  let response = await fetch(url, { ...options, headers });

  // Handle token refresh on 401
  if (response.status === 401 && tokens?.refresh) {
    try {
      const refreshRes = await fetch(`${baseUrl}/api/v1/accounts/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.access) {
          saveTokens({ access: data.access, refresh: data.refresh || tokens.refresh });
          headers.set("Authorization", `Bearer ${data.access}`);
          response = await fetch(url, { ...options, headers });
        }
      } else {
        clearTokens();
      }
    } catch {
      clearTokens();
    }
  }

  return response;
}

export async function quitApp(): Promise<void> {
  if (typeof window !== "undefined") {
    // 1. Try Tauri v2 IPC
    const w = window as any;
    const tauri = w.__TAURI_INTERNALS__ || w.__TAURI__;
    if (tauri) {
      try {
        if (tauri.invoke) {
          await tauri.invoke("quit_app");
          return;
        }
        if (tauri.core?.invoke) {
          await tauri.core.invoke("quit_app");
          return;
        }
      } catch (e) {
        console.warn("Tauri invoke quit_app:", e);
      }
    }

    // 2. Web fallback: try window.close()
    try {
      window.close();
    } catch {}

    // 3. Fallback prompt for browser tabs not opened by script
    if (window.confirm("Are you sure you want to quit Aevora?")) {
      window.location.href = "about:blank";
    }
  }
}

let cachedModels: AIModelItem[] | null = null;

export const api = {
  async health(): Promise<{ status: string }> {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/health/`);
      if (res.ok) return await res.json();
    } catch (e) {
      // Try fallback to port 8000 if 8002 failed
      if (baseUrl.includes(":8002")) {
        try {
          const fallbackRes = await fetch(`http://127.0.0.1:8000/api/v1/health/`);
          if (fallbackRes.ok) {
            setApiBaseUrl("http://127.0.0.1:8000");
            return await fallbackRes.json();
          }
        } catch {}
      }
    }
    return { status: "offline" };
  },

  async login(payload: { email?: string; username?: string; password: string }): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/accounts/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      const msg =
        err.detail ||
        err.non_field_errors?.[0] ||
        err.email?.[0] ||
        err.username?.[0] ||
        err.password?.[0] ||
        "Invalid email or password.";
      throw new Error(msg);
    }

    const data = await res.json();
    const tokens: AuthTokens = { access: data.access, refresh: data.refresh };
    const user: UserProfile = data.user;
    saveTokens(tokens);
    saveUser(user);
    return { user, tokens };
  },

  async register(payload: {
    username: string;
    email: string;
    password: string;
    confirm_password?: string;
    password_confirm?: string;
  }): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    const baseUrl = getApiBaseUrl();
    const confirm = payload.confirm_password || payload.password_confirm || payload.password;
    const res = await fetch(`${baseUrl}/api/v1/accounts/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: payload.username,
        email: payload.email,
        password: payload.password,
        confirm_password: confirm,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      const msg =
        err.detail ||
        err.non_field_errors?.[0] ||
        err.username?.[0] ||
        err.email?.[0] ||
        err.password?.[0] ||
        err.confirm_password?.[0] ||
        "Registration failed.";
      throw new Error(msg);
    }

    // Auto login with username & password after registration
    return await this.login({ username: payload.username, password: payload.password });
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/accounts/forgot-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      const msg = err.detail || err.non_field_errors?.[0] || err.email?.[0] || "Unable to send password reset email";
      throw new Error(msg);
    }
    return await res.json();
  },

  async resetPassword(payload: { token: string; password: string; confirm_password: string; uid?: string }): Promise<{ message: string }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/accounts/reset-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: payload.token,
        password: payload.password,
        confirm_password: payload.confirm_password,
        uid: payload.uid || "",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Password reset failed" }));
      const msg =
        err.detail ||
        err.non_field_errors?.[0] ||
        err.password?.[0] ||
        err.confirm_password?.[0] ||
        err.token?.[0] ||
        "Unable to reset password";
      throw new Error(msg);
    }
    return await res.json();
  },

  async getMe(): Promise<UserProfile> {
    const res = await requestWithAuth("/api/v1/accounts/me/");
    if (!res.ok) throw new Error("Failed to fetch user profile");
    const user = await res.json();
    saveUser(user);
    return user;
  },

  async updateMe(payload: Partial<UserProfile>): Promise<UserProfile> {
    const res = await requestWithAuth("/api/v1/accounts/me/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to update profile" }));
      throw new Error(err.detail || "Failed to update profile");
    }
    const data = await res.json();
    saveUser(data);
    return data;
  },

  async changePassword(payload: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ message: string }> {
    const res = await requestWithAuth("/api/v1/accounts/change-password/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to change password" }));
      const msg =
        err.detail ||
        err.non_field_errors?.[0] ||
        err.old_password?.[0] ||
        err.new_password?.[0] ||
        err.confirm_password?.[0] ||
        "Failed to change password.";
      throw new Error(msg);
    }
    return await res.json();
  },

  async logout(): Promise<void> {
    const tokens = getSavedTokens();
    if (tokens?.refresh) {
      try {
        await requestWithAuth("/api/v1/accounts/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh: tokens.refresh }),
        });
      } catch {}
    }
    clearTokens();
  },

  async getSessions(): Promise<ChatSessionItem[]> {
    const res = await requestWithAuth("/api/v1/chat/sessions/");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  },

  async createSession(title?: string): Promise<ChatSessionDetail> {
    const res = await requestWithAuth("/api/v1/chat/sessions/", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Conversation" }),
    });
    if (!res.ok) throw new Error("Failed to create chat session");
    return await res.json();
  },

  async getSession(sessionId: string): Promise<ChatSessionDetail> {
    if (!sessionId || sessionId.startsWith("local-")) {
      return { id: sessionId || "", title: "New Conversation", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0, messages: [] };
    }
    const res = await requestWithAuth(`/api/v1/chat/sessions/${sessionId}/`);
    if (!res.ok) throw new Error("Failed to load chat session");
    return await res.json();
  },

  async deleteSession(sessionId: string): Promise<void> {
    if (!sessionId || sessionId.startsWith("local-")) return;
    const res = await requestWithAuth(`/api/v1/chat/sessions/${sessionId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete chat session");
  },

  async getTools(): Promise<ToolItem[]> {
    try {
      const res = await requestWithAuth("/api/v1/chat/tools/");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.tools || data.results || [];
        if (list.length > 0) return list;
      }
    } catch {}
    return [
      {
        name: "lazy_reviewer__review_pr",
        description: "Pull Request code reviewer and diff analyzer",
        parameters: {
          properties: { pr_number: { type: "integer" } },
          required: ["pr_number"],
        },
      },
      {
        name: "environment__setup_project",
        description: "Setup and launch a project workspace by project name",
        parameters: {
          properties: { project_name: { type: "string" } },
          required: ["project_name"],
        },
      },
    ];
  },

  async getModels(): Promise<AIModelItem[]> {
    try {
      const res = await requestWithAuth("/api/v1/chat/models/");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.models || data.results || [];
        if (list.length > 0) {
          cachedModels = list;
          return list;
        }
      }
    } catch (_err) {
      // Fallback to default models if offline or unauthenticated
    }
    const fallback = [
      { id: "1", name: "gemini-3.5-flash-lite", quota: "200.00" },
      { id: "2", name: "gemini-2.5-flash", quota: "100.00" },
      { id: "3", name: "gemini-2.5-pro", quota: "50.00" },
      { id: "4", name: "gemini-1.5-flash", quota: "100.00" },
      { id: "5", name: "gemini-1.5-pro", quota: "50.00" },
    ];
    cachedModels = fallback;
    return fallback;
  },

  async streamChat(
    sessionId: string | null | undefined,
    prompt: string,
    callbacks: {
      onChunk: (chunk: string) => void;
      onSessionCreated?: (sessionId: string, title: string) => void;
      onToolStart?: (tool: string) => void;
      onToolDone?: (tool: string) => void;
      onToolError?: (tool: string) => void;
      onDone?: () => void;
      onError?: (err: Error) => void;
    },
    signal?: AbortSignal,
    options?: {
      voiceMode?: boolean;
      model?: string;
    }
  ): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const tokens = getSavedTokens();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (tokens?.access) {
      headers["Authorization"] = `Bearer ${tokens.access}`;
    }

    let modelId = options?.model;
    if (modelId) {
      if (!cachedModels) {
        try {
          await this.getModels();
        } catch {
          // ignore model cache fetch error
        }
      }
      if (cachedModels) {
        const match = cachedModels.find((m) => m.name === modelId || m.id === modelId);
        if (match?.id) {
          modelId = match.id;
        }
      }
    }

    const queryParams = new URLSearchParams();
    if (sessionId && !sessionId.startsWith("local-")) {
      queryParams.set("session_id", sessionId);
    }
    if (modelId) {
      queryParams.set("model", modelId);
    }
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const streamUrl = `${baseUrl}/api/v1/chat/stream/${query}`;

    try {
      const response = await fetch(streamUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          model: modelId,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${errText}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported on response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      let doneFired = false;
      const fireDone = () => {
        if (!doneFired) {
          doneFired = true;
          callbacks.onDone?.();
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, "");
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "session_created" && event.session_id) {
              callbacks.onSessionCreated?.(event.session_id, event.title);
            } else if (event.type === "chunk" && event.text) {
              callbacks.onChunk(event.text);
            } else if (event.type === "tool_start") {
              callbacks.onToolStart?.(event.tool);
            } else if (event.type === "tool_done") {
              callbacks.onToolDone?.(event.tool);
            } else if (event.type === "tool_error") {
              callbacks.onToolError?.(event.tool);
            } else if (event.type === "done") {
              fireDone();
            }
          } catch {
            // raw text line fallback
            if (jsonStr) callbacks.onChunk(jsonStr);
          }
        }
      }

      fireDone();
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        return;
      }
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  },

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    const response = await requestWithAuth("/api/v1/chat/transcribe/", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Transcription failed" }));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.transcript || "").trim();
  },
};
