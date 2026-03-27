/**
 * Image Upload Middleware
 *
 * This middleware intercepts model call requests and replaces base64-encoded
 * image_url parts in messages with remote URLs uploaded via the session adapter.
 * A cache keyed on the base64 string prevents redundant uploads.
 *
 * For Claude (Anthropic) models the behaviour differs: base64 images are kept
 * as-is (no upload) and HTTP image URLs are downloaded and converted to base64
 * so that the Anthropic API can process them inline.
 *
 * @module image-upload
 */

import axios from 'axios';
import { createMiddleware } from 'langchain';
import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { config } from '@/core/config';
import { Session } from '@/core/agent';

/**
 * Configuration options for the image upload middleware
 */
interface ImageUploadMiddlewareOptions {
  /** The session object used to call adapter.uploadImage */
  session: Session;
}

/**
 * Options for processMessagesForImageUpload
 */
export interface ProcessImageUploadOptions {
  /**
   * When true (Claude/Anthropic mode) base64 images are kept as-is and HTTP
   * image URLs are downloaded and re-encoded as base64 data URLs.
   * When false (default) base64 images are uploaded and replaced with remote
   * URLs, while HTTP image URLs are left unchanged.
   */
  useBase64?: boolean;
}

/**
 * Returns true when the configured model is an Anthropic / Claude model.
 */
export function isClaudeModel(): boolean {
  const { name, provider } = config.model;
  if (provider === 'anthropic') return true;
  if (name?.startsWith('claude-')) return true;
  return false;
}

/**
 * Downloads an image from an HTTP(S) URL and returns it as a base64 data URL.
 *
 * @param url - The HTTP(S) URL of the image
 * @returns A base64 data URL string (e.g. `data:image/jpeg;base64,...`)
 */
export async function fetchImageAsBase64(url: string): Promise<string> {
  let response;
  try {
    response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  } catch (err: any) {
    throw new Error(`fetchImageAsBase64: failed to download image from "${url}": ${err?.message ?? err}`);
  }
  const contentType = (response.headers['content-type'] as string | undefined) || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

/**
 * Process an array of LangChain messages, handling image content parts
 * according to the selected mode.
 *
 * Default mode (useBase64 = false):
 *   - Non-HTTP (base64) image URLs are uploaded via uploadFn and replaced with remote URLs.
 *   - HTTP image URLs are left unchanged.
 *
 * Claude mode (useBase64 = true):
 *   - Non-HTTP (base64) image URLs are kept as-is (no upload).
 *   - HTTP image URLs are downloaded and converted to base64 data URLs.
 *
 * @param messages - Input messages
 * @param uploadFn - Async function that uploads a base64 string and returns a URL (used in default mode)
 * @param cache - Map used to avoid re-uploading identical images (stores in-flight Promises too)
 * @param options - Additional processing options
 * @returns New message array with image URLs processed according to the selected mode
 */
export async function processMessagesForImageUpload(
  messages: BaseMessage[],
  uploadFn: (base64: string) => Promise<string>,
  cache?: Map<string, Promise<string>>,
  options?: ProcessImageUploadOptions
): Promise<BaseMessage[]> {
  const useBase64 = options?.useBase64 ?? false;

  return Promise.all(
    messages.map(async (msg) => {
      if (!Array.isArray(msg.content)) {
        return msg;
      }

      let changed = false;
      const newContent = await Promise.all(
        (msg.content as any[]).map(async (part: any) => {
          const type = part?.type;
          const url = part?.url || part?.image_url?.url;

          const usefulType = type === 'image' || type === 'image_url';

          if (!usefulType || typeof url !== 'string') {
            return part;
          }

          const isHttpUrl = url.startsWith('http');

          if (useBase64) {
            // Claude mode: keep base64 as-is; convert HTTP URLs to base64
            if (!isHttpUrl) {
              return part;
            }

            const base64Url = await fetchImageAsBase64(url);
            changed = true;

            if (part?.image_url) {
              return { ...part, image_url: { ...part.image_url, url: base64Url } };
            }
            return { ...part, url: base64Url };
          } else {
            // Default mode: upload base64 images; leave HTTP URLs unchanged
            if (isHttpUrl) {
              return part;
            }

            let remoteUrl;
            const base64 = url;
            if (cache) {
              if (!cache.has(base64)) {
                cache.set(base64, uploadFn(base64));
              }
              remoteUrl = await cache.get(base64)!;
            } else {
              remoteUrl = await uploadFn(base64);
            }

            changed = true;

            if (part?.image_url) {
              return { ...part, image_url: { ...part.image_url, url: remoteUrl } };
            }
            return { ...part, url: remoteUrl };
          }
        })
      );

      if (changed) {
        msg.content = newContent;
      }

      return msg;
    })
  );
}

/**
 * Creates a middleware that processes images in messages before they are sent
 * to the model.
 *
 * For Claude/Anthropic models (detected automatically from config) base64
 * images are kept inline and HTTP image URLs are downloaded and converted to
 * base64 data URLs.  For all other models the original behaviour applies:
 * base64 images are uploaded via the session adapter and replaced with remote
 * URLs.
 *
 * @param options - Configuration options including the session
 * @returns AgentMiddleware instance that processes image uploads
 */
export function createImageUploadMiddleware(
  options: ImageUploadMiddlewareOptions
) {
  const { session } = options;
  const useBase64 = isClaudeModel();
  // Per-middleware cache to avoid redundant uploads / downloads within a session
  const cache = new Map<string, Promise<string>>();

  return createMiddleware({
    name: 'ImageUploadMiddleware',

    stateSchema: z.object({}),

    wrapModelCall: async (request, handler) => {
      const processedMessages = await processMessagesForImageUpload(
        request.messages,
        (base64) => session.uploadImage(base64),
        cache,
        { useBase64 },
      );
      return handler({ ...request, messages: processedMessages });
    },
  });
}
