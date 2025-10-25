import { Step, CreateStepProps, UpdateStepProps } from '../entities/step';
import { StepId } from '../value-objects/step-id';
import { CapabilityId } from '../value-objects/capability-id';

/**
 * Step Repository Interface
 *
 * Defines the contract for persisting and retrieving Step entities.
 * Implementations are provided in the infrastructure layer.
 *
 * AIDEV-NOTE: This is a domain interface - implementations go in infrastructure layer.
 */
export interface IStepRepository {
  /**
   * Find a step by its ID
   */
  findById(id: StepId): Promise<Step | null>;

  /**
   * Find all steps for a specific capability
   * Returns steps ordered by stepOrder
   */
  findByCapabilityId(capabilityId: CapabilityId): Promise<Step[]>;

  /**
   * Create a new step
   */
  create(props: CreateStepProps): Promise<Step>;

  /**
   * Update an existing step
   */
  update(id: StepId, updates: UpdateStepProps): Promise<Step>;

  /**
   * Delete a step
   */
  delete(id: StepId): Promise<void>;

  /**
   * Delete all steps for a capability
   * Used when deleting a capability
   */
  deleteByCapabilityId(capabilityId: CapabilityId): Promise<void>;

  /**
   * Create multiple steps at once
   * More efficient than creating one-by-one
   */
  createMany(steps: CreateStepProps[]): Promise<Step[]>;

  /**
   * Update step orders in bulk
   * Used for reordering steps
   */
  updateStepOrders(updates: Array<{ id: StepId; stepOrder: number }>): Promise<void>;

  /**
   * Get the next step order number for a capability
   * Used when adding new steps
   */
  getNextStepOrder(capabilityId: CapabilityId): Promise<number>;

  /**
   * Count steps for a capability
   */
  countByCapabilityId(capabilityId: CapabilityId): Promise<number>;
}
