/**
 * Chat Domain Registration Module
 *
 * Registers repositories and services for chat domain:
 * - Chat repository
 * - Chat message repository
 * - Chat application service
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';

import { DrizzleChatRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-repository';
import { DrizzleChatMessageRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-message-repository';

import { ChatApplicationService } from '@/ddd/application/services/chat/chat-application-service';
import { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';

export interface ChatServices {
  chatRepository: IChatRepository;
  chatMessageRepository: IChatMessageRepository;
  chatApplicationService: ChatApplicationService;
}

export interface ChatDependencies {
  db: ContextAwareDbClient;
  dynamicTableService: DynamicTableService;
  agentRepository: IAgentRepository;
}

export function registerChatServices(deps: ChatDependencies): ChatServices {
  const { db, dynamicTableService, agentRepository } = deps;

  // Register repositories
  const chatRepository = new DrizzleChatRepository(db);
  const chatMessageRepository = new DrizzleChatMessageRepository(db);

  // Register application service
  const chatApplicationService = new ChatApplicationService(
    chatRepository,
    chatMessageRepository,
    dynamicTableService,
    agentRepository
  );

  return {
    chatRepository,
    chatMessageRepository,
    chatApplicationService
  };
}
