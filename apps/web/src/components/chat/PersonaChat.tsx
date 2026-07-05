"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUpIcon,
  ExternalLinkIcon,
  MessageCircleDashedIcon,
  MoonIcon,
  PlayCircleIcon,
  RotateCwIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@workspace/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";

import { PERSONA_CONFIG, type PersonaId } from "@/lib/prompts";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type CoTStep = "INITIAL" | "THINK" | "ANALYSE" | "TOOL_REQUEST";

interface UserMessage {
  id: string;
  role: "user";
  content: string;
}

interface AssistantMessage {
  id: string;
  role: "assistant";
  content: string;
  youtubeCard?: {
    found: boolean;
    title?: string;
    url?: string;
    message?: string;
    allVideos?: { title: string; url: string; viewCount: number }[];
  } | null;
}

type ChatMessage = UserMessage | AssistantMessage;

interface ThinkingState {
  active: boolean;
  step: CoTStep | null;
  stepText: string;
  youtubeCard: YouTubeCardData | null;
}

// ─────────────────────────────────────────────
// STEP LABELS
// ─────────────────────────────────────────────

const STEP_LABELS: Record<CoTStep, string> = {
  INITIAL: "Reading your question…",
  THINK: "Thinking…",
  ANALYSE: "Analysing…",
  TOOL_REQUEST: "Fetching a video…",
};

const STEP_COLORS: Record<CoTStep, string> = {
  INITIAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  THINK: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  ANALYSE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  TOOL_REQUEST: "bg-red-500/10 text-red-600 dark:text-red-400",
};

// ─────────────────────────────────────────────
// YOUTUBE CARD
// ─────────────────────────────────────────────

interface YouTubeCardData {
  found: boolean;
  title?: string;
  url?: string;
  message?: string;
  allVideos?: { title: string; url: string; viewCount: number }[];
}

function YouTubeCard({ data }: { data: YouTubeCardData }) {
  if (!data.found) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <PlayCircleIcon className="size-4 shrink-0 opacity-50" />
        <span>{data.message ?? "Video coming soon!"}</span>
      </div>
    );
  }

  // Show top video + optional collapse for more
  const extras = data.allVideos?.slice(1) ?? [];

  return (
    <div className="mt-2 flex flex-col gap-1">
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        <PlayCircleIcon className="size-4 shrink-0 text-red-500" />
        <span className="min-w-0 flex-1 truncate font-medium">{data.title}</span>
        <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </a>
      {extras.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none px-1 text-xs text-muted-foreground hover:text-foreground">
            +{extras.length} more video{extras.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-1 flex flex-col gap-1">
            {extras.map((v) => (
              <a
                key={v.url}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <PlayCircleIcon className="size-4 shrink-0 text-red-500/60" />
                <span className="min-w-0 flex-1 truncate">{v.title}</span>
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// THINKING MESSAGE
// ─────────────────────────────────────────────

function ThinkingMessage({
  thinking,
  persona,
}: {
  thinking: ThinkingState;
  persona: PersonaId;
}) {
  const config = PERSONA_CONFIG[persona];
  const step = thinking.step ?? "THINK";

  return (
    <MessageScrollerItem messageId="thinking" scrollAnchor={false}>
      <Message align="start">
        <MessageAvatar>
          <Avatar>
            <AvatarImage src={config.avatarImage} alt={config.name} />
            <AvatarFallback
              className={cn("text-xs font-semibold text-white", config.avatarColor)}
            >
              {config.avatarFallback}
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>{config.name}</MessageHeader>
          <Bubble variant="secondary" align="start">
            <BubbleContent>
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STEP_COLORS[step],
                  )}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-current" />
                  {STEP_LABELS[step]}
                </div>
                {thinking.youtubeCard && (
                  <YouTubeCard data={thinking.youtubeCard} />
                )}
                <div className="flex gap-1.5">
                  <Skeleton className="h-3 w-24 rounded-sm" />
                  <Skeleton className="h-3 w-16 rounded-sm" />
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </div>
              </div>
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

// ─────────────────────────────────────────────
// CHAT THREAD (per persona state)
// ─────────────────────────────────────────────

function useChatThread(persona: PersonaId) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState<ThinkingState>({
    active: false,
    step: null,
    stepText: "",
    youtubeCard: null,
  });

  const isBusy = thinking.active;

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || isBusy) return;

    const userMsg: UserMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const historyForApi = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    setThinking({ active: true, step: "INITIAL", stepText: "", youtubeCard: null });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, messages: historyForApi }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Daily message limit reached. Try again tomorrow!");
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingYouTubeCard: YouTubeCardData | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          let event: Record<string, string>;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "step") {
            setThinking((prev) => ({
              ...prev,
              step: event.step as CoTStep,
              stepText: event.text ?? "",
            }));
          } else if (event.type === "tool_request") {
            setThinking((prev) => ({ ...prev, step: "TOOL_REQUEST", stepText: event.text ?? "" }));
          } else if (event.type === "tool_output") {
            try {
              const parsed = JSON.parse(event.text ?? "{}");
              pendingYouTubeCard = {
                found: parsed.found ?? false,
                title: parsed.title,
                url: parsed.url,
                message: parsed.message,
                allVideos: parsed.allVideos,
              };
              setThinking((prev) => ({ ...prev, youtubeCard: pendingYouTubeCard }));
            } catch { /* ignore */ }
          } else if (event.type === "output") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: event.text ?? "",
                youtubeCard: pendingYouTubeCard,
              } satisfies AssistantMessage,
            ]);
            setThinking({ active: false, step: null, stepText: "", youtubeCard: null });
            pendingYouTubeCard = null;
          } else if (event.type === "error") {
            throw new Error(event.text ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Something went wrong. ${err instanceof Error ? err.message : "Please try again."}`,
        } satisfies AssistantMessage,
      ]);
      setThinking({ active: false, step: null, stepText: "", youtubeCard: null });
    }
  }, [input, isBusy, messages, persona]);

  return { messages, setMessages, input, setInput, thinking, isBusy, sendMessage };
}

// ─────────────────────────────────────────────
// PERSONA CHAT (main component)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// THEME TOGGLE
// ─────────────────────────────────────────────

function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);

  // Initialise from localStorage / system preference
  React.useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefersDark;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          onClick={toggle}
          className="fixed right-4 top-4 z-50"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>{isDark ? "Light mode" : "Dark mode"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────
export function PersonaChat({ rateLimitPerDay = 20 }: { rateLimitPerDay?: number }) {
  const [activePersona, setActivePersona] = React.useState<PersonaId>("hitesh");

  const hitesh = useChatThread("hitesh");
  const piyush = useChatThread("piyush");

  const active = activePersona === "hitesh" ? hitesh : piyush;
  const config = PERSONA_CONFIG[activePersona];

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    active.setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      active.sendMessage();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    active.sendMessage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const switchPersona = (p: PersonaId) => {
    setActivePersona(p);
  };

  const isEmpty = active.messages.length === 0 && !active.thinking.active;

  return (
    <TooltipProvider>
      <ThemeToggle />
      <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
        <MessageScrollerProvider autoScroll>
          <Card className="w-full max-w-lg gap-0" style={{ height: "min(680px, calc(100svh - 2rem))" }}>
            {/* Header */}
            <CardHeader className="gap-1 border-b">
              <CardTitle className="flex items-center gap-2.5">
                <Avatar size="sm">
                  <AvatarImage src={config.avatarImage} alt={config.name} />
                  <AvatarFallback
                    className={cn("text-xs font-semibold text-white", config.avatarColor)}
                  >
                    {config.avatarFallback}
                  </AvatarFallback>
                </Avatar>
                {config.name}
              </CardTitle>
              <CardDescription>{config.tagline}</CardDescription>
              <CardAction className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Reset conversation"
                      onClick={() => active.setMessages([])}
                      disabled={active.isBusy}
                    >
                      <RotateCwIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset conversation</p>
                  </TooltipContent>
                </Tooltip>
              </CardAction>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-hidden p-0">
              {isEmpty ? (
                <Empty className="h-full">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageCircleDashedIcon />
                    </EmptyMedia>
                    <EmptyTitle>Chat with {config.name.split(" ")[0]}</EmptyTitle>
                    <EmptyDescription>{config.welcomeMessage}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <MessageScroller>
                  <MessageScrollerViewport>
                    <MessageScrollerContent
                      aria-busy={active.isBusy}
                      className="p-(--card-spacing)"
                    >
                      {active.messages.map((msg, index) => {
                        if (msg.role === "user") {
                          return (
                            <MessageScrollerItem
                              key={msg.id}
                              messageId={msg.id}
                              scrollAnchor={index === active.messages.length - 1}
                            >
                              <Message align="end">
                                <MessageContent>
                                  <Bubble variant="default" align="end">
                                    <BubbleContent>{msg.content}</BubbleContent>
                                  </Bubble>
                                </MessageContent>
                              </Message>
                            </MessageScrollerItem>
                          );
                        }

                        const aMsg = msg as AssistantMessage;
                        return (
                          <MessageScrollerItem
                            key={msg.id}
                            messageId={msg.id}
                            scrollAnchor={false}
                          >
                            <Message align="start">
                              <MessageAvatar>
                                <Avatar>
                                  <AvatarImage src={config.avatarImage} alt={config.name} />
                                  <AvatarFallback
                                    className={cn(
                                      "text-xs font-semibold text-white",
                                      config.avatarColor,
                                    )}
                                  >
                                    {config.avatarFallback}
                                  </AvatarFallback>
                                </Avatar>
                              </MessageAvatar>
                              <MessageContent>
                                <MessageHeader>{config.name}</MessageHeader>
                                <Bubble variant="secondary" align="start">
                                  <BubbleContent>
                                   <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-600 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
                                     <ReactMarkdown>{aMsg.content}</ReactMarkdown>
                                   </div>
                                   {aMsg.youtubeCard && (
                                     <YouTubeCard data={aMsg.youtubeCard} />
                                   )}
                                  </BubbleContent>
                                </Bubble>
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        );
                      })}

                      {active.thinking.active && (
                        <ThinkingMessage thinking={active.thinking} persona={activePersona} />
                      )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              )}
            </CardContent>

            {/* Input footer */}
            <CardFooter className="p-(--card-spacing)">
              <form onSubmit={handleSubmit} className="w-full">
                <InputGroup>
                  <InputGroupTextarea
                    ref={textareaRef}
                    value={active.input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask ${config.name.split(" ")[0]} anything…`}
                    rows={1}
                    disabled={active.isBusy}
                    className="min-h-[40px] py-2.5 leading-relaxed"
                  />
                  <InputGroupAddon align="block-end" className="pt-1">
                    {/* Persona switcher — replaces the + add button */}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <InputGroupButton
                              aria-label="Switch persona"
                              type="button"
                              size="icon-sm"
                              variant="secondary"
                            >
                              <UsersIcon className="text-foreground" />
                            </InputGroupButton>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Switch persona</p>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="start" side="top" className="w-52">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Switch persona
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => switchPersona("hitesh")}
                          className={cn(activePersona === "hitesh" && "bg-muted")}
                        >
                          <Avatar size="sm">
                            <AvatarImage src={PERSONA_CONFIG.hitesh.avatarImage} alt="Hitesh" />
                            <AvatarFallback className="bg-orange-500 text-xs font-semibold text-white">HC</AvatarFallback>
                          </Avatar>
                          <span>Hitesh Choudhary</span>
                          {activePersona === "hitesh" && (
                            <span className="ms-auto text-xs text-muted-foreground">Active</span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => switchPersona("piyush")}
                          className={cn(activePersona === "piyush" && "bg-muted")}
                        >
                          <Avatar size="sm">
                            <AvatarImage src={PERSONA_CONFIG.piyush.avatarImage} alt="Piyush" />
                            <AvatarFallback className="bg-violet-600 text-xs font-semibold text-white">PG</AvatarFallback>
                          </Avatar>
                          <span>Piyush Garg</span>
                          {activePersona === "piyush" && (
                            <span className="ms-auto text-xs text-muted-foreground">Active</span>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Send button */}
                    <InputGroupButton
                      type="submit"
                      variant="default"
                      size="icon-sm"
                      disabled={!active.input.trim() || active.isBusy}
                      className="ml-auto"
                    >
                      <ArrowUpIcon />
                      <span className="sr-only">Send</span>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </form>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                Free tier · {rateLimitPerDay} messages per IP per day
              </p>
            </CardFooter>
          </Card>
        </MessageScrollerProvider>
      </div>
    </TooltipProvider>
  );
}
