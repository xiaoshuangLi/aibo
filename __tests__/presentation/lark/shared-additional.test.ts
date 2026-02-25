import { 
  inferLanguageType,
  escapeLarkIndentation,
  processLarkText,
  isErrorContent,
  getToolType
} from '@/presentation/lark/shared';

describe('Shared Utilities Additional Tests', () => {
  it('should handle file extension language detection', () => {
    expect(inferLanguageType('test.js')).toBe('javascript');
    expect(inferLanguageType('test.ts')).toBe('typescript');
    expect(inferLanguageType('test.py')).toBe('python');
    expect(inferLanguageType('test.sh')).toBe('bash');
    expect(inferLanguageType('test.html')).toBe('html');
    expect(inferLanguageType('test.css')).toBe('css');
    expect(inferLanguageType('test.java')).toBe('java');
    expect(inferLanguageType('test.c')).toBe('c');
    expect(inferLanguageType('test.cpp')).toBe('cpp');
    expect(inferLanguageType('test.go')).toBe('go');
    expect(inferLanguageType('test.rs')).toBe('rust');
    expect(inferLanguageType('Dockerfile')).toBe('docker_file');
    expect(inferLanguageType('Makefile')).toBe('makefile');
  });

  it('should handle indentation escaping', () => {
    const input = 'Normal line\n  Indented line\n\tTabbed line';
    const result = escapeLarkIndentation(input);
    expect(result).toBe('Normal line\n\u200B  Indented line\n\u200B\tTabbed line');
  });

  it('should process text with default options', () => {
    const input = 'Normal line\n  Indented line\nError occurred';
    const result = processLarkText(input);
    expect(result).toBe('Normal line\n\u200B  Indented line\nError occurred');
  });

  it('should detect error content', () => {
    expect(isErrorContent('Error occurred')).toBe(true);
    expect(isErrorContent('Exception thrown')).toBe(true);
    expect(isErrorContent('stderr output')).toBe(true);
    expect(isErrorContent('Error: Something went wrong')).toBe(true);
    expect(isErrorContent('Normal output')).toBe(false);
  });

  it('should categorize tool types correctly', () => {
    // Filesystem
    expect(getToolType('ls')).toBe('filesystem');
    expect(getToolType('read_file')).toBe('filesystem');
    
    // System
    expect(getToolType('execute_bash')).toBe('system');
    expect(getToolType('sleep')).toBe('system');
    
    // Task management
    expect(getToolType('task')).toBe('task_management');
    expect(getToolType('write_todos')).toBe('task_management');
    
    // Other
    expect(getToolType('unknown_tool')).toBe('other');
  });
});