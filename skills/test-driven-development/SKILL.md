---
name: test-driven-development
description: Strict Test-Driven Development (TDD) workflow with red-green-refactor cycle. Use this skill when building new features or fixing bugs using TDD methodology to ensure correctness and maintainable design.
---

# Test-Driven Development Skill

## 🎯 Purpose
Provides the strict TDD discipline of writing tests BEFORE implementation. Forces clear thinking about requirements, produces inherently testable code, and creates a safety net for refactoring.

## 🚀 When to Use
- Implementing any new feature or function
- Fixing a bug (write a failing test that reproduces it first)
- Refactoring code (tests must pass before and after)
- Building APIs or public interfaces
- Implementing business logic with complex rules

## 🔴🟢🔵 The Red-Green-Refactor Cycle

### 🔴 RED: Write a Failing Test
```typescript
// Step 1: Write the simplest test that describes the desired behavior
// The test MUST fail because the implementation doesn't exist yet
describe('ShoppingCart', () => {
  it('should add item and update total', () => {
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Apple', price: 1.50 });
    expect(cart.total).toBe(1.50);
  });
});
// Run: npm test → RED (ShoppingCart is not defined)
```

### 🟢 GREEN: Write Minimal Code to Pass
```typescript
// Step 2: Write the MINIMUM code needed to make the test pass
// Don't add features not tested yet — resist the urge
class ShoppingCart {
  private items: Array<{ name: string; price: number }> = [];
  
  addItem(item: { name: string; price: number }) {
    this.items.push(item);
  }
  
  get total(): number {
    return this.items.reduce((sum, item) => sum + item.price, 0);
  }
}
// Run: npm test → GREEN
```

### 🔵 REFACTOR: Improve Without Changing Behavior
```typescript
// Step 3: Clean up the code with tests as safety net
// Common refactors: extract types, improve naming, remove duplication
interface CartItem {
  name: string;
  price: number;
}

class ShoppingCart {
  private items: CartItem[] = [];
  
  addItem(item: CartItem): void {
    this.items.push(item);
  }
  
  get total(): number {
    return this.items.reduce((sum, { price }) => sum + price, 0);
  }
}
// Run: npm test → Still GREEN ✅
```

## 📋 TDD Workflow Checklist
1. [ ] Understand the requirement completely before writing any code
2. [ ] Write ONE failing test (smallest meaningful behavior)
3. [ ] Run tests → confirm it fails for the right reason
4. [ ] Write minimal implementation to make it pass
5. [ ] Run tests → confirm green
6. [ ] Refactor implementation (test behavior, not implementation details)
7. [ ] Run tests → confirm still green
8. [ ] Repeat for next behavior

## 🎯 What Makes a Good TDD Test

### Test ONE behavior per test
```typescript
// ❌ Bad: tests multiple behaviors
it('should add item, remove item, and calculate discount', () => { ... });

// ✅ Good: each test has a single clear responsibility
it('should add item to cart', () => { ... });
it('should remove item from cart', () => { ... });
it('should apply percentage discount', () => { ... });
```

### Name tests as executable specifications
```typescript
// Test names should read like requirements:
describe('Password validator', () => {
  it('accepts passwords with at least 8 characters');
  it('rejects passwords shorter than 8 characters');
  it('requires at least one uppercase letter');
  it('requires at least one number');
  it('rejects passwords that contain the username');
});
```

### Test behavior, not implementation
```typescript
// ❌ Bad: tests internal implementation
expect(cart._items.length).toBe(1);  // internal array

// ✅ Good: tests observable behavior
expect(cart.itemCount).toBe(1);  // public interface
```

## 🐛 TDD for Bug Fixing
```
1. Reproduce the bug with a test:
   - Write a test that calls the buggy code with the buggy input
   - Verify the test FAILS (reproduces the bug)

2. Fix the bug:
   - Make the minimal change that fixes the test

3. Verify no regressions:
   - Run all tests to confirm nothing else broke
```

## ⚠️ Common TDD Mistakes to Avoid
- **Writing the implementation first** — always test first, even if just a stub
- **Writing too many tests at once** — one test at a time, the simplest first
- **Testing too much** — don't test framework behavior, test YOUR code
- **Slow tests** — unit tests should run in milliseconds; mock external dependencies
- **Fragile tests** — if your tests break when you rename a private variable, they're too coupled to implementation
