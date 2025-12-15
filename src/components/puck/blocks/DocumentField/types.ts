/**
 * Shared types and utilities for DocumentField components
 */

import type { Action } from '@/components/puck/types/actions';

export type SizePreset = 'compact' | 'normal' | 'large';
export type FieldMode = 'view' | 'edit';

export interface DocumentFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'list' | 'card';
  size?: SizePreset;
  mode?: FieldMode;
  onEditAction?: Action[];
  maxItems?: number;
  showMetadata?: boolean;
  showStatus?: boolean;
  textColor?: string;
  fontFamily?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  s3Key?: string;
  url?: string;
  documentMetadata?: {
    pageCount?: number;
    status?: string;
    processingError?: string;
  };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDocumentUrl(doc: DocumentItem): string {
  if (doc.s3Key) {
    return `/api/files/stream?s3Key=${encodeURIComponent(doc.s3Key)}`;
  }
  if (doc.url) return doc.url;
  return '#';
}

export function getStatusColor(status?: string): string {
  switch (status) {
    case 'processed':
    case 'complete':
      return 'success';
    case 'processing':
    case 'pending':
      return 'warning';
    case 'failed':
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}
