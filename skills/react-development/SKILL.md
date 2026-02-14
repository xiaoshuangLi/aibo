---
name: react-development
description: Create modern, production-ready React applications with best practices, hooks, state management, and performance optimization. Use this skill when building React components, hooks, applications, or when optimizing existing React code.
---

# React Development Skill

## 🎯 Purpose
This skill provides comprehensive guidance for building modern, production-ready React applications using current best practices, hooks, state management patterns, and performance optimization techniques. It ensures high-quality, maintainable, and performant React code.

## 🚀 When to Use
- When building new React components, hooks, or applications
- When optimizing existing React code for performance
- When implementing state management solutions
- When setting up React project structure and configuration
- When creating custom hooks or higher-order components
- When implementing React testing strategies
- When integrating React with other libraries and frameworks

## 🔧 Core Capabilities
1. **Modern React Patterns**: Functional components, hooks, context API, suspense
2. **State Management**: useState, useEffect, useReducer, useContext, custom hooks
3. **Performance Optimization**: useMemo, useCallback, React.memo, code splitting
4. **TypeScript Integration**: Strong typing with React and TypeScript
5. **Testing Strategies**: Unit tests, integration tests, component testing
6. **Project Structure**: Scalable architecture and file organization
7. **Ecosystem Integration**: React Router, Redux, Zustand, TanStack Query, etc.
8. **Build Optimization**: Webpack, Vite, bundling, tree-shaking

## 📋 Development Workflow
1. **Requirements Analysis**: Understand the component/application requirements
2. **Architecture Planning**: Choose appropriate state management and data flow patterns
3. **Component Design**: Create reusable, composable components with proper props
4. **Hook Implementation**: Implement custom hooks for logic abstraction
5. **Type Safety**: Add TypeScript types for props, state, and functions
6. **Performance Considerations**: Apply memoization and optimization techniques
7. **Testing**: Write comprehensive tests covering all scenarios
8. **Documentation**: Provide clear usage examples and API documentation

## ⚠️ Best Practices & Guidelines
### Component Design
- **Single Responsibility**: Each component should have one clear purpose
- **Props Validation**: Use PropTypes or TypeScript interfaces
- **Default Props**: Provide sensible defaults for optional props
- **Composition over Inheritance**: Favor composition patterns
- **Controlled Components**: Prefer controlled over uncontrolled components
- **Accessibility**: Ensure proper ARIA attributes and keyboard navigation

### Hooks Usage
- **Rules of Hooks**: Only call hooks at the top level, never in loops/conditions
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Dependency Arrays**: Be explicit about dependencies in useEffect/useMemo
- **State Colocation**: Keep state as close as possible to where it's used
- **Avoid Prop Drilling**: Use Context API or state management for deep trees

### Performance Optimization
- **Memoization**: Use React.memo, useMemo, useCallback appropriately
- **Code Splitting**: Implement lazy loading for routes and components
- **Virtualization**: Use virtualized lists for large datasets
- **Bundle Analysis**: Analyze and optimize bundle size
- **Server Components**: Leverage React Server Components when applicable

### TypeScript Integration
- **Strong Typing**: Type all props, state, and function parameters
- **Generic Components**: Use generics for flexible, reusable components
- **Type Guards**: Implement proper type checking and validation
- **Utility Types**: Leverage TypeScript utility types (Partial, Pick, Omit, etc.)

## 🛠️ Common Patterns & Solutions
### State Management
- **Local State**: useState for simple component state
- **Complex State**: useReducer for complex state logic
- **Global State**: Context API for moderate complexity, Redux/Zustand for complex apps
- **Async State**: TanStack Query for server state management

### Data Fetching
- **Client-side**: fetch, axios with useEffect
- **Server-side**: Next.js getServerSideProps, getStaticProps
- **React Query**: TanStack Query for caching, background updates, pagination
- **SWR**: Stale-while-revalidate pattern for optimistic UI

### Routing
- **React Router**: Standard routing with nested routes and loaders
- **Next.js Router**: File-based routing with dynamic routes
- **Route Protection**: Authentication and authorization guards
- **Error Boundaries**: Handle routing errors gracefully

### Testing
- **Jest + React Testing Library**: Unit and integration tests
- **Cypress**: End-to-end testing
- **Mocking**: Mock API calls and external dependencies
- **Snapshot Testing**: For UI consistency (use sparingly)

## 💡 Code Quality Standards
- **ESLint**: Enforce consistent coding standards
- **Prettier**: Automatic code formatting
- **Husky**: Git hooks for pre-commit checks
- **Storybook**: Component development and documentation
- **Chromatic**: Visual regression testing

## 📝 Examples
- "Create a responsive product card component with TypeScript and proper accessibility"
- "Implement a custom hook for form validation with real-time error handling"
- "Build a dashboard application with React, TypeScript, and TanStack Query"
- "Optimize a slow React component using memoization and code splitting"
- "Create a theme switcher using React Context API and localStorage"
- "Implement infinite scroll with React and Intersection Observer API"

## 🎯 Success Criteria
- Components are reusable, composable, and well-documented
- Code follows React best practices and modern patterns
- TypeScript provides strong type safety without being overly verbose
- Performance is optimized for the target use cases
- Tests provide comprehensive coverage with meaningful assertions
- Accessibility standards are met (WCAG 2.1 AA compliance)
- Bundle size is optimized for fast loading
- Error handling is robust and user-friendly

## 🔄 Integration with Other Skills
- **frontend-design**: Apply distinctive visual design to React components
- **webapp-testing**: Test React applications with Playwright
- **typescript-frontend**: Ensure strong TypeScript integration
- **playwright-skill**: Perform end-to-end testing of React applications
- **d3js-skill**: Integrate data visualizations into React components

## 📊 Performance Metrics
- **Bundle Size**: Keep component bundles under 10KB gzipped
- **Render Performance**: Achieve 60fps animations and smooth interactions
- **Memory Usage**: Avoid memory leaks and excessive re-renders
- **Loading Time**: Optimize critical rendering path for fast initial load
- **Test Coverage**: Maintain 80%+ test coverage for business logic