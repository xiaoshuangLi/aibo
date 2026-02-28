import { todoWriteTool, todoReadTool, resetTodos } from '../../src/tools/todo';

describe('todoWriteTool', () => {
  beforeEach(() => {
    resetTodos();
  });

  test('should have correct name and description', () => {
    expect(todoWriteTool.name).toBe('todo_write');
    expect(todoWriteTool.description).toContain('personal task list');
  });

  test('should have correct schema', () => {
    const schema = todoWriteTool.schema;
    expect(schema).toBeDefined();
    const result = schema.safeParse({
      todos: [{ content: 'test task', status: 'not_started', priority: 'medium' }],
    });
    expect(result.success).toBe(true);
  });

  test('should create new todos and return them with auto-assigned ids', async () => {
    const result = await todoWriteTool.invoke({
      todos: [
        { content: 'Task 1', status: 'not_started', priority: 'high' },
        { content: 'Task 2', status: 'in_progress', priority: 'medium' },
      ],
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos[0].id).toBeDefined();
    expect(parsed.todos[0].content).toBe('Task 1');
    expect(parsed.todos[0].status).toBe('not_started');
    expect(parsed.todos[0].priority).toBe('high');
    expect(parsed.todos[1].content).toBe('Task 2');
    expect(parsed.todos[1].status).toBe('in_progress');
  });

  test('should default status to not_started and priority to medium', async () => {
    const result = await todoWriteTool.invoke({
      todos: [{ content: 'Minimal task' }],
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.todos[0].status).toBe('not_started');
    expect(parsed.todos[0].priority).toBe('medium');
  });

  test('should update an existing todo by id', async () => {
    // Create a todo first
    const createResult = await todoWriteTool.invoke({
      todos: [{ content: 'Original task', status: 'not_started', priority: 'low' }],
    });
    const created = JSON.parse(createResult);
    const id = created.todos[0].id;

    // Update its status
    const updateResult = await todoWriteTool.invoke({
      todos: [{ id, content: 'Original task', status: 'in_progress' }],
    });
    const updated = JSON.parse(updateResult);
    expect(updated.success).toBe(true);
    expect(updated.todos[0].status).toBe('in_progress');
    expect(updated.todos[0].id).toBe(id);
  });

  test('should leave unmentioned todos unchanged during update', async () => {
    // Create two todos
    await todoWriteTool.invoke({
      todos: [
        { content: 'Task A', status: 'not_started' },
        { content: 'Task B', status: 'not_started' },
      ],
    });
    const readAfterCreate = JSON.parse(await todoReadTool.invoke({}));
    const idA = readAfterCreate.todos[0].id;
    const idB = readAfterCreate.todos[1].id;

    // Only update Task A
    await todoWriteTool.invoke({
      todos: [{ id: idA, content: 'Task A', status: 'completed' }],
    });
    const readAfterUpdate = JSON.parse(await todoReadTool.invoke({}));

    expect(readAfterUpdate.todos).toHaveLength(2);
    expect(readAfterUpdate.todos.find((t: any) => t.id === idA).status).toBe('completed');
    expect(readAfterUpdate.todos.find((t: any) => t.id === idB).status).toBe('not_started');
  });

  test('should return TODO_NOT_FOUND when updating non-existent id', async () => {
    const result = await todoWriteTool.invoke({
      todos: [{ id: 'nonexistent-id', content: 'Ghost task', status: 'completed' }],
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('TODO_NOT_FOUND');
  });

  test('should handle empty todos array (clear list)', async () => {
    // Add something first
    await todoWriteTool.invoke({
      todos: [{ content: 'Some task' }],
    });
    // Clear by writing empty array
    const result = await todoWriteTool.invoke({ todos: [] });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.todos).toHaveLength(0);
  });

  test('should support all valid status values', async () => {
    for (const status of ['not_started', 'in_progress', 'completed'] as const) {
      resetTodos();
      const result = await todoWriteTool.invoke({
        todos: [{ content: `Task with ${status}`, status }],
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.todos[0].status).toBe(status);
    }
  });

  test('should support all valid priority values', async () => {
    for (const priority of ['high', 'medium', 'low'] as const) {
      resetTodos();
      const result = await todoWriteTool.invoke({
        todos: [{ content: `Task with ${priority} priority`, priority }],
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.todos[0].priority).toBe(priority);
    }
  });

  test('should accumulate todos across multiple calls', async () => {
    await todoWriteTool.invoke({ todos: [{ content: 'First' }] });
    await todoWriteTool.invoke({ todos: [{ content: 'Second' }] });
    const read = JSON.parse(await todoReadTool.invoke({}));
    expect(read.todos).toHaveLength(2);
    expect(read.todos[0].content).toBe('First');
    expect(read.todos[1].content).toBe('Second');
  });

  test('should return MISSING_CONTENT error when creating todo without content', async () => {
    const toolFunction = (todoWriteTool as any).func;
    if (toolFunction) {
      const result = await toolFunction({ todos: [{ status: 'pending' }] });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('MISSING_CONTENT');
    }
  });

  test('getTodoTools returns array with both tools', async () => {
    const getTodoTools = (await import('../../src/tools/todo')).default;
    const tools = await getTodoTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(2);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('todo_write');
    expect(names).toContain('todo_read');
  });
});

describe('todoReadTool', () => {
  beforeEach(() => {
    resetTodos();
  });

  test('should have correct name and description', () => {
    expect(todoReadTool.name).toBe('todo_read');
    expect(todoReadTool.description).toContain('personal task list');
  });

  test('should return empty list when no todos exist', async () => {
    const result = await todoReadTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.todos).toHaveLength(0);
    expect(parsed.total).toBe(0);
    expect(parsed.summary.not_started).toBe(0);
    expect(parsed.summary.in_progress).toBe(0);
    expect(parsed.summary.completed).toBe(0);
  });

  test('should return current todos with accurate summary counts', async () => {
    await todoWriteTool.invoke({
      todos: [
        { content: 'Task 1', status: 'completed' },
        { content: 'Task 2', status: 'in_progress' },
        { content: 'Task 3', status: 'not_started' },
        { content: 'Task 4', status: 'not_started' },
      ],
    });
    const result = await todoReadTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.total).toBe(4);
    expect(parsed.summary.completed).toBe(1);
    expect(parsed.summary.in_progress).toBe(1);
    expect(parsed.summary.not_started).toBe(2);
  });

  test('should reflect latest state after updates', async () => {
    await todoWriteTool.invoke({ todos: [{ content: 'My task', status: 'not_started' }] });
    const readBefore = JSON.parse(await todoReadTool.invoke({}));
    const id = readBefore.todos[0].id;

    await todoWriteTool.invoke({ todos: [{ id, content: 'My task', status: 'completed' }] });
    const readAfter = JSON.parse(await todoReadTool.invoke({}));
    expect(readAfter.todos[0].status).toBe('completed');
  });
});
