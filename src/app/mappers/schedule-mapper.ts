/**
 * Schedule Mapper (DEPRECATED - use AutomationMapper instead)
 *
 * This mapper is kept for backward compatibility during migration from schedules to automations.
 * New code should use AutomationMapper from './automation-mapper'.
 *
 * AIDEV-NOTE: The schedule system has been refactored to automations.
 * - Automations reference skills by ID instead of inline task instructions
 * - This mapper provides legacy support for existing code that hasn't been migrated
 */

import type { AutomationConfiguration } from '@/ddd/domain/agents/entities/agent';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import { TriggerConfigMapper } from './trigger-config-mapper';

/**
 * @deprecated Use AutomationMapper instead
 */
export class ScheduleMapper {
  /**
   * Convert AutomationConfiguration domain object to DTO
   * @deprecated Use AutomationMapper.toDTO instead
   */
  static toDTO(automation: AutomationConfiguration): AutomationConfigurationDTO {
    return {
      trigger: TriggerConfigMapper.toDTO(automation.trigger),
      skillId: automation.skillId,
      inputMappings: automation.inputMappings?.map(m => ({
        triggerField: m.triggerField,
        skillInputName: m.skillInputName
      })),
      enabled: automation.enabled,
      name: automation.name,
      description: automation.description
    };
  }

  /**
   * Convert AutomationConfigurationDTO to domain object
   * @deprecated Use AutomationMapper.fromDTO instead
   */
  static fromDTO(dto: AutomationConfigurationDTO): AutomationConfiguration {
    return {
      trigger: TriggerConfigMapper.fromDTO(dto.trigger),
      skillId: dto.skillId,
      inputMappings: dto.inputMappings?.map(m => ({
        triggerField: m.triggerField,
        skillInputName: m.skillInputName
      })),
      enabled: dto.enabled,
      name: dto.name,
      description: dto.description
    };
  }

  /**
   * Convert array of AutomationConfiguration to array of DTOs
   * @deprecated Use AutomationMapper.toDTOs instead
   */
  static toDTOs(automations: AutomationConfiguration[]): AutomationConfigurationDTO[] {
    return automations.map(automation => this.toDTO(automation));
  }

  /**
   * Convert array of DTOs to array of AutomationConfiguration
   * @deprecated Use AutomationMapper.fromDTOs instead
   */
  static fromDTOs(dtos: AutomationConfigurationDTO[]): AutomationConfiguration[] {
    return dtos.map(dto => this.fromDTO(dto));
  }
}
