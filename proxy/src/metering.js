// Reads token usage from provider responses and prices it.
// OpenAI chat completions report prompt_tokens/completion_tokens; the OpenAI
// Responses API and Anthropic Messages report input_tokens/output_tokens.

export function usageFromJson(body) {
  if (!body || typeof body !== "object" || !body.usage) return null;
  const u = body.usage;
  const input = u.prompt_tokens ?? u.input_tokens;
  const output = u.completion_tokens ?? u.output_tokens;
  if (typeof input !== "number" && typeof output !== "number") return null;
  return { model: body.model ?? null, inputTokens: input ?? 0, outputTokens: output ?? 0 };
}

// Streams arrive as server-sent events. OpenAI sends usage in a final chunk
// (when stream_options.include_usage is set). Anthropic sends input tokens in
// message_start and the running output count in message_delta.
export function usageFromSse(text) {
  let model = null;
  let input = 0;
  let output = 0;
  let found = false;

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    const message = event.type === "message_start" ? event.message : event.response ?? event;
    if (message?.model) model = message.model;
    const usage = usageFromJson(message);
    if (usage) {
      found = true;
      if (usage.inputTokens) input = usage.inputTokens;
      if (usage.outputTokens) output = usage.outputTokens;
    }
  }
  return found ? { model, inputTokens: input, outputTokens: output } : null;
}

export function priceFor(prices, model) {
  const name = model ?? "";
  let best = null;
  for (const prefix of Object.keys(prices.models ?? {})) {
    if (name.startsWith(prefix) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best ? prices.models[best] : prices.default;
}

export function costUsd(prices, usage) {
  const rate = priceFor(prices, usage.model);
  return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000;
}
