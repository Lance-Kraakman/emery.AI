/**
 * Schedule Mapper
 *
 * Maps between ScheduleConfiguration domain objects and ScheduleConfigurationDTO for API transfer.
 * Handles the complete schedule structure: trigger config + task instructions + tools.
 *
 * AIDEV-NOTE: This mapper is central to the schedule system architecture.
 * - Domain: ScheduleConfiguration (has TriggerConfig Value Object + TaskInstructions)
 * - DTO: ScheduleConfigurationDTO (has TriggerConfigDTO plain object + TaskInstructionsDTO)
 */

import type { ScheduleConfiguration, TaskInstructions } from '@/ddd/domain/agents/entities/agent';
import type { ScheduleConfigurationDTO, TaskInstructionsDTO } from '@/app/dtos/schedule.dto';
import { TriggerConfigMapper } from './trigger-config-mapper';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

export class ScheduleMapper {
  /**
   * Convert ScheduleConfiguration domain object to DTO
   */
  static toDTO(schedule: ScheduleConfiguration): ScheduleConfigurationDTO {
    return {
      // Convert TriggerConfig Value Object to DTO
      trigger: TriggerConfigMapper.toDTO(schedule.trigger),

      // Convert TaskInstructions with tools
      taskInstructions: {
        task: schedule.taskInstructions.task,
        images: schedule.taskInstructions.images,
        attachments: schedule.taskInstructions.attachments,
        tools: (schedule.taskInstructions.tools || []).map(tool => tool.toPlain()),
        metadata: schedule.taskInstructions.metadata
      },

      enabled: schedule.enabled,
      name: schedule.name,
      description: schedule.description
    };
  }

  /**
   * Convert ScheduleConfigurationDTO to domain object
   */
  static fromDTO(dto: ScheduleConfigurationDTO): ScheduleConfiguration {
    return {
      // Convert TriggerConfigDTO to TriggerConfig Value Object
      trigger: TriggerConfigMapper.fromDTO(dto.trigger),

      // Convert TaskInstructionsDTO with tools
      taskInstructions: {
        task: dto.taskInstructions.task,
        images: dto.taskInstructions.images,
        attachments: dto.taskInstructions.attachments,
        tools: (dto.taskInstructions.tools || []).map(toolDTO =>
          ToolConfig.fromPlain(toolDTO)
        ),
        metadata: dto.taskInstructions.metadata
      },

      enabled: dto.enabled,
      name: dto.name,
      description: dto.description
    };
  }

  /**
   * Convert array of ScheduleConfiguration to array of DTOs
   */
  static toDTOs(schedules: ScheduleConfiguration[]): ScheduleConfigurationDTO[] {
    return schedules.map(schedule => this.toDTO(schedule));
  }

  /**
   * Convert array of DTOs to array of ScheduleConfiguration
   */
  static fromDTOs(dtos: ScheduleConfigurationDTO[]): ScheduleConfiguration[] {
    return dtos.map(dto => this.fromDTO(dto));
  }
}
