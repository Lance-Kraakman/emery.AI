// AIDEV-NOTE: Drizzle implementation of Delegation repository
// Handles data persistence for CredentialDelegation domain entities
// Critical security component - manages OAuth credential delegation permissions

import type { IDelegationRepository } from '@/ddd/domain/delegations/repositories/delegation-repository';
import type { CredentialDelegation } from '@/ddd/domain/delegations/entities/credential-delegation';
import { DelegationStatus } from '@/ddd/domain/delegations/entities/credential-delegation';
import { credentialDelegations } from '@/ddd/infrastructure/db/schema';
import { eq, and, arrayContains } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { DelegationId, AgentId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import type { DbClient } from '@/ddd/infrastructure/db/client';

type DelegationRow = InferSelectModel<typeof credentialDelegations>;

export class DrizzleDelegationRepository implements IDelegationRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: DelegationId): Promise<CredentialDelegation | null> {
    const [record] = await this.db
      .select()
      .from(credentialDelegations)
      .where(eq(credentialDelegations.id, id.value))
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async findByAgent(agentId: AgentId): Promise<CredentialDelegation | null> {
    const [record] = await this.db
      .select()
      .from(credentialDelegations)
      .where(eq(credentialDelegations.agentId, agentId.value))
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async findByOwner(ownerId: UserId): Promise<CredentialDelegation[]> {
    const records = await this.db
      .select()
      .from(credentialDelegations)
      .where(eq(credentialDelegations.ownerId, ownerId.value));

    return records.map((record: DelegationRow) => this.fromPersistence(record));
  }

  async hasPermission(agentId: AgentId, service: AppName): Promise<boolean> {
    const delegation = await this.findByAgent(agentId);

    if (!delegation) {
      return false;
    }

    // Check if delegation is approved and not expired
    if (delegation.status !== DelegationStatus.APPROVED) {
      return false;
    }

    if (delegation.expiresAt && delegation.expiresAt < new Date()) {
      return false;
    }

    // Check if the specific service is in the approved services list
    return delegation.services.some(approvedService =>
      approvedService.equals(service)
    );
  }

  async create(delegation: CredentialDelegation): Promise<CredentialDelegation> {
    // Exclude ID from insert - let database generate via serial
    const data = this.toPersistence(delegation, false);

    const [record] = await this.db
      .insert(credentialDelegations)
      .values(data)
      .returning();

    return this.fromPersistence(record);
  }

  async update(delegation: CredentialDelegation): Promise<CredentialDelegation> {
    // Include ID for update operations
    const data = this.toPersistence(delegation, true);

    const [record] = await this.db
      .update(credentialDelegations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(credentialDelegations.id, delegation.id.value))
      .returning();

    if (!record) {
      throw new Error(`Delegation with id ${delegation.id.value} not found`);
    }

    return this.fromPersistence(record);
  }

  async delete(id: DelegationId): Promise<void> {
    await this.db
      .delete(credentialDelegations)
      .where(eq(credentialDelegations.id, id.value));
  }

  // AIDEV-NOTE: Mapping functions - convert between domain and persistence models

  private fromPersistence(record: DelegationRow): CredentialDelegation {
    return {
      id: DelegationId.fromNumber(record.id),
      ownerId: UserId.fromString(record.ownerId),
      agentId: AgentId.fromNumber(record.agentId),
      services: record.services.map(service => AppName.fromString(service)),
      status: record.status as DelegationStatus,
      approvedAt: record.approvedAt ?? undefined,
      expiresAt: record.expiresAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  /**
   * Convert domain entity to persistence model
   * @param delegation - Domain entity to convert
   * @param isUpdate - True for UPDATE operations (includes ID), false for INSERT (excludes ID)
   */
  private toPersistence(delegation: CredentialDelegation, isUpdate: boolean = false): Partial<DelegationRow> {
    const data: Partial<DelegationRow> = {
      ownerId: delegation.ownerId.value,
      agentId: delegation.agentId.value,
      services: delegation.services.map(service => service.value),
      status: delegation.status,
      approvedAt: delegation.approvedAt ?? null,
      expiresAt: delegation.expiresAt ?? null,
      createdAt: delegation.createdAt,
      updatedAt: delegation.updatedAt
    };

    // Only include ID for updates, not inserts (database generates ID via serial)
    if (isUpdate) {
      data.id = delegation.id.value;
    }

    return data;
  }
}
