import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import {
  processMessagesForImageUpload,
  createImageUploadMiddleware,
} from '@/core/middlewares/image-upload';
import { Session } from '@/core/agent/session';

// Mocks for Session dependencies
jest.mock('@/core/utils/interactive', () => ({
  createConsoleThreadId: jest.fn().mockReturnValue('test-thread-id'),
}));

jest.mock('@/infrastructure/session/manager', () => ({
  SessionManager: {
    getInstance: jest.fn().mockReturnValue({
      getCurrentSessionId: jest.fn().mockReturnValue('test-thread-id'),
      generateSessionMetadata: jest.fn(),
    }),
  },
}));

jest.mock('@/core/config', () => ({
  config: { model: { name: 'gpt-4o-mini' } },
}));

const BASE64_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const REMOTE_URL = 'https://example.com/image.png';

describe('processMessagesForImageUpload', () => {
  let uploadFn: jest.Mock;
  let cache: Map<string, Promise<string>>;

  beforeEach(() => {
    uploadFn = jest.fn().mockResolvedValue(REMOTE_URL);
    cache = new Map();
  });

  test('replaces base64 image_url with remote URL', async () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'image_url', image_url: { url: BASE64_IMAGE } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);

    expect(uploadFn).toHaveBeenCalledWith(BASE64_IMAGE);
    const content = result[0].content as any[];
    expect(content[0]).toEqual({ type: 'text', text: 'Describe this image' });
    expect(content[1].image_url.url).toBe(REMOTE_URL);
  });

  test('does not modify messages without base64 images', async () => {
    const messages = [
      new HumanMessage({ content: 'Plain text message' }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);

    expect(uploadFn).not.toHaveBeenCalled();
    expect(result[0]).toBe(messages[0]);
  });

  test('does not modify non-base64 image_url parts', async () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: 'image_url', image_url: { url: 'https://example.com/already-remote.png' } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);

    expect(uploadFn).not.toHaveBeenCalled();
    const content = result[0].content as any[];
    expect(content[0].image_url.url).toBe('https://example.com/already-remote.png');
  });

  test('uses cache to avoid re-uploading the same image', async () => {
    const messages = [
      new HumanMessage({
        content: [{ type: 'image_url', image_url: { url: BASE64_IMAGE } }],
      }),
      new HumanMessage({
        content: [{ type: 'image_url', image_url: { url: BASE64_IMAGE } }],
      }),
    ];

    await processMessagesForImageUpload(messages, uploadFn, cache);

    expect(uploadFn).toHaveBeenCalledTimes(1);
  });

  test('returns same message reference when no images changed', async () => {
    const msg = new AIMessage({ content: 'Hello' });
    const result = await processMessagesForImageUpload([msg], uploadFn, cache);
    expect(result[0]).toBe(msg);
  });

  test('preserves non-image_url parts unchanged', async () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: 'text', text: 'hello' },
          { type: 'image_url', image_url: { url: BASE64_IMAGE } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);
    const content = result[0].content as any[];
    expect(content[0]).toEqual({ type: 'text', text: 'hello' });
    expect(content[1].image_url.url).toBe(REMOTE_URL);
  });

  test('handles multiple different images, uploading each once', async () => {
    const base64a = 'data:image/png;base64,AAAA';
    const base64b = 'data:image/jpeg;base64,BBBB';
    uploadFn
      .mockResolvedValueOnce('https://cdn.example.com/a.png')
      .mockResolvedValueOnce('https://cdn.example.com/b.jpg');

    const messages = [
      new HumanMessage({
        content: [
          { type: 'image_url', image_url: { url: base64a } },
          { type: 'image_url', image_url: { url: base64b } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);
    const content = result[0].content as any[];
    expect(content[0].image_url.url).toBe('https://cdn.example.com/a.png');
    expect(content[1].image_url.url).toBe('https://cdn.example.com/b.jpg');
    expect(uploadFn).toHaveBeenCalledTimes(2);
  });

  test('preserves the original message type when array content has base64 images', async () => {
    const messages = [
      new SystemMessage({
        content: [{ type: 'image_url', image_url: { url: BASE64_IMAGE } }],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache);

    expect(result[0]).toBeInstanceOf(SystemMessage);
    const content = result[0].content as any[];
    expect(content[0].image_url.url).toBe(REMOTE_URL);
  });
});

describe('Session.uploadImage', () => {
  test('delegates to adapter.uploadImage', async () => {
    const mockAdapter = {
      emit: jest.fn().mockResolvedValue(undefined),
      requestUserInput: jest.fn(),
      setAbortSignal: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      uploadImage: jest.fn().mockResolvedValue(REMOTE_URL),
    };

    const session = new Session(mockAdapter as any, { threadId: 'test' });
    const result = await session.uploadImage(BASE64_IMAGE);

    expect(mockAdapter.uploadImage).toHaveBeenCalledWith(BASE64_IMAGE);
    expect(result).toBe(REMOTE_URL);
  });
});

describe('createImageUploadMiddleware', () => {
  test('returns a middleware object with a name', () => {
    const mockAdapter = {
      emit: jest.fn().mockResolvedValue(undefined),
      requestUserInput: jest.fn(),
      setAbortSignal: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      uploadImage: jest.fn().mockResolvedValue(REMOTE_URL),
    };

    const session = new Session(mockAdapter as any, { threadId: 'test' });
    const middleware = createImageUploadMiddleware({ session });

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('object');
  });
});
