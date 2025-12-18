/**
 * ValueSource Type System
 *
 * Provides type-safe value references for Puck component configuration.
 * Instead of string patterns like "{params.id}", we use typed objects
 * that can be resolved at runtime.
 *
 * This enables:
 * - Type-safe value references (no runtime string parsing)
 * - Clear separation between data values and display text
 * - Easier debugging (value sources are explicit objects)
 * - IDE autocomplete and validation
 */

/**
 * Static value - a hardcoded constant
 */
export interface StaticValueSource {
  type: 'static';
  value: unknown;
}

/**
 * URL params value - from query string (?id=123)
 * Resolved server-side when available, client-side otherwise
 */
export interface ParamsValueSource {
  type: 'params';
  /** Query parameter key */
  key: string;
}

/**
 * Row data value - from parent DataBlock row
 * Only available inside a DataBlock iteration
 */
export interface RowDataValueSource {
  type: 'rowData';
  /** Field name to look up in parent row */
  field: string;
}

/**
 * State value - from a StateBlock container
 * Only available within a StateBlock scope (client-side only)
 */
export interface StateValueSource {
  type: 'state';
  /** StateBlock container name */
  container: string;
  /** Variable key within the container */
  key: string;
}

/**
 * Form data value - from form submission context
 * Only available during action execution
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
  | ParamsValueSource
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
  return ['static', 'params', 'rowData', 'state', 'formData'].includes(obj.type);
}

/**
 * Helper to create a static value source
 */
export function staticValue(value: unknown): StaticValueSource {
  return { type: 'static', value };
}

/**
 * Helper to create a params value source
 */
export function paramsValue(key: string): ParamsValueSource {
  return { type: 'params', key };
}

/**
 * Helper to create a rowData value source
 */
export function rowDataValue(field: string): RowDataValueSource {
  return { type: 'rowData', field };
}

/**
 * Helper to create a state value source
 */
export function stateValue(container: string, key: string): StateValueSource {
  return { type: 'state', container, key };
}

/**
 * Helper to create a formData value source
 */
export function formDataValue(field: string): FormDataValueSource {
  return { type: 'formData', field };
}

/**
 * Resolution context for resolving ValueSources
 * Different sources require different context to be available
 */
export interface ValueResolutionContext {
  /** URL query parameters */
  params?: Record<string, string | string[] | undefined>;
  /** Parent row data resolver */
  resolveRowData?: (field: string) => unknown;
  /** State container value getter */
  getStateValue?: (container: string, key: string) => unknown;
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

    case 'params':
      if (!context.params) {
        console.warn(`[ValueSource] No params context available for key: ${source.key}`);
        return undefined;
      }
      return context.params[source.key];

    case 'rowData':
      if (!context.resolveRowData) {
        console.warn(`[ValueSource] No rowData context available for field: ${source.field}`);
        return undefined;
      }
      return context.resolveRowData(source.field);

    case 'state':
      if (!context.getStateValue) {
        console.warn(`[ValueSource] No state context available for: ${source.container}.${source.key}`);
        return undefined;
      }
      return context.getStateValue(source.container, source.key);

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
 * Convert a legacy string pattern to ValueSource (for migration)
 *
 * Handles patterns like:
 * - "{params.id}" -> ParamsValueSource
 * - "{rowData.field}" -> RowDataValueSource
 * - "{state.container.key}" -> StateValueSource
 * - Plain strings -> StaticValueSource
 */
export function stringPatternToValueSource(pattern: string): ValueSource {
  // Match {params.key}
  const paramsMatch = pattern.match(/^\{params\.(\w+)\}$/);
  if (paramsMatch) {
    return paramsValue(paramsMatch[1]);
  }

  // Match {rowData.field}
  const rowDataMatch = pattern.match(/^\{rowData\.(\w+)\}$/);
  if (rowDataMatch) {
    return rowDataValue(rowDataMatch[1]);
  }

  // Match {state.container.key}
  const stateMatch = pattern.match(/^\{state\.(\w+)\.(\w+)\}$/);
  if (stateMatch) {
    return stateValue(stateMatch[1], stateMatch[2]);
  }

  // Match {formData.field}
  const formDataMatch = pattern.match(/^\{formData\.(\w+)\}$/);
  if (formDataMatch) {
    return formDataValue(formDataMatch[1]);
  }

  // Default to static value
  return staticValue(pattern);
}
