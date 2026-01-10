/**
 * useOrgChartPersistence Hook
 *
 * Auto-save canvas metadata (positions, sizes, sticky notes).
 * Uses an interval-based approach to avoid constant timeout resets.
 */

import { useEffect, useRef } from 'react';
import type { OrgChartNode } from '../types';
import { extractMetadataFromNodes } from '../utils';
import { saveOrgChartCanvasMetadata } from '@/app/actions/organizations';

export function useOrgChartPersistence(
  nodes: OrgChartNode[],
  isInitialized: boolean
): void {
  const lastSavedRef = useRef<string>('');
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Check every 2 seconds if there are unsaved changes
    const intervalId = setInterval(() => {
      const currentNodes = nodesRef.current;

      const metadata = extractMetadataFromNodes(currentNodes);
      const metadataJson = JSON.stringify(metadata);

      if (metadataJson !== lastSavedRef.current) {
        lastSavedRef.current = metadataJson;
        saveOrgChartCanvasMetadata(metadata).catch((err) => {
          console.error('[OrgChart] Save error:', err);
        });
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isInitialized]);
}
