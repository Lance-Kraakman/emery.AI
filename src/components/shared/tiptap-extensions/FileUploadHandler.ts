/**
 * FileUploadHandler TipTap Extension
 *
 * Handles paste and drop events for files in the TipTap editor.
 * Uploads files to S3 and inserts appropriate nodes (Image or FileAttachment).
 *
 * Supports:
 * - Direct file paste (screenshots, copied files)
 * - Drag and drop files
 * - HTML paste with embedded images (Google Docs, web pages)
 */

import { Extension, Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  validateFileSize,
  validateFileType,
  getFileValidationError,
} from '@/lib/validation/file-validation';
import {
  isImageFile,
  dataUriToBlob,
  extractImageSrcsFromHtml,
  getFilenameFromUrl,
} from './image-utils';
import {
  uploadFileToS3,
  uploadBlobToS3,
  fetchExternalImage,
} from './upload-service';

export interface FileUploadHandlerOptions {
  organizationId: number;
  tableId: number;
  fieldId: number;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
  onUploadError?: (error: string) => void;
}

/**
 * Handle HTML paste with embedded images (Google Docs, web pages)
 *
 * Extracts images from HTML, uploads them to S3, and inserts proper TipTap Image nodes.
 */
async function handleHtmlPaste(
  editor: Editor,
  html: string,
  options: FileUploadHandlerOptions
): Promise<boolean> {
  const { organizationId, tableId, fieldId, onUploadStart, onUploadComplete, onUploadError } = options;

  const imageSrcs = extractImageSrcsFromHtml(html);
  console.log('[FileUploadHandler] Found images in HTML:', imageSrcs.length);

  if (imageSrcs.length === 0) {
    return false;
  }

  onUploadStart?.();

  try {
    let imagesInserted = 0;

    for (let i = 0; i < imageSrcs.length; i++) {
      const src = imageSrcs[i];
      console.log('[FileUploadHandler] Processing image', i + 1, ':', src.substring(0, 60) + '...');

      // Get blob from data URI or external URL
      let blob: Blob | null = null;

      if (src.startsWith('data:')) {
        console.log('[FileUploadHandler] Converting data URI to blob');
        blob = dataUriToBlob(src);
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        console.log('[FileUploadHandler] Fetching external image via proxy');
        blob = await fetchExternalImage(src);
      } else {
        console.log('[FileUploadHandler] Skipping non-HTTP URL:', src.substring(0, 40));
        continue;
      }

      if (!blob) {
        console.error('[FileUploadHandler] Failed to get blob for image', i + 1);
        continue;
      }

      console.log('[FileUploadHandler] Got blob, size:', blob.size, 'type:', blob.type);

      // Upload to S3
      const filename = getFilenameFromUrl(src, i);
      const result = await uploadBlobToS3(blob, filename, organizationId, tableId, fieldId);

      if (!result) {
        console.error('[FileUploadHandler] Upload failed for image', i + 1);
        continue;
      }

      console.log('[FileUploadHandler] Uploaded to S3, inserting s3Image node with s3Key:', result.s3Key);

      // Insert s3Image node with s3Key for persistence (signed URLs expire and are too long)
      const success = editor.chain()
        .focus()
        .insertContent({
          type: 's3Image',
          attrs: {
            src: result.url,    // For immediate display
            s3Key: result.s3Key // For persistent storage
          }
        })
        .run();

      console.log('[FileUploadHandler] insertContent result:', success);
      console.log('[FileUploadHandler] Editor content length after insert:', editor.getHTML().length);

      if (success) {
        imagesInserted++;
      }
    }

    console.log('[FileUploadHandler] Total images inserted:', imagesInserted);

    onUploadComplete?.();
    return imagesInserted > 0;
  } catch (error) {
    console.error('[FileUploadHandler] Error processing HTML paste:', error);
    onUploadError?.('Failed to process pasted images');
    return false;
  }
}

/**
 * Handle file upload and node insertion (for direct file paste/drop)
 */
async function handleFileUpload(
  editor: Editor,
  file: File,
  options: FileUploadHandlerOptions
): Promise<void> {
  const { organizationId, tableId, fieldId, onUploadStart, onUploadComplete, onUploadError } = options;

  console.log('[FileUploadHandler] Handling file upload:', file.name, 'type:', file.type, 'size:', file.size);

  // Validate file
  const validationError = getFileValidationError(file);
  if (validationError) {
    console.error('[FileUploadHandler] Validation error:', validationError);
    onUploadError?.(validationError);
    return;
  }

  onUploadStart?.();

  try {
    const result = await uploadFileToS3(file, organizationId, tableId, fieldId);

    if (!result) {
      console.error('[FileUploadHandler] Upload failed for:', file.name);
      onUploadError?.(`Failed to upload ${file.name}`);
      return;
    }

    console.log('[FileUploadHandler] File uploaded, inserting node. s3Key:', result.s3Key);

    // Insert appropriate node based on file type
    if (isImageFile(file)) {
      // Insert s3Image node with s3Key for persistence
      const success = editor
        .chain()
        .focus()
        .insertContent({
          type: 's3Image',
          attrs: {
            src: result.url,    // For immediate display
            s3Key: result.s3Key // For persistent storage
          }
        })
        .run();

      console.log('[FileUploadHandler] S3Image insert result:', success);
    } else {
      // Insert file attachment node
      const success = editor
        .chain()
        .focus()
        .insertContent({
          type: 'fileAttachment',
          attrs: {
            src: result.url,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            s3Key: result.s3Key,
            organizationId,
            tableId,
            fieldId,
          },
        })
        .run();

      console.log('[FileUploadHandler] FileAttachment insert result:', success);
    }

    onUploadComplete?.();
  } catch (error) {
    console.error('[FileUploadHandler] Error handling file upload:', error);
    onUploadError?.(`Failed to upload ${file.name}`);
  }
}

/**
 * FileUploadHandler Extension
 *
 * Intercepts paste and drop events to handle file uploads.
 */
export const FileUploadHandler = Extension.create<FileUploadHandlerOptions>({
  name: 'fileUploadHandler',

  addOptions() {
    return {
      organizationId: 0,
      tableId: 0,
      fieldId: 0,
      onUploadStart: undefined,
      onUploadComplete: undefined,
      onUploadError: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('fileUploadHandler'),
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            console.log('[FileUploadHandler] handlePaste triggered');

            // First, check for direct file pastes (screenshots, copied files)
            const items = clipboardData.items;
            let hasFiles = false;

            for (const item of items) {
              if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                  console.log('[FileUploadHandler] Found direct file paste:', file.name);
                  hasFiles = true;
                  // Handle file upload asynchronously
                  handleFileUpload(editor, file, options);
                }
              }
            }

            if (hasFiles) {
              console.log('[FileUploadHandler] Handled direct file paste, preventing default');
              return true;
            }

            // Check for HTML content with images (Google Docs, web pages, etc.)
            const html = clipboardData.getData('text/html');
            if (html) {
              const imageSrcs = extractImageSrcsFromHtml(html);
              console.log('[FileUploadHandler] HTML paste detected, images found:', imageSrcs.length);

              if (imageSrcs.length > 0) {
                // Handle HTML paste with images asynchronously
                handleHtmlPaste(editor, html, options);
                console.log('[FileUploadHandler] Started HTML paste processing, preventing default');
                return true;
              }
            }

            // No files or images to handle, let default paste behavior take over
            console.log('[FileUploadHandler] No files/images, allowing default paste');
            return false;
          },

          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            console.log('[FileUploadHandler] handleDrop triggered, files:', files.length);

            let hasValidFiles = false;

            for (const file of Array.from(files)) {
              // Validate file type
              if (validateFileType(file) && validateFileSize(file)) {
                console.log('[FileUploadHandler] Valid file dropped:', file.name);
                hasValidFiles = true;
                // Handle file upload asynchronously
                handleFileUpload(editor, file, options);
              } else {
                console.log('[FileUploadHandler] Invalid file dropped:', file.name);
              }
            }

            if (hasValidFiles) {
              console.log('[FileUploadHandler] Handled file drop, preventing default');
            }

            return hasValidFiles;
          },
        },
      }),
    ];
  },
});

export default FileUploadHandler;
