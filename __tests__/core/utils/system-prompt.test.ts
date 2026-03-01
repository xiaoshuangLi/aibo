// Mock dotenv and config so SYSTEM_PROMPT can be evaluated at module load time
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('@/core/config', () => ({
  config: {
    language: { code: 'en' },
    persona: { style: undefined },
  },
}));

import { buildCodingAgentHint, buildSystemPrompt } from '@/core/utils/system-prompt';

describe('buildCodingAgentHint', () => {
  it('returns empty string when no tools are available', () => {
    expect(buildCodingAgentHint(false, false, false, false)).toBe('');
  });

  it('returns empty string with default params', () => {
    expect(buildCodingAgentHint(false, false)).toBe('');
  });

  it('includes claude hint when only claude is available', () => {
    const hint = buildCodingAgentHint(true, false);
    expect(hint).toContain('claude_execute');
    expect(hint).not.toContain('cursor_execute');
    expect(hint).not.toContain('gemini_execute');
    expect(hint).not.toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
  });

  it('includes cursor hint when only cursor is available', () => {
    const hint = buildCodingAgentHint(false, true);
    expect(hint).toContain('cursor_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).toContain('PRIORITY');
  });

  it('includes gemini hint when only gemini is available', () => {
    const hint = buildCodingAgentHint(false, false, true, false);
    expect(hint).toContain('gemini_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).not.toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('frontend');
  });

  it('includes codex hint when only codex is available', () => {
    const hint = buildCodingAgentHint(false, false, false, true);
    expect(hint).toContain('codex_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).not.toContain('gemini_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('backend');
  });

  it('includes all four agents when all tools are available', () => {
    const hint = buildCodingAgentHint(true, true, true, true);
    expect(hint).toContain('claude_execute');
    expect(hint).toContain('cursor_execute');
    expect(hint).toContain('gemini_execute');
    expect(hint).toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('Routing rules');
  });

  it('includes routing table when multiple tools are available', () => {
    const hint = buildCodingAgentHint(true, false, true, true);
    expect(hint).toContain('| Tool | Best for |');
    expect(hint).toContain('claude_execute');
    expect(hint).toContain('gemini_execute');
    expect(hint).toContain('codex_execute');
  });
});

describe('buildSystemPrompt', () => {
  it('returns base system prompt when no coding tools are present', () => {
    const tools = [{ name: 'bash' }, { name: 'read_file' }];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toBeTruthy();
    expect(prompt).not.toContain('PRIORITY');
  });

  it('detects claude_execute and appends hint', () => {
    const tools = [{ name: 'bash' }, { name: 'claude_execute' }];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toContain('claude_execute');
    expect(prompt).toContain('PRIORITY');
  });

  it('detects cursor_execute and appends hint', () => {
    const tools = [{ name: 'cursor_execute' }];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toContain('cursor_execute');
    expect(prompt).toContain('PRIORITY');
  });

  it('detects gemini_execute and appends hint', () => {
    const tools = [{ name: 'gemini_execute' }];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toContain('gemini_execute');
    expect(prompt).toContain('frontend');
  });

  it('detects codex_execute and appends hint', () => {
    const tools = [{ name: 'codex_execute' }];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toContain('codex_execute');
    expect(prompt).toContain('backend');
  });

  it('detects all four coding tools', () => {
    const tools = [
      { name: 'claude_execute' },
      { name: 'cursor_execute' },
      { name: 'gemini_execute' },
      { name: 'codex_execute' },
    ];
    const prompt = buildSystemPrompt(tools);
    expect(prompt).toContain('claude_execute');
    expect(prompt).toContain('cursor_execute');
    expect(prompt).toContain('gemini_execute');
    expect(prompt).toContain('codex_execute');
    expect(prompt).toContain('Routing rules');
  });

  it('handles empty tools array', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toBeTruthy();
    expect(prompt).not.toContain('PRIORITY');
  });
});
