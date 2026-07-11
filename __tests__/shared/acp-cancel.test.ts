import { buildAcpCancelArgs } from '@/shared/acp-cancel';

describe('buildAcpCancelArgs', () => {
  it('targets the default session without inventing a name', () => {
    expect(buildAcpCancelArgs({ agent: 'codex', cwd: '/repo' })).toEqual([
      '--cwd', '/repo', 'codex', 'cancel',
    ]);
  });

  it('targets the same named session', () => {
    expect(buildAcpCancelArgs({
      agent: 'claude',
      cwd: '/repo',
      sessionName: 'backend',
    })).toEqual([
      '--cwd', '/repo', 'claude', '-s', 'backend', 'cancel',
    ]);
  });
});
