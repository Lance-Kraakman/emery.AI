// AIDEV-NOTE: Builtin templates loader
// Loads and provides access to builtin templates from JSON files
// These templates are version-controlled with the codebase and loaded at runtime

import type { BrainTemplate, TemplateEntityType, BuiltinTemplateInfo } from '@/ddd/domain/templates/types';

// Import builtin skill templates
import tableOperations from './skills/table-operations.brain.json';
import documentOperations from './skills/document-operations.brain.json';
import dataLookup from './skills/data-lookup.brain.json';

// Import builtin database templates
import crm from './databases/crm.brain.json';
import projectManagement from './databases/project-management.brain.json';
import taskManagement from './databases/task-management.brain.json';
import inventoryManagement from './databases/inventory-management.brain.json';
import employeeDirectory from './databases/employee-directory.brain.json';
import contentCalendar from './databases/content-calendar.brain.json';
import bugTracker from './databases/bug-tracker.brain.json';
import propertyManagement from './databases/property-management.brain.json';
import eventPlanning from './databases/event-planning.brain.json';
import expenseTracking from './databases/expense-tracking.brain.json';
import productCatalog from './databases/product-catalog.brain.json';
import meetingNotes from './databases/meeting-notes.brain.json';

/**
 * Registry of all builtin templates
 * Key format: "{entityType}/{templateName}" (e.g., "skill/table-operations")
 */
export const BUILTIN_TEMPLATES: Record<string, BrainTemplate> = {
  // Skill templates
  'skill/table-operations': tableOperations as unknown as BrainTemplate,
  'skill/document-operations': documentOperations as unknown as BrainTemplate,
  'skill/data-lookup': dataLookup as unknown as BrainTemplate,

  // Database templates
  'database/crm': crm as unknown as BrainTemplate,
  'database/project-management': projectManagement as unknown as BrainTemplate,
  'database/task-management': taskManagement as unknown as BrainTemplate,
  'database/inventory-management': inventoryManagement as unknown as BrainTemplate,
  'database/employee-directory': employeeDirectory as unknown as BrainTemplate,
  'database/content-calendar': contentCalendar as unknown as BrainTemplate,
  'database/bug-tracker': bugTracker as unknown as BrainTemplate,
  'database/property-management': propertyManagement as unknown as BrainTemplate,
  'database/event-planning': eventPlanning as unknown as BrainTemplate,
  'database/expense-tracking': expenseTracking as unknown as BrainTemplate,
  'database/product-catalog': productCatalog as unknown as BrainTemplate,
  'database/meeting-notes': meetingNotes as unknown as BrainTemplate,
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
