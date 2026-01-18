/**
 * TOON formatter for Skill resources
 *
 * Formats skills for LLM consumption with input summaries.
 * Used by ?format=llm on /api/skills endpoint.
 *
 * Key fields only (default):
 * skills[3]{id,name,description,type,agentId,inputs}:
 * 1,Send Email,Sends email to recipient,agentic,42,recipient;subject;body
 * 2,Create Lead,Creates CRM lead,operation,42,name;email;company
 *
 * With metadata (?meta=1):
 * skills[3]{id,name,description,type,agentId,inputs,tools,model}:
 */
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Format skills to TOON format.
 * Expects SkillDTO from SkillMapper.toDTO().
 */
export function skillsToToon(skills: SkillDTO[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = skills.slice(0, maxItems);

  // Key fields for understanding skill capabilities
  const keyFields = ['id', 'name', 'description', 'type', 'agentId', 'inputs'];
  const metaFields = includeMeta ? ['tools', 'model', 'isSystem'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `skills[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map(s => {
    // Format inputs as semicolon-separated list of names with required marker
    const inputsDisplay = s.inputs
      .map(i => i.required ? `${i.name}*` : i.name)
      .join(';');

    const values: (string | number | null)[] = [
      s.id,
      escapeToonValue(s.name),
      escapeToonValue((s.description || '').slice(0, 100)),
      s.executionType || 'agentic',
      s.agentId ?? '',
      escapeToonValue(inputsDisplay),
    ];

    if (includeMeta) {
      // Format tools as semicolon-separated names
      const toolsDisplay = s.tools.map(t => t.name).join(';');
      values.push(
        escapeToonValue(toolsDisplay),
        s.model || '',
        s.isSystem ? 'system' : ''
      );
    }

    return values.join(',');
  });

  const result = [header, ...rows];

  if (skills.length > maxItems) {
    result.push(`# truncated: ${skills.length - maxItems} more`);
  }

  return result.join('\n');
}

/**
 * Format single skill to TOON format with full metadata.
 */
export function skillToToon(skill: SkillDTO, config: ToonConfig = {}): string {
  return skillsToToon([skill], { ...config, includeMeta: true });
}
