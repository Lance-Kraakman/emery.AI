/**
 * Skill Row Utils
 *
 * Utilities for detecting and handling skill input mappings that require row selection.
 */

import type { InputDefinition } from '@/ddd/domain/skills/entities/skill';

/**
 * Table mapping requirement for a skill
 */
export interface SkillTableMapping {
  inputName: string;
  tableId: number;
  fieldId: number;
  requiresRowSelection: boolean;  // true if rowSource is 'source_row'
}

/**
 * Check if a skill has input mappings that require row selection from the user.
 * This happens when the rowSource is 'source_row' (which expects automation context).
 *
 * @param inputs - The skill's input definitions
 * @returns Array of table mappings that require row selection
 */
export function getSkillTableMappings(inputs: InputDefinition[]): SkillTableMapping[] {
  return inputs
    .filter((input) => {
      const mapping = input.inputMapping;
      if (!mapping?.source?.tableId) return false;
      // Only flag as requiring selection if it uses source_row
      return mapping.source.rowSource?.type === 'source_row';
    })
    .map((input) => ({
      inputName: input.name,
      tableId: input.inputMapping!.source.tableId,
      fieldId: input.inputMapping!.source.fieldId,
      requiresRowSelection: true,
    }));
}

/**
 * Check if a skill requires row selection for execution.
 *
 * @param inputs - The skill's input definitions
 * @returns true if the skill has any inputs requiring row selection
 */
export function skillRequiresRowSelection(inputs: InputDefinition[]): boolean {
  return getSkillTableMappings(inputs).length > 0;
}

/**
 * Get unique table IDs that need row selection.
 *
 * @param inputs - The skill's input definitions
 * @returns Array of unique table IDs
 */
export function getTablesRequiringRowSelection(inputs: InputDefinition[]): number[] {
  const mappings = getSkillTableMappings(inputs);
  return [...new Set(mappings.map((m) => m.tableId))];
}

/**
 * Row execution context for chat
 */
export interface SkillRowContext {
  /** Single row mode - execute skill once with this row */
  rowId?: number;
  /** Batch mode - execute skill for all rows in table */
  batchMode?: boolean;
  /** Table ID for the row context */
  tableId?: number;
}
