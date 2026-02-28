/**
 * Extra coverage tests for restart.ts, covering the branches that the existing
 * tests miss because ts-jest always sets the ts-node symbol.
 */
import { isRunningInTsNode } from '@/shared/utils/restart';

const TS_NODE_SYMBOL = Symbol.for('ts-node.register.instance');

/** Save all relevant process state and return a restore function. */
function saveProcessState() {
  const savedSymbol = (process as any)[TS_NODE_SYMBOL];
  const savedEnv = process.env.TS_NODE_DEV;
  const savedExecArgv = process.execArgv;
  const savedArgv = process.argv;

  return () => {
    if (savedSymbol !== undefined) {
      (process as any)[TS_NODE_SYMBOL] = savedSymbol;
    } else {
      delete (process as any)[TS_NODE_SYMBOL];
    }
    if (savedEnv !== undefined) {
      process.env.TS_NODE_DEV = savedEnv;
    } else {
      delete process.env.TS_NODE_DEV;
    }
    (process as any).execArgv = savedExecArgv;
    (process as any).argv = savedArgv;
  };
}

describe('isRunningInTsNode - isolated branch coverage', () => {
  it('returns true when only TS_NODE_DEV is set (line 21)', () => {
    const restore = saveProcessState();
    try {
      delete (process as any)[TS_NODE_SYMBOL];
      process.env.TS_NODE_DEV = 'true';
      (process as any).execArgv = [];
      (process as any).argv = ['node', 'dist/main.js'];

      expect(isRunningInTsNode()).toBe(true);
    } finally {
      restore();
    }
  });

  it('returns true when only execArgv contains ts-node (line 26)', () => {
    const restore = saveProcessState();
    try {
      delete (process as any)[TS_NODE_SYMBOL];
      delete process.env.TS_NODE_DEV;
      (process as any).execArgv = ['--require', 'ts-node/register'];
      (process as any).argv = ['node', 'dist/main.js'];

      expect(isRunningInTsNode()).toBe(true);
    } finally {
      restore();
    }
  });

  it('returns true when only argv[1] ends with .ts (line 32)', () => {
    const restore = saveProcessState();
    try {
      delete (process as any)[TS_NODE_SYMBOL];
      delete process.env.TS_NODE_DEV;
      (process as any).execArgv = [];
      (process as any).argv = ['node', '/app/src/main.ts'];

      expect(isRunningInTsNode()).toBe(true);
    } finally {
      restore();
    }
  });

  it('returns false when no ts-node indicators present (line 35)', () => {
    const restore = saveProcessState();
    try {
      delete (process as any)[TS_NODE_SYMBOL];
      delete process.env.TS_NODE_DEV;
      (process as any).execArgv = [];
      (process as any).argv = ['node', '/app/dist/main.js'];

      expect(isRunningInTsNode()).toBe(false);
    } finally {
      restore();
    }
  });
});
