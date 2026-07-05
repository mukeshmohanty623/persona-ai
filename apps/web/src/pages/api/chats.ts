import type { APIRoute } from "astro";
import OpenAI from "openai";
import {
  PERSONA_CONFIG,
  getYouTubeVideo,
  type PersonaId,
} from "@/lib/prompts";

export const prerender = false;

// SSE event types sent to the client
export type SSEEvent =
  | {
      type: "step";
      step: "INITIAL" | "THINK" | "ANALYSE";
      text: string;
    }
  | {
      type: "tool_request";
      step: "TOOL_REQUEST";
      text: string;
      tool: string;
      input: string;
    }
  | { type: "tool_output"; text: string }
  | { type: "output"; text: string }
  | { type: "error"; text: string };

interface ChatRequestBody {
  persona: PersonaId;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { persona, messages } = body;
  if (!persona || !PERSONA_CONFIG[persona]) {
    return new Response(
      JSON.stringify({ error: 'Invalid persona. Use "hitesh" or "piyush".' }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = new OpenAI({ apiKey });
  const systemPrompt = PERSONA_CONFIG[persona].systemPrompt;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: SSEEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }

      function sendDone() {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }

      // Build message history with system prompt prepended
      const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      try {
        // CoT loop — each iteration gets one JSON step from the model
        while (true) {
          const result = await client.chat.completions.create({
            model: "gpt-4o",
            messages: fullMessages,
            response_format: { type: "json_object" },
          });

          const rawContent = result.choices[0].message.content ?? "{}";
          let parsed: Record<string, string>;
          try {
            parsed = JSON.parse(rawContent);
          } catch {
            sendEvent({ type: "error", text: "Failed to parse model response." });
            break;
          }

          // Add assistant step to history
          fullMessages.push({ role: "assistant", content: rawContent });

          const step = (parsed.step ?? "").toUpperCase() as string;
          const text = parsed.text ?? "";

          if (step === "OUTPUT") {
            sendEvent({ type: "output", text });
            break;
          }

          if (step === "TOOL_REQUEST") {
            const toolName = parsed.functionName ?? "";
            const input = parsed.input ?? "";

            sendEvent({
              type: "tool_request",
              step: "TOOL_REQUEST",
              text,
              tool: toolName,
              input,
            });

            if (toolName === "getYouTubeVideo") {
              const toolResult = getYouTubeVideo(input, persona);
              sendEvent({ type: "tool_output", text: toolResult });
              // Feed tool result back into message history
              fullMessages.push({
                role: "user",
                content: JSON.stringify({
                  step: "TOOL_OUTPUT",
                  output: toolResult,
                }),
              });
            }
            continue;
          }

          if (step === "INITIAL" || step === "THINK" || step === "ANALYSE") {
            sendEvent({
              type: "step",
              step: step as "INITIAL" | "THINK" | "ANALYSE",
              text,
            });
            continue;
          }

          // Unknown step — skip silently
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred.";
        sendEvent({ type: "error", text: message });
      }

      sendDone();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
