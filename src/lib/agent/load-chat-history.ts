import type { UIMessage } from "ai";

interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
  session_id: string | null;
}

/**
 * Fetch persisted chat history from the API and convert to UIMessage format
 * compatible with useChat's setMessages.
 */
export async function loadChatHistory(sessionId?: string): Promise<UIMessage[]> {
  try {
    const url = sessionId
      ? `/api/agent/conversations?sessionId=${sessionId}`
      : "/api/agent/conversations";
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data as DBMessage[];
    if (!data?.length) return [];

    return data
      .filter((msg) => msg.content?.trim())
      .map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: msg.content }],
        createdAt: new Date(msg.created_at),
      }));
  } catch {
    return [];
  }
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** Fetch all chat sessions for the current brand */
export async function loadSessions(): Promise<ChatSession[]> {
  try {
    const res = await fetch("/api/agent/sessions");
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data as ChatSession[]) || [];
  } catch {
    return [];
  }
}

/** Create a new chat session */
export async function createSession(title?: string): Promise<ChatSession | null> {
  try {
    const res = await fetch("/api/agent/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as ChatSession;
  } catch {
    return null;
  }
}

/** Delete a chat session */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/agent/sessions?sessionId=${sessionId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
