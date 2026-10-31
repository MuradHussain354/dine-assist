export interface LLMProvider {
  generateJson(system: string, user: string): Promise<string>;
}

