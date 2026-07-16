import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { config } from '@/core/config';
import {
  isImageModeEnabled,
  runWithImageModeConversation,
  setImageModeEnabled,
} from '@/presentation/lark/image-mode';

describe('shared Lark image mode', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLarkConfig = { ...config.lark };
  const appId = `image-mode-${process.pid}`;
  const chatA = `chat-a-${process.pid}`;
  const chatB = `chat-b-${process.pid}`;

  function statePath(chatId: string): string {
    const key = crypto.createHash('sha256').update(`${appId}:${chatId}`).digest('hex');
    return path.join(os.tmpdir(), 'aibo-lark-image-mode', `${key}.enabled`);
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    config.lark = { ...config.lark, appId };
    fs.rmSync(statePath(chatA), { force: true });
    fs.rmSync(statePath(chatB), { force: true });
  });

  afterEach(() => {
    fs.rmSync(statePath(chatA), { force: true });
    fs.rmSync(statePath(chatB), { force: true });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    config.lark = originalLarkConfig;
  });

  it('persists one conversation mode outside process memory', () => {
    runWithImageModeConversation(chatA, () => setImageModeEnabled(true));

    expect(fs.existsSync(statePath(chatA))).toBe(true);
    expect(isImageModeEnabled(chatA)).toBe(true);
    expect(isImageModeEnabled(chatB)).toBe(false);
  });

  it('disables only the current conversation', () => {
    setImageModeEnabled(true, chatA);
    setImageModeEnabled(true, chatB);

    runWithImageModeConversation(chatA, () => setImageModeEnabled(false));

    expect(isImageModeEnabled(chatA)).toBe(false);
    expect(isImageModeEnabled(chatB)).toBe(true);
  });
});
