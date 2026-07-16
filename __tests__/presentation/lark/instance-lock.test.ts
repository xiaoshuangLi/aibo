import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { config } from '@/core/config';
import { acquireLarkInstanceLock, releaseLarkInstanceLock } from '@/presentation/lark/instance-lock';

describe('Lark instance lock', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLarkConfig = { ...config.lark };
  const originalLarkType = config.interaction.larkType;
  const appId = `instance-lock-${process.pid}`;
  const receiveId = `receive-${process.pid}`;
  const scope = `${appId}|user_chat|${receiveId}`;
  const key = crypto.createHash('sha256').update(scope).digest('hex');
  const lockPath = path.join(os.tmpdir(), 'aibo-lark-instances', `${key}.lock`);

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    config.lark = { ...config.lark, appId, receiveId };
    config.interaction.larkType = 'user_chat';
    releaseLarkInstanceLock();
    fs.rmSync(lockPath, { force: true });
  });

  afterEach(() => {
    releaseLarkInstanceLock();
    fs.rmSync(lockPath, { force: true });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    config.lark = originalLarkConfig;
    config.interaction.larkType = originalLarkType;
  });

  it('rejects a second instance while the recorded owner is alive', () => {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, String(process.ppid), 'utf8');

    expect(() => acquireLarkInstanceLock(null)).toThrow(/已由本机进程/);
  });

  it('reclaims a stale lock and releases its own lock', () => {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, '2147483647', 'utf8');

    acquireLarkInstanceLock(null);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(String(process.pid));

    releaseLarkInstanceLock();
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});
