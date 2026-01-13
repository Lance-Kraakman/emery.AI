/**
 * Table Event Coordinator Service
 *
 * Handles table change event coordination and trigger matching.
 * Responsible for creating tasks when table changes match agent automations.
 *
 * AIDEV-NOTE: Extracted from TableApplicationService for Single Responsibility Principle.
 * This service focuses solely on event coordination, not row operations.
 */

import type { ITriggerMatchingService } from '@/ddd/domain/scheduling/services/trigger-matching-service';
import type { TableChangeEvent } from '@/ddd/domain/scheduling/types/scheduling-types';
import type { ITaskRepository, CreateTaskData } from '@/ddd/domain/tasks/repositories/task-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { type TriggerContext } from '@/ddd/domain/tasks/entities/task';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('TableEventCoordinator');

export class TableEventCoordinatorService {
  constructor(
    private readonly triggerMatchingService?: ITriggerMatchingService,
    private readonly taskRepository?: ITaskRepository,
    private readonly skillRepository?: ISkillRepository
  ) {}

  /**
   * Handle table triggers for DATABASE_EVENT schedules
   * Emits table change events and creates tasks for matching agent schedules
   *
   * AIDEV-NOTE: This method is called after successful row operations (create, update, delete)
   * to trigger any agents that are listening for table changes.
   */
  async handleTableTriggers(event: TableChangeEvent): Promise<void> {
    // Skip if trigger matching service not available (backward compatibility)
    if (!this.triggerMatchingService || !this.taskRepository) {
      logger.debug('Trigger matching service not available, skipping table triggers');
      return;
    }

    try {
      // Find all agent automations that match this table change event
      const matches = await this.triggerMatchingService.findMatchingAutomations(event);

      if (matches.length === 0) {
        logger.debug('No matching automations found for table change', {
          tableId: event.tableId,
          operation: event.operation
        });
        return;
      }

      logger.debug(`Found ${matches.length} matching automation(s) for table trigger`, {
        tableId: event.tableId,
        operation: event.operation,
        agentCount: matches.length
      });

      // Create a task for each matching automation
      for (const match of matches) {
        try {
          const triggerContext: TriggerContext = {
            type: 'DATABASE_EVENT',
            scheduleName: match.automation.name,
            tableChange: event
          };

          // Look up the skill to get instructions
          let skillInstructions = `Execute automation: ${match.automation.name}`;
          if (match.automation.skillId && this.skillRepository) {
            const skill = await this.skillRepository.findById(
              SkillId.fromNumber(match.automation.skillId)
            );
            if (skill) {
              skillInstructions = skill.instructions;
            }
          }

          // Resolve skill inputs from automation inputMappings
          // Supports variables: $row.*, $previousRow.*, $event.*
          const skillInputs: Record<string, any> = {};
          if (match.automation.inputMappings) {
            for (const mapping of match.automation.inputMappings) {
              let value: any = mapping.triggerField;

              // Resolve trigger variables
              if (typeof value === 'string') {
                if (value.startsWith('$row.')) {
                  const fieldName = value.slice(5);
                  value = event.rowData?.[fieldName];
                } else if (value.startsWith('$previousRow.')) {
                  const fieldName = value.slice(13);
                  value = event.previousRowData?.[fieldName];
                } else if (value.startsWith('$event.')) {
                  const fieldName = value.slice(7);
                  switch (fieldName) {
                    case 'operation': value = event.operation; break;
                    case 'tableId': value = event.tableId; break;
                    case 'tableName': value = event.tableName; break;
                    case 'rowId': value = event.rowId; break;
                    case 'timestamp': value = event.timestamp.toISOString(); break;
                    default: value = undefined;
                  }
                }
              }

              skillInputs[mapping.skillInputName] = value;
            }
          }

          // Build enhanced task instruction text with event context
          const eventDataPreview = JSON.stringify(event.rowData, null, 2);

          const enhancedTask = `
DATABASE EVENT TRIGGER
Table: ${event.tableName} (ID: ${event.tableId})
Operation: ${event.operation}
Row ID: ${event.rowId}
Timestamp: ${event.timestamp.toISOString()}

Row Data:
${eventDataPreview}
${event.previousRowData ? `
Previous Data:
${JSON.stringify(event.previousRowData, null, 2)}
` : ''}
INSTRUCTIONS:
${skillInstructions}
          `.trim();

          const taskData: CreateTaskData = {
            agentId: match.agent.id.value,
            organizationId: event.organizationId.value,
            name: match.automation.name || `Table ${event.operation} trigger`,
            instructions: {
              task: enhancedTask,
              metadata: {
                triggeredBy: 'DATABASE_EVENT',
                tableName: event.tableName,
                tableId: event.tableId,
                operation: event.operation,
                rowId: event.rowId,
                skillId: match.automation.skillId,
                // Include resolved skill inputs for execution
                skillInputs: Object.keys(skillInputs).length > 0 ? skillInputs : undefined
              }
            },
            triggerContext
          };

          const task = await this.taskRepository.create(taskData);

          logger.summary('Created task from table trigger', {
            taskId: task.id.value,
            agentId: match.agent.id.value,
            automationName: match.automation.name,
            tableId: event.tableId,
            operation: event.operation,
            skillId: match.automation.skillId,
            inputCount: Object.keys(skillInputs).length
          });
        } catch (taskError) {
          logger.error('Failed to create task for table trigger', {
            error: taskError,
            agentId: match.agent.id.value,
            automationName: match.automation.name
          });
          // Continue creating tasks for other matches even if one fails
        }
      }
    } catch (error) {
      logger.error('Error handling table triggers', {
        error,
        tableId: event.tableId,
        operation: event.operation
      });
      // Don't throw - table operation should succeed even if trigger handling fails
    }
  }
}
