/**
 * Agent Domain Registration Module
 *
 * Registers repositories and services for agent domain:
 * - Agent repository
 * - Task repository
 * - Agent execution repository (gRPC)
 * - Agent application services
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';

import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { DrizzleTaskRepository } from '@/ddd/infrastructure/db/repositories/tasks/drizzle-task-repository';
import { GrpcAgentExecutionRepository } from '@/ddd/infrastructure/execution/grpc-agent-execution-repository';

import { AgentTaskApplicationService } from '@/ddd/application/services/agents/agent-task-application-service';
import { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';

export interface AgentServices {
  agentRepository: IAgentRepository;
  taskRepository: ITaskRepository;
  agentExecutionRepository: IAgentExecutionRepository;
  agentTaskApplicationService: AgentTaskApplicationService;
  agentApplicationService: AgentApplicationService;
}

export interface AgentDependencies {
  db: ContextAwareDbClient;
  teamRepository: ITeamRepository;
}

export function registerAgentServices(deps: AgentDependencies): AgentServices {
  const { db, teamRepository } = deps;

  // Register repositories
  const agentRepository = new DrizzleAgentRepository(db);
  const taskRepository = new DrizzleTaskRepository(db);
  const agentExecutionRepository = new GrpcAgentExecutionRepository(agentRepository);

  // Register application services
  const agentTaskApplicationService = new AgentTaskApplicationService(
    agentRepository,
    taskRepository,
    agentExecutionRepository
  );

  const agentApplicationService = new AgentApplicationService(
    agentRepository,
    teamRepository
  );

  return {
    agentRepository,
    taskRepository,
    agentExecutionRepository,
    agentTaskApplicationService,
    agentApplicationService
  };
}
