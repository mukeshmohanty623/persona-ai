import type { APIRoute } from "astro";
import OpenAI from "openai";
import {
  PERSONA_CONFIG,
  type PersonaId,
} from "@/lib/prompts";
import { getYouTubeVideoLive } from "@/lib/youtube";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const apiKey = process.env.OPENAI_API_KEY ?? import.meta.env.OPENAI_API_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY ?? import.meta.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error("[chat API] OPENAI_API_KEY is not set");
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

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? import.meta.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("cf-connecting-ip") ??
        "unknown";

      const rl = await checkRateLimit(ip);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({
            error: `Daily limit reached. You can send ${rl.limit} messages per day. Try again tomorrow!`,
            code: "RATE_LIMITED",
            limit: rl.limit,
            remaining: 0,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": String(rl.limit),
              "X-RateLimit-Remaining": "0",
            },
          },
        );
      }
    } catch (err) {
      // Don't block the request if rate-limit check fails — just log
      console.error("[chat API] Rate-limit check failed:", err);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

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
              let toolResult: string;

              if (youtubeApiKey) {
                // Live YouTube API call
                const ytResult = await getYouTubeVideoLive(input, persona, youtubeApiKey);

                if (ytResult.found) {
                  toolResult = JSON.stringify({
                    topic: input,
                    persona,
                    found: true,
                    title: ytResult.top.title,
                    url: ytResult.top.url,
                    viewCount: ytResult.top.viewCount,
                    allVideos: ytResult.all.map((v) => ({
                      title: v.title,
                      url: v.url,
                      viewCount: v.viewCount,
                    })),
                  });
                } else {
                  toolResult = JSON.stringify({
                    topic: input,
                    persona,
                    found: false,
                    message: ytResult.message,
                  });
                }
              } else {
                // Fallback: no YouTube API key configured
                toolResult = JSON.stringify({
                  topic: input,
                  persona,
                  found: false,
                  message: "YouTube API not configured — video coming soon!",
                });
              }

              sendEvent({ type: "tool_output", text: toolResult });
              fullMessages.push({
                role: "user",
                content: JSON.stringify({ step: "TOOL_OUTPUT", output: toolResult }),
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
