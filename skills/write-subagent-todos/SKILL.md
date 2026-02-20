---
name: write-subagent-todos
description: Advanced task management skill that creates structured todo lists with specialized subagent type assignments for complex multi-step objectives, supporting both built-in agent types and unlimited user-dynamic configurations for systematic coordination and parallel execution.
keywords: ["规划任务", "任务分解", "并行执行", "子代理协调", "智能调度"]
---

## 🎯 PURPOSE & SCOPE

The write-subagent-todos skill provides an enhanced task management framework that extends standard todo list functionality by incorporating specialized subagent type assignments. This skill enables systematic decomposition of complex objectives into coordinated, parallelizable subtasks, each assigned to the most appropriate specialized agent type based on the task requirements.

The skill supports a **dual-layer subagent architecture**:
- **Built-in Specialized Agents**: 7 foundation agent types for common development tasks
- **User Dynamic Agents**: Unlimited custom agent types defined through user configuration files

This architecture ensures immediate usability while providing unlimited extensibility for project-specific workflows and specialized capabilities.

### 🚨 MANDATORY USAGE RULES

**ALWAYS use this skill instead of standard todo lists when dealing with complex objectives requiring 3+ steps. NEVER use basic `write_todos` when `write-subagent-todos` can provide specialized subagent assignments for better task coordination and execution efficiency.**

### 🎯 CORE PRINCIPLE: MAIN PROCESS PLANS, SUBTASK AGENTS WORK

**The main process is ONLY responsible for planning, coordination, and strategy. ALL actual implementation work ("doing", "executing", "working") MUST be delegated to specialized subtask agents. This ensures optimal specialization, parallel execution, and system reliability.**

### When to Use This Skill

- ✅ **ALWAYS**: When creating todo lists for complex objectives requiring 3 or more distinct steps
- ✅ **ALWAYS**: When tasks involve different expertise domains (coding, research, validation, documentation, etc.)
- ✅ **ALWAYS**: When you need to ensure proper subagent specialization for optimal task execution
- ✅ **ALWAYS**: When coordinating multiple parallel subtasks with clear responsibility assignments
- ✅ **ALWAYS**: When implementing the main process vs subtask agent execution strategy
- ✅ **ALWAYS**: When working with projects that have custom user-defined subagent configurations
- ✅ **ALWAYS**: When you need to leverage specialized capabilities beyond the 7 built-in agent types
- ❌ **NEVER**: Use basic `write_todos` for complex multi-step tasks when subagent specialization is beneficial

### Key Benefits

This skill ensures strict adherence to the main process vs subtask agent roles by providing explicit subagent type assignments, enabling:
- **Specialized Execution**: Each subtask is handled by the most appropriate agent type (built-in or custom) - **SUBTASK AGENTS DO THE ACTUAL WORK**
- **Parallel Processing**: Independent subtasks can execute simultaneously for maximum efficiency  - **MAXIMIZE CONCURRENT "DOING" NOT SEQUENTIAL "WAITING"**
- **Clear Responsibilities**: Explicit subagent assignments eliminate ambiguity in task ownership - **MAIN PROCESS PLANS, SUBTASK AGENTS EXECUTE**
- **Systematic Coordination**: Structured approach to complex problem decomposition and solution integration
- **Enhanced Reliability**: Proper agent specialization reduces errors and improves quality - **RIGHT AGENT FOR RIGHT "JOB"**
- **Unlimited Extensibility**: Support for user-defined custom subagent types enables project-specific optimizations
- **Dynamic Discovery**: Automatic detection and loading of user agent configurations from project directories
- **Priority-Based Selection**: User-configured agents take precedence over built-in agents when available
- **WORK DELEGATION ENFORCEMENT**: Main process NEVER does implementation work directly - **ALL "HANDS-ON" WORK IS DELEGATED TO SPECIALIZED SUBTASK AGENTS**

### 📊 Decision Flowchart

1. **Does the objective require 3+ steps?** → YES → Use `write-subagent-todos`
2. **Do tasks span different expertise areas?** → YES → Use `write-subagent-todos`
3. **Is subagent specialization beneficial?** → YES → Use `write-subagent-todos`
4. **Does the project have custom user-defined subagent configurations?** → YES → Use `write-subagent-todos`
5. **Are tasks simple and single-domain?** → YES → Consider basic `write_todos` (rare case)

## 📋 DETAILED CAPABILITIES

### User Dynamic Subagent Configuration

The write-subagent-todos skill fully supports user-defined custom subagent types through dynamic configuration:

**Configuration File Format:**
```markdown
<!-- agents/custom-agent-name.md -->
/**
 * @name Custom Agent Name
 * @type custom
 * @capabilities ["capability1", "capability2", "capability3"]
 * @tools ["*"]  <!-- Use all available tools -->
 * @skills ["*"]  <!-- Use all available skills -->
 * @context_window unlimited  <!-- No context limitations -->
 * @timeout unlimited        <!-- No time restrictions -->
 */
```

**Key Features:**
- **Automatic Discovery**: System automatically scans for `agents/*.md` files in project directories
- **Dynamic Loading**: Custom agent configurations are loaded at runtime without restart
- **Priority Override**: User-defined agents take precedence over built-in agents with same name
- **Unlimited Extensibility**: Create any number of custom agent types for specialized workflows
- **Complete Tool Access**: Custom agents have access to all system tools and capabilities
- **No Resource Limits**: Custom agents operate with unlimited context windows and execution time

### Built-in Specialized Agent Types

The skill provides 7 foundation agent types optimized for common development scenarios:

1. **`coder`** - Expert coding assistant for software development and debugging
2. **`coordinator`** - Task coordination and orchestration agent for multi-agent collaboration  
3. **`documentation`** - Technical documentation and knowledge management agent
4. **`innovator`** - Creative problem-solving and alternative solution generation agent
5. **`researcher`** - Research assistant for complex topics and deep analysis
6. **`testing`** - Comprehensive testing and quality assurance agent
7. **`validator`** - Quality assurance and validation agent for code and content verification

### Usage Examples

#### Basic Usage with Built-in Agents
```javascript
// Create todo list with specialized subagent assignments
await write-subagent-todos({
  todos: [
    {
      content: "Research best practices for authentication",
      status: "pending",
      subagent_type: "researcher"
    },
    {
      content: "Implement authentication service",
      status: "pending", 
      subagent_type: "coder"
    },
    {
      content: "Write API documentation",
      status: "pending",
      subagent_type: "documentation"
    }
  ]
});
```

#### Using Custom User-Defined Agents
```javascript
// Leverage project-specific custom agents
await write-subagent-todos({
  todos: [
    {
      content: "Analyze security vulnerabilities",
      status: "pending",
      subagent_type: "security-analyst" // Custom user-defined agent
    },
    {
      content: "Optimize database performance",
      status: "pending", 
      subagent_type: "db-optimizer" // Custom user-defined agent
    }
  ]
});
```

### Integration with Main Process Strategy

This skill enforces the critical separation between main process responsibilities and subtask agent execution:

**Main Process (YOU) Responsibilities:**
- Task decomposition and strategy planning
- Subagent type assignment and coordination
- Result synthesis and adaptive strategy adjustment
- **NEVER** handle implementation details directly

**Subtask Agent Responsibilities:**
- Handle all implementation details within assigned scope
- Execute specialized operations (coding, research, validation, etc.)
- Return structured results for main process integration
- Operate with unlimited resources and complete autonomy

### Best Practices

1. **Always Specify Subagent Types**: Never leave `subagent_type` unspecified for complex tasks
2. **Use Concurrency Groups Strategically**: Group independent tasks that can execute in parallel
3. **Leverage Custom Agents**: Create user-defined agents for project-specific workflows
4. **Follow Main Process Rules**: Never implement directly - always delegate via subagents
5. **Plan for Parallel Execution**: Design todo lists to maximize concurrent processing
6. **Validate Agent Selection**: Choose the most appropriate agent type for each task domain
7. **Monitor and Adapt**: Track subagent performance and adjust strategies as needed

This skill is essential for implementing the systematic, parallel, and specialized approach required for complex autonomous programming tasks while maintaining strict adherence to the main process vs subtask agent role separation principle.