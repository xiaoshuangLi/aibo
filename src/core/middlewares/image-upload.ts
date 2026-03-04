/**
 * Image Upload Middleware
 *
 * This middleware intercepts model call requests and replaces base64-encoded
 * image_url parts in messages with remote URLs uploaded via the session adapter.
 * A cache keyed on the base64 string prevents redundant uploads.
 *
 * @module image-upload
 */

import { createMiddleware } from 'langchain';
import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { Session } from '@/core/agent';

/**
 * Configuration options for the image upload middleware
 */
interface ImageUploadMiddlewareOptions {
  /** The session object used to call adapter.uploadImage */
  session: Session;
}

/**
 * Process an array of LangChain messages, uploading any inline base64 images
 * found in `image_url` content parts and replacing their URLs with remote URLs.
 *
 * @param messages - Input messages
 * @param uploadFn - Async function that uploads a base64 string and returns a URL
 * @param cache - Map used to avoid re-uploading identical images (stores in-flight Promises too)
 * @returns New message array with base64 URLs replaced
 */
export async function processMessagesForImageUpload(
  messages: BaseMessage[],
  uploadFn: (base64: string) => Promise<string>,
  cache?: Map<string, Promise<string>>
): Promise<BaseMessage[]> {
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
          const usefulUrl = typeof url === 'string' && !url.startsWith('http');

          if (usefulType && usefulUrl) {
            let remoteUrl;
            const base64 = url;
            if (cache) {
              if (!cache?.has?.(base64)) {
                cache?.set?.(base64, uploadFn(base64));
              }
              remoteUrl = await cache?.get?.(base64)!;
            } else {
              remoteUrl = await uploadFn(base64);
            }

            changed = true;
            return { ...part, image_url: { ...part.image_url, url: remoteUrl } };
          }
          return part;
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
 * Creates a middleware that uploads inline base64 images in messages before
 * they are sent to the model.
 *
 * @param options - Configuration options including the session
 * @returns AgentMiddleware instance that processes image uploads
 */
export function createImageUploadMiddleware(
  options: ImageUploadMiddlewareOptions
) {
  const { session } = options;

  return createMiddleware({
    name: 'ImageUploadMiddleware',

    stateSchema: z.object({}),

    wrapModelCall: async (request, handler) => {
      const processedMessages = await processMessagesForImageUpload(
        request.messages,
        (base64) => session.uploadImage(base64),
      );
      return handler({ ...request, messages: processedMessages });
    },
  });
}
