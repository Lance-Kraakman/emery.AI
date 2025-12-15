/**
 * Shared types and utilities for FileField components
 */

import type { Action } from '@/components/puck/types/actions';

export type SizePreset = 'compact' | 'normal' | 'large';
export type FieldMode = 'view' | 'edit';

export interface FileFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'list' | 'compact' | 'card';
  size?: SizePreset;
  mode?: FieldMode;
  onEditAction?: Action[];
  maxItems?: number;
  showSize?: boolean;
  showDownload?: boolean;
  textColor?: string;
  fontFamily?: string;
}

export interface FileItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  s3Key?: string;
  url?: string;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileUrl(file: FileItem): string {
  if (file.s3Key) {
    return `/api/files/stream?s3Key=${encodeURIComponent(file.s3Key)}`;
  }
  if (file.url) return file.url;
  return '#';
}
