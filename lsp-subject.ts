// lsp-subject.ts
// TypeScript fixture file for LSP tool tests

interface LspTestUser {
  id: number;
  name: string;
  email: string;
}

function formatUser(user: LspTestUser): string {
  const displayName = user.name;
  return displayName;
}

class LspTestService {
  private items: LspTestUser[] = [];

  addItem(item: LspTestUser): void {
    this.items.push(item);
  }

  getItem(id: number): LspTestUser | undefined {
    return this.items.find(i => i.id === id);
  }
}

const testService = new LspTestService();
const testUser: LspTestUser = { id: 1, name: 'TestUser', email: 'test@example.com' };
testService.addItem(testUser);

export { LspTestUser, LspTestService, formatUser };
