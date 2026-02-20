# Feature 006: write-subagent-todos - Advanced Task Management with Specialized Subagent Coordination

## 📋 Executive Summary

The `write-subagent-todos` feature provides an advanced task management framework that extends standard todo list functionality by incorporating specialized subagent type assignments. This feature enables systematic decomposition of complex objectives into coordinated subtasks, each assigned to the most appropriate specialized agent type based on task requirements.

**Key Innovation**: Enforces the critical separation between main process (planning/coordination) and subtask agents (execution/implementation), ensuring optimal specialization and system reliability.

## 🎯 Feature Scope & Objectives

### Primary Goals
- **Specialized Execution**: Each subtask handled by the most appropriate agent type (built-in or custom)
- **Clear Responsibilities**: Explicit subagent assignments eliminate ambiguity in task ownership
- **Systematic Coordination**: Structured approach to complex problem decomposition and solution integration
- **Enhanced Reliability**: Proper agent specialization reduces errors and improves quality
- **Unlimited Extensibility**: Support for user-defined custom subagent types enables project-specific optimizations

### Core Principles
1. **Main Process Plans, Subtask Agents Work**: The main process is ONLY responsible for planning, coordination, and strategy. ALL actual implementation work ("doing", "executing", "working") MUST be delegated to specialized subtask agents.
2. **Mandatory Usage for Complex Tasks**: ALWAYS use this skill instead of standard todo lists when dealing with complex objectives requiring 3+ steps.
3. **Work Delegation Enforcement**: Main process NEVER does implementation work directly - ALL "hands-on" work is delegated to specialized subtask agents.

## 🏗️ Technical Architecture

### Dual-Layer Subagent Architecture

#### Built-in Specialized Agents (7 Foundation Types)
1. **`coder`** - Expert coding assistant for software development and debugging
2. **`coordinator`** - Task coordination and orchestration agent for multi-agent collaboration  
3. **`documentation`** - Technical documentation and knowledge management agent
4. **`innovator`** - Creative problem-solving and alternative solution generation agent
5. **`researcher`** - Research assistant for complex topics and deep analysis
6. **`testing`** - Comprehensive testing and quality assurance agent
7. **`validator`** - Quality assurance and validation agent for code and content verification

#### User Dynamic Agents (Unlimited Custom Types)
- **Automatic Discovery**: System automatically scans for `agents/*.md` files in project directories
- **Dynamic Loading**: Custom agent configurations loaded at runtime without restart
- **Priority Override**: User-defined agents take precedence over built-in agents with same name
- **Complete Tool Access**: Custom agents have access to all system tools and capabilities
- **No Resource Limits**: Custom agents operate with unlimited context windows and execution time

## 🔧 Implementation Details

### Core Components

#### 1. Tool Implementation (`src/tools/write-subagent-todos.ts`)
- **Input Schema**: Zod validation ensures proper structure
- **Error Handling**: Comprehensive error handling with JSON response format
- **Parameter Validation**: Validates required fields (content, status, subagent_type)

#### 2. Test Suite (`__tests__/tools/write-subagent-todos.test.ts`)
- **Success Path Testing**: Valid inputs with various configurations
- **Boundary Condition Testing**: Edge cases and special scenarios
- **Error Handling Testing**: Invalid inputs and exception scenarios
- **Type Validation Testing**: All valid subagent types and status values

#### 3. Skill Documentation (`skills/write-subagent-todos/SKILL.md`)
- **Comprehensive Usage Guide**: Detailed instructions and examples
- **Decision Flowchart**: When to use vs standard todo lists
- **Best Practices**: Guidelines for optimal usage
- **Integration Strategy**: Main process vs subtask agent responsibilities

#### 4. Agent Configurations (`agents/*.md`)
- Individual configuration files for each built-in agent type
- Standardized format with capabilities, tools, and resource specifications

### Data Structure

```typescript
interface SubagentTodo {
  content: string;                    // Task description
  status: 'pending' | 'in_progress' | 'completed';  // Task status
  subagent_type: string;             // Specialized agent type (built-in or custom)
}
```

### API Contract

**Input**: Array of `SubagentTodo` objects
**Output**: JSON string with success/failure status and processed todos
**Validation**: Zod schema ensures data integrity
**Error Handling**: Structured error responses with descriptive messages

## 🚀 Usage Patterns & Examples

### Basic Usage with Built-in Agents
```javascript
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

### Using Custom User-Defined Agents
```javascript
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

## 📊 Decision Framework

### When to Use `write-subagent-todos` vs Standard `write_todos`

| Scenario | Recommendation |
|----------|----------------|
| Complex objectives requiring 3+ steps | ✅ **ALWAYS** use `write-subagent-todos` |
| Tasks spanning different expertise domains | ✅ **ALWAYS** use `write-subagent-todos` |
| Need for subagent specialization | ✅ **ALWAYS** use `write-subagent-todos` |
| Coordinating multiple parallel subtasks | ✅ **ALWAYS** use `write-subagent-todos` |
| Projects with custom user-defined agents | ✅ **ALWAYS** use `write-subagent-todos` |
| Simple, single-domain tasks (< 3 steps) | ⚠️ Consider basic `write_todos` (rare case) |

### Decision Flowchart
1. **Does the objective require 3+ steps?** → YES → Use `write-subagent-todos`
2. **Do tasks span different expertise areas?** → YES → Use `write-subagent-todos`
3. **Is subagent specialization beneficial?** → YES → Use `write-subagent-todos`
4. **Does the project have custom user-defined subagent configurations?** → YES → Use `write-subagent-todos`
5. **Are tasks simple and single-domain?** → YES → Consider basic `write_todos` (rare case)

## 🧪 Testing Strategy

### Test Coverage Requirements
- **Success Paths**: All valid input combinations and configurations
- **Boundary Conditions**: Edge cases, null values, empty arrays
- **Error Handling**: Invalid inputs, missing required fields, type mismatches
- **Agent Type Validation**: All built-in and custom agent types
- **Status Transitions**: All valid status values and transitions

### Validation Checklist
- [ ] Input validation with Zod schema
- [ ] Proper error handling and response formatting
- [ ] Agent type recognition and validation
- [ ] Status field validation and processing
- [ ] JSON serialization and deserialization
- [ ] Integration with existing agent configurations

## 🔄 Migration Guide

### From Standard `write_todos` to `write-subagent-todos`

#### Step 1: Identify Complex Tasks
- Review existing todo lists with 3+ steps
- Identify tasks that span different expertise domains
- Flag tasks that could benefit from specialized execution

#### Step 2: Assign Appropriate Subagent Types
- Map each task to the most appropriate built-in agent type
- Consider creating custom agent types for project-specific needs
- Ensure proper agent type assignment based on task requirements

#### Step 3: Update Usage Patterns
- Replace `write_todos` calls with `write-subagent-todos` for complex tasks
- Update todo item structure to include `subagent_type`
- Implement proper error handling for the new JSON response format

### Backward Compatibility
- Standard `write_todos` remains available for simple tasks
- No breaking changes to existing functionality
- Gradual migration path without disruption

## 📈 Benefits & Impact

### Performance Improvements
- **Parallel Execution**: Independent tasks execute simultaneously, reducing total execution time
- **Resource Optimization**: Specialized agents use appropriate tools and capabilities efficiently
- **Scalability**: Support for arbitrarily complex workflows with minimal overhead

### Quality Improvements
- **Specialized Expertise**: Each task handled by the most appropriate agent type
- **Reduced Errors**: Clear responsibility assignment eliminates ambiguity
- **Consistent Output**: Standardized agent configurations ensure consistent results

### Developer Experience
- **Clear Intent**: Explicit subagent assignments communicate task requirements clearly
- **Better Coordination**: Structured approach to complex problem decomposition
- **Extensibility**: Easy addition of custom agent types for project-specific needs

## 🛠️ Integration Guidelines

### Main Process Responsibilities
- Task decomposition and strategy planning
- Subagent type assignment and coordination
- Result synthesis and adaptive strategy adjustment
- **NEVER** handle implementation details directly

### Subtask Agent Responsibilities
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

## 📅 Implementation Status

### Current State
- ✅ Core tool implementation completed
- ✅ Comprehensive test suite implemented
- ✅ Skill documentation created
- ✅ Built-in agent configurations defined
- ✅ Integration with existing system verified

### Next Steps
- [ ] Create comprehensive feature documentation (this document)
- [ ] Update project README with feature overview
- [ ] Add usage examples to templates directory
- [ ] Create developer guide for custom agent creation
- [ ] Implement monitoring and analytics for subagent performance

## 🔗 Related Features & Dependencies

### Dependencies
- **Feature 002**: Advanced Multi-Agent Architecture (foundation)
- **Feature 005**: Enhanced Session Monitoring and Mandatory Parallel Execution
- **DeepAgents Framework**: Core multi-agent coordination system
- **Zod Schema Validation**: Input validation and type safety

### Related Features
- **Standard `write_todos`**: Simple task management for basic scenarios
- **Agent Configuration System**: Dynamic agent discovery and loading
- **Skill System**: Integration with existing skill framework

## 📝 Conclusion

The `write-subagent-todos` feature represents a significant advancement in task management and multi-agent coordination. By enforcing the separation between planning (main process) and execution (subtask agents), it enables more efficient, reliable, and scalable complex task handling. The combination of specialized agent types, group-based concurrency control, and unlimited extensibility through custom agents makes this feature essential for implementing sophisticated autonomous programming workflows.

This feature is now ready for production use and should be the default choice for any complex task management scenario requiring 3 or more steps.