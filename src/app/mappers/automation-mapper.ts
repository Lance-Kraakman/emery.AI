/**
 * AutomationMapper - Converts between domain entities and DTOs
 *
 * AIDEV-NOTE: Replaces ScheduleMapper for the new automation model
 * - Automations reference skills by ID instead of inline task instructions
 * - Maps trigger configs to/from DTOs
 */

import type { AutomationConfiguration, AutomationInputMapping } from '@/ddd/domain/agents/entities/agent';
import type {
  AutomationConfigurationDTO,
  AutomationInputMappingDTO,
  TriggerConfigDTO,
  CalendarTriggerConfigDTO,
  DatabaseEventTriggerConfigDTO,
  WebhookTriggerConfigDTO,
  PipedreamEventTriggerConfigDTO
} from '@/app/dtos/automation.dto';
import {
  CalendarTriggerConfig,
  DatabaseEventTriggerConfig,
  WebhookTriggerConfig,
  PipedreamEventTriggerConfig,
  type TriggerConfig
} from '@/ddd/domain/scheduling/value-objects/trigger-config';

export class AutomationMapper {
  /**
   * Convert domain AutomationConfiguration to DTO
   */
  static toDTO(automation: AutomationConfiguration): AutomationConfigurationDTO {
    return {
      trigger: this.triggerToDTO(automation.trigger),
      skillId: automation.skillId,
      inputMappings: automation.inputMappings?.map(m => this.inputMappingToDTO(m)),
      enabled: automation.enabled,
      name: automation.name,
      description: automation.description
    };
  }

  /**
   * Convert TriggerConfig to TriggerConfigDTO
   */
  static triggerToDTO(trigger: TriggerConfig): TriggerConfigDTO {
    if (trigger instanceof CalendarTriggerConfig) {
      return {
        type: 'CALENDAR',
        enabled: trigger.enabled,
        description: trigger.description,
        rrule: trigger.rrule,
        timezone: trigger.timezone,
        startDate: trigger.startDate.toISOString(),
        endDate: trigger.endDate?.toISOString()
      } as CalendarTriggerConfigDTO;
    }

    if (trigger instanceof DatabaseEventTriggerConfig) {
      return {
        type: 'DATABASE_EVENT',
        enabled: trigger.enabled,
        description: trigger.description,
        operations: trigger.operations,
        tableId: trigger.tableId,
        conditions: trigger.conditions
      } as DatabaseEventTriggerConfigDTO;
    }

    if (trigger instanceof WebhookTriggerConfig) {
      return {
        type: 'WEBHOOK',
        enabled: trigger.enabled,
        description: trigger.description,
        webhookSecret: trigger.webhookSecret,
        allowedOrigins: trigger.allowedOrigins,
        requiresSignature: trigger.requiresSignature
      } as WebhookTriggerConfigDTO;
    }

    if (trigger instanceof PipedreamEventTriggerConfig) {
      return {
        type: 'PIPEDREAM_EVENT',
        enabled: trigger.enabled,
        description: trigger.description,
        connectionId: trigger.connectionId,
        triggerType: trigger.triggerType,
        props: trigger.props,
        pipedreamSourceId: trigger.pipedreamSourceId,
        pipedreamWebhookId: trigger.pipedreamWebhookId,
        pipedreamSubscriptionId: trigger.pipedreamSubscriptionId
      } as PipedreamEventTriggerConfigDTO;
    }

    // All known trigger types are handled above
    // This should never execute if the type system is correctly used
    throw new Error(`Unknown trigger type: ${(trigger as any).type}`);
  }

  /**
   * Convert input mapping to DTO
   */
  static inputMappingToDTO(mapping: AutomationInputMapping): AutomationInputMappingDTO {
    return {
      triggerField: mapping.triggerField,
      skillInputName: mapping.skillInputName
    };
  }
}
