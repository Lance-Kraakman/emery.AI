'use client';

/**
 * DocumentField - Field Block Component (Display Only)
 *
 * Displays document field values from the nearest data context.
 * Must be used inside DataBlock.
 * Documents are like files but with additional metadata (page count, status, etc.)
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import { FileText, Download, ExternalLink } from 'lucide-react';
import styles from './styles.module.css';

export interface DocumentFieldProps {
  fieldId?: number;
  label?: string;
  labelPosition?: 'top' | 'inline';
  displayStyle?: 'list' | 'card';
  maxItems?: number;
  showMetadata?: boolean;
  showStatus?: boolean;
  textColor?: string;
  fontFamily?: string;
}

interface DocumentItem {
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

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentUrl(doc: DocumentItem): string {
  if (doc.s3Key) {
    return `/api/files/stream?s3Key=${encodeURIComponent(doc.s3Key)}`;
  }
  if (doc.url) return doc.url;
  return '#';
}

function getStatusColor(status?: string): string {
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

export default function DocumentField({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'list',
  maxItems = 5,
  showMetadata = true,
  showStatus = true,
  textColor,
  fontFamily,
}: DocumentFieldProps) {
  // All hooks must be called before any conditionals (React hooks rules)
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId ?? 0);

  // No field selected
  if (fieldId === undefined) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span>Please select a field</span>
      </div>
    );
  }

  // Not in data context - show warning
  if (!isInContext) {
    return (
      <div className={styles.warning}>
        <span className={styles.warningIcon}>⚠️</span>
        <span className={styles.warningText}>
          DocumentField must be inside a Data block
        </span>
      </div>
    );
  }

  // Parse documents
  const documents: DocumentItem[] = Array.isArray(value) ? value : (value ? [value] : []);
  const displayDocs = documents.slice(0, maxItems);
  const remainingCount = documents.length - displayDocs.length;

  // No documents
  if (documents.length === 0) {
    return (
      <div className={cn(styles.documentField, labelPosition === 'inline' && styles.inline)}>
        {label && <label className={styles.label}>{label}</label>}
        <span className={styles.empty}>No documents</span>
      </div>
    );
  }

  const containerClass = cn(
    styles.documentField,
    labelPosition === 'inline' && styles.inline
  );

  const customStyles: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };

  const renderList = () => (
    <ul className={styles.docList}>
      {displayDocs.map((doc, index) => {
        const status = doc.documentMetadata?.status;
        const pageCount = doc.documentMetadata?.pageCount;

        return (
          <li key={doc.id || index} className={styles.docListItem}>
            <FileText className={styles.docIcon} />
            <div className={styles.docInfo}>
              <span className={styles.docName}>{doc.name}</span>
              <div className={styles.docMeta}>
                {showMetadata && doc.size && (
                  <span className={styles.docSize}>{formatFileSize(doc.size)}</span>
                )}
                {showMetadata && pageCount && (
                  <span className={styles.docPages}>{pageCount} pages</span>
                )}
                {showStatus && status && (
                  <span className={cn(styles.docStatus, styles[getStatusColor(status)])}>
                    {status}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.docActions}>
              <a
                href={getDocumentUrl(doc)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionLink}
                title="Open"
              >
                <ExternalLink className={styles.actionIcon} />
              </a>
              <a
                href={getDocumentUrl(doc)}
                download={doc.name}
                className={styles.actionLink}
                title="Download"
              >
                <Download className={styles.actionIcon} />
              </a>
            </div>
          </li>
        );
      })}
      {remainingCount > 0 && (
        <li className={styles.moreDocs}>+{remainingCount} more document(s)</li>
      )}
    </ul>
  );

  const renderCard = () => (
    <div className={styles.cardContainer}>
      {displayDocs.map((doc, index) => {
        const status = doc.documentMetadata?.status;
        const pageCount = doc.documentMetadata?.pageCount;

        return (
          <div key={doc.id || index} className={styles.card}>
            <div className={styles.cardHeader}>
              <FileText className={styles.cardIcon} />
              {showStatus && status && (
                <span className={cn(styles.cardStatus, styles[getStatusColor(status)])}>
                  {status}
                </span>
              )}
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardName}>{doc.name}</span>
              {showMetadata && (
                <div className={styles.cardMeta}>
                  {doc.size && <span>{formatFileSize(doc.size)}</span>}
                  {pageCount && <span>{pageCount} pages</span>}
                </div>
              )}
            </div>
            <div className={styles.cardActions}>
              <a
                href={getDocumentUrl(doc)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.cardAction}
              >
                <ExternalLink className={styles.cardActionIcon} />
                Open
              </a>
              <a
                href={getDocumentUrl(doc)}
                download={doc.name}
                className={styles.cardAction}
              >
                <Download className={styles.cardActionIcon} />
                Download
              </a>
            </div>
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div className={cn(styles.card, styles.moreCard)}>
          +{remainingCount} more
        </div>
      )}
    </div>
  );

  return (
    <div className={containerClass} style={customStyles}>
      {label && <label className={styles.label}>{label}</label>}
      {displayStyle === 'list' && renderList()}
      {displayStyle === 'card' && renderCard()}
    </div>
  );
}
