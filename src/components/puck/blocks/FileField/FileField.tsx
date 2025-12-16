'use client';

/**
 * FileField - View Mode Component
 *
 * Displays file field values from the nearest data context.
 * Must be used inside DataBlock.
 * For edit mode with edit buttons, see FileEditMode.
 */

import { useFieldValue, useIsInDataContext } from '@/components/puck/hooks/useFieldValue';
import { cn } from '@/lib/utils';
import { File, Download, FileText, FileImage, FileVideo, FileAudio, FileArchive } from 'lucide-react';
import styles from './styles.module.css';
import type { FileFieldProps, FileItem } from './types';
import { formatFileSize, getFileUrl } from './types';

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return FileArchive;
  return File;
}

export default function FileField({
  fieldId,
  label,
  labelPosition = 'top',
  displayStyle = 'list',
  size = 'normal',
  maxItems = 5,
  showSize = true,
  showDownload = true,
  textColor,
  fontFamily,
}: FileFieldProps) {
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
          FileField must be inside a Data block
        </span>
      </div>
    );
  }

  // Parse files
  const files: FileItem[] = Array.isArray(value) ? value : (value ? [value] : []);
  const displayFiles = files.slice(0, maxItems);
  const remainingCount = files.length - displayFiles.length;

  // No files
  if (files.length === 0) {
    return (
      <div className={cn(styles.fileField, labelPosition === 'inline' && styles.inline)}>
        {label && <label className={styles.label}>{label}</label>}
        <span className={styles.empty}>No files</span>
      </div>
    );
  }

  const containerClass = cn(
    styles.fileField,
    labelPosition === 'inline' && styles.inline,
    size !== 'normal' && styles[size]
  );

  const customStyles: React.CSSProperties = {
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };

  const renderList = () => (
    <ul className={styles.fileList}>
      {displayFiles.map((file, index) => {
        const FileIcon = getFileIcon(file.mimeType);
        return (
          <li key={file.id || index} className={styles.fileListItem}>
            <FileIcon className={styles.fileIcon} />
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.name}</span>
              {showSize && file.size && (
                <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              )}
            </div>
            {showDownload && (
              <a
                href={getFileUrl(file)}
                download={file.name}
                className={styles.downloadLink}
                title="Download"
              >
                <Download className={styles.downloadIcon} />
              </a>
            )}
          </li>
        );
      })}
      {remainingCount > 0 && (
        <li className={styles.moreFiles}>+{remainingCount} more file(s)</li>
      )}
    </ul>
  );

  const renderCompact = () => (
    <div className={styles.compactContainer}>
      {displayFiles.map((file, index) => {
        const FileIcon = getFileIcon(file.mimeType);
        return (
          <a
            key={file.id || index}
            href={getFileUrl(file)}
            download={file.name}
            className={styles.compactFile}
            title={file.name}
          >
            <FileIcon className={styles.compactIcon} />
            <span className={styles.compactName}>{file.name}</span>
          </a>
        );
      })}
      {remainingCount > 0 && (
        <span className={styles.compactMore}>+{remainingCount}</span>
      )}
    </div>
  );

  const renderCard = () => (
    <div className={styles.cardContainer}>
      {displayFiles.map((file, index) => {
        const FileIcon = getFileIcon(file.mimeType);
        const isImage = file.mimeType?.startsWith('image/');

        return (
          <div key={file.id || index} className={styles.card}>
            {isImage ? (
              <div className={styles.cardPreview}>
                <img
                  src={getFileUrl(file)}
                  alt={file.name}
                  className={styles.cardImage}
                />
              </div>
            ) : (
              <div className={styles.cardIconContainer}>
                <FileIcon className={styles.cardIcon} />
              </div>
            )}
            <div className={styles.cardContent}>
              <span className={styles.cardName}>{file.name}</span>
              {showSize && file.size && (
                <span className={styles.cardSize}>{formatFileSize(file.size)}</span>
              )}
            </div>
            {showDownload && (
              <a
                href={getFileUrl(file)}
                download={file.name}
                className={styles.cardDownload}
              >
                <Download className={styles.cardDownloadIcon} />
              </a>
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
      {displayStyle === 'compact' && renderCompact()}
      {displayStyle === 'card' && renderCard()}
    </div>
  );
}
