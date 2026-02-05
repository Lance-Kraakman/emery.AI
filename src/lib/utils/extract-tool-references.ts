/**
 * Extract Tool References from Instructions Text
 *
 * Parses @tool:name, @doc:name, @table:name, @agent:name, @file:name,
 * @database:name patterns from skill instructions and returns ToolConfigDTOs.
 *
 * Maps reference-style patterns to their underlying tool names
 * (matching tool-resolver-service.ts mappings).
 */

import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';

/** Pattern-to-tool mapping for reference-style mentions */
const REFERENCE_MAPPINGS: Array<{
  prefix: string;
  pattern: RegExp;
  toToolConfig: (resourceName: string) => Pick<ToolConfigDTO, 'name' | 'config'>;
}> = [
  {
    prefix: '@doc:',
    pattern: /@doc:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name: `@doc:${name}`,
      config: { type: 'reference', category: 'documents', resourceName: name, displayName: name },
    }),
  },
  {
    prefix: '@table:',
    pattern: /@table:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name: `@table:${name}`,
      config: { type: 'reference', category: 'tables', resourceName: name, displayName: name },
    }),
  },
  {
    prefix: '@file:',
    pattern: /@file:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name: `@file:${name}`,
      config: { type: 'reference', category: 'files', resourceName: name, displayName: name },
    }),
  },
  {
    prefix: '@agent:',
    pattern: /@agent:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name: `@agent:${name}`,
      config: { type: 'reference', category: 'agents', resourceName: name, displayName: name },
    }),
  },
  {
    prefix: '@database:',
    pattern: /@database:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name: `@database:${name}`,
      config: { type: 'reference', category: 'databases', resourceName: name, displayName: name },
    }),
  },
  {
    prefix: '@tool:',
    pattern: /@tool:([^\s@]+)/g,
    toToolConfig: (name) => ({
      name,
      config: { type: 'system', displayName: formatDisplayName(name) },
    }),
  },
];

function formatDisplayName(toolName: string): string {
  // Strip app prefix (first segment before _) and title-case
  const idx = toolName.indexOf('_');
  const withoutPrefix = idx > 0 ? toolName.slice(idx + 1) : toolName;
  return withoutPrefix
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/**
 * Extract tool references from instructions text.
 *
 * Returns ToolConfigDTOs for each unique @-mention found in the text.
 * Each extracted tool has `config.source: 'instruction'` to distinguish
 * from manually-added tools.
 */
export function extractToolReferences(text: string): ToolConfigDTO[] {
  if (!text) return [];

  const seen = new Set<string>();
  const tools: ToolConfigDTO[] = [];

  for (const mapping of REFERENCE_MAPPINGS) {
    // Reset regex lastIndex for each call
    const regex = new RegExp(mapping.pattern.source, mapping.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const resourceName = match[1];
      const toolConfig = mapping.toToolConfig(resourceName);

      if (!seen.has(toolConfig.name)) {
        seen.add(toolConfig.name);
        tools.push({
          ...toolConfig,
          config: {
            ...toolConfig.config,
            source: 'instruction',
          },
        });
      }
    }
  }

  return tools;
}

/**
 * Merge instruction-extracted tools with existing tools array.
 *
 * - Adds new tools found in instructions that aren't already in the array
 * - Removes instruction-sourced tools that are no longer in the text
 * - Preserves manually-added tools (those without source: 'instruction')
 */
export function mergeToolReferences(
  existingTools: ToolConfigDTO[],
  instructionTools: ToolConfigDTO[]
): ToolConfigDTO[] {
  const instructionNames = new Set(instructionTools.map((t) => t.name));

  // Keep manually-added tools + instruction tools that are still in the text
  const manualTools = existingTools.filter(
    (t) => t.config?.source !== 'instruction'
  );
  const keptInstructionTools = existingTools.filter(
    (t) => t.config?.source === 'instruction' && instructionNames.has(t.name)
  );

  // Find new instruction tools not already present
  const existingNames = new Set(existingTools.map((t) => t.name));
  const newTools = instructionTools.filter((t) => !existingNames.has(t.name));

  return [...manualTools, ...keptInstructionTools, ...newTools];
}
