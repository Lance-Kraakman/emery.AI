/**
 * TableBlock - Server Component
 *
 * AIDEV-NOTE: This is the render component for TableBlock.
 * It receives pre-resolved data from the resolveData hook and renders
 * a table/grid with the configured field mappings.
 */

import React from "react";
import type { Row } from "@/ddd/domain/tables/value-objects/row";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import styles from "./styles.module.css";

export interface FieldMapping {
  sourceFieldId: number;
  displayName: string;
  visible: boolean;
  order: number;
}

export interface TableBlockProps {
  // Configuration props (set in Puck editor)
  table?: {
    id: number;
    name: string;
    databaseId: number;
  };
  dataSourceId?: number;
  dataSourceName?: string;
  fieldMappings?: FieldMapping[];
  showHeader?: boolean;
  striped?: boolean;
  bordered?: boolean;
  compact?: boolean;

  // Resolved data (injected by resolveData hook)
  _rows?: Row[];
  _fields?: TableField[];
  _totalCount?: number;
}

/**
 * TableBlock Component
 *
 * Renders a data table with configured field mappings.
 * Data is pre-fetched and filtered/sorted server-side.
 */
export default function TableBlock(props: TableBlockProps) {
  const {
    dataSourceName,
    fieldMappings = [],
    showHeader = true,
    striped = true,
    bordered = false,
    compact = false,
    _rows = [],
    _fields = [],
    _totalCount = 0,
  } = props;

  // If no table selected, show placeholder
  if (!props.table?.id) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>📊</div>
        <p className={styles.placeholderText}>
          Select a table to display data
        </p>
      </div>
    );
  }

  // If data source selected but no data, show empty state
  if (_rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📭</div>
        <p className={styles.emptyText}>
          No data available
          {dataSourceName && ` from ${dataSourceName}`}
        </p>
      </div>
    );
  }

  // Filter and sort field mappings by visibility and order
  const visibleMappings = fieldMappings
    .filter((m) => m.visible)
    .sort((a, b) => a.order - b.order);

  // If no visible columns, show message
  if (visibleMappings.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          No visible columns configured. Edit field mappings to show data.
        </p>
      </div>
    );
  }

  // Build class names
  const tableClasses = [
    styles.table,
    striped && styles.striped,
    bordered && styles.bordered,
    compact && styles.compact,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.container}>
      {dataSourceName && (
        <div className={styles.header}>
          <h3 className={styles.title}>{dataSourceName}</h3>
          <span className={styles.count}>
            {_rows.length} {_rows.length === 1 ? "row" : "rows"}
            {_totalCount > _rows.length && ` of ${_totalCount}`}
          </span>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={tableClasses}>
          {showHeader && (
            <thead>
              <tr>
                {visibleMappings.map((mapping) => (
                  <th key={mapping.sourceFieldId} className={styles.th}>
                    {mapping.displayName}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {_rows.map((row, rowIndex) => {
              // AIDEV-NOTE: _rows are already plain objects (from Server Action DTOs)
              // No need to call .toPlainObject() anymore
              const rowData = row as Record<string, any>;

              return (
                <tr key={rowData.id || rowIndex} className={styles.tr}>
                  {visibleMappings.map((mapping) => {
                    const fieldValue = rowData[`field_${mapping.sourceFieldId}`];
                    // AIDEV-NOTE: _fields are now plain objects: { id, name, type, slug }
                    const field = _fields.find(
                      (f) => (f as any).id === mapping.sourceFieldId
                    );

                    return (
                      <td key={mapping.sourceFieldId} className={styles.td}>
                        {formatCellValue(fieldValue, (field as any)?.type)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Format cell value based on field type
 */
function formatCellValue(value: any, fieldType?: string): React.ReactNode {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className={styles.nullValue}>—</span>;
  }

  // Handle empty strings
  if (value === "") {
    return <span className={styles.emptyValue}>(empty)</span>;
  }

  // Format based on field type
  switch (fieldType) {
    case "boolean":
      return value ? "✓" : "✗";

    case "date":
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return String(value);
      }

    case "email":
      return <a href={`mailto:${value}`} className={styles.link}>{value}</a>;

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {value}
        </a>
      );

    case "number":
      return typeof value === "number" ? value.toLocaleString() : value;

    case "file":
    case "document":
      // File fields return arrays of file objects
      if (Array.isArray(value)) {
        return `${value.length} file${value.length === 1 ? "" : "s"}`;
      }
      return String(value);

    case "relation":
      // Relation fields return arrays of IDs
      if (Array.isArray(value)) {
        return `${value.length} relation${value.length === 1 ? "" : "s"}`;
      }
      return String(value);

    default:
      // For text and other types, display as string
      // Truncate very long values
      const stringValue = String(value);
      if (stringValue.length > 100) {
        return (
          <span title={stringValue}>
            {stringValue.substring(0, 100)}...
          </span>
        );
      }
      return stringValue;
  }
}
