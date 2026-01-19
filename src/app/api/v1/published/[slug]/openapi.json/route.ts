/**
 * External API - OpenAPI Specification Endpoint
 *
 * GET /api/v1/published/:slug/openapi.json
 *
 * Returns the OpenAPI 3.0 specification for a published agent.
 * Used by ChatGPT plugins and other integrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/ddd/infrastructure/db/client';
import { publishedAgents } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  DrizzlePublishedAgentRepository,
  DrizzlePublishedAgentApiKeyRepository,
  DrizzlePublishedAgentUsageLogRepository,
} from '@/ddd/infrastructure/db/repositories/published-agents';
import { DrizzleSkillRepository } from '@/ddd/infrastructure/db/repositories/skills/drizzle-skill-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { ExternalExecutionService } from '@/ddd/application/services/published-agents';
import { AgentId } from '@/ddd/domain/shared/value-objects';

// Initialize repositories and service
const publishedAgentRepository = new DrizzlePublishedAgentRepository(db);
const apiKeyRepository = new DrizzlePublishedAgentApiKeyRepository(db);
const usageLogRepository = new DrizzlePublishedAgentUsageLogRepository(db);
const skillRepository = new DrizzleSkillRepository(db);
const agentRepository = new DrizzleAgentRepository(db);

const executionService = new ExternalExecutionService(
  publishedAgentRepository,
  apiKeyRepository,
  usageLogRepository,
  skillRepository,
  agentRepository
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the published agent by slug (no auth required for OpenAPI spec)
    const result = await db.select()
      .from(publishedAgents)
      .where(and(
        eq(publishedAgents.slug, slug),
        eq(publishedAgents.status, 'published')
      ))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Published agent not found' },
        { status: 404 }
      );
    }

    const publishedAgent = result[0];

    // Get skills for this agent
    const agentId = AgentId.fromNumber(publishedAgent.agentId);
    const skills = await skillRepository.findByAgentId(agentId);

    // Get the base URL from the request
    const baseUrl = new URL(request.url).origin;

    // Generate OpenAPI spec
    const openApiSpec = generateOpenApiSpec(
      publishedAgent,
      skills.map(s => ({
        name: s.name,
        description: s.description,
        inputs: s.inputs,
        outputs: s.outputs,
      })),
      baseUrl
    );

    return NextResponse.json(openApiSpec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[PublishedAgent:OpenAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// OpenAPI Spec Generator
// ============================================================================

interface SkillInfo {
  name: string;
  description: string;
  inputs: unknown[];
  outputs: unknown[];
}

function generateOpenApiSpec(
  publishedAgent: typeof publishedAgents.$inferSelect,
  skills: SkillInfo[],
  baseUrl: string
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};

  // Add task endpoint if task mode is enabled
  if (publishedAgent.allowTaskMode) {
    paths['/task'] = {
      post: {
        operationId: 'executeTask',
        summary: 'Execute a natural language task',
        description: `Send a natural language task to ${publishedAgent.displayName}. The agent will determine the best way to accomplish the task.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['task'],
                properties: {
                  task: {
                    type: 'string',
                    description: 'The task to execute in natural language',
                  },
                  context: {
                    type: 'object',
                    description: 'Optional context for the task',
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task executed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        output: { type: 'object' },
                        executionTimeMs: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized - Invalid or missing API key' },
          '429': { description: 'Rate limit exceeded' },
        },
        security: [{ apiKey: [] }],
      },
    };
  }

  // Add skill endpoints if skill mode is enabled
  if (publishedAgent.allowSkillMode) {
    for (const skill of skills) {
      const inputSchema = generateInputSchema(skill.inputs);
      const outputSchema = generateOutputSchema(skill.outputs);

      paths[`/skills/${skill.name}`] = {
        post: {
          operationId: `execute_${skill.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          summary: `Execute ${skill.name}`,
          description: skill.description || `Execute the ${skill.name} skill`,
          requestBody: {
            required: Array.isArray(inputSchema.required) && inputSchema.required.length > 0,
            content: {
              'application/json': {
                schema: inputSchema,
              },
            },
          },
          responses: {
            '200': {
              description: 'Skill executed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          output: outputSchema,
                          executionTimeMs: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid input' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Skill not found' },
            '429': { description: 'Rate limit exceeded' },
          },
          security: [{ apiKey: [] }],
        },
      };
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: publishedAgent.displayName,
      description: publishedAgent.description || `API for ${publishedAgent.displayName}`,
      version: '1.0.0',
    },
    servers: [
      {
        url: `${baseUrl}/api/v1/published/${publishedAgent.slug}`,
        description: 'Production server',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
      },
    },
    security: [{ apiKey: [] }],
  };
}

function generateInputSchema(inputs: unknown[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const input of inputs as Array<{ name: string; type?: string; description?: string; required?: boolean }>) {
    properties[input.name] = {
      type: mapInputType(input.type),
      description: input.description || undefined,
    };

    if (input.required) {
      required.push(input.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function generateOutputSchema(outputs: unknown[]): Record<string, unknown> {
  if (!outputs || outputs.length === 0) {
    return { type: 'object', additionalProperties: true };
  }

  const properties: Record<string, unknown> = {};

  for (const output of outputs as Array<{ name: string; type?: string; description?: string }>) {
    properties[output.name] = {
      type: mapInputType(output.type),
      description: output.description || undefined,
    };
  }

  return {
    type: 'object',
    properties,
  };
}

function mapInputType(type?: string): string {
  switch (type?.toLowerCase()) {
    case 'string':
    case 'text':
      return 'string';
    case 'number':
    case 'integer':
    case 'int':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'array':
    case 'list':
      return 'array';
    case 'object':
    case 'json':
      return 'object';
    default:
      return 'string';
  }
}
