import { LLMProvider } from "./types";

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = model || process.env.OLLAMA_MODEL || "llama3.2:3b";
  }

  async generateJson(system: string, user: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    try {
      const url = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          stream: false,
          format: "json",
          options: {
            temperature: 0,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama request failed with status ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const content = data?.message?.content;
      if (typeof content !== "string") {
        throw new Error(
          "Invalid response format from Ollama: message.content is not a string"
        );
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function getProvider(name?: string): LLMProvider {
  const providerName = (
    name ||
    process.env.LLM_PROVIDER ||
    "ollama"
  ).toLowerCase();

  switch (providerName) {
    case "ollama":
    default:
      return new OllamaProvider();
  }
}
