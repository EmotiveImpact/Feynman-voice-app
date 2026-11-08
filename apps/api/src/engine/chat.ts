// A small JSON chat call, shared by the engine's pieces. OpenAI by default;
// a model name starting "claude-" goes to Anthropic instead (needs anthropicKey).
import Anthropic from "@anthropic-ai/sdk";

export interface ChatCfg {
  apiKey: string;
  /** Needed when model is a Claude model. */
  anthropicKey?: string;
  model: string;
  reasoningEffort?: string;
  fetchImpl?: typeof fetch;
}

/** A message part in OpenAI's shape: text, or an image as a data URL. */
export type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } };
export type ChatMessage = { role: string; content: string | ChatPart[] };

type Env = Record<string, string | undefined>;

/** Claude is the brain whenever its key is on the server, unless AI_PROVIDER=openai. */
export function useClaude(env: Env): boolean {
  return !!env.ANTHROPIC_API_KEY && (env.AI_PROVIDER ?? "claude").toLowerCase() !== "openai";
}

/** The model for a job: its own setting if given, else Claude's pick, else OpenAI's chat model. */
export function modelFor(env: Env, specific: string | undefined, claudeDefault = "claude-haiku-5-5"): string {
  if (specific) return specific;
  return useClaude(env) ? claudeDefault : env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini";
}

/** True when the server has a key for this model's provider. */
export function hasKeyFor(env: Env, model: string): boolean {
  return model.startsWith("claude-") ? !!env.ANTHROPIC_API_KEY : !!env.OPENAI_API_KEY;
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export async function chatJSON<T>(
  cfg: ChatCfg,
  messages: ChatMessage[],
  schema: { name: string; schema: object },
  maxTokens = 600,
): Promise<{ value: T; usage: ChatUsage }> {
  if (cfg.model.startsWith("claude-")) return claudeJSON<T>(cfg, messages, schema, maxTokens);
  const f = cfg.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: { name: schema.name, strict: true, schema: schema.schema } },
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
  const res = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[]; usage?: ChatUsage };
  return { value: JSON.parse(j.choices[0].message.content) as T, usage: j.usage ?? {} };
}

const clients = new Map<string, Anthropic>();

/** The same call on Claude: structured output, low effort for speed, usage in OpenAI's shape. */
async function claudeJSON<T>(
  cfg: ChatCfg,
  messages: ChatMessage[],
  schema: { name: string; schema: object },
  maxTokens: number,
): Promise<{ value: T; usage: ChatUsage }> {
  if (!cfg.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set on the server");
  const id = cfg.anthropicKey + (cfg.fetchImpl ? "+f" : "");
  let client = clients.get(id);
  if (!client) {
    client = new Anthropic({ apiKey: cfg.anthropicKey, maxRetries: 1, ...(cfg.fetchImpl ? { fetch: cfg.fetchImpl } : {}) });
    clients.set(id, client);
  }
  const system = messages
    .filter((m) => m.role === "developer" || m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("")))
    .join("\n\n");
  // Claude wants turns to alternate and to end on the user, so neighbours with the same role are joined.
  const turns: { role: "user" | "assistant"; content: ClaudeBlock[] }[] = [];
  for (const m of messages) {
    if (m.role === "developer" || m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const blocks = toClaudeBlocks(m.content);
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: [{ type: "text", text: "(go on)" }] });
  const effort = cfg.reasoningEffort === "high" || cfg.reasoningEffort === "medium" ? cfg.reasoningEffort : "low";
  const fallback = !cfg.model.startsWith("claude-haiku");
  const r = await client.beta.messages.create({
    model: cfg.model,
    // Thinking tokens count towards this, so leave room above the answer.
    max_tokens: maxTokens + 2000,
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort, format: { type: "json_schema", schema: schema.schema as { [k: string]: unknown } } },
    messages: turns,
  });
  if (r.stop_reason === "refusal") throw new Error(`${cfg.model} declined`);
  const text = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const u = r.usage;
  const cached = u.cache_read_input_tokens ?? 0;
  return {
    value: JSON.parse(text) as T,
    usage: {
      prompt_tokens: (u.input_tokens ?? 0) + cached + (u.cache_creation_input_tokens ?? 0),
      completion_tokens: u.output_tokens,
      prompt_tokens_details: { cached_tokens: cached },
    },
  };
}

type ClaudeBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };

function toClaudeBlocks(content: string | ChatPart[]): ClaudeBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((p): ClaudeBlock => {
    if (p.type === "text") return { type: "text", text: p.text };
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/s.exec(p.image_url.url);
    if (!m) throw new Error("Images must be base64 data URLs");
    return { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } };
  });
}
