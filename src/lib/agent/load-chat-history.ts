import type { UIMessage } from "ai";

interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}

/**
 * Fetch persisted chat history from the API and convert to UIMessage format
 * compatible with useChat's setMessages.
 */
export async function loadChatHistory(): Promise<UIMessage[]> {
  try {
    const res = await fetch("/api/agent/conversations");
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
