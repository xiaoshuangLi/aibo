import { AsyncLocalStorage } from 'async_hooks';

const DEFAULT_SCOPE = '__default__';
const enabledConversations = new Set<string>();
const conversationContext = new AsyncLocalStorage<string>();

function resolveConversationId(conversationId?: string): string {
  return conversationId || conversationContext.getStore() || DEFAULT_SCOPE;
}

export function isImageModeEnabled(conversationId?: string): boolean {
  return enabledConversations.has(resolveConversationId(conversationId));
}

export function setImageModeEnabled(enabled: boolean, conversationId?: string): void {
  const scope = resolveConversationId(conversationId);
  if (enabled) {
    enabledConversations.add(scope);
  } else if (!conversationId && !conversationContext.getStore()) {
    // Unscoped disable is used by startup/tests to reset process-local state.
    enabledConversations.clear();
  } else {
    enabledConversations.delete(scope);
  }
}

export function runWithImageModeConversation<T>(conversationId: string, callback: () => T): T {
  return conversationContext.run(conversationId, callback);
}

/** Image-mode commands must remain reachable while all other input is intercepted. */
export function isImageModeCommand(text: string): boolean {
  return /^\/image(?:\s|$)/i.test(text.trim());
}
