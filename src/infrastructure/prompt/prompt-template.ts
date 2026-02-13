import * as os from 'os';
import { 
  SYSTEM_PROMPT_EN, 
  SYSTEM_PROMPT_ZH, 
  SYSTEM_PROMPT 
} from '../../shared/constants/system-prompts';
import { PromptLanguage, SystemPromptConfig, EnhancedSystemPrompt } from '../../shared/types/prompt-types';

/**
 * Prompt template manager for AIBO autonomous programming AI
 * Provides dynamic prompt generation with environment variable injection
 * and language selection capabilities.
 * 
 * @class PromptTemplate
 * @name PromptTemplate
 */
export class PromptTemplate {
  /**
   * Get enhanced system prompt based on configuration
   * @param config - Configuration options for prompt generation
   * @returns Enhanced system prompt structure
   * @example
   * const template = new PromptTemplate();
   * const prompt = template.getEnhancedSystemPrompt({ language: PromptLanguage.EN });
   */
  public getEnhancedSystemPrompt(config: SystemPromptConfig): EnhancedSystemPrompt {
    const { language, includeEnvironmentContext = true, customEnvironment = {} } = config;
    
    let content: string;
    switch (language) {
      case PromptLanguage.ZH:
        content = SYSTEM_PROMPT_ZH;
        break;
      case PromptLanguage.EN:
      default:
        content = SYSTEM_PROMPT_EN;
        break;
    }
    
    // Inject custom environment variables if provided
    if (Object.keys(customEnvironment).length > 0) {
      Object.entries(customEnvironment).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      });
    }
    
    // Inject standard environment context if requested
    if (includeEnvironmentContext) {
      const envReplacements: Record<string, string> = {
        'os.platform()': os.platform(),
        'os.arch()': os.arch(),
        'process.version': process.version,
        'process.cwd()': process.cwd()
      };
      
      Object.entries(envReplacements).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      });
    }
    
    return {
      content,
      language,
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
  
  /**
   * Get default enhanced system prompt (English)
   * @returns Default enhanced system prompt
   * @example
   * const template = new PromptTemplate();
   * const defaultPrompt = template.getDefaultPrompt();
   */
  public getDefaultPrompt(): EnhancedSystemPrompt {
    return this.getEnhancedSystemPrompt({ language: PromptLanguage.EN });
  }
  
  /**
   * Get all available prompt variants
   * @returns Array of all prompt variants
   * @example
   * const template = new PromptTemplate();
   * const allPrompts = template.getAllPrompts();
   */
  public getAllPrompts(): EnhancedSystemPrompt[] {
    return [
      this.getEnhancedSystemPrompt({ language: PromptLanguage.EN }),
      this.getEnhancedSystemPrompt({ language: PromptLanguage.ZH })
    ];
  }
}

// Export constants for backward compatibility
export { 
  SYSTEM_PROMPT_EN, 
  SYSTEM_PROMPT_ZH, 
  SYSTEM_PROMPT 
};