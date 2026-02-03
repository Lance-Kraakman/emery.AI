/**
 * Message Part Mapper
 *
 * Converts between LlamaIndex MessagePart format and Protocol Buffer MessagePart format.
 * Clean separation of concerns for message transformation logic.
 */

import type { MessagePart as LlamaIndexMessagePart } from '@llamaindex/chat-ui';
import { MessagePart, TextPart, ImageUrlPart, FilePart } from '../generated/agent_worker';

/**
 * Convert single LlamaIndex MessagePart to Protocol Buffer MessagePart
 *
 * @param part - LlamaIndex message part (text, image, data-file)
 * @returns Protocol Buffer MessagePart or null if unsupported type
 */
export function toProtoMessagePart(part: LlamaIndexMessagePart): MessagePart | null {
  // Handle string (legacy text format)
  if (typeof part === 'string') {
    return MessagePart.fromPartial({
      text: TextPart.fromPartial({ text: part })
    });
  }

  // Handle text part
  if (part.type === 'text') {
    return MessagePart.fromPartial({
      text: TextPart.fromPartial({ text: (part as any).text })
    });
  }

  // Handle direct image part
  if (part.type === 'image') {
    return MessagePart.fromPartial({
      imageUrl: ImageUrlPart.fromPartial({ url: (part as any).image })
    });
  }

  // Handle data-file part (for S3 uploaded files - images, PDFs, audio, etc.)
  if (part.type === 'data-file') {
    const dataPart = part as any;
    const mediaType = dataPart.data?.mediaType || dataPart.data?.type || '';
    const url = dataPart.data?.url || '';

    if (!url) {
      console.warn('[message-part-mapper] data-file missing URL:', dataPart);
      return null;
    }

    // Images use ImageUrlPart for vision model support
    if (mediaType.startsWith('image/')) {
      return MessagePart.fromPartial({
        imageUrl: ImageUrlPart.fromPartial({ url })
      });
    }

    // All other files (PDFs, audio, documents) use FilePart
    return MessagePart.fromPartial({
      file: FilePart.fromPartial({
        url,
        mimeType: mediaType,
        filename: dataPart.data?.name || dataPart.data?.filename || 'file',
        size: Number(dataPart.data?.size || 0)
      })
    });
  }

  // Unsupported part type - return null
  return null;
}

/**
 * Convert array of LlamaIndex MessageParts to Protocol Buffer MessageParts
 *
 * Filters out null values (unsupported types).
 *
 * @param parts - Array of LlamaIndex message parts
 * @returns Array of Protocol Buffer MessageParts
 */
export function toProtoMessageParts(parts: LlamaIndexMessagePart[]): MessagePart[] {
  return parts
    .map(toProtoMessagePart)
    .filter((part): part is MessagePart => part !== null);
}

/**
 * Convert database message with attachments to Protocol Buffer MessageParts
 *
 * Used when building conversation history from database messages.
 * Combines text content with attachment URLs.
 *
 * @param content - Text content of the message
 * @param attachments - Array of attachment metadata (from database)
 * @returns Array of Protocol Buffer MessageParts (text + images)
 */
export function messageWithAttachmentsToProtoParts(
  content: string,
  attachments?: Array<{ type: string; url: string; mimeType?: string }>
): MessagePart[] {
  const parts: MessagePart[] = [
    MessagePart.fromPartial({
      text: TextPart.fromPartial({ text: content })
    })
  ];

  if (attachments) {
    attachments.forEach(att => {
      if (!att.url) return;
      if (att.type === 'image') {
        parts.push(
          MessagePart.fromPartial({
            imageUrl: ImageUrlPart.fromPartial({ url: att.url })
          })
        );
      } else {
        parts.push(
          MessagePart.fromPartial({
            file: FilePart.fromPartial({
              url: att.url,
              mimeType: att.mimeType || 'application/octet-stream',
              filename: '',
              size: 0
            })
          })
        );
      }
    });
  }

  return parts;
}

/**
 * Extract text content from LlamaIndex message parts for display/logging
 *
 * Useful for logging message preview without image URLs.
 *
 * @param parts - Array of LlamaIndex message parts
 * @returns Combined text string
 */
export function extractTextFromParts(parts: LlamaIndexMessagePart[]): string {
  return parts
    .map(part => {
      if (typeof part === 'string') return part;
      if (part.type === 'text') return (part as any).text;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Check if message parts contain any images
 *
 * @param parts - Array of LlamaIndex message parts
 * @returns True if images present, false otherwise
 */
export function hasImageParts(parts: LlamaIndexMessagePart[]): boolean {
  return parts.some(part => {
    if (typeof part === 'string') return false;
    const typedPart = part as any;
    return part.type === 'image' ||
           (part.type === 'data-file' && typedPart.data?.mediaType?.startsWith('image/'));
  });
}
