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
import { getAgent } from './agents';
import { getDatabase, getAgentDatabases } from './databases';

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
  if (!session?.user?.id || !session?.user?.organizationId) {
    return null;
  }
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId
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

      const databasesTemplateData: DatabaseTemplateData[] = agentDatabases.map(db => ({
        name: db.name,
        slug: db.slug,
        description: db.description || undefined,
        metadata: db.metadata || undefined,
        // Tables could be included here if needed
      }));

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

    // Fetch standalone databases
    const standaloneDatabases: DatabaseTemplateData[] = [];
    for (const dbId of selection.databaseIds) {
      const db = await getDatabase(dbId);
      if (!db) continue;

      standaloneDatabases.push({
        name: db.name,
        slug: db.slug,
        description: db.description || undefined,
        metadata: db.metadata || undefined,
      });
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
