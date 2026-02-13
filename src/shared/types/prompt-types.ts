/**
 * Type definitions for system prompts used by AIBO autonomous programming AI
 * 
 * @file prompt-types.ts
 * @author AIBO Team
 * @description TypeScript type definitions for prompt-related functionality
 */

/**
 * System prompt language variants
 * @enum {string}
 * @name PromptLanguage
 */
export enum PromptLanguage {
  /** English language prompt */
  EN = 'en',
  /** Chinese language prompt */
  ZH = 'zh'
}

/**
 * System prompt configuration options
 * @interface
 * @name SystemPromptConfig
 */
export interface SystemPromptConfig {
  /** Language variant to use */
  language: PromptLanguage;
  /** Whether to include environment context */
  includeEnvironmentContext?: boolean;
  /** Custom environment variables to inject */
  customEnvironment?: Record<string, string>;
}

/**
 * Enhanced system prompt structure
 * @interface
 * @name EnhancedSystemPrompt
 */
export interface EnhancedSystemPrompt {
  /** The actual prompt content */
  content: string;
  /** Language of the prompt */
  language: PromptLanguage;
  /** Timestamp when prompt was generated */
  timestamp: Date;
  /** Version identifier */
  version: string;
}