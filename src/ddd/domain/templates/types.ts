// AIDEV-NOTE: Template system type definitions
// Templates allow exporting and importing entity configurations as .brain files
// Supports: skill, database, table, agent, app, organization, org_section (composite)

import type {
  InputDefinition,
  OutputDefinition,
  ToolConfig,
  SkillExecutionType,
  TaskModelConfig,
  ToolExecutionConfig,
  WriteConfig,
  ReadConfig,
  SkillStep,
  CanvasMetadata
} from '@/ddd/domain/skills/entities/skill';
import type { AvatarConfig } from '@/lib/avatars';
import type { AutomationConfigurationJSON } from '@/ddd/domain/agents/entities/agent';

// =============================================================================
// Template Entity Types
// =============================================================================

/**
 * Template entity types supported by the template system
 */
export type TemplateEntityType =
  | 'skill'
  | 'database'
  | 'table'
  | 'agent'
  | 'app'
  | 'organization'
  | 'org_section'; // Composite: agents + their skills/databases

/**
 * Template source - where the template came from
 */
export type TemplateSource = 'builtin' | 'organization' | 'imported';

// =============================================================================
// Template Metadata
// =============================================================================

/**
 * Template metadata - common header for all templates
 */
export interface TemplateMetadata {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  version: string;  // Semantic version for the template content
  author?: string;
}

// =============================================================================
// Entity Template Data Types (mirrors domain entities without IDs)
// =============================================================================

/**
 * Field template data - mirrors TableField without IDs
 */
export interface FieldTemplateData {
  name: string;
  slug: string;
  type: string;
  required?: boolean;
  description?: string;
  formula?: string;
  fieldConfig?: Record<string, unknown>;
}

/**
 * Table template data - mirrors DynamicTable without IDs
 */
export interface TableTemplateData {
  name: string;
  description?: string;
  fields: FieldTemplateData[];
  metadata?: Record<string, unknown>;
}

/**
 * Database template data - mirrors Database without IDs
 * Can optionally include inline tables
 */
export interface DatabaseTemplateData {
  name: string;
  slug: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tables?: TableTemplateData[];  // Optional inline table templates
}

/**
 * Skill template data - mirrors Skill without IDs
 */
export interface SkillTemplateData {
  name: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  instructions: string;
  tools: ToolConfig[];
  model?: string | null;
  agentType?: string | null;
  executionType?: SkillExecutionType;
  taskModelConfig?: TaskModelConfig;
  toolExecutionConfig?: ToolExecutionConfig;
  writeConfig?: WriteConfig;
  readConfig?: ReadConfig;
  steps?: SkillStep[];
  canvasMetadata?: CanvasMetadata;
}

/**
 * Automation template data - mirrors AutomationConfiguration without skill IDs
 * Skills are referenced by name within the template
 */
export interface AutomationTemplateData {
  trigger: AutomationConfigurationJSON['trigger'];
  skillRef: string;  // Reference to skill by name within template (or existing skill name)
  inputMappings?: Array<{
    triggerField: string;
    skillInputName: string;
  }>;
  enabled: boolean;
  name?: string;
  description?: string;
}

/**
 * Agent template data - mirrors Agent without IDs
 * Can optionally include inline skills and databases
 */
export interface AgentTemplateData {
  name: string;
  role: string;
  description: string;
  persona: string;
  defaultModel?: string | null;
  avatarConfig?: AvatarConfig | null;
  automations?: AutomationTemplateData[];
  skills?: SkillTemplateData[];      // Optional inline skill templates
  databases?: DatabaseTemplateData[]; // Optional inline database templates
}

/**
 * Page template data - for app pages (Puck visual builder)
 */
export interface PageTemplateData {
  name: string;
  slug: string;
  description?: string;
  puckData?: Record<string, unknown>;
  isHomePage?: boolean;
}

/**
 * App template data - mirrors App without IDs
 */
export interface AppTemplateData {
  name: string;
  slug: string;
  description?: string;
  themeConfig?: Record<string, unknown>;
  pages?: PageTemplateData[];
}

/**
 * Organization template data - for full organization templates
 */
export interface OrganizationTemplateData {
  name: string;
  mission?: string;
  sharedTools?: string[];
  sharedServers?: string[];
  agents?: AgentTemplateData[];
  databases?: DatabaseTemplateData[];
  skills?: SkillTemplateData[];  // Org-level skills
  apps?: AppTemplateData[];
}

/**
 * Org Section template data - composite template from org chart selection
 * Contains multiple agents with their resources
 */
export interface OrgSectionTemplateData {
  // Agent-scoped entities (agents with their children)
  agents: Array<{
    agent: AgentTemplateData;
    skills: SkillTemplateData[];
    databases: DatabaseTemplateData[];
  }>;
  // Organization-level resources (not attached to agents)
  orgSkills?: SkillTemplateData[];
  orgDatabases?: DatabaseTemplateData[];
}

// =============================================================================
// Template Content Union Type
// =============================================================================

/**
 * Template content - discriminated union of all template data types
 */
export type TemplateContent =
  | { type: 'skill'; data: SkillTemplateData }
  | { type: 'database'; data: DatabaseTemplateData }
  | { type: 'table'; data: TableTemplateData }
  | { type: 'agent'; data: AgentTemplateData }
  | { type: 'app'; data: AppTemplateData }
  | { type: 'organization'; data: OrganizationTemplateData }
  | { type: 'org_section'; data: OrgSectionTemplateData };

// =============================================================================
// Brain Template File Format
// =============================================================================

/**
 * BrainTemplate - the full .brain file format
 * This is what gets exported/imported as JSON files
 */
export interface BrainTemplate {
  /** Format identifier */
  $format: 'brain-template';
  /** Schema version for migrations */
  $version: 1;
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Template content (type-discriminated) */
  template: TemplateContent;
  /** Export timestamp (set on export) */
  exportedAt?: string;
  /** Source app version (set on export) */
  exportedFrom?: {
    appVersion?: string;
  };
}

// =============================================================================
// Stored Template (Database Entity)
// =============================================================================

/**
 * Stored template - template saved in the database
 */
export interface StoredTemplate {
  id: number;
  organizationId: number;
  ownerId: string | null;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  entityType: TemplateEntityType;
  templateData: TemplateContent;
  version: string;
  isBuiltin: boolean;
  sourceBuiltinId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create template command
 */
export interface CreateTemplateCommand {
  organizationId: number;
  ownerId?: string | null;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  entityType: TemplateEntityType;
  templateData: TemplateContent;
  version?: string;
  isBuiltin?: boolean;
  sourceBuiltinId?: string;
}

/**
 * Update template command
 */
export interface UpdateTemplateCommand {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  templateData?: TemplateContent;
  version?: string;
}

// =============================================================================
// Template DTOs
// =============================================================================

/**
 * Template DTO for API responses
 */
export interface TemplateDTO {
  id: number;
  organizationId: number;
  ownerId: string | null;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  entityType: TemplateEntityType;
  templateData: TemplateContent;
  version: string;
  isBuiltin: boolean;
  sourceBuiltinId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Builtin template info (metadata only, for listing)
 */
export interface BuiltinTemplateInfo {
  id: string;  // e.g., 'skill/table-operations'
  name: string;
  description: string;
  category: string;
  tags: string[];
  entityType: TemplateEntityType;
  version: string;
}

// =============================================================================
// Apply Template Types
// =============================================================================

/**
 * Result of applying a skill template
 */
export interface ApplySkillTemplateResult {
  skillId: number;
  skillName: string;
}

/**
 * Result of applying an org section template
 */
export interface ApplyOrgSectionTemplateResult {
  agents: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string; agentId: number | null }>;
  databases: Array<{ id: number; name: string; agentId: number | null }>;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for BrainTemplate
 */
export function isBrainTemplate(obj: unknown): obj is BrainTemplate {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as Record<string, unknown>;
  return (
    t.$format === 'brain-template' &&
    t.$version === 1 &&
    typeof t.metadata === 'object' &&
    t.metadata !== null &&
    typeof t.template === 'object' &&
    t.template !== null
  );
}

/**
 * Type guard for TemplateContent
 */
export function isTemplateContent(obj: unknown): obj is TemplateContent {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as Record<string, unknown>;
  const validTypes: TemplateEntityType[] = [
    'skill', 'database', 'table', 'agent', 'app', 'organization', 'org_section'
  ];
  return (
    typeof t.type === 'string' &&
    validTypes.includes(t.type as TemplateEntityType) &&
    typeof t.data === 'object' &&
    t.data !== null
  );
}

/**
 * Type guard for SkillTemplateData
 */
export function isSkillTemplateData(obj: unknown): obj is SkillTemplateData {
  if (typeof obj !== 'object' || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.name === 'string' &&
    typeof s.description === 'string' &&
    Array.isArray(s.inputs) &&
    Array.isArray(s.outputs) &&
    typeof s.instructions === 'string' &&
    Array.isArray(s.tools)
  );
}
