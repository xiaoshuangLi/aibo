import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import {
  processMessagesForImageUpload,
  createImageUploadMiddleware,
  isClaudeModel,
  fetchImageAsBase64,
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

// Config mock — overridden per-suite below
const mockConfig = { model: { name: 'gpt-4o-mini', provider: undefined as string | undefined } };
jest.mock('@/core/config', () => ({ get config() { return mockConfig; } }));

// axios mock for fetchImageAsBase64
jest.mock('axios');

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

describe('processMessagesForImageUpload (Claude / useBase64 mode)', () => {
  let uploadFn: jest.Mock;
  let cache: Map<string, Promise<string>>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require('axios') as jest.Mocked<typeof import('axios').default>;

  beforeEach(() => {
    uploadFn = jest.fn().mockResolvedValue(REMOTE_URL);
    cache = new Map();
    (axios.get as jest.Mock).mockReset();
  });

  test('keeps base64 image_url as-is (no upload)', async () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: 'image_url', image_url: { url: BASE64_IMAGE } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache, { useBase64: true });

    expect(uploadFn).not.toHaveBeenCalled();
    const content = result[0].content as any[];
    expect(content[0].image_url.url).toBe(BASE64_IMAGE);
  });

  test('converts HTTP image_url to base64 data URL', async () => {
    const HTTP_URL = 'https://example.com/photo.png';
    const fakeBuffer = Buffer.from('fakeimagedata');
    (axios.get as jest.Mock).mockResolvedValue({
      data: fakeBuffer.buffer.slice(fakeBuffer.byteOffset, fakeBuffer.byteOffset + fakeBuffer.byteLength),
      headers: { 'content-type': 'image/png' },
    });

    const messages = [
      new HumanMessage({
        content: [
          { type: 'image_url', image_url: { url: HTTP_URL } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache, { useBase64: true });

    expect(axios.get).toHaveBeenCalledWith(HTTP_URL, { responseType: 'arraybuffer' });
    expect(uploadFn).not.toHaveBeenCalled();
    const content = result[0].content as any[];
    expect(content[0].image_url.url).toMatch(/^data:image\/png;base64,/);
  });

  test('converts HTTP image part (url field) to base64', async () => {
    const HTTP_URL = 'https://example.com/photo.jpg';
    const fakeBuffer = Buffer.from('fakeimagedata');
    (axios.get as jest.Mock).mockResolvedValue({
      data: fakeBuffer.buffer.slice(fakeBuffer.byteOffset, fakeBuffer.byteOffset + fakeBuffer.byteLength),
      headers: { 'content-type': 'image/jpeg' },
    });

    const messages = [
      new HumanMessage({
        content: [
          { type: 'image', url: HTTP_URL },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache, { useBase64: true });

    const content = result[0].content as any[];
    expect(content[0].url).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('leaves plain text parts unchanged in Claude mode', async () => {
    const messages = [
      new HumanMessage({
        content: [
          { type: 'text', text: 'hello' },
          { type: 'image_url', image_url: { url: BASE64_IMAGE } },
        ],
      }),
    ];

    const result = await processMessagesForImageUpload(messages, uploadFn, cache, { useBase64: true });
    const content = result[0].content as any[];
    expect(content[0]).toEqual({ type: 'text', text: 'hello' });
    expect(content[1].image_url.url).toBe(BASE64_IMAGE);
  });
});

describe('isClaudeModel', () => {
  beforeEach(() => {
    mockConfig.model = { name: 'gpt-4o-mini', provider: undefined };
  });

  test('returns false for a non-Claude model', () => {
    mockConfig.model = { name: 'gpt-4o-mini', provider: undefined };
    expect(isClaudeModel()).toBe(false);
  });

  test('returns true when model name starts with claude-', () => {
    mockConfig.model = { name: 'claude-3-5-sonnet-20241022', provider: undefined };
    expect(isClaudeModel()).toBe(true);
  });

  test('returns true when provider is anthropic regardless of model name', () => {
    mockConfig.model = { name: 'custom-model', provider: 'anthropic' };
    expect(isClaudeModel()).toBe(true);
  });
});

describe('fetchImageAsBase64', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require('axios') as jest.Mocked<typeof import('axios').default>;

  beforeEach(() => {
    (axios.get as jest.Mock).mockReset();
  });

  test('returns a base64 data URL with correct content-type', async () => {
    const fakeBuffer = Buffer.from('fakeimagedata');
    (axios.get as jest.Mock).mockResolvedValue({
      data: fakeBuffer.buffer.slice(fakeBuffer.byteOffset, fakeBuffer.byteOffset + fakeBuffer.byteLength),
      headers: { 'content-type': 'image/webp' },
    });

    const result = await fetchImageAsBase64('https://example.com/img.webp');
    expect(result).toMatch(/^data:image\/webp;base64,/);
  });

  test('defaults to image/jpeg when content-type header is missing', async () => {
    const fakeBuffer = Buffer.from('fakeimagedata');
    (axios.get as jest.Mock).mockResolvedValue({
      data: fakeBuffer.buffer.slice(fakeBuffer.byteOffset, fakeBuffer.byteOffset + fakeBuffer.byteLength),
      headers: {},
    });

    const result = await fetchImageAsBase64('https://example.com/img');
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
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
