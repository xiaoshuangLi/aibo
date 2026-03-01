import * as fs from 'fs';
import * as path from 'path';
import { ConversationSummarizer } from '../src/infrastructure/session/summarizer';

const testSessionsDir = path.join(__dirname, '.test-summarizer-sessions');

function makeMessage(role: 'HumanMessage' | 'AIMessage', content: string) {
  return {
    type: 'constructor',
    id: ['langchain_core', 'messages', role],
    kwargs: { content, response_metadata: {} }
  };
}

function makeSessionData(messages: any[]) {
  return {
    checkpoint: {
      v: 4,
      id: 'test-ckpt',
      ts: new Date().toISOString(),
      channel_values: { messages },
      channel_versions: {},
      versions_seen: {}
    },
    metadata: { source: 'input', step: 0, parents: {} },
    lastUpdated: new Date().toISOString()
  };
}

describe('ConversationSummarizer', () => {
  let summarizer: ConversationSummarizer;

  beforeEach(() => {
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testSessionsDir, { recursive: true });
    summarizer = new ConversationSummarizer(testSessionsDir, 4);
  });

  afterEach(() => {
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  test('loadSummary returns null when no summary file exists', () => {
    const result = summarizer.loadSummary('no-such-thread');
    expect(result).toBeNull();
  });

  test('maybeSummarize returns null when session.json does not exist', async () => {
    const mockModel = { invoke: jest.fn() };
    const result = await summarizer.maybeSummarize('no-such-thread', mockModel);
    expect(result).toBeNull();
    expect(mockModel.invoke).not.toHaveBeenCalled();
  });

  test('maybeSummarize returns null when message count <= windowSize', async () => {
    const threadId = 'small-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // 3 messages, windowSize is 4 → no summarization
    const messages = [
      makeMessage('HumanMessage', 'hello'),
      makeMessage('AIMessage', 'hi'),
      makeMessage('HumanMessage', 'how are you'),
    ];
    const sessionData = makeSessionData(messages);
    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(sessionData, null, 2));

    const mockModel = { invoke: jest.fn() };
    const result = await summarizer.maybeSummarize(threadId, mockModel);
    expect(result).toBeNull();
    expect(mockModel.invoke).not.toHaveBeenCalled();
  });

  test('maybeSummarize triggers summarization when message count > windowSize', async () => {
    const threadId = 'large-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // 6 messages, windowSize is 4 → should summarize
    const messages = [
      makeMessage('HumanMessage', 'msg1'),
      makeMessage('AIMessage', 'resp1'),
      makeMessage('HumanMessage', 'msg2'),
      makeMessage('AIMessage', 'resp2'),
      makeMessage('HumanMessage', 'msg3'),
      makeMessage('AIMessage', 'resp3'),
    ];
    const sessionData = makeSessionData(messages);
    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(sessionData, null, 2));

    const mockSummaryText = 'This is a summary of the conversation.';
    const mockModel = {
      invoke: jest.fn().mockResolvedValue({ content: mockSummaryText })
    };

    const result = await summarizer.maybeSummarize(threadId, mockModel);
    expect(result).toBe(mockSummaryText);
    expect(mockModel.invoke).toHaveBeenCalledTimes(1);

    // Verify summary.json was written
    const summaryPath = path.join(sessionDir, 'summary.json');
    expect(fs.existsSync(summaryPath)).toBe(true);
    const savedSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    expect(savedSummary.summaryText).toBe(mockSummaryText);
    expect(savedSummary.compressedMessageCount).toBeGreaterThan(0);
    expect(savedSummary.retainedMessageCount).toBeGreaterThan(0);

    // Verify session.json was compacted
    const updatedSession = JSON.parse(fs.readFileSync(path.join(sessionDir, 'session.json'), 'utf-8'));
    const updatedMessages = updatedSession.checkpoint.channel_values.messages;
    // Should have 1 summary message + retained messages (windowSize/2 = 2)
    expect(updatedMessages.length).toBeLessThan(messages.length);
    // First message should be the summary AIMessage
    expect(updatedMessages[0].kwargs.content).toContain(mockSummaryText);
  });

  test('loadSummary returns saved summary', async () => {
    const threadId = 'summary-load-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Write 6 messages to trigger summarization
    const messages = Array.from({ length: 6 }, (_, i) => makeMessage(
      i % 2 === 0 ? 'HumanMessage' : 'AIMessage',
      `message ${i}`
    ));
    const sessionData = makeSessionData(messages);
    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(sessionData, null, 2));

    const mockModel = {
      invoke: jest.fn().mockResolvedValue({ content: 'Stored summary' })
    };
    await summarizer.maybeSummarize(threadId, mockModel);

    const loaded = summarizer.loadSummary(threadId);
    expect(loaded).not.toBeNull();
    expect(loaded?.summaryText).toBe('Stored summary');
    expect(typeof loaded?.createdAt).toBe('string');
  });

  test('maybeSummarize returns null if model invoke fails', async () => {
    const threadId = 'fail-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const messages = Array.from({ length: 6 }, (_, i) => makeMessage(
      i % 2 === 0 ? 'HumanMessage' : 'AIMessage',
      `msg ${i}`
    ));
    fs.writeFileSync(
      path.join(sessionDir, 'session.json'),
      JSON.stringify(makeSessionData(messages), null, 2)
    );

    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('LLM unavailable'))
    };

    const result = await summarizer.maybeSummarize(threadId, mockModel);
    expect(result).toBeNull();
  });
});
