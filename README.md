# AIBO - Advanced Multi-Agent Autonomous Programming AI Assistant

An advanced autonomous programming AI assistant powered by a sophisticated multi-agent architecture with specialized skills system, deep code intelligence, and full local filesystem access. Built with TypeScript, Jest, and DeepAgents.

## Features

- ✅ **Advanced Multi-Agent Architecture**: 7 specialized agent types (coder, coordinator, documentation, innovator, researcher, testing, validator) working in collaboration
- ✅ **Skills System Framework**: 15+ standardized skill modules providing reusable, domain-specific capabilities with progressive disclosure
- ✅ **Hybrid Code Intelligence**: Advanced code analysis combining LSP (semantic analysis) and Tree-sitter (syntax analysis) for deep code understanding with 60-90% token savings
- ✅ **Voice Input Integration**: Real-time voice input support using Tencent Cloud's official ASR service with microphone audio capture and speech-to-text conversion
- ✅ **Advanced Autonomous Programming**: Write, edit, debug, and optimize code across any language with intelligent context awareness
- ✅ **SubAgent Delegation**: Spawn specialized SubAgents for complex, isolated tasks with parallel execution and coordinated results
- ✅ **Error Recovery & Retry Strategy**: Systematic error analysis, strategy adjustment, and fallback plans with graceful degradation
- ✅ **Full System Access**: Complete read/write access to local filesystem and terminal commands with safety-first design
- ✅ **Enhanced Web Tools**: Puppeteer-based WebSearch and WebFetch tools with proper error handling, resource management, and anti-bot bypass capabilities
- ✅ **Bilingual System Prompt**: Full English and Chinese support with comprehensive methodology and cultural context
- ✅ **Interactive Chat Mode**: Real-time interactive mode with command shortcuts, session management, and voice input support
- ✅ **Comprehensive Testing**: 86.5%+ test coverage with unit, integration, and edge case testing across all modules
- ✅ **Problem-Solving Methodology**: 7-step structured approach including research best practices and multi-agent collaboration
- ✅ **Feature Development Workflow**: Strict workflow ensuring quality with documentation and proper commits
- ✅ **Enhanced Startup Documentation Reading**: Automatically reads README.md and features/*.md at startup to understand project architecture and capabilities
- ✅ **Mandatory Technical Proposal Approval**: Requires user approval for all technical implementations after comprehensive research
- ✅ **Filesystem Access Optimization**: Strategic guidance to avoid reading unnecessary directories (dist, node_modules, __tests__, coverage) to minimize token consumption and improve performance
- ✅ **Mandatory Hybrid Code Reader Usage**: **ALWAYS** use the hybrid_code_reader tool for code analysis tasks - this is a non-negotiable requirement that must be followed without exception. Direct file reading should only be used as a last resort when hybrid_code_reader cannot provide the required information.
- ✅ **AI Thinking Capability**: Enhanced reasoning and problem-solving through enabled thinking mode in all AI Agent interactions
- ✅ **Tencent Cloud WSA Web Search**: Default integrated web search functionality using Tencent Cloud's official WSA (Web Search API) service based on Sogou search's public web resources. Provides structured search results with titles, summaries, URLs, and publication dates. Automatically available when Tencent Cloud credentials are configured.
- ✅ **Safe Filesystem Backend**: Security-first file system operations with validation and protection against accidental destructive operations

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

# Tencent Cloud ASR and WSA Configuration
TENCENTCLOUD_APP_ID=your-app-id          # Required for voice input and web search
TENCENTCLOUD_SECRET_ID=your-secret-id    # Required for voice input and web search
TENCENTCLOUD_SECRET_KEY=your-secret-key  # Required for voice input and web search
TENCENTCLOUD_REGION=ap-shanghai          # Optional, default: ap-shanghai
```

## Project Structure

```
aibo/
├── src/                    # Source code directory (completely refactored with multi-agent architecture)
│   ├── core/               # Core application infrastructure
│   │   ├── agent/          # Multi-agent system (NEW - 7 specialized agent types)
│   │   ├── config/         # Configuration management
│   │   ├── session/        # Session and graceful shutdown management
│   │   └── utils/          # Core utilities
│   ├── features/           # Feature-specific modules
│   │   ├── voice-input/    # Voice input integration (NEW - Tencent Cloud ASR)
│   │   └── ...             # Other feature modules
│   ├── infrastructure/     # External service integrations (MAJOR REFACTOR)
│   │   ├── agents/         # Agent loading and management (NEW)
│   │   ├── audio/          # Audio recording and processing (NEW)
│   │   ├── browser/        # Puppeteer-based web tools
│   │   ├── code-analysis/  # Hybrid code intelligence (NEW - LSP + Tree-sitter)
│   │   ├── filesystem/     # Safe filesystem operations (NEW - security-first)
│   │   └── tencent-cloud/  # Tencent Cloud services (ASR + WSA)
│   ├── presentation/       # User interface and interaction layer
│   │   ├── console/        # Console command handlers and interactive mode
│   │   └── styling/        # Output styling and formatting
│   └── shared/             # Shared utilities and types
│       ├── constants/      # System prompts and constants
│       └── utils/          # Shared utility functions
├── skills/                 # Skills system framework (NEW - 15+ standardized skill modules)
├── agents/                 # Agent definitions (NEW - 7 specialized agent types)
├── __tests__/              # Comprehensive test suite
├── features/               # Feature documentation (numbered sequentially)
├── templates/              # Documentation templates
├── .env                    # Environment variables (gitignored)
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── jest.config.ts          # Jest configuration
└── README.md               # Project documentation
```

### Key Architectural Changes

- **Multi-Agent Architecture**: Introduced 7 specialized agent types for different domains
- **Skills System**: Added standardized skill modules with progressive disclosure pattern
- **Hybrid Code Analysis**: Combined LSP and Tree-sitter for deep code intelligence
- **Voice Input Support**: Integrated Tencent Cloud ASR for real-time voice commands
- **Safe Filesystem Operations**: Security-first approach to file system access
- **Modular Infrastructure**: Complete reorganization of external service integrations

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
- **Minimum Coverage**: 85% overall test coverage (statement, branch, function, and line)
- **Current Coverage**: 86.55% statements, 72.65% branches, 83.09% functions, 86.64% lines
- **Test Types**: Unit tests, integration tests, and edge case scenarios
- **Validation**: All new features must pass comprehensive test suite before acceptance

### Git Hooks
- **Pre-commit Hook**: Automatically validates that test coverage is at least 85% before allowing commits
- **Post-commit Hook**: Automatically pushes successful commits to the remote repository
- **Build Validation**: Ensures TypeScript compilation succeeds before commit
- **Coverage Check**: Runs `npm run test:coverage` and validates threshold using custom script

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
