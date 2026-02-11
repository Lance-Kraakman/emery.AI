'use client';

/**
 * DocumentEditMode - Edit Mode Component
 *
 * Displays document field values with edit buttons for triggering edit actions.
 * Used when mode='edit' is set on the DocumentField block.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { useRowData } from '@/components/puck/contexts/RowDataContext';
import { useActionContext } from '@/components/puck/contexts/ActionContext';
import { executeActions } from '@/components/puck/actions/execute-action';
import { cn } from '@/lib/utils';
import { FileText, Download, ExternalLink, Edit3 } from 'lucide-react';
import styles from './styles.module.css';
import type { DocumentFieldProps, DocumentItem } from './types';
import { formatFileSize, getDocumentUrl, getStatusColor } from './types';

export default function DocumentEditMode({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'list',
  size = 'normal',
  onEditAction,
  maxItems = 5,
  showMetadata = true,
  showStatus = true,
  textColor,
  fontFamily,
}: DocumentFieldProps) {
  // All hooks must be called before any conditionals (React hooks rules)
  const isInContext = useIsInDataContext();
  const value = useFieldValue(fieldId ?? 0);
  const rowContext = useRowData();
  const buildActionContext = useActionContext();

  const handleEditClick = async (doc: DocumentItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onEditAction || onEditAction.length === 0) return;

    // Build context with document data merged into row data
    const context = buildActionContext({
      rowData: {
        ...(rowContext?.rowData || {}),
        documentId: doc.id,
        documentName: doc.name,
        fieldId: fieldId,
      },
    });

    await executeActions(onEditAction, context);
  };

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
    labelPosition === 'inline' && styles.inline,
    size !== 'normal' && styles[size]
  );

  const customStyles: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };

  const hasEditAction = onEditAction && onEditAction.length > 0;

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
            {hasEditAction && (
              <button
                type="button"
                className={styles.editButton}
                onClick={(e) => handleEditClick(doc, e)}
                title="Edit document"
              >
                <Edit3 className={styles.editIcon} />
              </button>
            )}
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
            {hasEditAction && (
              <button
                type="button"
                className={styles.editButton}
                onClick={(e) => handleEditClick(doc, e)}
                title="Edit document"
              >
                <Edit3 className={styles.editIcon} />
              </button>
            )}
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
