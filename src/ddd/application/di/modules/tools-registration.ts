/**
 * Tools Domain Registration Module
 *
 * Registers services for tools domain:
 * - Tool registry service
 * - Tool configuration service
 * - Tool search application service
 */

import type { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IToolConfigurationService } from '@/ddd/domain/tools/services/tool-configuration-service';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';

import { DatabaseToolRegistry } from '@/ddd/infrastructure/tools/database-tool-registry';
import { ToolConfigurationDomainService } from '@/ddd/domain/tools/services/tool-configuration-domain-service';
import { ToolConfigurationApplicationService } from '@/ddd/application/services/tools/tool-configuration-application-service';
import { ToolSearchApplicationService } from '@/ddd/application/services/tools/tool-search-application-service';

import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import type { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';

export interface ToolsServices {
  toolRegistryService: IToolRegistryService;
  toolConfigurationService: IToolConfigurationService;
  toolConfigurationApplicationService: ToolConfigurationApplicationService;
  toolSearchApplicationService: ToolSearchApplicationService;
}

export interface ToolsDependencies {
  agentRepository: IAgentRepository;
  tableApplicationService: TableApplicationService;
  agentApplicationService: AgentApplicationService;
  databaseApplicationService: DatabaseApplicationService;
}

export function registerToolsServices(deps: ToolsDependencies): ToolsServices {
  const {
    agentRepository,
    tableApplicationService,
    agentApplicationService,
    databaseApplicationService
  } = deps;

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for tool registry');
  }

  // Register tool services
  const toolRegistryService = new DatabaseToolRegistry();
  const toolConfigurationService = new ToolConfigurationDomainService();

  const toolConfigurationApplicationService = new ToolConfigurationApplicationService(
    agentRepository,
    toolConfigurationService,
    toolRegistryService
  );

  const toolSearchApplicationService = new ToolSearchApplicationService(
    tableApplicationService,
    agentApplicationService,
    databaseApplicationService,
    toolRegistryService
  );

  return {
    toolRegistryService,
    toolConfigurationService,
    toolConfigurationApplicationService,
    toolSearchApplicationService
  };
}
