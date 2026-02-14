---
name: spec-driven-development
description: Implement Specification-Driven Development (SDD) methodology to create clear, testable specifications that drive implementation. Use this skill when defining requirements, creating user stories, establishing acceptance criteria, and ensuring traceability between specifications and code.
---

# Specification-Driven Development Skill

## 🎯 Purpose
This skill provides a comprehensive framework for implementing Specification-Driven Development (SDD), a methodology that puts specifications at the center of the development process. Instead of jumping directly to implementation, SDD requires clear definition of what needs to be built, why it's needed, and how it will be verified before any code is written.

## 🚀 When to Use
- When starting a new feature or capability development
- When requirements are unclear or ambiguous
- When you need to establish clear acceptance criteria
- When implementing complex functionality that requires careful planning
- When working with AI assistants to ensure alignment on expectations
- When you need traceability between requirements and implementation
- When refactoring or modernizing existing codebases

## 🔧 Core Capabilities
1. **Specification Creation**: Generate user stories, acceptance criteria, and technical constraints
2. **Architecture Planning**: Create technical designs with rationale and alternatives
3. **Task Decomposition**: Break down complex features into actionable implementation tasks
4. **Risk Assessment**: Identify potential risks and mitigation strategies
5. **Success Metrics Definition**: Establish measurable quality gates and performance requirements
6. **Verification Strategy**: Define comprehensive testing approaches and validation methods
7. **Traceability Management**: Ensure clear links between specifications and implementation

## 📋 SDD Workflow Steps
1. **Specify Requirements**: Define user stories, business value, and acceptance criteria
2. **Design Solution**: Document architecture decisions, component design, and data flow
3. **Plan Implementation**: Break down into tasks with dependencies, risks, and success metrics
4. **Implement & Verify**: Execute the plan with continuous verification against specifications
5. **Validate & Review**: Ensure all acceptance criteria are met and quality gates are passed

## ⚠️ Best Practices & Guidelines
### Specification Quality
- **Be Specific**: Avoid vague requirements like "make it fast" - use concrete, measurable metrics
- **Make Testable**: Every acceptance criterion should be verifiable through automated or manual testing
- **Include Edge Cases**: Consider boundary conditions, error scenarios, and failure modes
- **Document Rationale**: Explain why certain decisions were made and alternatives considered
- **Iterate**: Specifications can be refined based on feedback and learning

### Implementation Alignment
- **Code Serves Specs**: Implementation should fulfill the specification, not the other way around
- **Traceability**: Every line of code should be traceable back to a specific requirement
- **Quality Gates**: Establish clear criteria for when work is "done" and ready for review
- **Collaboration**: Use specifications as a shared understanding between humans and AI assistants

### Risk Management
- **Early Identification**: Catch issues in the specification phase rather than during implementation
- **Mitigation Planning**: Have concrete plans for addressing identified risks
- **Contingency Planning**: Prepare alternative approaches for high-risk areas
- **Progressive Disclosure**: Reveal specification details only when needed to avoid overwhelming context

## 🛠️ Common Patterns & Solutions
### User Story Template
```
As a [user role], I want [feature description] so that [business value].
```

### Acceptance Criteria Template
- **Given** [initial context]
- **When** [action/event occurs]  
- **Then** [expected outcome]

### Technical Constraints Template
- **Performance**: Response time ≤ X ms, memory usage ≤ Y MB
- **Compatibility**: Support browsers A, B, C; OS versions X, Y, Z
- **Security**: Follow OWASP guidelines, implement input validation
- **Accessibility**: Meet WCAG 2.1 AA compliance

### Architecture Decision Record (ADR)
- **Context**: What problem are we solving?
- **Decision**: What is our chosen solution?
- **Status**: Proposed/Approved/Deprecated
- **Consequences**: What are the positive and negative impacts?

## 💡 Integration with Other Skills
- **subagent-driven-development**: Use subagents to handle different aspects of specification creation
- **mcp-builder**: Create MCP servers that enforce specification-driven workflows
- **skill-creator**: Generate new skills based on well-defined specifications
- **frontend-design**: Apply specification-driven approach to UI/UX design
- **react-development/vue-development**: Ensure frontend implementations meet specifications
- **webapp-testing**: Create comprehensive test suites based on acceptance criteria

## 📝 Examples
- "Create a specification for a real-time collaborative editing feature with proper conflict resolution"
- "Define acceptance criteria for an authentication system with multi-factor support"
- "Establish technical constraints for a mobile-first responsive design system"
- "Create an architecture decision record for choosing between microservices vs monolith"
- "Generate a complete SDD document for implementing OAuth 2.0 authorization flow"

## 🎯 Success Criteria
- Specifications are clear, specific, and testable
- All acceptance criteria can be verified through testing
- Technical constraints are measurable and achievable
- Architecture decisions include rationale and alternatives
- Implementation tasks are well-defined with clear dependencies
- Risk assessment identifies potential issues with mitigation strategies
- Success metrics provide objective measures of quality and performance
- Traceability exists between every requirement and its implementation

## 📊 Quality Metrics
- **Specification Completeness**: 100% coverage of user stories and acceptance criteria
- **Testability**: 100% of acceptance criteria have corresponding test cases
- **Traceability**: Every implementation task maps to specific requirements
- **Risk Coverage**: All identified risks have documented mitigation strategies
- **Review Quality**: Specifications pass peer review with minimal revisions