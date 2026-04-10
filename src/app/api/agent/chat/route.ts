import { NextRequest } from "next/server";
import { convertToModelMessages } from "ai";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/runtime";
import type { AgentConfig } from "@/lib/types/database";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id, agent_enabled")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string; agent_enabled: boolean } | null;

    if (!brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!brand.agent_enabled) {
      return new Response(
        JSON.stringify({
          error:
            "AI Agent is not enabled. Enable it in Settings → AI Agent.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, pageContext, pageData, sessionId } = await request.json();

    // Load agent config
    const { data: agentConfigRow } = await supabase
      .from("agent_config")
      .select("*")
      .eq("brand_id", brand.id)
      .single();
    const agentConfig = agentConfigRow as AgentConfig | null;

    if (!agentConfig) {
      return new Response(
        JSON.stringify({
          error:
            "Agent configuration not found. Please set up the agent in Settings.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    // Reset counter if past reset time
    if (
      agentConfig.limit_reset_at &&
      new Date(agentConfig.limit_reset_at) < new Date()
    ) {
      await supabase
        .from("agent_config")
        .update({
          messages_today: 0,
          limit_reset_at: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        } as never)
        .eq("brand_id", brand.id);
      agentConfig.messages_today = 0;
    }

    if (agentConfig.messages_today >= agentConfig.daily_message_limit) {
      return new Response(
        JSON.stringify({
          error: "Daily message limit reached. Try again tomorrow.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert UI messages to model messages for streamText
    const modelMessages = await convertToModelMessages(messages);

    // Use service-role client for agent tool execution (bypasses RLS)
    // The user-session client above is used for auth verification only
    const agentSupabase = createServiceRoleClient();

    // Resolve or create session
    let resolvedSessionId: string | null = sessionId || null;
    if (!resolvedSessionId) {
      // Auto-create a session for the first message
      const { data: newSession } = await agentSupabase
        .from("agent_chat_sessions")
        .insert({ brand_id: brand.id, title: "New Chat" } as never)
        .select("id")
        .single();
      resolvedSessionId = (newSession as { id: string } | null)?.id ?? null;
    }

    // Persist user message
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") {
      // Extract text content from parts
      const textContent = lastMsg.parts
        ?.filter((p: Record<string, unknown>) => p.type === "text")
        .map((p: Record<string, unknown>) => p.text)
        .join("") || "";
      await agentSupabase.from("agent_conversations").insert({
        brand_id: brand.id,
        session_id: resolvedSessionId,
        role: "user",
        content: textContent,
        page_context: pageContext || null,
        page_data: pageData || null,
      } as never);

      // Update session title from first user message
      if (resolvedSessionId && messages.filter((m: { role: string }) => m.role === "user").length === 1 && textContent) {
        const title = textContent.length > 60 ? textContent.slice(0, 57) + "..." : textContent;
        await agentSupabase
          .from("agent_chat_sessions")
          .update({ title, updated_at: new Date().toISOString() } as never)
          .eq("id", resolvedSessionId);
      } else if (resolvedSessionId) {
        // Touch updated_at
        await agentSupabase
          .from("agent_chat_sessions")
          .update({ updated_at: new Date().toISOString() } as never)
          .eq("id", resolvedSessionId);
      }
    }

    // Run agent
    const result = await runAgent({
      brandId: brand.id,
      messages: modelMessages,
      pageContext: pageContext || "/dashboard",
      pageData,
      agentConfig,
      supabase: agentSupabase,
    });

    // Return stream with sessionId header so client can track it
    const response = result.toUIMessageStreamResponse();
    if (resolvedSessionId) {
      response.headers.set("X-Session-Id", resolvedSessionId);
    }
    return response;
  } catch (err) {
    console.error("[agent/chat] Error:", err);
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your message.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
