/**
 * ValueSource Type System
 *
 * AIDEV-NOTE: Provides type-safe value references for Puck component configuration.
 * Instead of string patterns, we use typed objects that can be resolved at runtime.
 *
 * Supported sources:
 * - static: Hardcoded values
 * - rowData: From parent DataBlock row
 * - state: From page state (flat namespace, auto-populated from URL params)
 * - formData: From form submission context
 */

/**
 * Static value - a hardcoded constant
 */
export interface StaticValueSource {
  type: 'static';
  value: unknown;
}

/**
 * Row data value - from parent DataBlock row
 */
export interface RowDataValueSource {
  type: 'rowData';
  /** Field name to look up in parent row */
  field: string;
}

/**
 * State value - from page state (flat namespace)
 */
export interface StateValueSource {
  type: 'state';
  /** Variable key (flat namespace - no container) */
  key: string;
}

/**
 * Form data value - from form submission context
 */
export interface FormDataValueSource {
  type: 'formData';
  /** Form field name */
  field: string;
}

/**
 * Union type of all value sources
 */
export type ValueSource =
  | StaticValueSource
  | RowDataValueSource
  | StateValueSource
  | FormDataValueSource;

/**
 * Type guard to check if a value is a ValueSource object
 */
export function isValueSource(value: unknown): value is ValueSource {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  return ['static', 'rowData', 'state', 'formData'].includes(obj.type);
}

/**
 * Helper to create a static value source
 */
export function staticValue(value: unknown): StaticValueSource {
  return { type: 'static', value };
}

/**
 * Helper to create a rowData value source
 */
export function rowDataValue(field: string): RowDataValueSource {
  return { type: 'rowData', field };
}

/**
 * Helper to create a state value source (flat namespace)
 */
export function stateValue(key: string): StateValueSource {
  return { type: 'state', key };
}

/**
 * Helper to create a formData value source
 */
export function formDataValue(field: string): FormDataValueSource {
  return { type: 'formData', field };
}

/**
 * Resolution context for resolving ValueSources
 */
export interface ValueResolutionContext {
  /** Parent row data resolver */
  resolveRowData?: (field: string) => unknown;
  /** State value getter (flat namespace) */
  getStateValue?: (key: string) => unknown;
  /** Form data (during action execution) */
  formData?: Record<string, unknown>;
}

/**
 * Resolve a ValueSource to its actual value
 */
export function resolveValueSource(
  source: ValueSource,
  context: ValueResolutionContext
): unknown {
  switch (source.type) {
    case 'static':
      return source.value;

    case 'rowData':
      if (!context.resolveRowData) {
        console.warn(`[ValueSource] No rowData context available for field: ${source.field}`);
        return undefined;
      }
      return context.resolveRowData(source.field);

    case 'state':
      if (!context.getStateValue) {
        console.warn(`[ValueSource] No state context available for: ${source.key}`);
        return undefined;
      }
      return context.getStateValue(source.key);

    case 'formData':
      if (!context.formData) {
        console.warn(`[ValueSource] No formData context available for field: ${source.field}`);
        return undefined;
      }
      return context.formData[source.field];

    default:
      console.warn(`[ValueSource] Unknown source type:`, source);
      return undefined;
  }
}

/**
 * Convert a string pattern to ValueSource
 *
 * Handles patterns like:
 * - "{rowData.field}" -> RowDataValueSource
 * - "{state.key}" -> StateValueSource (flat namespace)
 * - "{formData.field}" -> FormDataValueSource
 * - Plain strings -> StaticValueSource
 */
export function stringPatternToValueSource(pattern: string): ValueSource {
  // Match {rowData.field}
  const rowDataMatch = pattern.match(/^\{rowData\.(\w+)\}$/);
  if (rowDataMatch) {
    return rowDataValue(rowDataMatch[1]);
  }

  // Match {state.key} (flat namespace - just one key)
  const stateMatch = pattern.match(/^\{state\.(\w+)\}$/);
  if (stateMatch) {
    return stateValue(stateMatch[1]);
  }

  // Match {formData.field}
  const formDataMatch = pattern.match(/^\{formData\.(\w+)\}$/);
  if (formDataMatch) {
    return formDataValue(formDataMatch[1]);
  }

  // Default to static value
  return staticValue(pattern);
}
