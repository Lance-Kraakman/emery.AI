'use client';

/**
 * DataContextBlock - Client Component
 *
 * Provides single-record context to child blocks, similar to RepeatBlock but for ONE record.
 * Fetches a specific row from a view and makes it available to children via RowDataContext.
 *
 * Use cases:
 * - User profile pages (show specific user's data)
 * - Detail views (show specific order/product/etc.)
 * - Nested contexts (show manager info within user profile)
 *
 * Context resolution:
 * - Wraps children in RowDataProvider
 * - Children access data via useRowData() hook
 * - Nearest context wins for nested DataContextBlocks
 */

import { DropZone } from "@measured/puck";
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { Section } from '@/components/puck/components/Section';
import styles from './styles.module.css';

export interface DataContextBlockProps {
  viewId: number;
  rowParam?: string;    // Query param name to get row ID from
  rowId?: number;       // Or static row ID
  mode: 'param' | 'static';

  // Server-resolved data
  _resolvedRow?: Record<string, any>;
  _viewName?: string;
  _error?: string;

  // Puck props
  puck?: {
    renderDropZone: typeof DropZone;
  };
}

export default function DataContextBlock({
  viewId,
  rowParam,
  rowId,
  mode = 'param',
  _resolvedRow,
  _viewName,
  _error,
  puck,
}: DataContextBlockProps) {
  // No view selected
  if (!viewId) {
    return (
      <Section>
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>
            Please select a data source (view) in the editor
          </p>
        </div>
      </Section>
    );
  }

  // Error loading data
  if (_error) {
    return (
      <Section>
        <div className={styles.error}>
          <p className={styles.errorText}>
            ⚠️ Error loading data: {_error}
          </p>
        </div>
      </Section>
    );
  }

  // No row parameter in param mode
  if (mode === 'param' && !rowParam) {
    return (
      <Section>
        <div className={styles.error}>
          <p className={styles.errorText}>
            ⚠️ Please specify which query parameter contains the row ID
          </p>
        </div>
      </Section>
    );
  }

  // No row ID in static mode
  if (mode === 'static' && !rowId) {
    return (
      <Section>
        <div className={styles.error}>
          <p className={styles.errorText}>
            ⚠️ Please specify a row ID
          </p>
        </div>
      </Section>
    );
  }

  // No data loaded
  if (!_resolvedRow) {
    return (
      <Section>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No data found
            {mode === 'param' && rowParam && ` (query param "${rowParam}" not provided or row not found)`}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className={styles.dataContext}>
        {/* Optional: Show view name header */}
        {_viewName && (
          <div className={styles.header}>
            <span className={styles.badge}>Data Context</span>
            <span className={styles.viewName}>{_viewName}</span>
          </div>
        )}

        {/* Provide row context to children */}
        <RowDataProvider rowData={_resolvedRow} rowIndex={0}>
          <div className={styles.content}>
            {puck?.renderDropZone ? (
              <DropZone zone="content" />
            ) : (
              <div className={styles.templatePlaceholder}>
                <p className={styles.templatePlaceholderText}>
                  Drag blocks here to display data from this record
                </p>
                <p className={styles.hint}>
                  Use Field blocks (TextField, ImageField, etc.) to display specific fields
                </p>
              </div>
            )}
          </div>
        </RowDataProvider>
      </div>
    </Section>
  );
}
