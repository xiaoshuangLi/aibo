// Re-export main function and agent for backward compatibility
export { main } from '@/main';
export * from '@/core/agent/agent-factory';

// Re-export other utilities that might be used externally
export * from '@/presentation/console/command-handlers';
export * from '@/features/voice-input/voice-input-manager';
export * from '@/presentation/console/interactive-mode';
export * from '@/core/agent/session';
