import { AsyncLocalStorage } from 'async_hooks';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { config } from '@/core/config';

const DEFAULT_SCOPE = '__default__';
const enabledConversations = new Set<string>();
const conversationContext = new AsyncLocalStorage<string>();

function resolveConversationId(conversationId?: string): string {
  return conversationId || conversationContext.getStore() || DEFAULT_SCOPE;
}

function getSharedStatePath(conversationId: string): string {
  const scope = `${config.lark.appId || 'aibo'}:${conversationId}`;
  const key = crypto.createHash('sha256').update(scope).digest('hex');
  return path.join(os.tmpdir(), 'aibo-lark-image-mode', `${key}.enabled`);
}

export function isImageModeEnabled(conversationId?: string): boolean {
  const scope = resolveConversationId(conversationId);
  if (process.env.NODE_ENV === 'test') {
    return enabledConversations.has(scope);
  }
  return fs.existsSync(getSharedStatePath(scope));
}

export function setImageModeEnabled(enabled: boolean, conversationId?: string): void {
  const scope = resolveConversationId(conversationId);
  if (process.env.NODE_ENV === 'test') {
    if (enabled) {
      enabledConversations.add(scope);
    } else if (!conversationId && !conversationContext.getStore()) {
      enabledConversations.clear();
    } else {
      enabledConversations.delete(scope);
    }
    return;
  }

  const statePath = getSharedStatePath(scope);
  if (enabled) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, 'enabled\n', 'utf8');
    return;
  }

  try {
    fs.unlinkSync(statePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function runWithImageModeConversation<T>(conversationId: string, callback: () => T): T {
  return conversationContext.run(conversationId, callback);
}

/** Image-mode commands must remain reachable while all other input is intercepted. */
export function isImageModeCommand(text: string): boolean {
  return /^\/image(?:\s|$)/i.test(text.trim());
}
