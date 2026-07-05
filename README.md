# Persona AI

An AI-powered chatbot that simulates conversations with **Hitesh Choudhary** (🎓) and **Piyush Garg** (🌌) — two well-known Indian tech educators. Built with Astro, shadcn/ui, and OpenAI GPT-4o.

## Features

- 🎭 **Two distinct AI personas** — each with their own voice, teaching style, and personality
- 🧠 **Chain-of-Thought (CoT) visualization** — watch the AI think through INITIAL → THINK → ANALYSE → OUTPUT in real time
- 🎬 **YouTube video recommendations** — contextual video cards for learning resources
- 💬 **Per-persona conversation history** — each tab maintains its own independent thread
- ⚡ **Server-Sent Events (SSE) streaming** — responses stream in live, step by step
- 🌗 **Dark/light mode** support via shadcn/ui

---

## Structure

```
persona-ai/
├── apps/web/               — Astro application
│   ├── src/
│   │   ├── components/chat/PersonaChat.tsx   — Main React chat component
│   │   ├── lib/prompts.ts                    — System prompts, video maps, tools
│   │   ├── pages/
│   │   │   ├── index.astro                   — Home page
│   │   │   └── api/chat.ts                   — SSE chat API endpoint
│   │   └── layouts/main.astro
│   └── .env.example
└── packages/ui/            — Shared shadcn/ui components
```

---

## Setup & Run

### Prerequisites

- Node.js ≥ 22.12.0
- An OpenAI API key with GPT-4o access

### 1. Clone and install

```bash
git clone https://github.com/mukeshmohanty623/persona-ai
cd persona-ai
npm install
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env and add your key:
# OPENAI_API_KEY=sk-...
```

### 3. Start development server

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

### 4. Build for production

```bash
npm run build
```

---

## How It Works

### Persona Data Collection

The personas were constructed by studying publicly available content:

| Source | What was studied |
|---|---|
| YouTube (ChaiCode, Hitesh Official) | Teaching cadence, code examples, vocabulary, Hindi/English mix |
| YouTube (Piyush Garg) | Philosophical tangents, spiritual analogies, "thinking out loud" style |
| hitesh.ai, piyushgarg.dev | Bio, career milestones, stated beliefs on learning |
| Twitter/X posts | Casual tone, opinions, signature phrases |
| Course content (LCO, ChaiCode) | Technical depth, curriculum choices, project-first approach |

Key observations encoded into each persona:
- **Hitesh**: outcome-first teaching, numbered steps, occasional Hindi interjections ("theek hai", "are waah"), "finish the course" ethos, candid about trade-offs
- **Piyush**: philosophical tech framing, spiritual/cosmic analogies (containers = universes, karma = async side effects), "thinking out loud" ramble, tag questions ("na?", "right?")

### Prompt Engineering Strategy

Both personas use a **Chain-of-Thought (CoT) pipeline** enforced via `response_format: { type: "json_object" }`:

```
INITIAL → THINK → ANALYSE → [TOOL_REQUEST → TOOL_OUTPUT]* → OUTPUT
```

Each step is a separate LLM call that outputs one JSON object. The model is forced to reason step-by-step before producing the final answer. This:
1. Improves response quality by separating reasoning from output
2. Gives the UI something to show while the model thinks
3. Makes tool calls (YouTube lookup) feel natural and inline

System prompts are structured with:
- `=== PERSONA TRAITS ===` — core identity anchors
- `=== SIGNATURE PHRASES ===` — specific vocabulary and catchphrases
- `=== TEACHING PATTERN ===` — structural teaching framework
- `=== TONE RULES ===` — language constraints (primarily English, Romanized Hindi only, no Devanagari)
- `=== CoT PIPELINE ===` — exact step definitions and output format
- `=== CRITICAL RULES ===` — never break character, no full Hindi sentences

### Context Management

- **Full history per request**: The entire conversation history is sent with every API call. This gives the model full context for coherent multi-turn replies.
- **Per-persona isolation**: Each persona tab maintains its own `messages[]` array in React state. Switching tabs doesn't contaminate contexts.
- **System prompt is always first**: `[system, ...userHistory]` — the persona instructions always anchor the context window.
- **Tool output as user turn**: After a `TOOL_REQUEST`, the YouTube video result is injected as a `user` message (`{ step: "TOOL_OUTPUT", output: "..." }`) so the model can reference it in the final OUTPUT.

---

## Sample Conversations

### Hitesh — "How should I learn backend development?"

> **Hitesh**: Theek hai, bhai. Backend is where your real skills show — so let's keep this simple.
>
> Here's the path:
> 1. Learn Node.js — build a small REST API with Express
> 2. Connect a database — PostgreSQL or MongoDB, your choice
> 3. Add authentication — JWT is fine for starters
> 4. Deploy it — Railway or Render, free tier works
>
> Go ahead and check this out: **Node.js Complete Course – Chai aur Code** → [link]
>
> Are waah, you've got this. Start with step 1 today. Don't plan too much — just build.

### Piyush — "What is Docker and why should I care?"

> **Piyush**: Are yaar, Docker is one of those things that looks complicated on the surface but is actually... bahut beautiful once you see what it's really doing, na.
>
> Theek hai, so here's the thing. A Docker container is basically an isolated universe. Your app, its dependencies, its environment — all contained. It doesn't know what's outside. It doesn't need to. And when that container stops? Phir it can restart — almost like reincarnation. Same app, fresh start.
>
> Bhai, this is where most people miss it: Docker isn't just about "it works on my machine." It's about giving every service its own dharma — its own role, its own environment, its own lifecycle.
>
> I actually have a video on this: **Docker Full Course – Piyush Garg** → [link]
>
> Can you see the pattern na? The universe runs on isolation + communication. So does microservices.

---

## Adding Components

```bash
npx shadcn@latest add <component> -c apps/web
```

## Tech Stack

- **Framework**: Astro 6 + React 19
- **UI**: shadcn/ui (radix-nova style, Tailwind v4)
- **AI**: OpenAI GPT-4o (`gpt-4o`)
- **Streaming**: Server-Sent Events (SSE) via Astro API routes
- **Build**: Turborepo monorepo, npm workspaces
