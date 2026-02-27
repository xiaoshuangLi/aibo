/**
 * LSP test fixture file.
 * Used by __tests__/tools/lsp-tools.test.ts to exercise every LSP tool
 * against real TypeScript source.
 *
 * Key line positions referenced by the tests (1-based):
 *   Line 14  – `export interface User {`           col 18 = 'U' of User
 *   Line 20  – `export function greet(user: User)` col 23 = 'u' of user param
 *                                                   col 29 = 'U' of User type ref
 *   Line 24  – `export class UserService {`        col 14 = 'U' of UserService
 *   Line 40  – `export const defaultUser: User`    col 14 = 'd' of defaultUser
 */

export interface User {
  id: number;
  name: string;
  email: string;
}

export function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

export class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users];
  }
}

export const defaultUser: User = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
};
