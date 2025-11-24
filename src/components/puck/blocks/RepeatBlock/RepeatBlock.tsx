'use client';

/**
 * RepeatBlock - Client Component
 *
 * AIDEV-NOTE: Renders a list of items using a custom template.
 * Each item iteration is wrapped with RowDataContext so child blocks can access row data.
 */

import { DropZone } from "@measured/puck";
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { cn } from '@/lib/utils';
import styles from './styles.module.css';

export interface RepeatBlockProps {
  viewId: number;
  itemsPerPage: number;
  showMoreButton: boolean;
  orientation: 'vertical' | 'horizontal';
  columns: number;
  gap: string;

  // Server-resolved data
  _viewName?: string;
  _tableId?: number;
  _rows?: Record<string, any>[];
  _totalCount?: number;

  // Puck props
  puck?: {
    renderDropZone: typeof DropZone;
  };
}

export default function RepeatBlock({
  viewId,
  itemsPerPage = 10,
  showMoreButton = true,
  orientation = 'vertical',
  columns = 2,
  gap = '4',
  _viewName,
  _rows = [],
  _totalCount = 0,
  puck,
}: RepeatBlockProps) {
  const hasMoreItems = _totalCount > _rows.length;

  // If no view selected, show placeholder
  if (!viewId) {
    return (
      <Section>
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>
            Please select a data source (grid view) in the editor
          </p>
        </div>
      </Section>
    );
  }

  // If no rows, show empty state
  if (_rows.length === 0) {
    return (
      <Section>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No data to display
            {_viewName && ` from "${_viewName}"`}
          </p>
        </div>
      </Section>
    );
  }

  // Determine container classes based on orientation
  const containerClass = cn(
    styles.repeatContainer,
    orientation === 'vertical' ? styles.vertical : styles.horizontal,
    orientation === 'horizontal' && `grid-cols-${columns}`,
    `gap-${gap}`
  );

  return (
    <Section>
      <div className={styles.repeatBlock}>
        {/* Optional: Show view name header */}
        {_viewName && (
          <div className={styles.header}>
            <h3 className={styles.title}>{_viewName}</h3>
            <span className={styles.count}>
              {_rows.length} {_rows.length === 1 ? 'item' : 'items'}
              {hasMoreItems && ` of ${_totalCount}`}
            </span>
          </div>
        )}

        {/* Repeat items container */}
        <div className={containerClass}>
          {_rows.map((row, index) => (
            <div key={row.id || index} className={styles.item}>
              {/* Wrap each iteration with RowDataContext */}
              <RowDataProvider rowData={row} rowIndex={index}>
                {/* Render the itemTemplate zone with unique name per row */}
                {puck?.renderDropZone ? (
                  <DropZone zone={`itemTemplate-${row.id || index}`} />
                ) : (
                  <div className={styles.templatePlaceholder}>
                    <p className={styles.templatePlaceholderText}>
                      Drag blocks here to design your item template
                    </p>
                  </div>
                )}
              </RowDataProvider>
            </div>
          ))}
        </div>

        {/* Show More button */}
        {showMoreButton && hasMoreItems && (
          <div className={styles.loadMoreContainer}>
            <Button
              variant="outline"
              onClick={() => {
                // TODO: Implement pagination
                // For now, this is a placeholder
                console.log('Load more clicked');
              }}
              className={styles.loadMoreButton}
            >
              Load More ({_totalCount - _rows.length} remaining)
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
