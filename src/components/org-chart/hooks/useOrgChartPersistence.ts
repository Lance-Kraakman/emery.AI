/**
 * useOrgChartPersistence Hook
 *
 * Auto-save canvas metadata (positions, sizes, sticky notes, edges).
 * Uses an interval-based approach to avoid constant timeout resets.
 */

import { useEffect, useRef } from 'react';
import type { OrgChartNode, OrgChartEdge } from '../types';
import { extractMetadataFromNodes } from '../utils';
import { saveOrgChartCanvasMetadata } from '@/app/actions/organizations';

export function useOrgChartPersistence(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[],
  isInitialized: boolean
): void {
  const lastSavedRef = useRef<string>('');
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Check every 2 seconds if there are unsaved changes
    const intervalId = setInterval(() => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      const metadata = extractMetadataFromNodes(currentNodes, currentEdges);
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
