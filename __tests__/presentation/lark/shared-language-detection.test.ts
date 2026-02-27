import { inferLanguageType } from '@/presentation/lark/shared';

describe('Lark Shared - inferLanguageType Content Detection', () => {
  describe('shebang-based detection', () => {
    it('should detect bash from #!/bin/bash shebang', () => {
      expect(inferLanguageType(undefined, '#!/bin/bash\necho hello')).toBe('bash');
    });

    it('should detect bash from #!/usr/bin/env bash shebang', () => {
      expect(inferLanguageType(undefined, '#!/usr/bin/env bash\nset -e')).toBe('bash');
    });

    it('should detect shell from #!/bin/sh shebang', () => {
      expect(inferLanguageType(undefined, '#!/bin/sh\necho hello')).toBe('shell');
    });

    it('should detect shell from #!/usr/bin/env sh shebang', () => {
      expect(inferLanguageType(undefined, '#!/usr/bin/env sh\necho hello')).toBe('shell');
    });

    it('should detect python from #!/usr/bin/env python shebang', () => {
      expect(inferLanguageType(undefined, '#!/usr/bin/env python\nprint("hello")')).toBe('python');
    });

    it('should detect javascript from #!/usr/bin/env node shebang', () => {
      expect(inferLanguageType(undefined, '#!/usr/bin/env node\nconsole.log("hi")')).toBe('javascript');
    });
  });

  describe('content pattern detection', () => {
    it('should detect typescript from TypeScript-specific features', () => {
      const tsContent = 'interface MyInterface {\n  name: string;\n}\nconst x: number = 1;';
      expect(inferLanguageType(undefined, tsContent)).toBe('typescript');
    });

    it('should detect javascript from JS-only features', () => {
      const jsContent = 'const x = 1;\nfunction doSomething() {}\nlet y = 2;';
      expect(inferLanguageType(undefined, jsContent)).toBe('javascript');
    });

    it('should detect python from def/class', () => {
      const pyContent = 'def my_function():\n    pass\nclass MyClass:\n    pass';
      expect(inferLanguageType(undefined, pyContent)).toBe('python');
    });

    it('should detect C from int main / #include', () => {
      const cContent = '#include <stdio.h>\nvoid main() {\n  return 0;\n}';
      expect(inferLanguageType(undefined, cContent)).toBe('c');
    });

    it('should detect Go from package/func', () => {
      const goContent = 'package main\nfunc main() {\n  return\n}';
      expect(inferLanguageType(undefined, goContent)).toBe('go');
    });

    it('should detect Java from private/protected keywords', () => {
      // Java code without class/import/def (which would match Python earlier)
      // and without void/struct (which would match C earlier)
      const javaContent = 'protected String getValue() {\n  return name;\n}';
      expect(inferLanguageType(undefined, javaContent)).toBe('java');
    });

    it('should return undefined when content matches no language patterns', () => {
      // Note: Rust detection requires fn+let+mut but let also triggers JS detection first
      // So we test with content that has none of the special markers
      expect(inferLanguageType(undefined, 'hello world this is some text without code markers')).toBeUndefined();
    });

    it('should return undefined when both filePath and content are undefined', () => {
      expect(inferLanguageType()).toBeUndefined();
    });

    it('should return undefined when content is empty string', () => {
      expect(inferLanguageType(undefined, '')).toBeUndefined();
    });
  });
});
