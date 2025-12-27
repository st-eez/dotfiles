/**
 * PromptStrategy interface for A/B testing framework.
 * Each strategy version implements this interface.
 */

export interface PromptStrategy {
  /** Unique identifier, e.g., "v1-baseline" */
  id: string;

  /** Human-readable name */
  name: string;

  /** What this version tests or changes */
  description: string;

  /**
   * Build a quick-mode optimization prompt.
   * Single-shot comprehensive prompt in XML format.
   */
  buildQuickPrompt: (userRequest: string, context?: string, personaId?: string) => string;

  /**
   * Build a detailed-mode optimization prompt.
   * Phased execution with checkpoints.
   */
  buildDetailedPrompt: (userRequest: string, context?: string, personaId?: string) => string;
}
