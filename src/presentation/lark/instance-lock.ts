import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { config } from '@/core/config';

let ownedLockPath: string | null = null;

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getInstanceScope(chatId: string | null): string {
  const target = config.interaction.larkType === 'group_chat'
    ? chatId || process.cwd()
    : config.lark.receiveId || 'user_chat';
  return [config.lark.appId || 'aibo', config.interaction.larkType, target].join('|');
}

function getLockPath(chatId: string | null): string {
  const key = crypto.createHash('sha256').update(getInstanceScope(chatId)).digest('hex');
  return path.join(os.tmpdir(), 'aibo-lark-instances', `${key}.lock`);
}

/** Ensure only one local process consumes a specific Lark conversation. */
export function acquireLarkInstanceLock(chatId: string | null): void {
  if (process.env.NODE_ENV === 'test') return;

  const lockPath = getLockPath(chatId);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeFileSync(fd, String(process.pid), 'utf8');
      } finally {
        fs.closeSync(fd);
      }
      ownedLockPath = lockPath;
      return;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;

      let ownerPid = 0;
      try {
        ownerPid = Number.parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
      } catch {
        // An incomplete lock is stale and can be reclaimed.
      }

      if (ownerPid === process.pid) {
        ownedLockPath = lockPath;
        return;
      }
      if (isProcessAlive(ownerPid)) {
        throw new Error(`Lark 会话已由本机进程 ${ownerPid} 运行，请先停止重复的 aibo 进程`);
      }

      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkError: any) {
        if (unlinkError?.code !== 'ENOENT') throw unlinkError;
      }
    }
  }

  throw new Error('无法获取 Lark 会话单实例锁');
}

export function releaseLarkInstanceLock(): void {
  if (!ownedLockPath) return;
  const lockPath = ownedLockPath;
  ownedLockPath = null;

  try {
    const ownerPid = Number.parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
    if (ownerPid === process.pid) fs.unlinkSync(lockPath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('⚠️ 释放 Lark 会话单实例锁失败:', error);
    }
  }
}
