feat: implement write-subagent-todos advanced task management

Introduce the write-subagent-todos tool that provides sophisticated task management with specialized subagent type assignments and group-based concurrency control.

Key Features:
- **Specialized Subagent Assignment**: Each task assigned to appropriate agent type (coder, researcher, validator, testing, documentation, coordinator, innovator)
- **Group-Based Concurrency Control**: Precise parallel execution using concurrent_group parameter (null = sequential, number = concurrent group)
- **Mandatory Parallel Execution**: Enforces efficient processing of independent subtasks for complex objectives (3+ steps)
- **Dual-Layer Architecture**: Supports both built-in agents and unlimited user-defined custom agents
- **Enhanced System Prompts**: Reinforced prompts with strict working directory constraints and role definitions
- **Comprehensive Testing**: 11/11 tests passing with full coverage of success paths, error conditions, and edge cases

Implementation Details:
- Core tool implementation in src/tools/write-subagent-todos.ts
- Agent loader enhancements for automatic discovery of user agent configurations
- Subagent prompt template system with reinforced security constraints
- Built-in agent configurations for all 7 specialized agent types
- Complete integration with existing AIBO architecture
- Comprehensive documentation in skills/write-subagent-todos/SKILL.md
- Feature specification in features/006-write-subagent-todos-advanced-task-management.md
- Updated README with new feature description

This feature enforces the critical separation between main process responsibilities (planning, coordination, strategy) and subtask agent execution (actual implementation work), ensuring optimal specialization, parallel execution, and system reliability.

Resolves: #006