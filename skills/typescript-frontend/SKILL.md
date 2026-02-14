---
name: typescript-frontend
description: Implement robust, type-safe frontend code with TypeScript best practices, advanced types, and integration patterns for React, Vue, and vanilla JavaScript applications.
---

# TypeScript Frontend Development Skill

## 🎯 Purpose
This skill provides comprehensive guidance for implementing robust, type-safe frontend code using TypeScript best practices, advanced type system features, and integration patterns. It ensures high-quality, maintainable, and error-resistant frontend applications.

## 🚀 When to Use
- When adding TypeScript to existing JavaScript projects
- When creating new TypeScript-based frontend applications
- When implementing complex type systems and generics
- When integrating TypeScript with React, Vue, or other frameworks
- When setting up TypeScript configuration and tooling
- When optimizing TypeScript for performance and bundle size
- When creating type definitions for third-party libraries

## 🔧 Core Capabilities
1. **Type System Mastery**: Advanced types, generics, conditional types, mapped types
2. **Framework Integration**: React + TypeScript, Vue + TypeScript patterns
3. **Configuration**: tsconfig.json optimization, compiler options, build setup
4. **Type Safety**: Runtime validation, type guards, discriminated unions
5. **Performance**: Tree-shaking, dead code elimination, bundle optimization
6. **Testing**: Type-aware testing strategies and mocking
7. **Migration**: JavaScript to TypeScript migration strategies
8. **Tooling**: ESLint, Prettier, VS Code integration

## 📋 Development Workflow
1. **Project Assessment**: Evaluate current codebase and TypeScript readiness
2. **Configuration Setup**: Configure tsconfig.json with appropriate compiler options
3. **Incremental Migration**: Add types incrementally without breaking changes
4. **Type Design**: Create meaningful, reusable type definitions
5. **Integration Patterns**: Implement framework-specific TypeScript patterns
6. **Validation**: Add runtime type checking where necessary
7. **Testing**: Write type-aware tests and validate type safety
8. **Documentation**: Document type interfaces and usage patterns

## ⚠️ Best Practices & Guidelines
### Type Design Principles
- **Meaningful Names**: Use descriptive, domain-specific type names
- **Composition over Inheritance**: Favor intersection and union types
- **Discriminated Unions**: Use for state machines and variant types
- **Brand Types**: Create nominal types to prevent accidental assignment
- **Utility Types**: Leverage built-in and custom utility types
- **Avoid any**: Never use `any` - prefer `unknown` with type guards

### Framework Integration
- **React**: Component props, hooks return types, context types
- **Vue**: Component props, emits, slots, composable return types
- **Vanilla JS**: Module augmentation, global types, declaration files
- **Libraries**: Type definitions for third-party dependencies

### Configuration Optimization
- **Strict Mode**: Enable strict type checking options
- **Module Resolution**: Configure proper module resolution strategy
- **Target Compatibility**: Set appropriate ECMAScript target
- **Source Maps**: Enable for debugging and error tracking
- **Incremental Builds**: Optimize compilation speed

### Performance Considerations
- **Tree-shaking**: Ensure types don't bloat production bundles
- **Dead Code Elimination**: Remove unused type imports
- **Bundle Analysis**: Monitor type-related bundle impact
- **Compilation Speed**: Optimize tsconfig for development vs production

## 🛠️ Advanced Type Patterns
### Utility Types
- **Partial<T>**: Make all properties optional
- **Required<T>**: Make all properties required
- **Readonly<T>**: Make all properties readonly
- **Pick<T, K>**: Select specific properties
- **Omit<T, K>**: Exclude specific properties
- **Record<K, T>**: Create object with specific key-value types
- **Exclude<T, U>**: Exclude types from union
- **Extract<T, U>**: Extract types from union

### Custom Utility Types
- **DeepPartial<T>**: Recursively make all properties optional
- **DeepRequired<T>**: Recursively make all properties required
- **Nullable<T>**: Make type nullable (T | null)
- **Maybe<T>**: Make type optional (T | undefined)
- **NonEmptyArray<T>**: Array with at least one element
- **Tuple<T, N>**: Fixed-length array of specific type

### Conditional Types
- **Distributive Conditional Types**: Apply conditionals to union members
- **Infer Keyword**: Extract types from complex structures
- **Template Literal Types**: Create string manipulation types
- **Key Remapping**: Transform object keys in mapped types

## 💡 Integration Patterns
### React + TypeScript
- **Component Props**: Interface vs type, defaultProps handling
- **Hooks**: Custom hook return types, generic hooks
- **Context**: Typed context values and providers
- **Event Handlers**: Proper event typing and handler signatures
- **Refs**: ForwardRef, MutableRefObject, RefObject

### Vue + TypeScript
- **Component Props**: defineProps with runtime + type safety
- **Emits**: defineEmits with proper event typing
- **Slots**: Typed slot content and fallbacks
- **Composables**: Return type inference and generic composables
- **Stores**: Pinia store typing and actions

### API Integration
- **Fetch Responses**: Typed API response structures
- **Error Handling**: Discriminated union for success/error states
- **Validation**: Runtime validation with Zod, Yup, or custom validators
- **Serialization**: Type-safe JSON serialization/deserialization

## 📝 Examples
- "Create a type-safe API client with TypeScript generics and error handling"
- "Implement a discriminated union for form state management"
- "Add TypeScript to an existing React component with proper prop typing"
- "Create custom utility types for common frontend patterns"
- "Set up TypeScript configuration for a Vue 3 + Vite project"
- "Implement runtime type validation with Zod for API responses"

## 🎯 Success Criteria
- Code is fully type-safe with no implicit any errors
- Types are meaningful and improve code readability
- Build times are optimized for development workflow
- Bundle size is not negatively impacted by type annotations
- Migration from JavaScript is smooth and incremental
- Error messages are clear and actionable
- Team adoption is successful with proper documentation

## 🔄 Integration with Other Skills
- **react-development**: Provide TypeScript integration for React components
- **vue-development**: Provide TypeScript integration for Vue components  
- **frontend-design**: Ensure type safety in design system components
- **webapp-testing**: Create type-aware test utilities and mocks
- **playwright-skill**: Type-safe Playwright test configurations

## 📊 Quality Metrics
- **Type Coverage**: 100% type coverage with no implicit any
- **Build Performance**: Compilation time under 10 seconds for medium projects
- **Bundle Impact**: Zero runtime impact from type annotations
- **Error Reduction**: 50%+ reduction in runtime type-related errors
- **Developer Experience**: Clear, actionable error messages and autocomplete