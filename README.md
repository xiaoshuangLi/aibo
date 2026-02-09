# AIBO - Advanced Autonomous Programming AI Assistant

An advanced autonomous programming AI assistant with full local filesystem access, terminal capabilities, and sophisticated SubAgent delegation framework. Built with TypeScript, Jest, and DeepAgents.

## Features

- ✅ **Advanced Autonomous Programming**: Write, edit, debug, and optimize code across any language
- ✅ **SubAgent Delegation**: Spawn specialized SubAgents for complex, isolated tasks with parallel execution
- ✅ **Error Recovery & Retry Strategy**: Systematic error analysis, strategy adjustment, and fallback plans
- ✅ **Full System Access**: Complete read/write access to local filesystem and terminal commands
- ✅ **Enhanced Web Tools**: Automatic search engine detection (Google/Bing China) with HTML content cleaning
- ✅ **Bilingual System Prompt**: Full English and Chinese support with comprehensive methodology
- ✅ **Interactive Chat Mode**: Real-time interactive mode with command shortcuts and session management
- ✅ **Comprehensive Testing**: 95%+ test coverage with unit, integration, and edge case testing
- ✅ **Problem-Solving Methodology**: 7-step structured approach including research best practices
- ✅ **Feature Development Workflow**: Strict workflow ensuring quality with documentation and proper commits

## Environment Variables

The application supports the following environment variables (defined in `.env`):

```env
# AI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional
MODEL_NAME=gpt-4o

# LangChain Configuration  
RECURSION_LIMIT=25
CHECKPOINTER_TYPE=memory

# Memory Configuration
MEMORY_WINDOW_SIZE=5
```

## Project Structure

```
aibo/
├── src/                    # Source code directory
│   ├── agent-interaction.ts      # Agent interaction logic
│   ├── config.ts                # Environment configuration with validation
│   ├── enhanced-system-prompt.ts # Bilingual system prompts
│   ├── index.ts                 # Main entry point with interactive mode
│   ├── interactive-logic.ts     # Interactive chat mode logic
│   ├── validators.ts            # Input validation utilities
│   ├── logging.ts              # Logging utilities
│   ├── tools/                  # AI tool implementations
│   │   ├── bash.ts            # Terminal/bash command execution
│   │   ├── utils.ts           # Utility functions for tools
│   │   └── web.ts             # Web search and fetch tools
│   └── utils/                 # Utility functions
│       ├── interactive-utils.ts  # Interactive mode utilities
│       └── search-engine-detector.ts # Automatic search engine detection
├── __tests__/                 # Comprehensive test suite
│   ├── agent-interaction.test.ts
│   ├── config.test.ts
│   ├── enhanced-system-prompt.test.ts
│   ├── enhanced-system-prompt-chinese.test.ts
│   ├── index.test.ts
│   ├── index-coverage-simple.test.ts
│   ├── interactive-logic.test.ts
│   ├── logging.test.ts
│   ├── validators.test.ts
│   ├── tools/                 # Tool-specific tests
│   │   ├── bash.test.ts
│   │   ├── utils.test.ts
│   │   └── web.test.ts
│   └── utils/                 # Utility function tests
│       ├── interactive-utils.test.ts
│       ├── interactive-utils-basic.test.ts
│       ├── simple-coverage.test.ts
│       └── search-engine-detector.test.ts
├── features/                  # Feature documentation (numbered sequentially)
├── templates/                 # Documentation templates
├── .env                       # Environment variables (gitignored)
├── .env.example               # Environment variables template
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── jest.config.ts             # Jest configuration
└── README.md                  # Project documentation
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm start` - Start the compiled application
- `npm run dev` - Run the application in development mode (using ts-node)

## Testing

All tests are located in the `__tests__` directory and use Jest with TypeScript support. The test environment automatically loads environment variables from the `.env` file.

### Test Coverage Requirements
- **Minimum Coverage**: 90% statement, branch, function, and line coverage
- **Current Coverage**: 95.67% statements, 83.15% branches, 97.26% functions, 96.94% lines
- **Test Types**: Unit tests, integration tests, and edge case scenarios
- **Validation**: All new features must pass comprehensive test suite before acceptance

### Test Commands
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode  
- `npm run test:coverage` - Run tests with detailed coverage report

## Configuration

The `src/config.ts` file uses Zod for schema validation of environment variables, ensuring that required variables are present and optional variables have sensible defaults.

## AI Parameters

All AI parameters can be configured via environment variables:

- `OPENAI_API_KEY` - Required API key
- `OPENAI_BASE_URL` - Optional base URL (useful for custom endpoints or proxies)
- `MODEL_NAME` - Model name to use (defaults to 'gpt-4o')

The configuration is validated at startup and will throw descriptive errors if required variables are missing.

## Development Workflow

### Feature Implementation Process
Every feature implementation MUST follow this strict workflow:

1. **Write Comprehensive Tests**: Create test scripts in `__tests__` directory with 90%+ coverage
2. **Implement Functionality**: Write code that passes all tests
3. **Create Feature Documentation**: Add numbered documentation file in `features/` directory using template
4. **Update Main Documentation**: Update this README.md to reflect new capabilities
5. **Commit Code Properly**: Use standardized commit message template from `templates/git-commit-template.md`

### Problem-Solving Methodology
AIBO follows a 7-step structured approach:
1. **Understand**: Analyze requirements through git diff and project documentation
2. **Research Best Practices**: Search online for current standards and patterns
3. **Plan**: Break down into logical steps with potential pitfalls identified
4. **Execute**: Implement step-by-step with appropriate tools and SubAgents
5. **Verify**: Test and validate results at each critical step
6. **Recover**: Analyze issues, adjust strategy, and retry systematically  
7. **Deliver**: Provide complete solution with clear documentation

### Quality Standards
- **Code Quality**: Follow TypeScript best practices and maintain clean, readable code
- **Error Handling**: Implement comprehensive error recovery with user communication
- **Security**: Never run destructive commands without explicit confirmation
- **Documentation**: Maintain up-to-date documentation for all features