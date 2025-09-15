import { eq } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

/**
 * Drizzle-specific base repository implementation
 * Provides common query patterns for Drizzle ORM
 */
export abstract class DrizzleBaseRepository<
  TEntity,
  TId extends { value: string | number },
  TCreateData,
  TUpdateData,
  TRecord = any
> extends BaseRepository<TEntity, TId, TCreateData, TUpdateData> {
  
  // Subclasses must define their table and columns
  protected abstract readonly table: any;
  protected abstract readonly idColumn: any;
  protected abstract readonly organizationColumn?: any;
  
  // Mapping methods between domain entities and database records
  protected abstract fromPersistence(record: TRecord): TEntity;
  protected abstract toPersistence(entity: TEntity): Partial<TRecord>;
  
  /**
   * Find entity by ID - common implementation for all repositories
   */
  async findById(id: TId): Promise<TEntity | null> {
    const [record] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.idColumn, id.value))
      .limit(1);
    
    return record ? this.fromPersistence(record) : null;
  }
  
  /**
   * Find entities by organization - common pattern for multi-tenant entities
   */
  async findByOrganization(orgId: OrganizationId): Promise<TEntity[]> {
    if (!this.organizationColumn) {
      throw new Error(`${this.constructor.name} does not support organization filtering`);
    }
    
    const records: TRecord[] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.organizationColumn, orgId.value));

    return records.map(r => this.fromPersistence(r));
  }

  /**
   * Delete entity by ID - common implementation
   */
  async delete(id: TId): Promise<void> {
    await this.db
      .delete(this.table)
      .where(eq(this.idColumn, id.value));
  }
}