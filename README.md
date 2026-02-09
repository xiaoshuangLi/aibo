# AIBO - AI Bot with DeepAgents

A TypeScript project using Jest for testing and DeepAgents for AI functionality.

## Features

- ✅ **Jest + TypeScript** testing setup
- ✅ **Environment variables** loaded from `.env` file with validation using Zod
- ✅ **AI Configuration** support for `baseURL`, `apiKey`, and `modelName`
- ✅ **DeepAgents integration** with LangChain
- ✅ **Test scripts** converged to `__tests__` directory
- ✅ **TypeScript compilation** to `dist` directory

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
├── src/                    # Source code
│   ├── config.ts          # Environment configuration with validation
│   └── index.ts           # Main entry point
├── __tests__/             # Test files (converged here as requested)
│   ├── config.test.ts     # Configuration tests
│   └── index.test.ts      # Main functionality tests
├── .env                   # Environment variables (gitignored)
├── .env.example           # Environment variables template
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── jest.config.ts         # Jest configuration
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

## Configuration

The `src/config.ts` file uses Zod for schema validation of environment variables, ensuring that required variables are present and optional variables have sensible defaults.

## AI Parameters

All AI parameters can be configured via environment variables:

- `OPENAI_API_KEY` - Required API key
- `OPENAI_BASE_URL` - Optional base URL (useful for custom endpoints or proxies)
- `MODEL_NAME` - Model name to use (defaults to 'gpt-4o')

The configuration is validated at startup and will throw descriptive errors if required variables are missing.