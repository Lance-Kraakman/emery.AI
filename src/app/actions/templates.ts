'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Result } from '@/ddd/domain/shared/result';
import type {
  TemplateDTO,
  BrainTemplate,
  TemplateEntityType,
  CreateTemplateCommand,
  UpdateTemplateCommand,
  BuiltinTemplateInfo,
  SkillTemplateData,
  AgentTemplateData,
  DatabaseTemplateData,
  OrgSectionTemplateData,
  TemplateMetadata
} from '@/ddd/domain/templates/types';
import { TemplateApplicationService } from '@/ddd/application/services/templates/template-application-service';
import { DrizzleTemplateRepository } from '@/ddd/infrastructure/db/repositories/templates/drizzle-template-repository';
import { db } from '@/ddd/infrastructure/db/client';

// Skill imports for template application
import { createSkill, createOrganizationSkill, getSkill, getSkillsByAgent } from './skills';
import { getAgent, createAgentFromClient } from './agents';
import { getDatabase, getAgentDatabases, createDatabase } from './databases';
import { getTablesForDatabase, createTable, type TableWithFieldsDTO } from './tables';
import { createField } from './fields';
import { isBrainTemplate, isOrgSectionTemplateData } from '@/ddd/domain/templates/types';
import type { TableTemplateData, FieldTemplateData, TemplateContent } from '@/ddd/domain/templates/types';

/**
 * Server Actions for Template Management
 *
 * Provides CRUD operations for templates with authentication.
 * Supports both stored templates and builtin templates.
 */

// =============================================================================
// HELPER: Get Template Service
// =============================================================================

function getTemplateService(): TemplateApplicationService {
  const repository = new DrizzleTemplateRepository(db);
  return new TemplateApplicationService(repository);
}

async function getSessionInfo(): Promise<{ userId: string; organizationId: number } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.currentOrganizationId) {
    return null;
  }
  return {
    userId: session.user.id,
    organizationId: session.user.currentOrganizationId
  };
}

// =============================================================================
// BUILTIN TEMPLATES
// =============================================================================

/**
 * Get all builtin templates info
 */
export async function getBuiltinTemplates(): Promise<Result<BuiltinTemplateInfo[]>> {
  try {
    const service = getTemplateService();
    const templates = service.getBuiltinTemplateInfo();
    return { success: true, data: templates };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get builtin templates' };
  }
}

/**
 * Get builtin templates by entity type
 */
export async function getBuiltinTemplatesByType(
  entityType: TemplateEntityType
): Promise<Result<BuiltinTemplateInfo[]>> {
  try {
    const service = getTemplateService();
    const templates = service.getBuiltinTemplateInfoByType(entityType);
    return { success: true, data: templates };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get builtin templates' };
  }
}

/**
 * Get a specific builtin template
 */
export async function getBuiltinTemplate(
  builtinId: string
): Promise<Result<BrainTemplate>> {
  try {
    const service = getTemplateService();
    const template = service.getBuiltinTemplate(builtinId);
    if (!template) {
      return { success: false, error: `Builtin template not found: ${builtinId}` };
    }
    return { success: true, data: template };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get builtin template' };
  }
}

// =============================================================================
// STORED TEMPLATES CRUD
// =============================================================================

/**
 * List templates for the current organization
 */
export async function listTemplates(options?: {
  entityType?: TemplateEntityType;
  category?: string;
  search?: string;
}): Promise<Result<TemplateDTO[]>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();
    const result = await service.listTemplates({
      organizationId: sessionInfo.organizationId,
      entityType: options?.entityType,
      category: options?.category,
      search: options?.search
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: service.templatesToDTOs(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list templates' };
  }
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(
  templateId: number
): Promise<Result<TemplateDTO>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();
    const result = await service.getTemplate(templateId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Verify organization access
    if (result.data!.organizationId.value !== sessionInfo.organizationId) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, data: service.templateToDTO(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get template' };
  }
}

/**
 * Create a new template
 */
export async function createTemplate(
  command: Omit<CreateTemplateCommand, 'organizationId' | 'ownerId'>
): Promise<Result<TemplateDTO>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();
    const result = await service.createTemplate({
      ...command,
      organizationId: sessionInfo.organizationId,
      ownerId: sessionInfo.userId
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/templates');
    return { success: true, data: service.templateToDTO(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create template' };
  }
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: number,
  updates: UpdateTemplateCommand
): Promise<Result<TemplateDTO>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();

    // Verify ownership/access
    const existing = await service.getTemplate(templateId);
    if (!existing.success || existing.data!.organizationId.value !== sessionInfo.organizationId) {
      return { success: false, error: 'Template not found' };
    }

    const result = await service.updateTemplate(templateId, updates);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/templates');
    return { success: true, data: service.templateToDTO(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update template' };
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  templateId: number
): Promise<Result<void>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();

    // Verify ownership/access
    const existing = await service.getTemplate(templateId);
    if (!existing.success || existing.data!.organizationId.value !== sessionInfo.organizationId) {
      return { success: false, error: 'Template not found' };
    }

    const result = await service.deleteTemplate(templateId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/templates');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete template' };
  }
}

// =============================================================================
// IMPORT / EXPORT
// =============================================================================

/**
 * Import a template from a .brain file content
 */
export async function importTemplate(
  brainFileContent: string
): Promise<Result<TemplateDTO>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();
    const result = await service.importTemplate(
      sessionInfo.organizationId,
      sessionInfo.userId,
      brainFileContent
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/templates');
    return { success: true, data: service.templateToDTO(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to import template' };
  }
}

/**
 * Export a stored template as a .brain file
 */
export async function exportTemplate(
  templateId: number
): Promise<Result<BrainTemplate>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();

    // Verify access
    const existing = await service.getTemplate(templateId);
    if (!existing.success || existing.data!.organizationId.value !== sessionInfo.organizationId) {
      return { success: false, error: 'Template not found' };
    }

    return await service.exportTemplate(templateId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export template' };
  }
}

/**
 * Export a builtin template as a .brain file
 */
export async function exportBuiltinTemplate(
  builtinId: string
): Promise<Result<BrainTemplate>> {
  try {
    const service = getTemplateService();
    return service.exportBuiltinTemplate(builtinId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export builtin template' };
  }
}

// =============================================================================
// APPLY TEMPLATES
// =============================================================================

/**
 * Get skill template data from a stored template or builtin
 * This can be used to create a new skill from a template
 */
export async function getSkillTemplateData(
  templateIdOrBuiltinId: number | string
): Promise<Result<SkillTemplateData>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();

    // If it's a stored template ID (number), verify access
    if (typeof templateIdOrBuiltinId === 'number') {
      const existing = await service.getTemplate(templateIdOrBuiltinId);
      if (!existing.success || existing.data!.organizationId.value !== sessionInfo.organizationId) {
        return { success: false, error: 'Template not found' };
      }
    }

    return await service.getSkillTemplateData(templateIdOrBuiltinId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get skill template data' };
  }
}

/**
 * Save a builtin template to the organization's template library
 */
export async function saveBuiltinToLibrary(
  builtinId: string
): Promise<Result<TemplateDTO>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getTemplateService();
    const result = await service.saveBuiltinToLibrary(
      builtinId,
      sessionInfo.organizationId,
      sessionInfo.userId
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/templates');
    return { success: true, data: service.templateToDTO(result.data!) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save builtin template' };
  }
}

// =============================================================================
// ORG CHART EXPORT
// =============================================================================

/**
 * Helper to convert a database with tables/fields to template format
 */
async function databaseToTemplateData(db: {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<DatabaseTemplateData> {
  // Fetch tables with fields for this database
  const tablesWithFields = await getTablesForDatabase(db.id);

  // Convert to template format
  const tables: TableTemplateData[] = tablesWithFields.map(table => ({
    name: table.name,
    description: table.description,
    fields: table.fields.map(field => ({
      name: field.name,
      slug: field.name, // Use name as slug since field doesn't have separate slug
      type: field.type,
      required: field.required ?? false,
      description: field.metadata?.description as string | undefined,
      fieldConfig: field.metadata as Record<string, unknown> | undefined,
    })),
    metadata: table.metadata as Record<string, unknown> | undefined,
  }));

  return {
    name: db.name,
    slug: db.slug,
    description: db.description || undefined,
    metadata: db.metadata as Record<string, unknown> | undefined,
    tables: tables.length > 0 ? tables : undefined,
  };
}

/**
 * Helper to create tables and fields from template data after database creation
 */
async function createTablesFromTemplate(
  databaseId: number,
  tables: TableTemplateData[] | undefined
): Promise<void> {
  if (!tables || tables.length === 0) return;

  for (const tableData of tables) {
    const tableResult = await createTable({
      name: tableData.name,
      description: tableData.description,
      databaseId,
    });

    if (!tableResult.success || !tableResult.data) {
      console.error('Failed to create table from template:', tableResult.error);
      continue;
    }

    const tableId = tableResult.data.id;

    // Create fields for the table
    if (tableData.fields && tableData.fields.length > 0) {
      for (const fieldData of tableData.fields) {
        const fieldResult = await createField({
          tableId,
          name: fieldData.name,
          type: fieldData.type as any, // FieldType cast
          required: fieldData.required ?? false,
          metadata: fieldData.fieldConfig as Record<string, unknown> | undefined,
        });

        if (!fieldResult.success) {
          console.error('Failed to create field from template:', fieldResult.error);
        }
      }
    }
  }
}

/**
 * Export selection from org chart as a BrainTemplate
 * Fetches full entity data and builds an org_section template
 */
export async function exportOrgChartSelection(
  selection: {
    agentIds: number[];
    skillIds: number[];  // Standalone skills (not part of exported agents)
    databaseIds: number[];  // Standalone databases
  },
  metadata: {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
  }
): Promise<Result<BrainTemplate>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }


    // Fetch and convert agents with their skills/databases
    const agentEntries: OrgSectionTemplateData['agents'] = [];

    for (const agentId of selection.agentIds) {
      const agent = await getAgent(agentId);
      if (!agent) continue;

      // Get agent's skills
      const skillsResult = await getSkillsByAgent(agentId);
      const agentSkills = skillsResult.success ? skillsResult.data || [] : [];

      // Get agent's databases
      const agentDatabases = await getAgentDatabases(agentId);

      // Convert to template data
      const agentTemplateData: AgentTemplateData = {
        name: agent.name,
        role: agent.role || '',
        description: agent.description || '',
        persona: agent.persona || '',
        defaultModel: agent.defaultModel || null,
        avatarConfig: agent.avatarConfig || null,
        automations: agent.automations?.map(a => ({
          trigger: a.trigger,
          skillRef: agentSkills.find(s => s.id === a.skillId)?.name || '',
          inputMappings: a.inputMappings,
          enabled: a.enabled,
          name: a.name,
          description: a.description,
        })),
      };

      const skillsTemplateData: SkillTemplateData[] = agentSkills.map(skill => ({
        name: skill.name,
        description: skill.description || '',
        inputs: skill.inputs || [],
        outputs: skill.outputs || [],
        instructions: skill.instructions || '',
        tools: skill.tools || [],
        model: skill.model || null,
        agentType: skill.agentType || null,
        executionType: skill.executionType,
        taskModelConfig: skill.taskModelConfig,
        toolExecutionConfig: skill.toolExecutionConfig,
        writeConfig: skill.writeConfig,
        // readConfig not included - not part of SkillDTO currently
        steps: skill.steps,
        canvasMetadata: skill.canvasMetadata,
      }));

      // Fetch databases with tables/fields
      const databasesTemplateData: DatabaseTemplateData[] = await Promise.all(
        agentDatabases.map(db => databaseToTemplateData(db))
      );

      agentEntries.push({
        agent: agentTemplateData,
        skills: skillsTemplateData,
        databases: databasesTemplateData,
      });
    }

    // Fetch standalone skills (not part of exported agents)
    const standaloneSkills: SkillTemplateData[] = [];
    for (const skillId of selection.skillIds) {
      const skillResult = await getSkill(skillId);
      if (!skillResult.success || !skillResult.data) continue;
      const skill = skillResult.data;

      standaloneSkills.push({
        name: skill.name,
        description: skill.description || '',
        inputs: skill.inputs || [],
        outputs: skill.outputs || [],
        instructions: skill.instructions || '',
        tools: skill.tools || [],
        model: skill.model || null,
        agentType: skill.agentType || null,
        executionType: skill.executionType,
        taskModelConfig: skill.taskModelConfig,
        toolExecutionConfig: skill.toolExecutionConfig,
        writeConfig: skill.writeConfig,
        // readConfig not included - not part of SkillDTO currently
        steps: skill.steps,
        canvasMetadata: skill.canvasMetadata,
      });
    }

    // Fetch standalone databases with tables/fields
    const standaloneDatabases: DatabaseTemplateData[] = [];
    for (const dbId of selection.databaseIds) {
      const db = await getDatabase(dbId);
      if (!db) continue;

      const dbTemplateData = await databaseToTemplateData(db);
      standaloneDatabases.push(dbTemplateData);
    }

    // Build the template
    const orgSectionData: OrgSectionTemplateData = {
      agents: agentEntries,
      orgSkills: standaloneSkills.length > 0 ? standaloneSkills : undefined,
      orgDatabases: standaloneDatabases.length > 0 ? standaloneDatabases : undefined,
    };

    const brainTemplate: BrainTemplate = {
      $format: 'brain-template',
      $version: 1,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
        tags: metadata.tags,
        version: '1.0.0',
      },
      template: {
        type: 'org_section',
        data: orgSectionData,
      },
      exportedAt: new Date().toISOString(),
    };

    return { success: true, data: brainTemplate };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export selection' };
  }
}

/**
 * Export and save org chart selection as a template in the library
 */
export async function exportAndSaveOrgChartSelection(
  selection: {
    agentIds: number[];
    skillIds: number[];
    databaseIds: number[];
  },
  metadata: {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
  }
): Promise<Result<TemplateDTO>> {
  const exportResult = await exportOrgChartSelection(selection, metadata);
  if (!exportResult.success) {
    return { success: false, error: exportResult.error };
  }

  // Save to library
  return await createTemplate({
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    tags: metadata.tags,
    entityType: 'org_section',
    templateData: exportResult.data!.template,
  });
}

// =============================================================================
// SINGLE-ENTITY EXPORT FUNCTIONS
// =============================================================================

/**
 * Export a single skill as template content
 * Used by "Save as Template" in skill editor
 */
export async function exportSkillAsTemplate(
  skillId: number
): Promise<Result<TemplateContent>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const skillResult = await getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: skillResult.error || 'Skill not found' };
    }

    const skill = skillResult.data;

    const templateData: SkillTemplateData = {
      name: skill.name,
      description: skill.description || '',
      inputs: skill.inputs || [],
      outputs: skill.outputs || [],
      instructions: skill.instructions || '',
      tools: skill.tools || [],
      model: skill.model || null,
      agentType: skill.agentType || null,
      executionType: skill.executionType,
      taskModelConfig: skill.taskModelConfig,
      toolExecutionConfig: skill.toolExecutionConfig,
      writeConfig: skill.writeConfig,
      steps: skill.steps,
      canvasMetadata: skill.canvasMetadata,
    };

    return {
      success: true,
      data: {
        type: 'skill',
        data: templateData,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export skill' };
  }
}

/**
 * Export a single database (with tables/fields) as template content
 * Used by "Save as Template" in database settings
 */
export async function exportDatabaseAsTemplate(
  databaseId: number
): Promise<Result<TemplateContent>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await getDatabase(databaseId);
    if (!db) {
      return { success: false, error: 'Database not found' };
    }

    const templateData = await databaseToTemplateData(db);

    return {
      success: true,
      data: {
        type: 'database',
        data: templateData,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export database' };
  }
}

/**
 * Export a single agent (with skills and databases) as template content
 * Used by "Save as Template" in agent settings
 */
export async function exportAgentAsTemplate(
  agentId: number
): Promise<Result<TemplateContent>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    const agent = await getAgent(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    // Fetch agent's skills
    const agentSkillsResult = await getSkillsByAgent(agentId);
    const agentSkills = agentSkillsResult.success ? agentSkillsResult.data || [] : [];

    // Fetch agent's databases
    const agentDatabases = await getAgentDatabases(agentId);

    // Convert skills to template format
    const skillsTemplateData: SkillTemplateData[] = agentSkills.map(skill => ({
      name: skill.name,
      description: skill.description || '',
      inputs: skill.inputs || [],
      outputs: skill.outputs || [],
      instructions: skill.instructions || '',
      tools: skill.tools || [],
      model: skill.model || null,
      agentType: skill.agentType || null,
      executionType: skill.executionType,
      taskModelConfig: skill.taskModelConfig,
      toolExecutionConfig: skill.toolExecutionConfig,
      writeConfig: skill.writeConfig,
      steps: skill.steps,
      canvasMetadata: skill.canvasMetadata,
    }));

    // Convert databases to template format (with tables/fields)
    const databasesTemplateData: DatabaseTemplateData[] = await Promise.all(
      agentDatabases.map(db => databaseToTemplateData(db))
    );

    const templateData: AgentTemplateData = {
      name: agent.name,
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      defaultModel: agent.defaultModel || null,
      avatarConfig: agent.avatarConfig || null,
      automations: [], // TODO: Include automations that reference agent's own skills
      skills: skillsTemplateData,
      databases: databasesTemplateData,
    };

    return {
      success: true,
      data: {
        type: 'agent',
        data: templateData,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export agent' };
  }
}

/**
 * Export a single table (with fields) as template content
 * Used by "Save as Template" in table view
 */
export async function exportTableAsTemplate(
  tableId: number
): Promise<Result<TemplateContent>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get tables from the database - need to find which database this table is in
    // We'll get the table through the application service
    const tableApplicationService = (await import('@/ddd/application/di/container')).getTableApplicationService();
    const { TableId } = await import('@/ddd/domain/shared/value-objects');

    const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      return { success: false, error: 'Table not found' };
    }

    const templateData: TableTemplateData = {
      name: table.name,
      description: table.description,
      fields: table.fields.map(field => ({
        name: field.name,
        slug: field.name,
        type: field.type,
        required: field.required ?? false,
        description: field.metadata?.description as string | undefined,
        fieldConfig: field.metadata as Record<string, unknown> | undefined,
      })),
      metadata: table.metadata?.toDatabaseJson() as Record<string, unknown> | undefined,
    };

    return {
      success: true,
      data: {
        type: 'table',
        data: templateData,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to export table' };
  }
}

// =============================================================================
// APPLY BUILTIN TEMPLATES
// =============================================================================

/**
 * Apply a builtin skill template to create a new skill
 * This creates a regular skill (not isSystem) from the template content
 */
export async function applyBuiltinSkillTemplate(
  builtinId: string,
  options?: {
    agentId?: number | null;  // null = org-level skill
    namePrefix?: string;      // Optional prefix for the skill name
  }
): Promise<Result<{ skillId: number; skillName: string }>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the builtin template
    const service = getTemplateService();
    const template = service.getBuiltinTemplate(builtinId);

    if (!template) {
      return { success: false, error: `Builtin template not found: ${builtinId}` };
    }

    // Verify it's a skill template
    if (template.template.type !== 'skill') {
      return { success: false, error: 'Template is not a skill template' };
    }

    const skillData = template.template.data as SkillTemplateData;
    const skillName = options?.namePrefix
      ? `${options.namePrefix} ${skillData.name}`
      : skillData.name;

    // Create the skill using the appropriate skills action
    let result: Result<{ id: number; name: string }>;

    if (options?.agentId) {
      // Agent-scoped skill
      result = await createSkill({
        agentId: options.agentId,
        name: skillName,
        description: skillData.description,
        instructions: skillData.instructions,
        inputs: skillData.inputs,
        outputs: skillData.outputs,
        tools: skillData.tools,
        executionType: skillData.executionType,
        model: skillData.model,
        agentType: skillData.agentType,
        taskModelConfig: skillData.taskModelConfig,
        toolExecutionConfig: skillData.toolExecutionConfig,
        writeConfig: skillData.writeConfig,
        steps: skillData.steps,
        canvasMetadata: skillData.canvasMetadata,
      });
    } else {
      // Organization-level skill (canvasMetadata not supported for org skills)
      result = await createOrganizationSkill({
        organizationId: sessionInfo.organizationId,
        name: skillName,
        description: skillData.description,
        instructions: skillData.instructions,
        inputs: skillData.inputs,
        outputs: skillData.outputs,
        tools: skillData.tools,
        executionType: skillData.executionType,
        model: skillData.model,
        agentType: skillData.agentType,
        taskModelConfig: skillData.taskModelConfig,
        toolExecutionConfig: skillData.toolExecutionConfig,
        writeConfig: skillData.writeConfig,
        steps: skillData.steps,
      });
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/skills');
    return {
      success: true,
      data: {
        skillId: result.data!.id,
        skillName: result.data!.name
      }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to apply template' };
  }
}

// =============================================================================
// APPLY ORG SECTION TEMPLATE
// =============================================================================

/**
 * Result of applying an org_section template
 */
export interface ApplyOrgSectionResult {
  agents: Array<{ id: number; name: string }>;
  skills: Array<{ id: number; name: string; agentId: number | null }>;
  databases: Array<{ id: number; name: string; agentId: number | null }>;
}

/**
 * Apply an org_section template to create agents, skills, and databases
 * This creates actual entities from the template data and appends them to the organization
 *
 * @param templateContent - Either a BrainTemplate object or raw JSON string
 * @returns Created entity IDs for the org chart to display
 */
export async function applyOrgSectionTemplate(
  templateContent: BrainTemplate | string
): Promise<Result<ApplyOrgSectionResult>> {
  try {
    const sessionInfo = await getSessionInfo();
    if (!sessionInfo) {
      return { success: false, error: 'Unauthorized' };
    }

    // Parse if string
    let template: BrainTemplate;
    if (typeof templateContent === 'string') {
      try {
        const parsed = JSON.parse(templateContent);
        if (!isBrainTemplate(parsed)) {
          return { success: false, error: 'Invalid template format' };
        }
        template = parsed;
      } catch {
        return { success: false, error: 'Invalid JSON format' };
      }
    } else {
      template = templateContent;
    }

    // Verify it's an org_section template
    if (template.template.type !== 'org_section') {
      return { success: false, error: `Expected org_section template, got ${template.template.type}` };
    }

    const orgSectionData = template.template.data as OrgSectionTemplateData;
    if (!isOrgSectionTemplateData(orgSectionData)) {
      return { success: false, error: 'Invalid org_section template data' };
    }

    const createdAgents: ApplyOrgSectionResult['agents'] = [];
    const createdSkills: ApplyOrgSectionResult['skills'] = [];
    const createdDatabases: ApplyOrgSectionResult['databases'] = [];

    // Create agents and their children
    for (const agentEntry of orgSectionData.agents) {
      const agentData = agentEntry.agent;

      // Create the agent
      const agentResult = await createAgentFromClient({
        name: agentData.name,
        role: agentData.role || undefined,
        description: agentData.description || undefined,
        persona: agentData.persona || undefined,
        defaultModel: agentData.defaultModel || undefined,
        avatarConfig: agentData.avatarConfig || undefined,
        status: 'active',
        // TODO: Implement automation restoration for templates
        // Design decision: Only export/import automations that reference skills owned by the same agent.
        // Implementation steps:
        // 1. When exporting: Filter automations to only include those where skillRef matches an agent-owned skill
        // 2. When applying: After creating skills, resolve skillRef by name to get the newly created skill ID
        // 3. Call updateAgent to set the automations with resolved skill IDs
        // Currently automations are not restored - they reference skills by name which need resolution after skill creation
      });

      if (!agentResult.success || !agentResult.data) {
        console.error('Failed to create agent:', agentResult.error);
        continue;
      }

      const agentId = agentResult.data.id;
      createdAgents.push({ id: agentId, name: agentData.name });

      // Create agent's skills
      for (const skillData of agentEntry.skills) {
        const skillResult = await createSkill({
          agentId,
          name: skillData.name,
          description: skillData.description,
          instructions: skillData.instructions,
          inputs: skillData.inputs,
          outputs: skillData.outputs,
          tools: skillData.tools,
          executionType: skillData.executionType,
          model: skillData.model,
          agentType: skillData.agentType,
          taskModelConfig: skillData.taskModelConfig,
          toolExecutionConfig: skillData.toolExecutionConfig,
          writeConfig: skillData.writeConfig,
          steps: skillData.steps,
          canvasMetadata: skillData.canvasMetadata,
        });

        if (skillResult.success && skillResult.data) {
          createdSkills.push({
            id: skillResult.data.id,
            name: skillData.name,
            agentId,
          });
        } else {
          console.error('Failed to create skill:', skillResult.error);
        }
      }

      // Create agent's databases (with tables/fields from template)
      for (const dbData of agentEntry.databases) {
        const dbResult = await createDatabase({
          name: dbData.name,
          description: dbData.description,
          metadata: dbData.metadata,
          agentId,
        });

        if (dbResult.success && dbResult.data) {
          createdDatabases.push({
            id: dbResult.data.id,
            name: dbData.name,
            agentId,
          });

          // Create tables and fields if template includes them
          await createTablesFromTemplate(dbResult.data.id, dbData.tables);
        } else {
          console.error('Failed to create database:', dbResult.error);
        }
      }
    }

    // Create org-level skills
    if (orgSectionData.orgSkills) {
      for (const skillData of orgSectionData.orgSkills) {
        const skillResult = await createOrganizationSkill({
          organizationId: sessionInfo.organizationId,
          name: skillData.name,
          description: skillData.description,
          instructions: skillData.instructions,
          inputs: skillData.inputs,
          outputs: skillData.outputs,
          tools: skillData.tools,
          executionType: skillData.executionType,
          model: skillData.model,
          agentType: skillData.agentType,
          taskModelConfig: skillData.taskModelConfig,
          toolExecutionConfig: skillData.toolExecutionConfig,
          writeConfig: skillData.writeConfig,
          steps: skillData.steps,
        });

        if (skillResult.success && skillResult.data) {
          createdSkills.push({
            id: skillResult.data.id,
            name: skillData.name,
            agentId: null,
          });
        } else {
          console.error('Failed to create org skill:', skillResult.error);
        }
      }
    }

    // Create org-level databases (with tables/fields from template)
    if (orgSectionData.orgDatabases) {
      for (const dbData of orgSectionData.orgDatabases) {
        const dbResult = await createDatabase({
          name: dbData.name,
          description: dbData.description,
          metadata: dbData.metadata,
          agentId: null,
        });

        if (dbResult.success && dbResult.data) {
          createdDatabases.push({
            id: dbResult.data.id,
            name: dbData.name,
            agentId: null,
          });

          // Create tables and fields if template includes them
          await createTablesFromTemplate(dbResult.data.id, dbData.tables);
        } else {
          console.error('Failed to create org database:', dbResult.error);
        }
      }
    }

    // Revalidate paths
    revalidatePath('/organization');
    revalidatePath('/agents');
    revalidatePath('/skills');
    revalidatePath('/data');

    return {
      success: true,
      data: {
        agents: createdAgents,
        skills: createdSkills,
        databases: createdDatabases,
      },
    };
  } catch (error) {
    console.error('Apply org section template error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply template',
    };
  }
}
