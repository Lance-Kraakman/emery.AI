'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFields } from '@/app/actions/fields';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * Shared hook for lazily fetching and caching table fields.
 * Prevents duplicate API calls when multiple components need fields for the same tables.
 */
export function useTableFields(tableIds: number[]) {
  const [tableFieldsMap, setTableFieldsMap] = useState<Map<number, FieldDTO[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch fields for all provided table IDs (deduped against already-fetched)
  useEffect(() => {
    const missing = tableIds.filter((id) => id > 0 && !tableFieldsMap.has(id));
    if (missing.length === 0) return;

    setLoading(true);
    const fetchAll = async () => {
      const newEntries = new Map<number, FieldDTO[]>();
      for (const tableId of missing) {
        try {
          const fields = await getFields(tableId);
          if (Array.isArray(fields)) {
            newEntries.set(tableId, fields);
          }
        } catch (e) {
          console.error(`Failed to fetch fields for table ${tableId}:`, e);
        }
      }
      setTableFieldsMap((prev) => {
        const merged = new Map(prev);
        newEntries.forEach((v, k) => merged.set(k, v));
        return merged;
      });
      setLoading(false);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds.join(',')]);

  // Imperatively fetch fields for a single table (used when a new table is selected)
  const fetchFieldsForTable = useCallback(
    async (tableId: number) => {
      if (tableFieldsMap.has(tableId)) return;
      try {
        const fields = await getFields(tableId);
        if (Array.isArray(fields)) {
          setTableFieldsMap((prev) => new Map(prev).set(tableId, fields));
        }
      } catch (e) {
        console.error(`Failed to fetch fields for table ${tableId}:`, e);
      }
    },
    [tableFieldsMap]
  );

  return { tableFieldsMap, fetchFieldsForTable, loading };
}
