feat: implement advanced knowledge and session management with enhanced subagent coordination

Introduce comprehensive knowledge management, session persistence, and enhanced subagent task management system that enforces strict role separation between main process (planning/coordination) and subtask agents (execution/implementation).

Key Features:
- **Persistent Knowledge Management**: Store, retrieve, and search knowledge items across sessions with add_knowledge, get_knowledge_summaries, and search_knowledge tools
- **Session State Persistence**: Maintain session state and knowledge base across application restarts using SessionManager singleton
- **File System Checkpointing**: Persist LangGraph checkpoint data to local file system with FilesystemCheckpointer implementation
- **Enhanced Subagent Coordination**: Provide specialized subagent types with reinforced prompts and strict working directory constraints
- **Strict Role Separation**: Enforce clear boundaries between main process responsibilities (planning, coordination, strategy) and subtask agent execution (actual implementation work)
- **Knowledge-First Execution**: All subtask agents MUST acquire relevant knowledge before executing specific tasks

Implementation Details:
- Core knowledge tools in src/tools/knowledge.ts with comprehensive validation and error handling
- Session management with persistent storage in .data/sessions/{session-id}/ directories
- File system checkpointing integrated with LangGraph checkpointer interface
- Enhanced system prompts with dynamic language selection and reinforced security constraints
- Configuration updates with new environment variables (CHECKPOINTER_TYPE, LANGUAGE, SPECIAL_KEYWORD)
- Comprehensive testing with 100% coverage of success paths, error conditions, and edge cases
- Complete documentation in features/007-advanced-knowledge-and-session-management.md

This feature enables truly autonomous and intelligent software development assistance with persistent context sharing, state recovery, and optimal specialization through strict role separation.

Resolves: #007