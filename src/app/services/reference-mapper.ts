/**
 * Simple Reference-to-Tool Mapping Service
 *
 * Maps @ references to execution tools with proper parameters.
 * No complex auto-binding - just simple, predictable mappings.
 */

export interface ReferenceMapping {
  pattern: RegExp;
  toolName: string;
  parameterName: string;
}

/**
 * Simple mapping configuration
 * Maps @ patterns to execution tools that actually exist in backend
 */
const REFERENCE_MAPPINGS: ReferenceMapping[] = [
  {
    pattern: /@doc:([^@\s]+)/g,
    toolName: 'document_reader',
    parameterName: 'document_id'
  },
  {
    pattern: /@document:([^@\s]+)/g,
    toolName: 'document_reader',
    parameterName: 'document_id'
  },
  {
    pattern: /@table:([^@\s]+)/g,
    toolName: 'table_query',
    parameterName: 'table_name'
  },
  {
    pattern: /@file:([^@\s]+)/g,
    toolName: 'file_reader',
    parameterName: 'file_path'
  }
  // AIDEV-NOTE: Only include tools that exist in base_tools.py
  // Removed agent_reader and database_query as they don't exist yet
];

export interface ToolReference {
  original: string;     // "@doc:myfile.pdf"
  toolName: string;     // "document_reader"
  parameter: string;    // "document_id"
  value: string;        // "myfile.pdf"
}

/**
 * Extract tool references from a message
 */
export function extractToolReferences(message: string): ToolReference[] {
  const references: ToolReference[] = [];

  for (const mapping of REFERENCE_MAPPINGS) {
    const matches = message.matchAll(mapping.pattern);

    for (const match of matches) {
      references.push({
        original: match[0],
        toolName: mapping.toolName,
        parameter: mapping.parameterName,
        value: match[1]
      });
    }
  }

  return references;
}

/**
 * Convert message with @ references to use proper tool calls
 */
export function mapReferencesToTools(message: string): {
  mappedMessage: string;
  toolReferences: ToolReference[];
} {
  const toolReferences = extractToolReferences(message);
  let mappedMessage = message;

  // Replace each reference with tool call syntax
  for (const ref of toolReferences) {
    const toolCall = `@tool:${ref.toolName}`;
    mappedMessage = mappedMessage.replace(ref.original, toolCall);
  }

  return {
    mappedMessage,
    toolReferences
  };
}

/**
 * Check if a tool supports a specific reference prefix
 */
export function getToolForReference(prefix: string): string | null {
  const mapping = REFERENCE_MAPPINGS.find(m => {
    // Convert regex pattern to check if it matches the prefix
    const prefixPattern = m.pattern.source.split('(')[0]; // Get part before capture group
    return prefixPattern.includes(prefix);
  });

  return mapping?.toolName || null;
}

/**
 * Get all supported reference prefixes
 */
export function getSupportedPrefixes(): string[] {
  return REFERENCE_MAPPINGS.map(m => {
    // Extract prefix from regex pattern like /@doc:/ -> "@doc:"
    const match = m.pattern.source.match(/@[^:]+:/);
    return match ? match[0] : '';
  }).filter(Boolean);
}