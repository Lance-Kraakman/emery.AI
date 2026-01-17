// AIDEV-NOTE: Builtin templates loader
// Loads and provides access to builtin templates from JSON files
// These templates are version-controlled with the codebase and loaded at runtime

import type { BrainTemplate, TemplateEntityType, BuiltinTemplateInfo } from '@/ddd/domain/templates/types';

// Import builtin skill templates
import tableOperations from './skills/table-operations.brain.json';
import documentOperations from './skills/document-operations.brain.json';
import dataLookup from './skills/data-lookup.brain.json';

/**
 * Registry of all builtin templates
 * Key format: "{entityType}/{templateName}" (e.g., "skill/table-operations")
 */
export const BUILTIN_TEMPLATES: Record<string, BrainTemplate> = {
  'skill/table-operations': tableOperations as unknown as BrainTemplate,
  'skill/document-operations': documentOperations as unknown as BrainTemplate,
  'skill/data-lookup': dataLookup as unknown as BrainTemplate,
};

/**
 * Get a builtin template by ID
 * @param id Template ID in format "{entityType}/{name}" (e.g., "skill/table-operations")
 * @returns The template if found, null otherwise
 */
export function getBuiltinTemplate(id: string): BrainTemplate | null {
  return BUILTIN_TEMPLATES[id] ?? null;
}

/**
 * Get all builtin templates
 */
export function getAllBuiltinTemplates(): BrainTemplate[] {
  return Object.values(BUILTIN_TEMPLATES);
}

/**
 * Get builtin templates by entity type
 * @param entityType The type of entity (e.g., 'skill', 'database', 'agent')
 */
export function getBuiltinTemplatesByType(entityType: TemplateEntityType): BrainTemplate[] {
  return Object.entries(BUILTIN_TEMPLATES)
    .filter(([key]) => key.startsWith(`${entityType}/`))
    .map(([, template]) => template);
}

/**
 * Get all builtin template IDs
 */
export function getBuiltinTemplateIds(): string[] {
  return Object.keys(BUILTIN_TEMPLATES);
}

/**
 * Get builtin template info (metadata only) for listing
 */
export function getBuiltinTemplateInfo(): BuiltinTemplateInfo[] {
  return Object.entries(BUILTIN_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.metadata.name,
    description: template.metadata.description,
    category: template.metadata.category || 'General',
    tags: template.metadata.tags || [],
    entityType: template.template.type,
    version: template.metadata.version
  }));
}

/**
 * Get builtin template info by entity type
 */
export function getBuiltinTemplateInfoByType(entityType: TemplateEntityType): BuiltinTemplateInfo[] {
  return getBuiltinTemplateInfo().filter(info => info.entityType === entityType);
}

/**
 * Check if a builtin template exists
 */
export function builtinTemplateExists(id: string): boolean {
  return id in BUILTIN_TEMPLATES;
}

/**
 * Get categories of builtin templates
 */
export function getBuiltinCategories(): string[] {
  const categories = new Set<string>();
  for (const template of Object.values(BUILTIN_TEMPLATES)) {
    if (template.metadata.category) {
      categories.add(template.metadata.category);
    }
  }
  return Array.from(categories).sort();
}

/**
 * Get categories for a specific entity type
 */
export function getBuiltinCategoriesByType(entityType: TemplateEntityType): string[] {
  const categories = new Set<string>();
  for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
    if (key.startsWith(`${entityType}/`) && template.metadata.category) {
      categories.add(template.metadata.category);
    }
  }
  return Array.from(categories).sort();
}
