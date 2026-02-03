// AIDEV-NOTE: Builtin templates loader
// Loads and provides access to builtin templates from JSON files
// These templates are version-controlled with the codebase and loaded at runtime

import type { BrainTemplate, TemplateEntityType, BuiltinTemplateInfo } from '@/ddd/domain/templates/types';

// Import builtin skill templates
import tableOperations from './skills/table-operations.enhancd.json';
import documentOperations from './skills/document-operations.enhancd.json';
import dataLookup from './skills/data-lookup.enhancd.json';

// Import builtin integration skill templates - Gmail
import gmailAssistant from './skills/gmail-assistant.enhancd.json';
import gmailSendEmail from './skills/gmail-send-email.enhancd.json';
import gmailFindEmail from './skills/gmail-find-email.enhancd.json';
import gmailCreateDraft from './skills/gmail-create-draft.enhancd.json';
// Outlook
import outlookAssistant from './skills/outlook-assistant.enhancd.json';
import outlookSendEmail from './skills/outlook-send-email.enhancd.json';
import outlookFindEmail from './skills/outlook-find-email.enhancd.json';
import outlookReplyToEmail from './skills/outlook-reply-to-email.enhancd.json';
// Canva
import canvaAssistant from './skills/canva-assistant.enhancd.json';
import canvaCreateDesign from './skills/canva-create-design.enhancd.json';
import canvaExportDesign from './skills/canva-export-design.enhancd.json';
// LinkedIn
import linkedinAssistant from './skills/linkedin-assistant.enhancd.json';
import linkedinCreatePostUser from './skills/linkedin-create-post-user.enhancd.json';
import linkedinCreatePostOrg from './skills/linkedin-create-post-org.enhancd.json';
import linkedinGetProfile from './skills/linkedin-get-profile.enhancd.json';
// Google Sheets
import googleSheetsAssistant from './skills/google-sheets-assistant.enhancd.json';
import googleSheetsAddRow from './skills/google-sheets-add-row.enhancd.json';
import googleSheetsFindRow from './skills/google-sheets-find-row.enhancd.json';
import googleSheetsGetValues from './skills/google-sheets-get-values.enhancd.json';
// Google Calendar
import googleCalendarAssistant from './skills/google-calendar-assistant.enhancd.json';
import googleCalendarCreateEvent from './skills/google-calendar-create-event.enhancd.json';
import googleCalendarListEvents from './skills/google-calendar-list-events.enhancd.json';
import googleCalendarQuickAdd from './skills/google-calendar-quick-add.enhancd.json';
// Slack
import slackAssistant from './skills/slack-assistant.enhancd.json';
import slackSendMessage from './skills/slack-send-message.enhancd.json';
import slackCreateChannel from './skills/slack-create-channel.enhancd.json';
import slackFindUser from './skills/slack-find-user.enhancd.json';

// Import builtin database templates
import crm from './databases/crm.enhancd.json';
import projectManagement from './databases/project-management.enhancd.json';
import taskManagement from './databases/task-management.enhancd.json';
import inventoryManagement from './databases/inventory-management.enhancd.json';
import employeeDirectory from './databases/employee-directory.enhancd.json';
import contentCalendar from './databases/content-calendar.enhancd.json';
import bugTracker from './databases/bug-tracker.enhancd.json';
import propertyManagement from './databases/property-management.enhancd.json';
import eventPlanning from './databases/event-planning.enhancd.json';
import expenseTracking from './databases/expense-tracking.enhancd.json';
import productCatalog from './databases/product-catalog.enhancd.json';
import meetingNotes from './databases/meeting-notes.enhancd.json';

/**
 * Registry of all builtin templates
 * Key format: "{entityType}/{templateName}" (e.g., "skill/table-operations")
 */
export const BUILTIN_TEMPLATES: Record<string, BrainTemplate> = {
  // Skill templates
  'skill/table-operations': tableOperations as unknown as BrainTemplate,
  'skill/document-operations': documentOperations as unknown as BrainTemplate,
  'skill/data-lookup': dataLookup as unknown as BrainTemplate,

  // Integration skill templates - Gmail
  'skill/gmail-assistant': gmailAssistant as unknown as BrainTemplate,
  'skill/gmail-send-email': gmailSendEmail as unknown as BrainTemplate,
  'skill/gmail-find-email': gmailFindEmail as unknown as BrainTemplate,
  'skill/gmail-create-draft': gmailCreateDraft as unknown as BrainTemplate,
  // Outlook
  'skill/outlook-assistant': outlookAssistant as unknown as BrainTemplate,
  'skill/outlook-send-email': outlookSendEmail as unknown as BrainTemplate,
  'skill/outlook-find-email': outlookFindEmail as unknown as BrainTemplate,
  'skill/outlook-reply-to-email': outlookReplyToEmail as unknown as BrainTemplate,
  // Canva
  'skill/canva-assistant': canvaAssistant as unknown as BrainTemplate,
  'skill/canva-create-design': canvaCreateDesign as unknown as BrainTemplate,
  'skill/canva-export-design': canvaExportDesign as unknown as BrainTemplate,
  // LinkedIn
  'skill/linkedin-assistant': linkedinAssistant as unknown as BrainTemplate,
  'skill/linkedin-create-post-user': linkedinCreatePostUser as unknown as BrainTemplate,
  'skill/linkedin-create-post-org': linkedinCreatePostOrg as unknown as BrainTemplate,
  'skill/linkedin-get-profile': linkedinGetProfile as unknown as BrainTemplate,
  // Google Sheets
  'skill/google-sheets-assistant': googleSheetsAssistant as unknown as BrainTemplate,
  'skill/google-sheets-add-row': googleSheetsAddRow as unknown as BrainTemplate,
  'skill/google-sheets-find-row': googleSheetsFindRow as unknown as BrainTemplate,
  'skill/google-sheets-get-values': googleSheetsGetValues as unknown as BrainTemplate,
  // Google Calendar
  'skill/google-calendar-assistant': googleCalendarAssistant as unknown as BrainTemplate,
  'skill/google-calendar-create-event': googleCalendarCreateEvent as unknown as BrainTemplate,
  'skill/google-calendar-list-events': googleCalendarListEvents as unknown as BrainTemplate,
  'skill/google-calendar-quick-add': googleCalendarQuickAdd as unknown as BrainTemplate,
  // Slack
  'skill/slack-assistant': slackAssistant as unknown as BrainTemplate,
  'skill/slack-send-message': slackSendMessage as unknown as BrainTemplate,
  'skill/slack-create-channel': slackCreateChannel as unknown as BrainTemplate,
  'skill/slack-find-user': slackFindUser as unknown as BrainTemplate,

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
