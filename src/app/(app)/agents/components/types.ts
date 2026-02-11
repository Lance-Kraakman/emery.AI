/**
 * Shared types for agent components
 */

/** Viewer type for workspace files */
export type FileViewerType = 'text' | 'pdf' | 'image' | 'unsupported';

/** Represents a file being viewed/edited in the workspace */
export interface ViewingFile {
  path: string;
  content?: string;      // For text files
  url?: string;          // For binary files (PDF, images)
  mimeType: string;
  viewerType: FileViewerType;
}
