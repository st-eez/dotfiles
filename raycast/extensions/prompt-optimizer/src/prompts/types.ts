export interface PromptStrategy {
  id: string;
  name: string;
  description: string;
  buildPrompt: (userRequest: string, context?: string, personaId?: string) => string;
}
