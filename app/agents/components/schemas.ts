import { z } from "zod";

// AIDEV-NOTE: Centralized Zod schemas for form validation across the application
// AIDEV-NOTE: These schemas ensure type safety and data integrity for Agent and Team operations

// Agent Schemas
export const agentSchema = z.object({
  name: z.string()
    .min(1, "Agent name is required")
    .max(100, "Agent name must be less than 100 characters")
    .trim(),
  role: z.string()
    .max(100, "Role must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  description: z.string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  persona: z.string()
    .max(1000, "Persona must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  model: z.string()
    .optional()
    .or(z.literal("")),
  organizationId: z.number().optional(),
});

export const createAgentSchema = agentSchema.extend({
  organizationId: z.number().min(1, "Organization ID is required"),
});

export const updateAgentSchema = agentSchema.extend({
  id: z.number().min(1, "Agent ID is required"),
});

// Team Schemas
export const teamSchema = z.object({
  name: z.string()
    .min(1, "Team name is required")
    .max(100, "Team name must be less than 100 characters")
    .trim(),
  purpose: z.string()
    .max(200, "Purpose must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  description: z.string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  responsibilities: z.array(z.string().min(1, "Responsibility cannot be empty"))
    .max(20, "Maximum 20 responsibilities allowed")
    .optional(),
  goals: z.array(z.string().min(1, "Goal cannot be empty"))
    .max(20, "Maximum 20 goals allowed")
    .optional(),
  agentIds: z.array(z.string())
    .max(50, "Maximum 50 agents per team")
    .optional(),
  organizationId: z.number().optional(),
});

export const createTeamSchema = teamSchema.extend({
  organizationId: z.number().min(1, "Organization ID is required"),
});

export const updateTeamSchema = teamSchema.extend({
  id: z.number().min(1, "Team ID is required"),
});

// Form data parsers to handle FormData conversion
export const parseArrayFromString = (value: string | null): string[] => {
  if (!value || value.trim() === "") return [];
  return value.split(",").map(item => item.trim()).filter(item => item.length > 0);
};

export const parseFormDataToAgent = (formData: FormData) => {
  return {
    name: formData.get("name") as string,
    role: formData.get("role") as string,
    description: formData.get("description") as string,
    persona: formData.get("persona") as string,
    model: formData.get("model") as string,
    organizationId: parseInt(formData.get("organizationId") as string),
  };
};

export const parseFormDataToTeam = (formData: FormData) => {
  const responsibilitiesStr = formData.get("responsibilities") as string;
  const goalsStr = formData.get("goals") as string;
  const agentIdsStr = formData.get("agentIds") as string;

  return {
    name: formData.get("name") as string,
    purpose: formData.get("purpose") as string,
    description: formData.get("description") as string,
    responsibilities: parseArrayFromString(responsibilitiesStr),
    goals: parseArrayFromString(goalsStr),
    agentIds: parseArrayFromString(agentIdsStr),
    organizationId: parseInt(formData.get("organizationId") as string),
  };
};

// Type exports
export type AgentFormData = z.infer<typeof agentSchema>;
export type CreateAgentFormData = z.infer<typeof createAgentSchema>;
export type UpdateAgentFormData = z.infer<typeof updateAgentSchema>;
export type TeamFormData = z.infer<typeof teamSchema>;
export type CreateTeamFormData = z.infer<typeof createTeamSchema>;
export type UpdateTeamFormData = z.infer<typeof updateTeamSchema>;