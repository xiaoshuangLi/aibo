// Re-export main function and agent for backward compatibility
export { main } from './main';
export { createAIAgent } from './core/agent/agent-factory';
export { agent } from './core/agent/agent-factory';

// Re-export other utilities that might be used externally
export { handleHelpCommand, handleClearCommand, handlePwdCommand, handleLsCommand, handleVerboseCommand, handleNewCommand, handleVoiceCommand, handleExitCommand, handleUnknownCommand, createHandleInternalCommand } from './presentation/console/command-handlers';
export { cleanupVoiceRecording, startRecord, stopRecord, onKeypress } from './features/voice-input/voice-input-manager';
export { createSessionState, setupExitHandlers, createGracefulShutdownHandler } from './core/session/session-manager';
export { startInteractiveMode } from './presentation/console/interactive-mode';
