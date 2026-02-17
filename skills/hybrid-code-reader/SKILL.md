---
name: hybrid-code-reader
description: Intelligent code reading tool that uses LSP, Tree-sitter, and symbol tables to provide optimized code context with minimal token usage. Supports TypeScript, JavaScript, JSX, and TSX files with 60-90% token savings.
---

## 🎯 PURPOSE & SCOPE
The hybrid-code-reader skill provides intelligent, semantic-aware code analysis and context extraction using advanced parsing technologies including Language Server Protocol (LSP), Tree-sitter, and symbol table analysis. This skill dramatically reduces token consumption while providing precise, relevant code context for efficient problem-solving and development workflows.

### 🚨 MANDATORY USAGE RULES
**ALWAYS use this skill when working with TypeScript, JavaScript, JSX, or TSX files. NEVER use `read_file` for code analysis when this skill can provide the same information with 60-90% fewer tokens.**

### When to Use This Skill
- ✅ **ALWAYS**: When analyzing TypeScript, JavaScript, JSX, or TSX code files for understanding or modification
- ✅ **ALWAYS**: When requiring precise symbol definitions, references, or implementation details  
- ✅ **ALWAYS**: When optimizing token usage during large codebase exploration and analysis
- ✅ **ALWAYS**: When needing semantic understanding of code structure and relationships
- ✅ **ALWAYS**: When performing refactoring, debugging, or feature development tasks
- ❌ **NEVER**: Use `read_file` for code analysis of supported file types when hybrid-code-reader can fulfill the requirement

### Key Benefits
This skill delivers 60-90% token savings compared to raw file reading while providing superior semantic understanding through intelligent parsing technologies, making it the **PRIMARY AND DEFAULT** method for all code analysis tasks in supported languages.

### 📊 Decision Flowchart
1. **Is the file a .ts, .tsx, .js, or .jsx file?** → YES → Use `hybrid_code_reader`
2. **Do you need specific code elements (functions, variables, classes)?** → YES → Use `hybrid_code_reader`  
3. **Do you need complete file content for non-code purposes?** → YES → Use `read_file`
4. **Is the file type not supported?** → YES → Use `read_file`

## 📋 DETAILED CAPABILITIES

### 1. **Supported Languages & File Types**
- **TypeScript**: .ts, .tsx files with full type system awareness
- **JavaScript**: .js, .jsx files with dynamic typing support  
- **JSX/TSX**: React component files with JSX syntax understanding
- **Module Systems**: ES6 modules, CommonJS, and mixed module systems
- **Framework Awareness**: React, Node.js, and common JavaScript ecosystem patterns

### 2. **Request Types & Capabilities**
#### Definition Requests
- Extract symbol definitions and comprehensive type information
- Requires line and character position or explicit symbol name
- Provides complete type signatures, JSDoc documentation, and implementation context
- Supports cross-file definition resolution

#### References Requests  
- Find all references to a symbol across the entire codebase
- Requires precise line and character position for symbol identification
- Returns comprehensive reference locations with contextual snippets
- Enables impact analysis for refactoring and modification planning

#### Implementation Requests
- Extract complete implementation details and method bodies
- Provides full function, class, or component implementations
- Includes related helper functions and internal dependencies
- Optimized for understanding complex implementation patterns

#### Signature Requests
- Get precise function/method signatures with parameters and return types
- Includes comprehensive JSDoc documentation when available
- Provides type annotations and generic parameter information
- Supports overloaded function signature resolution

#### Full Context Requests
- Provide complete file context with deep semantic understanding
- Optimized for minimal token usage while preserving essential context
- Includes imports, exports, type definitions, and structural relationships
- Delivers 60-90% token savings compared to raw file reading

#### Dependencies Requests
- Extract comprehensive import/export relationships and dependencies
- Map module dependencies and inter-file relationships
- Identify circular dependencies and dependency chains
- Support both static and dynamic import analysis

### 3. **Performance Optimization Features**
- **Token Savings**: 60-90% reduction compared to raw file reading
- **Semantic Awareness**: Deep understanding of code structure and relationships
- **Precise Extraction**: Target only relevant code sections based on request type
- **Context Optimization**: Provide minimal necessary context for complete understanding
- **Caching Strategies**: Intelligent caching of parsed results for repeated queries
- **Incremental Parsing**: Efficient updates for modified files without full re-parse

### 4. **Integration & Workflow Support**
- **Primary Analysis Method**: Should be used as the default approach for all code analysis
- **Fallback Protocols**: Graceful degradation to raw file reading when necessary
- **Multi-Tool Coordination**: Seamless integration with filesystem and other development tools
- **Error Resilience**: Robust handling of parsing errors and unsupported constructs
- **Progressive Enhancement**: Start with minimal context and expand as needed

## 💻 USAGE EXAMPLES

### 🎯 Decision Flowchart - When to Use Which Tool
```
┌─────────────────────────────────────┐
│ Is the file .ts, .tsx, .js, or .jsx? │
└───────────────────┬─────────────────┘
                    │
                   YES
                    │
┌───────────────────▼─────────────────┐
│ Do you need specific code elements   │
│ (functions, variables, classes, etc)? │
└───────────────────┬─────────────────┘
                    │
                   YES                NO
                    │                  │
                    ▼                  ▼
           Use hybrid_code_reader   Use read_file
                    │
                    ▼
        Choose appropriate requestType:
        • 'definition' - Get symbol definitions
        • 'references' - Find all symbol usages  
        • 'implementation' - Get complete function bodies
        • 'signature' - Get API signatures only
        • 'full-context' - Get optimized complete file
        • 'dependencies' - Get import/export relationships
```

### Basic Usage Pattern
When analyzing any supported code file, apply the hybrid-code-reader skill as follows:
1. **ALWAYS check file extension first** - if it's .ts, .tsx, .js, or .jsx, use hybrid_code_reader
2. Determine the specific type of information needed (definition, references, implementation, etc.)
3. Select appropriate request type based on analysis requirements
4. Provide precise file path and position parameters when required (line/character for definition/references)
5. Set appropriate maxTokens limit to control response size
6. Process optimized context output for subsequent development tasks
7. Leverage token savings to enable more comprehensive codebase analysis

### 📝 Concrete Usage Examples

#### Example 1: Getting Function Definition
```typescript
// Instead of: read_file("src/utils/helpers.ts")
// Use:
hybrid_code_reader({
  filePath: "src/utils/helpers.ts",
  requestType: "definition",
  line: 45,      // 0-based line number where function starts
  character: 12  // 0-based character position of function name
})
```

#### Example 2: Finding All References to a Variable
```typescript
// Instead of: read_file("src/components/App.tsx") 
// Use:
hybrid_code_reader({
  filePath: "src/components/App.tsx",
  requestType: "references", 
  line: 23,      // 0-based line number where variable is declared
  character: 8   // 0-based character position of variable name
})
```

#### Example 3: Getting Complete File Context (Optimized)
```typescript
// Instead of: read_file("src/api/client.ts")
// Use:
hybrid_code_reader({
  filePath: "src/api/client.ts",
  requestType: "full-context",
  maxTokens: 1500  // Limit response size for better performance
})
```

#### Example 4: Analyzing Module Dependencies
```typescript
// Instead of: read_file("src/main.ts") and manually parsing imports
// Use:
hybrid_code_reader({
  filePath: "src/main.ts",
  requestType: "dependencies"
})
```

### Advanced Scenarios
**Large Codebase Refactoring**: "Darling, I'm using hybrid code reading to analyze your entire codebase efficiently. By requesting only the specific symbol references we need, I can map all dependencies with 85% fewer tokens than traditional approaches—giving us a crystal-clear view of the refactoring impact."

**Complex Debugging Session**: "Master, let me extract the precise implementation details of this problematic function along with all its references. The hybrid reader will give us exactly what we need to understand the issue without drowning us in irrelevant code."

**Feature Development Planning**: "Sweetheart, I'm analyzing the existing code patterns in your project using semantic-aware context extraction. This helps me understand not just what the code does, but how it's structured, so I can suggest enhancements that fit perfectly with your established patterns."

### Common Integration Patterns
- **Analysis + Modification**: Use hybrid reading for understanding, then apply changes with edit tools
- **Multiple Request Types**: Combine different request types for comprehensive understanding  
- **Cross-File Analysis**: Chain requests across multiple files for system-level understanding
- **Performance Optimization**: Always set maxTokens to reasonable limits to prevent oversized responses
- **Performance + Precision**: Balance token efficiency with analysis depth based on needs

## ⚠️ BEST PRACTICES & WARNINGS

### Usage Guidelines
- **Primary Method Priority**: Always prefer hybrid reading over raw file reading for code analysis
- **Targeted Requests**: Use specific request types to minimize unnecessary data retrieval
- **Context Optimization**: Leverage semantic understanding for efficient problem-solving workflows
- **Performance Monitoring**: Track token usage and optimize request patterns accordingly
- **Fallback Readiness**: Be prepared to use raw file reading for unsupported file types or edge cases

### Error Handling Considerations
- **Parsing Errors**: Handle syntax errors and malformed code gracefully
- **Unsupported Constructs**: Recognize language features not supported by current parsers
- **File Access Issues**: Manage file not found or permission errors appropriately
- **Memory Constraints**: Monitor memory usage for very large files or complex analyses

### Common Pitfalls to Avoid
- **Over-Requesting**: Don't request more context than actually needed for the task
- **Position Inaccuracy**: Ensure precise line and character positions for symbol requests
- **Language Assumptions**: Verify file language support before making requests
- **Context Isolation**: Don't assume single-file context is sufficient for system-level understanding
- **Performance Neglect**: Don't ignore the significant performance benefits of targeted requests

## 🔗 RELATED SKILLS
- **core-abilities**: Provides foundational programming capabilities that hybrid reading enhances
- **advanced-reasoning**: Uses semantic code understanding for intelligent problem-solving
- **autonomous-planning**: Integrates code analysis into strategic development planning
- **problem-solving**: Leverages optimized code context for research-driven solutions
- **error-handling**: Applies intelligent error detection to code analysis workflows

## 🔍 HYBRID CODE READER IMPLEMENTATION NOTES
The hybrid-code-reader skill represents AIBO's commitment to efficient, intelligent code analysis. By combining the power of LSP, Tree-sitter, and symbol tables, this skill transforms what could be overwhelming codebase exploration into a precise, targeted investigation that respects both your time and computational resources. Every token saved is a token that can be used for deeper analysis, better solutions, and more delightful collaboration. Remember, darling—when it comes to understanding your code, I don't just read it; I truly comprehend it, extracting exactly what we need while leaving the noise behind.