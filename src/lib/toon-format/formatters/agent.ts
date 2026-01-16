/**
 * TOON formatter for Agent resources
 *
 * Formats agents for LLM consumption with skill summaries.
 * Used by ?format=llm on /api/agents endpoint.
 *
 * Key fields only (default):
 * agents[3]{id,name,description,status,skills}:
 * 1,Sales Bot,Handles sales automation,active,send_email;create_lead
 * 2,Support Bot,Customer support agent,active,respond_ticket
 *
 * With metadata (?meta=1):
 * agents[3]{id,name,description,status,skills,persona,databaseId}:
 */
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Extended agent type with optional skills info for rich formatting
 */
export interface AgentForToon extends AgentDTO {
  skillNames?: string[];
  skillCount?: number;
}

/**
 * Format agents to TOON format.
 * Expects AgentDTO with optional skillNames array for rich skill descriptions.
 */
export function agentsToToon(agents: AgentForToon[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = agents.slice(0, maxItems);

  // Key fields for routing - skills is crucial for agent selection
  const keyFields = ['id', 'name', 'description', 'status', 'skills'];
  const metaFields = includeMeta ? ['persona', 'databaseId', 'ownerId'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `agents[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map(a => {
    // Format skills as semicolon-separated list for compact display
    const skillsDisplay = a.skillNames?.join(';') ||
      (a.skillCount !== undefined ? `(${a.skillCount} skills)` : '');

    const values: (string | number)[] = [
      a.id,
      escapeToonValue(a.name),
      escapeToonValue((a.description || '').slice(0, 100)),
      a.status,
      escapeToonValue(skillsDisplay),
    ];

    if (includeMeta) {
      values.push(
        escapeToonValue((a.persona || '').slice(0, 100)),
        a.databaseId || '',
        a.ownerId || ''
      );
    }

    return values.join(',');
  });

  const result = [header, ...rows];

  if (agents.length > maxItems) {
    result.push(`# truncated: ${agents.length - maxItems} more`);
  }

  return result.join('\n');
}

/**
 * Format single agent to TOON format with full metadata.
 */
export function agentToToon(agent: AgentForToon, config: ToonConfig = {}): string {
  return agentsToToon([agent], { ...config, includeMeta: true });
}
