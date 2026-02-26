export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/__tests__'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Case-insensitive shim: map Config (uppercase) → config (lowercase)
    '^(.*[\\/]core[\\/]config[\\/])Config$': '$1config',
  },
  transform: {
    '^.+\\.(j|t)s$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  // 添加 transformIgnorePatterns 以处理 ESM 模块
  // 转换所有 node_modules 中的文件（除了明确排除的）
  transformIgnorePatterns: [
    'node_modules/(?!(ansi-styles|langchain|@langchain|deepagents|@composio|uuid))',
  ],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.d\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/infrastructure/browser/puppeteer-utils.ts',
  ],
};