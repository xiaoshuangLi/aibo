---
name: vue-development
description: Create modern, production-ready Vue applications with Composition API, Pinia, Vue Router, and best practices. Use this skill when building Vue components, composables, applications, or when optimizing existing Vue code.
---

# Vue Development Skill

## 🎯 Purpose
This skill provides comprehensive guidance for building modern, production-ready Vue applications using the Composition API, Pinia state management, Vue Router, and current best practices. It ensures high-quality, maintainable, and performant Vue code following Vue 3 standards.

## 🚀 When to Use
- When building new Vue components, composables, or applications
- When migrating from Vue 2 to Vue 3
- When optimizing existing Vue code for performance
- When implementing state management with Pinia
- When setting up Vue project structure and configuration
- When creating custom composables or directives
- When implementing Vue testing strategies
- When integrating Vue with other libraries and frameworks

## 🔧 Core Capabilities
1. **Composition API**: setup(), reactive, ref, computed, watch, lifecycle hooks
2. **State Management**: Pinia stores, actions, getters, plugins
3. **Routing**: Vue Router with composition API, navigation guards
4. **Performance Optimization**: Suspense, teleport, v-memo, code splitting
5. **TypeScript Integration**: Strong typing with Vue 3 and TypeScript
6. **Testing Strategies**: Vitest, Vue Test Utils, component testing
7. **Project Structure**: Scalable architecture and file organization
8. **Ecosystem Integration**: Vite, Nuxt.js, VueUse, Headless UI, etc.

## 📋 Development Workflow
1. **Requirements Analysis**: Understand the component/application requirements
2. **Architecture Planning**: Choose appropriate state management and data flow patterns
3. **Component Design**: Create reusable, composable components with proper props
4. **Composable Implementation**: Extract reusable logic into composables
5. **Type Safety**: Add TypeScript types for props, state, and functions
6. **Performance Considerations**: Apply optimization techniques and lazy loading
7. **Testing**: Write comprehensive tests covering all scenarios
8. **Documentation**: Provide clear usage examples and API documentation

## ⚠️ Best Practices & Guidelines
### Component Design
- **Single Responsibility**: Each component should have one clear purpose
- **Props Validation**: Use TypeScript interfaces or prop validation
- **Default Props**: Provide sensible defaults for optional props
- **Composition over Inheritance**: Favor composition patterns
- **Template Syntax**: Use consistent template syntax and directives
- **Accessibility**: Ensure proper ARIA attributes and keyboard navigation

### Composition API Usage
- **Reactivity**: Use ref() for primitives, reactive() for objects
- **Computed Properties**: Use computed() for derived state
- **Watchers**: Use watch() and watchEffect() appropriately
- **Lifecycle Hooks**: Use onMounted, onUnmounted, etc. for side effects
- **State Colocation**: Keep state as close as possible to where it's used
- **Avoid Prop Drilling**: Use provide/inject or Pinia for deep trees

### Performance Optimization
- **Suspense**: Handle async component loading gracefully
- **Teleport**: Render components outside the DOM hierarchy
- **v-memo**: Optimize large list rendering
- **Code Splitting**: Implement lazy loading for routes and components
- **Bundle Analysis**: Analyze and optimize bundle size
- **Server Components**: Leverage Nuxt.js server components when applicable

### TypeScript Integration
- **Strong Typing**: Type all props, state, and function parameters
- **Generic Components**: Use generics for flexible, reusable components
- **Type Guards**: Implement proper type checking and validation
- **Utility Types**: Leverage TypeScript utility types (Partial, Pick, Omit, etc.)
- **DefineComponent**: Use defineComponent() for better type inference

## 🛠️ Common Patterns & Solutions
### State Management
- **Local State**: ref() and reactive() for simple component state
- **Complex State**: Pinia stores for complex state logic
- **Global State**: Pinia for application-wide state management
- **Async State**: Pinia with async actions and caching

### Data Fetching
- **Client-side**: fetch, axios with onMounted or composables
- **Server-side**: Nuxt.js asyncData, fetch, or server middleware
- **VueUse**: Composables for common data fetching patterns
- **SWR**: Stale-while-revalidate pattern for optimistic UI

### Routing
- **Vue Router**: Standard routing with nested routes and guards
- **Nuxt.js Router**: File-based routing with dynamic routes
- **Route Protection**: Authentication and authorization guards
- **Error Handling**: Handle routing errors gracefully

### Testing
- **Vitest + Vue Test Utils**: Unit and integration tests
- **Cypress**: End-to-end testing
- **Mocking**: Mock API calls and external dependencies
- **Component Testing**: Test components in isolation

## 💡 Code Quality Standards
- **ESLint**: Enforce consistent coding standards with Vue plugin
- **Prettier**: Automatic code formatting with Vue support
- **Husky**: Git hooks for pre-commit checks
- **Storybook**: Component development and documentation
- **Chromatic**: Visual regression testing

## 📝 Examples
- "Create a responsive product card component with Vue 3, TypeScript, and proper accessibility"
- "Implement a custom composable for form validation with real-time error handling"
- "Build a dashboard application with Vue 3, Pinia, and Vue Router"
- "Optimize a slow Vue component using v-memo and code splitting"
- "Create a theme switcher using Pinia store and localStorage"
- "Implement infinite scroll with Vue 3 and Intersection Observer API"

## 🎯 Success Criteria
- Components are reusable, composable, and well-documented
- Code follows Vue 3 best practices and Composition API patterns
- TypeScript provides strong type safety without being overly verbose
- Performance is optimized for the target use cases
- Tests provide comprehensive coverage with meaningful assertions
- Accessibility standards are met (WCAG 2.1 AA compliance)
- Bundle size is optimized for fast loading
- Error handling is robust and user-friendly

## 🔄 Integration with Other Skills
- **frontend-design**: Apply distinctive visual design to Vue components
- **webapp-testing**: Test Vue applications with Playwright
- **typescript-frontend**: Ensure strong TypeScript integration
- **playwright-skill**: Perform end-to-end testing of Vue applications
- **d3js-skill**: Integrate data visualizations into Vue components

## 📊 Performance Metrics
- **Bundle Size**: Keep component bundles under 10KB gzipped
- **Render Performance**: Achieve 60fps animations and smooth interactions
- **Memory Usage**: Avoid memory leaks and excessive re-renders
- **Loading Time**: Optimize critical rendering path for fast initial load
- **Test Coverage**: Maintain 80%+ test coverage for business logic