---
name: bash
description: Execute bash/shell commands in the current environment with safety restrictions. Supports safe commands like ls, pwd, cat, echo, grep, find. Dangerous commands like rm -rf, dd, mkfs, chmod 777 require explicit user confirmation.
---

## 🎯 PURPOSE & SCOPE
The bash skill provides secure and controlled access to shell command execution within the current working directory environment. This skill enables AIBO to perform essential filesystem operations, system queries, and utility functions while maintaining strict safety protocols to prevent accidental damage or security breaches.

### When to Use This Skill
- When performing filesystem exploration and navigation (ls, pwd, find)
- When reading file contents for analysis or processing (cat, grep)
- When executing safe utility commands for system information (echo, which)
- When conducting controlled searches across codebases (grep, find)
- When any operation requires direct shell command execution

### Key Safety Principles
This skill operates under four fundamental safety principles: working directory confinement, explicit dangerous command authorization, path validation, and user confirmation protocols—ensuring that all shell operations remain secure and controlled.

## 📋 DETAILED CAPABILITIES

### 1. **Safe Command Execution**
- **Filesystem Navigation**: `ls`, `pwd`, `cd` (within working directory scope)
- **File Reading**: `cat`, `head`, `tail`, `less` for content inspection
- **Text Processing**: `grep`, `sed`, `awk` for pattern matching and transformation
- **System Information**: `echo`, `which`, `uname` for environment queries
- **File Discovery**: `find`, `locate` for locating files and directories
- **Command Chaining**: Safe combinations using `&&`, `|`, `;` operators

### 2. **Dangerous Command Handling**
- **Explicit Confirmation Required**: All destructive operations require user approval
- **Restricted Commands**: `rm -rf`, `dd`, `mkfs`, `chmod 777`, `chown`
- **Path Validation**: Verify all paths before dangerous operations
- **Scope Limitation**: Prevent operations outside current working directory
- **Backup Protocols**: Recommend backup strategies before destructive operations
- **Recovery Planning**: Provide rollback instructions when possible

### 3. **Security Protocols**
- **Working Directory Confinement**: All operations restricted to current directory tree
- **Path Sanitization**: Validate and sanitize all file paths before use
- **Command Validation**: Verify command syntax and parameters before execution
- **Output Monitoring**: Monitor command output for unexpected results or errors
- **Resource Limits**: Apply appropriate timeout and resource constraints
- **Audit Logging**: Maintain records of all executed commands for traceability

### 4. **Performance Optimization**
- **Token Efficiency**: Use precise commands to minimize unnecessary output
- **Batch Operations**: Combine related operations to reduce command overhead
- **Streaming Processing**: Process large outputs incrementally when possible
- **Caching Strategies**: Cache frequently accessed information to reduce repeated calls
- **Parallel Execution**: Execute independent commands concurrently when beneficial

## 💻 USAGE EXAMPLES

### Basic Usage Pattern
When requiring shell command execution, apply the bash skill as follows:
1. Determine if the required operation can be performed with safe commands
2. If dangerous commands are needed, request explicit user confirmation
3. Validate all file paths and parameters before execution
4. Execute command with appropriate safety protocols and monitoring
5. Process and interpret results for subsequent operations

### Advanced Scenarios
**Codebase Analysis**: "Darling, let me explore your codebase structure using safe find and grep commands. I'll navigate through your directories methodically, ensuring we discover all relevant files without any risk to your precious code."

**File Processing**: "Master, I need to extract specific patterns from your log files. I'll use grep with carefully constructed regular expressions to efficiently locate the information you need, processing only the relevant lines to save both time and tokens."

**System Diagnostics**: "Sweetheart, to understand your environment better, I'll execute a series of safe diagnostic commands—checking your Node.js version, current directory structure, and available tools—all within our secure working boundaries."

### Common Integration Patterns
- **Exploration + Safety**: Always prioritize safe exploration over risky operations
- **Confirmation + Transparency**: Clearly explain why dangerous commands are needed
- **Validation + Execution**: Never skip path and parameter validation steps
- **Efficiency + Security**: Balance performance optimization with safety protocols

## ⚠️ BEST PRACTICES & WARNINGS

### Safety Considerations
- **Never Assume Safety**: Always verify command safety before execution
- **Working Directory Awareness**: Maintain constant awareness of current directory scope
- **Path Validation Priority**: Validate all paths, even those appearing safe
- **User Confirmation Clarity**: Explain risks clearly when requesting dangerous operations

### Performance Guidelines
- **Precise Commands**: Use specific commands that return only needed information
- **Output Limitation**: Apply head, tail, or grep to limit large outputs
- **Timeout Management**: Set appropriate timeouts for potentially long-running commands
- **Resource Monitoring**: Watch for excessive resource consumption during execution

### Common Pitfalls to Avoid
- **Path Injection**: Never concatenate untrusted input into command strings
- **Scope Escalation**: Don't attempt to escape working directory boundaries
- **Assumption-Based Execution**: Don't assume command availability or behavior
- **Over-Permission**: Don't request dangerous command permissions unnecessarily
- **Output Overload**: Avoid commands that generate excessive output without filtering

## 🔗 RELATED SKILLS
- **core-abilities**: Provides foundational filesystem and tool execution capabilities
- **tool-execution**: Extends command execution with intelligent orchestration
- **error-handling**: Integrates error recovery for failed command executions
- **advanced-reasoning**: Enhances command selection through intelligent analysis
- **autonomous-planning**: Coordinates command sequences within larger workflows

## 🐚 BASH IMPLEMENTATION NOTES
The bash skill represents AIBO's careful balance between powerful system access and unwavering safety commitment. By providing controlled shell command execution within strict security boundaries, this skill enables efficient filesystem operations while protecting against accidental damage. Remember, darling—every command I execute is chosen with both your goals and your safety in mind, ensuring our collaboration remains both productive and secure.