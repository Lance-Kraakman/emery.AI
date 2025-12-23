/**
 * TriggerConfig Mapper
 *
 * Maps between TriggerConfig domain Value Objects and TriggerConfigDTO for API transfer.
 * Handles all trigger types: Manual, Calendar, DatabaseEvent, Webhook.
 *
 * AIDEV-NOTE: This mapper bridges the domain layer (TriggerConfig) and the DTO layer (TriggerConfigDTO).
 * - Domain objects have business logic and validation
 * - DTOs are plain objects for client-server communication
 */

import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { TriggerConfigFromJSON } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { TriggerConfigDTO } from '@/app/dtos/automation.dto';

export class TriggerConfigMapper {
  /**
   * Convert TriggerConfig domain Value Object to DTO
   * Uses the built-in toJSON() method on TriggerConfig
   */
  static toDTO(triggerConfig: TriggerConfig): TriggerConfigDTO {
    // TriggerConfig.toJSON() returns a plain object compatible with TriggerConfigDTO
    return triggerConfig.toJSON() as TriggerConfigDTO;
  }

  /**
   * Convert TriggerConfigDTO to domain Value Object
   * Uses the TriggerConfigFromJSON factory function
   */
  static fromDTO(dto: TriggerConfigDTO): TriggerConfig {
    return TriggerConfigFromJSON(dto);
  }

  /**
   * Convert array of TriggerConfig to array of DTOs
   */
  static toDTOs(triggerConfigs: TriggerConfig[]): TriggerConfigDTO[] {
    return triggerConfigs.map(tc => this.toDTO(tc));
  }

  /**
   * Convert array of DTOs to array of TriggerConfig
   */
  static fromDTOs(dtos: TriggerConfigDTO[]): TriggerConfig[] {
    return dtos.map(dto => this.fromDTO(dto));
  }
}
