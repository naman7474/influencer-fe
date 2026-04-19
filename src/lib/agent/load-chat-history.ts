import type { UIMessage } from "ai";

interface DBToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  output: Record<string, unknown> | null;
}

interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: DBToolCall[] | null;
  created_at: string;
  session_id: string | null;
}

/**
 * Fetch persisted chat history from the API and convert to UIMessage format
 * compatible with useChat's setMessages.
 *
 * Reconstructs tool invocation parts from stored tool_calls so that
 * extractHighlights() can derive artifact cards from loaded history.
 */
export async function loadChatHistory(sessionId?: string): Promise<UIMessage[]> {
  try {
    const url = sessionId
      ? `/api/agent/conversations?sessionId=${sessionId}`
      : "/api/agent/conversations";
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[loadChatHistory] fetch failed:", res.status, res.statusText);
      return [];
    }
    const json = await res.json();
    const data = json.data as DBMessage[];
    if (!data?.length) {
      console.warn("[loadChatHistory] no messages returned for session", sessionId);
      return [];
    }

    console.log("[loadChatHistory] loaded", data.length, "messages, tool_calls breakdown:",
      data.map(m => ({
        role: m.role,
        hasContent: !!m.content?.trim(),
        toolCallCount: m.tool_calls?.length ?? 0,
        toolCallsWithOutput: m.tool_calls?.filter(tc => tc.output)?.length ?? 0,
      }))
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data
      .filter((msg) => msg.content?.trim() || (msg.tool_calls && msg.tool_calls.length > 0))
      .map((msg) => {
        const parts: Array<Record<string, unknown>> = [];

        // Add text part if content exists
        if (msg.content?.trim()) {
          parts.push({ type: "text" as const, text: msg.content });
        }

        // Reconstruct tool invocation parts from saved tool_calls
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            if (tc.output) {
              // Completed tool call — extractHighlights looks for these.
              // input MUST always be a valid object (never undefined/null)
              // or convertToModelMessages → Anthropic API rejects with
              // "tool_use.input: Field required".
              parts.push({
                type: `tool-${tc.toolName}`,
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                state: "output-available",
                input: tc.args ?? {},
                output: tc.output,
              });
            }
          }
        }

        return {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts,
          createdAt: new Date(msg.created_at),
        };
      })) as unknown as UIMessage[];
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
