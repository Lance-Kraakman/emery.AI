import { Capability, CreateCapabilityProps, UpdateCapabilityProps } from '../entities/capability';
import { CapabilityId } from '../value-objects/capability-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';

/**
 * Capability Repository Interface
 *
 * Defines the contract for persisting and retrieving Capability aggregates.
 * Implementations are provided in the infrastructure layer.
 *
 * AIDEV-NOTE: This is a domain interface - implementations go in infrastructure layer.
 */
export interface ICapabilityRepository {
  /**
   * Find a capability by its ID (without steps loaded)
   */
  findById(id: CapabilityId): Promise<Capability | null>;

  /**
   * Find all capabilities for a specific agent
   * Steps are loaded for each capability
   */
  findByAgentId(agentId: AgentId): Promise<Capability[]>;

  /**
   * Find a capability by ID with all steps loaded
   * Steps are ordered by stepOrder
   */
  findByIdWithSteps(id: CapabilityId): Promise<Capability | null>;

  /**
   * Create a new capability
   * Steps should be created separately via step repository
   */
  create(props: CreateCapabilityProps): Promise<Capability>;

  /**
   * Update an existing capability
   * Only updates capability metadata (name, description)
   * Steps are managed separately
   */
  update(id: CapabilityId, updates: UpdateCapabilityProps): Promise<Capability>;

  /**
   * Delete a capability
   * Cascade deletes all associated steps
   */
  delete(id: CapabilityId): Promise<void>;

  /**
   * Delete all capabilities for an agent
   * Cascade deletes all associated steps
   */
  deleteByAgentId(agentId: AgentId): Promise<void>;

  /**
   * Check if a capability exists
   */
  exists(id: CapabilityId): Promise<boolean>;

  /**
   * Count capabilities for an agent
   */
  countByAgentId(agentId: AgentId): Promise<number>;
}
