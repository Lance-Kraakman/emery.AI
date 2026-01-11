/**
 * Rename Cascade Utility
 *
 * When a node is renamed, this utility updates all variable references
 * in downstream nodes to use the new name.
 *
 * Example: If "read_abc" is renamed to "customer_data", all references
 * like "{{read_abc.name}}" become "{{customer_data.name}}"
 */

import type { WorkflowNodeData } from '../types';

/**
 * Recursively replace variable references in an object.
 * Handles strings, arrays, and nested objects.
 *
 * @param obj - The object to process
 * @param oldName - The old node name to find
 * @param newName - The new node name to replace with
 * @returns The updated object with replaced references
 */
function replaceRefsInValue(obj: unknown, oldName: string, newName: string): unknown {
  if (typeof obj === 'string') {
    // Replace {{oldName.xxx}} with {{newName.xxx}}
    // Also handle bare references like oldName.xxx (without braces)
    return obj
      .replace(new RegExp(`\\{\\{${escapeRegex(oldName)}\\.`, 'g'), `{{${newName}.`)
      .replace(new RegExp(`\\b${escapeRegex(oldName)}\\.`, 'g'), `${newName}.`);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => replaceRefsInValue(item, oldName, newName));
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceRefsInValue(value, oldName, newName);
    }
    return result;
  }

  return obj;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update all variable references in node data when a source node is renamed.
 *
 * This handles all places where variable references can appear:
 * - Agentic: instructions field
 * - Condition: conditions[].expression
 * - Loop: loopConfig.itemsVar, loopConfig.condition
 * - Operation: promptTemplate
 * - Write: fieldMappings[].skillInputName, updateMatch.skillInputName
 * - Read: rowIdSource.skillInput
 *
 * @param data - The node data to update
 * @param oldName - The old node name
 * @param newName - The new node name
 * @returns Updated node data with references replaced
 */
export function cascadeRenameInNodeData(
  data: WorkflowNodeData,
  oldName: string,
  newName: string
): WorkflowNodeData {
  // Deep clone to avoid mutations
  const updated = JSON.parse(JSON.stringify(data)) as WorkflowNodeData;

  // Replace references recursively in all fields
  return replaceRefsInValue(updated, oldName, newName) as WorkflowNodeData;
}
