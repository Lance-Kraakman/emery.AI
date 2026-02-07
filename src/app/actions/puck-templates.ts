"use server"

// AIDEV-NOTE: Server Actions for Puck template management
// Handles CRUD operations for reusable Puck component templates

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from "./permissions"
import { requireCurrentOrganization } from "./user-organizations"
import { ActionError, type Result } from "@/lib/puck/errors"

import { OrganizationId, UserId } from "@/ddd/domain/shared/value-objects"
import { AppId } from "@/ddd/domain/puck/value-objects/app-id"
import { TemplateId } from "@/ddd/domain/puck/value-objects/template-id"
import { Template, type TemplateData, type TemplateVariant } from "@/ddd/domain/puck/entities/template"
import { getTemplateApplicationService } from "@/ddd/application/di/container"
import type { CreateTemplateCommand, UpdateTemplateCommand } from "@/ddd/application/services/puck/template-application-service"

// DTO for transferring template data to the client
export interface TemplateDTO {
  id: number;
  organizationId: number | null;
  appId: number | null;
  name: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  thumbnailUrl?: string;
  data: TemplateData;
  variants: TemplateVariant[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mapper to convert domain entity to DTO
function toDTO(template: Template): TemplateDTO {
  return {
    id: template.id.value,
    organizationId: template.organizationId?.value ?? null,
    appId: template.appId?.value ?? null,
    name: template.name,
    description: template.description,
    category: template.category,
    isSystem: template.isSystem,
    thumbnailUrl: template.thumbnailUrl,
    data: template.data,
    variants: template.variants,
    createdBy: template.createdBy?.value ?? null,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  };
}

// Schema for template variants
const templateVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  data: z.array(z.any()),
  isDefault: z.boolean().optional()
})

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  appId: z.number().optional().nullable(),
  data: z.array(z.any()),
  variants: z.array(templateVariantSchema).optional(),
})

const updateTemplateSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Template name is required").optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  data: z.array(z.any()).optional(),
  variants: z.array(templateVariantSchema).optional(),
})

/**
 * Get all templates accessible from the current context
 * If appId is provided, returns org-wide + app-specific templates
 * Otherwise, returns all templates in the organization
 */
export async function getTemplates(appId?: number): Promise<Result<TemplateDTO[]>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user) {
        return {
          success: false,
          error: ActionError.permission('view templates'),
          errorCode: 'PERMISSION'
        };
      }

      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      const templateApplicationService = getTemplateApplicationService();

      let templates: Template[];
      if (appId) {
        const result = await templateApplicationService.getTemplatesForApp(
          OrganizationId.fromNumber(currentOrg.id),
          AppId.fromNumber(appId)
        );
        if (!result.success) {
          return {
            success: false,
            error: ActionError.database('fetch templates'),
            errorCode: 'DATABASE'
          };
        }
        templates = result.data!;
      } else {
        const result = await templateApplicationService.getTemplatesForOrganization(
          OrganizationId.fromNumber(currentOrg.id)
        );
        if (!result.success) {
          return {
            success: false,
            error: ActionError.database('fetch templates'),
            errorCode: 'DATABASE'
          };
        }
        templates = result.data!;
      }

      return {
        success: true,
        data: templates.map(toDTO)
      };
    } catch (error) {
      console.error('[getTemplates] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch templates'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: number): Promise<Result<TemplateDTO>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requirePermission("apps:view");

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.getTemplate(TemplateId.fromNumber(id));

      if (!result.success || !result.data) {
        return {
          success: false,
          error: ActionError.notFound('Template', id),
          errorCode: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        data: toDTO(result.data)
      };
    } catch (error) {
      console.error('[getTemplate] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch template'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(category: string): Promise<Result<TemplateDTO[]>> {
  return withAuthContext(async () => {
    try {
      if (!category) {
        return {
          success: false,
          error: ActionError.validation(['Category required']),
          errorCode: 'VALIDATION'
        };
      }

      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.getTemplatesByCategory(
        OrganizationId.fromNumber(currentOrg.id),
        category
      );

      if (!result.success) {
        return {
          success: false,
          error: ActionError.database('fetch templates by category'),
          errorCode: 'DATABASE'
        };
      }

      return {
        success: true,
        data: result.data!.map(toDTO)
      };
    } catch (error) {
      console.error('[getTemplatesByCategory] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch templates by category'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Create a new template
 */
export async function createTemplate(data: z.infer<typeof createTemplateSchema>): Promise<Result<TemplateDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user) {
        return {
          success: false,
          error: ActionError.permission('create template'),
          errorCode: 'PERMISSION'
        };
      }

      await requirePermission("apps:manage");
      const currentOrg = await requireCurrentOrganization();

      const validatedData = createTemplateSchema.parse(data);

      const createCommand: CreateTemplateCommand = {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        data: validatedData.data as TemplateData,
        variants: validatedData.variants as TemplateVariant[] | undefined,
        organizationId: OrganizationId.fromNumber(currentOrg.id),
        appId: validatedData.appId ? AppId.fromNumber(validatedData.appId) : null,
        createdBy: UserId.fromString(session.user.id)
      };

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.createTemplate(createCommand);

      if (!result.success) {
        return {
          success: false,
          error: ActionError.database('create template'),
          errorCode: 'DATABASE'
        };
      }

      revalidatePath('/apps');

      return {
        success: true,
        data: toDTO(result.data!)
      };
    } catch (error) {
      console.error('[createTemplate] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: ActionError.validation(error.errors.map(e => e.message)),
          errorCode: 'VALIDATION'
        };
      }

      return {
        success: false,
        error: ActionError.database('create template'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Update an existing template
 */
export async function updateTemplate(data: z.infer<typeof updateTemplateSchema>): Promise<Result<TemplateDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user) {
        return {
          success: false,
          error: ActionError.permission('update template'),
          errorCode: 'PERMISSION'
        };
      }

      const validatedData = updateTemplateSchema.parse(data);

      if (!validatedData.id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requirePermission("apps:manage");

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.updateTemplate({
        id: TemplateId.fromNumber(validatedData.id),
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        data: validatedData.data as TemplateData,
        variants: validatedData.variants as TemplateVariant[] | undefined,
        updatedBy: UserId.fromString(session.user.id)
      });

      if (!result.success) {
        return {
          success: false,
          error: ActionError.database('update template'),
          errorCode: 'DATABASE'
        };
      }

      revalidatePath('/apps');

      return {
        success: true,
        data: toDTO(result.data!)
      };
    } catch (error) {
      console.error('[updateTemplate] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: ActionError.validation(error.errors.map(e => e.message)),
          errorCode: 'VALIDATION'
        };
      }

      return {
        success: false,
        error: ActionError.database('update template'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: number): Promise<Result<{ message: string }>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user) {
        return {
          success: false,
          error: ActionError.permission('delete template'),
          errorCode: 'PERMISSION'
        };
      }

      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requirePermission("apps:manage");

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.deleteTemplate(TemplateId.fromNumber(id));

      if (!result.success) {
        return {
          success: false,
          error: ActionError.database('delete template'),
          errorCode: 'DATABASE'
        };
      }

      revalidatePath('/apps');

      return {
        success: true,
        data: { message: "Template deleted successfully" }
      };
    } catch (error) {
      console.error('[deleteTemplate] Error:', error);
      return {
        success: false,
        error: ActionError.database('delete template'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Delete a variant from a template
 */
export async function deleteVariant(templateId: number, variantId: string): Promise<Result<TemplateDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user) {
        return {
          success: false,
          error: ActionError.permission('delete variant'),
          errorCode: 'PERMISSION'
        };
      }

      if (!templateId || !variantId) {
        return {
          success: false,
          error: ActionError.validation(['Template ID and Variant ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requirePermission("apps:manage");

      const templateApplicationService = getTemplateApplicationService();
      const result = await templateApplicationService.getTemplate(TemplateId.fromNumber(templateId));

      if (!result.success || !result.data) {
        return {
          success: false,
          error: ActionError.notFound('Template', templateId),
          errorCode: 'NOT_FOUND'
        };
      }

      const template = result.data!;

      // Remove the variant
      template.removeVariant(variantId);

      const updateResult = await templateApplicationService.updateTemplate({
        id: TemplateId.fromNumber(templateId),
        variants: template.variants,
        updatedBy: UserId.fromString(session.user.id)
      });

      if (!updateResult.success) {
        return {
          success: false,
          error: ActionError.database('delete variant'),
          errorCode: 'DATABASE'
        };
      }

      revalidatePath('/apps');

      return {
        success: true,
        data: toDTO(updateResult.data!)
      };
    } catch (error) {
      console.error('[deleteVariant] Error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        return {
          success: false,
          error: error.message,
          errorCode: 'NOT_FOUND'
        };
      }

      return {
        success: false,
        error: ActionError.database('delete variant'),
        errorCode: 'DATABASE'
      };
    }
  });
}