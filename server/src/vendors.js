// AI vendors recognised on card statements. Patterns match the descriptor text
// banks show, which is usually upper case and truncated.
export const AI_VENDORS = [
  { name: "Anthropic", pattern: /ANTHROPIC|CLAUDE\.AI|CLAUDE AI/i },
  { name: "OpenAI", pattern: /OPENAI|CHATGPT/i },
  { name: "Cursor", pattern: /CURSOR(\.SH| AI|,? ?INC)?\b|ANYSPHERE/i },
  { name: "GitHub Copilot", pattern: /COPILOT/i },
  { name: "Google Gemini", pattern: /GEMINI|GOOGLE \*?AI ?STUDIO/i },
  { name: "Mistral", pattern: /MISTRAL/i },
  { name: "Perplexity", pattern: /PERPLEXITY/i },
  { name: "Midjourney", pattern: /MIDJOURNEY/i },
  { name: "ElevenLabs", pattern: /ELEVENLABS|ELEVEN LABS/i },
  { name: "Replicate", pattern: /REPLICATE/i },
  { name: "Together AI", pattern: /TOGETHER ?AI|TOGETHER COMPUTER/i },
  { name: "OpenRouter", pattern: /OPENROUTER/i },
  { name: "Groq", pattern: /\bGROQ\b/i },
  { name: "Hugging Face", pattern: /HUGGING ?FACE/i },
  { name: "Cohere", pattern: /COHERE/i },
  { name: "Runway", pattern: /RUNWAY ?ML|RUNWAYML/i },
];

export function detectVendor(text) {
  if (!text) return null;
  const hit = AI_VENDORS.find((v) => v.pattern.test(text));
  return hit ? hit.name : null;
}
