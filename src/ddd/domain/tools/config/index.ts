/**
 * Tools Configuration Index
 *
 * Exports all tool configurations for easy importing.
 * Combines built-in tools with generated Pipedream tools.
 */

export * from './built-in-tools';

// Conditional imports for generated Pipedream tools (may not exist yet)
export type PipedreamToolMetadata = {
  id: string;
  app: string;
  name: string;
  description: string;
  type: 'action' | 'mcp';
  inputs: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
};

export type PipedreamToolId = string;

// Export empty defaults - will be populated when pipedream tools are generated
export const PIPEDREAM_TOOLS: Record<string, PipedreamToolMetadata> = {};
export const PIPEDREAM_TOOLS_ARRAY: PipedreamToolMetadata[] = [];

/**
 * Check if Pipedream tools are available
 */
export function hasPipedreamTools(): boolean {
  return Object.keys(PIPEDREAM_TOOLS).length > 0;
}

/**
 * Get total tool count
 */
export function getTotalToolCount(): number {
  const { BUILT_IN_TOOLS } = require('./built-in-tools');
  return BUILT_IN_TOOLS.length + Object.keys(PIPEDREAM_TOOLS).length;
}