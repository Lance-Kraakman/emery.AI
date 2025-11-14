import { FileText, File, Bot, Database, Table, Sparkles } from 'lucide-react';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';
import type { ToolDTO } from '@/app/mappers/tool-mapper';

/**
 * Category icon mapping
 */
export const categoryIcons = {
  [ReferenceCategory.DOC]: FileText,
  [ReferenceCategory.FILE]: File,
  [ReferenceCategory.AGENT]: Bot,
  [ReferenceCategory.TABLE]: Table,
  [ReferenceCategory.DATABASE]: Database,
  [ReferenceCategory.SKILL]: Sparkles,
} as const;

/**
 * Category color mapping
 */
export const categoryColors = {
  [ReferenceCategory.DOC]: 'text-blue-600 bg-blue-50',
  [ReferenceCategory.FILE]: 'text-green-600 bg-green-50',
  [ReferenceCategory.AGENT]: 'text-purple-600 bg-purple-50',
  [ReferenceCategory.TABLE]: 'text-orange-600 bg-orange-50',
  [ReferenceCategory.DATABASE]: 'text-gray-600 bg-gray-50',
  [ReferenceCategory.SKILL]: 'text-pink-600 bg-pink-50',
} as const;

/**
 * Detect reference category from @ prefix query
 */
export function detectCategoryFromQuery(query: string): ReferenceCategory | null {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '@doc' || trimmed === '@document') return ReferenceCategory.DOC;
  if (trimmed === '@file') return ReferenceCategory.FILE;
  if (trimmed === '@agent') return ReferenceCategory.AGENT;
  if (trimmed === '@table') return ReferenceCategory.TABLE;
  if (trimmed === '@database') return ReferenceCategory.DATABASE;
  return null;
}

/**
 * Convert reference category to unified tool category
 */
export function getUnifiedCategory(referenceCategory: ReferenceCategory): ToolCategory {
  switch (referenceCategory) {
    case ReferenceCategory.DOC: return ToolCategory.DOCUMENTS;
    case ReferenceCategory.FILE: return ToolCategory.FILES;
    case ReferenceCategory.AGENT: return ToolCategory.AGENTS;
    case ReferenceCategory.TABLE: return ToolCategory.TABLES;
    case ReferenceCategory.DATABASE: return ToolCategory.DATABASES;
    case ReferenceCategory.SKILL: return ToolCategory.SKILLS;
    default: return ToolCategory.BASE;
  }
}

/**
 * Get correct insertText for a tool
 */
export function getToolInsertText(tool: ToolDTO): string {
  // Use tool's insertText if available
  if (tool.insertText) return tool.insertText;

  // Generate category-specific insert text for reference tools
  if (tool.type === 'reference') {
    switch (tool.category) {
      case 'documents': return `@doc:${tool.name}`;
      case 'files': return `@file:${tool.name}`;
      case 'agents': return `@agent:${tool.name}`;
      case 'tables': return `@table:${tool.name}`;
      case 'databases': return `@database:${tool.name}`;
      case 'skills': return `@skill:${tool.name}`;
      default: return `@tool:${tool.name}`;
    }
  }

  // System tools use @tool: prefix
  return `@tool:${tool.name}`;
}

/**
 * Generate insert text with parameter placeholders
 */
export function getToolInsertTextWithParameters(tool: ToolDTO): string {
  const baseTool = tool.insertText || getToolInsertText(tool);

  // Type-safe access
  const params = tool.config.parameters;
  const paramEntries = Object.entries(params);

  if (paramEntries.length === 0) {
    return baseTool;
  }

  const required = paramEntries
    .filter(([_, p]) => p.required)
    .map(([name, _]) => `${name}: [value]`);

  const optional = paramEntries
    .filter(([_, p]) => !p.required)
    .map(([name, _]) => `${name}: [value]`);

  let result = `using ${baseTool}`;

  if (required.length > 0) {
    result += ` with ${required.join(', ')}`;
  }

  if (optional.length > 0) {
    result += ` // optional: ${optional.join(', ')}`;
  }

  return result;
}
