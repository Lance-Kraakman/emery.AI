/**
 * Template Resolution Utility
 *
 * AIDEV-NOTE: Simple {{variable}} placeholder resolution from a flat variable map.
 * Used by HumanTaskCard, InstructionTemplateService, and other template consumers.
 *
 * For complex namespace-based resolution (state, rowData, params), use useResolveVariables hook.
 */

/**
 * Format a value for display in resolved template text
 */
export function formatTemplateValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => formatTemplateValue(v)).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

/**
 * Resolve {{variable}} placeholders in a template string using a variable map
 *
 * @param template - String with {{variable}} placeholders
 * @param variables - Map of variable names to values
 * @param options - Resolution options
 * @returns Template with placeholders replaced
 *
 * @example
 * ```ts
 * resolveTemplate("Hello {{name}}!", { name: "World" })
 * // Returns: "Hello World!"
 *
 * resolveTemplate("Order {{orderId}} for {{email}}", { orderId: 123, email: "user@example.com" })
 * // Returns: "Order 123 for user@example.com"
 * ```
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, unknown>,
  options: { keepUnresolved?: boolean } = {}
): string {
  if (!template || typeof template !== 'string') {
    return template || '';
  }

  const { keepUnresolved = true } = options;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim();
    const value = variables[trimmedName];

    if (value !== undefined && value !== null) {
      return formatTemplateValue(value);
    }

    return keepUnresolved ? match : '';
  });
}

/**
 * Check if a template string contains any {{variable}} placeholders
 */
export function hasTemplatePlaceholders(template: string): boolean {
  return /\{\{[^}]+\}\}/.test(template);
}

/**
 * Extract all placeholder names from a template string
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
  return Array.from(matches, m => m[1].trim());
}
