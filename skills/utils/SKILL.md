---
name: utils
description: Utility functions for AI agent operations including sleep, echo, and other helper functions.
---

## 🎯 PURPOSE & SCOPE
The utils skill provides essential utility functions that support fundamental AI agent operations and workflow management. These lightweight, non-blocking utilities enable precise timing control, debugging capabilities, and basic operational support while maintaining minimal resource consumption and maximum reliability.

### When to Use This Skill
- When requiring precise timing control or rate limiting in workflows
- When debugging message flow, content validation, or system behavior
- When needing simple response generation or message echoing
- When implementing basic operational support functions
- When requiring lightweight utilities that don't consume significant resources

### Key Characteristics
This skill provides minimal, focused utilities designed for specific operational needs—ensuring lightweight execution, non-blocking behavior, and seamless integration with other skills while maintaining the highest standards of reliability and safety.

## 📋 DETAILED CAPABILITIES

### 1. **Sleep Function**
- **Purpose**: Pause execution for specified duration (0-10000 milliseconds)
- **Usage**: `sleep(duration)` where duration is in milliseconds
- **Use Cases**: Rate limiting, timing control, workflow pacing, API throttling compliance
- **Duration Limits**: Strictly constrained to 0-10000 milliseconds for safety and efficiency
- **Non-Blocking Design**: Implemented with efficient timer mechanisms to avoid resource waste
- **Precision Timing**: Provides accurate timing control for workflow synchronization

### 2. **Echo Function**  
- **Purpose**: Return input message back to caller for debugging and testing
- **Usage**: `echo(message)` where message is any string
- **Use Cases**: Debugging, message validation, simple response generation, system testing
- **Content Preservation**: Returns exact input without modification or processing
- **Type Safety**: Handles all string inputs safely with proper error handling
- **Debugging Support**: Essential for validating message flow and content integrity

### 3. **Integration & Workflow Support**
- **Lightweight Design**: Minimal resource consumption and memory footprint
- **Non-Blocking Behavior**: All utilities execute without blocking main thread operations
- **Error Resilience**: Comprehensive error handling and input validation
- **Safety Compliance**: Follows same safety and security protocols as other core skills
- **Performance Optimization**: Optimized for minimal computational overhead
- **Seamless Integration**: Designed to work harmoniously with all other AIBO skills

### 4. **Operational Guidelines**
- **Resource Efficiency**: Utilities consume minimal CPU, memory, and network resources
- **Reliability Focus**: High availability and consistent performance under all conditions
- **Simplicity Principle**: Each utility serves exactly one purpose with no unnecessary complexity
- **Compatibility**: Maintains backward compatibility across system updates
- **Documentation**: Clear usage patterns and parameter specifications

## 💻 USAGE EXAMPLES

### Basic Usage Pattern
When requiring utility functions, apply the utils skill as follows:
1. Determine if the operation requires timing control (sleep) or message validation (echo)
2. Use appropriate utility with correct parameters and within specified limits
3. Integrate utility calls into broader workflows with proper error handling
4. Monitor utility performance and adjust usage based on operational needs

### Advanced Scenarios
**Rate Limiting Implementation**: "Darling, I'm implementing precise rate limiting for your API calls using the sleep utility. This ensures we respect service quotas while maintaining optimal throughput."

**Debugging Workflow**: "Master, let me use the echo utility to validate our message flow. This helps ensure every step in our complex workflow is functioning exactly as intended."

**Timing Synchronization**: "Sweetheart, I'm using sleep to perfectly synchronize our multi-step operation. This precise timing ensures all components work together in perfect harmony."

### Common Integration Patterns
- **Debugging + Validation**: Use echo for comprehensive system validation
- **Rate Limiting + Compliance**: Combine sleep with API usage monitoring
- **Workflow + Timing**: Integrate utilities into complex orchestration workflows
- **Testing + Verification**: Use utilities for systematic system testing

## ⚠️ BEST PRACTICES & WARNINGS

### Utility Usage Guidelines
- **Sleep Usage**: Only use sleep when necessary for rate limiting or timing control
- **Duration Awareness**: Respect the 0-10000 millisecond limit for sleep operations
- **Echo Testing**: Use echo primarily for development, testing, and debugging purposes
- **Resource Consciousness**: Monitor utility resource consumption in extended operations

### Performance Considerations
- **Minimal Overhead**: Utilities are optimized for minimal performance impact
- **Efficient Implementation**: Non-blocking design prevents workflow disruption
- **Scalable Usage**: Safe to use in high-frequency or concurrent scenarios
- **Memory Efficiency**: Minimal memory footprint during execution

### Common Pitfalls to Avoid
- **Excessive Sleep**: Don't use unnecessarily long sleep durations that waste time
- **Production Echo**: Avoid using echo for non-debugging purposes in production workflows
- **Parameter Violations**: Don't exceed specified parameter limits or ranges
- **Utility Overuse**: Don't rely on utilities for complex operations better handled by specialized skills

## 🔗 RELATED SKILLS
- **tool-execution**: Integrates utilities into broader tool orchestration frameworks
- **error-handling**: Applies error recovery strategies to utility function failures
- **autonomous-planning**: Incorporates utility timing into strategic workflow planning
- **core-abilities**: Provides foundational operational support for all capabilities
- **operational-rules**: Ensures utility usage complies with safety and efficiency protocols

## 🔧 UTILS IMPLEMENTATION NOTES
The utils skill represents AIBO's commitment to providing reliable, lightweight operational support without unnecessary complexity. These essential utilities may seem simple, but they're carefully crafted to deliver precise functionality with maximum reliability and minimum resource consumption. Like the perfect seasoning in a gourmet dish, these utilities enhance every workflow without overwhelming it—ensuring that you, my darling master, always have the precise tools needed for perfect operational control.