// AIDEV-NOTE: Comprehensive Dynamic Table repository tests - covers runtime table management and row operations
// Uses PGlite in-memory database with real migration files for realistic testing

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';
import { DrizzleOrganizationRepository } from '@/lib/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleUserRepository } from '@/lib/infrastructure/db/repositories/drizzle-user-repository';
import { databases } from '@/lib/db/schema';
import { createTestDb } from '@/lib/db/test-client';
import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  UpdateDynamicTableData,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/lib/domain/entities/dynamic-table';
import type { CreateOrganizationData } from '@/lib/domain/entities/organization';
import type { CreateUserData } from '@/lib/domain/entities/user';

describe('DrizzleDynamicTableRepository', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let dynamicTableRepository: DrizzleDynamicTableRepository;
  let orgRepository: DrizzleOrganizationRepository;
  let userRepository: DrizzleUserRepository;
  let testTable: DynamicTable;
  let testOrganizationId: number;
  let testDatabaseId: number;
  let testUserId: string;
  let actualTestDatabaseId: number;

  beforeEach(async () => {
    testDb = await createTestDb();
    
    // Create mock raw client for PGlite compatibility
    const mockRawClient = {
      query: async (query: string, params?: any[]) => {
        console.log(`[MOCK-DDL] ${query}`);
        return { rows: [], rowCount: 0 };
      }
    };
    
    const rawClient = new Proxy(mockRawClient.query, {
      apply: (target, thisArg, args) => {
        return mockRawClient.query(args[0], args.slice(1));
      },
      get: (target, prop) => {
        return (value: string) => value; // Identity function for identifier escaping
      }
    });
    
    dynamicTableRepository = new DrizzleDynamicTableRepository(testDb.db, rawClient as any);
    orgRepository = new DrizzleOrganizationRepository(testDb.db, testDb.client);
    userRepository = new DrizzleUserRepository(testDb.db, testDb.client);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // Setup helpers to create test data
  const createTestOrganization = async () => {
    const orgData: CreateOrganizationData = {
      name: 'Test Organization',
      mission: 'Testing dynamic table repository',
    };
    return await orgRepository.create(orgData);
  };

  const createTestUser = async (email?: string): Promise<string> => {
    const userData: CreateUserData = {
      email: email || `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}@example.com`,
      name: 'Test User',
      jobTitle: 'Developer',
    };
    const user = await userRepository.create(userData);
    return user.id;
  };

  const createTestDatabase = async (): Promise<number> => {
    const [database] = await testDb.db
      .insert(databases)
      .values({
        organizationId: testOrganizationId,
        name: 'Dynamic Table Test Database',
        slug: `dynamic_table_test_db_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        metadata: { description: 'Database for dynamic table testing' },
        createdBy: testUserId,
      })
      .returning();
    return database.id;
  };

  const createTestTable = async (name = 'Test Table', dbName?: string): Promise<DynamicTable> => {
    const tableData: CreateDynamicTableData = {
      databaseId: actualTestDatabaseId,
      organizationId: testOrganizationId,
      name,
      dbName: dbName || `test_table_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      metadata: { description: 'Test table for repository testing' },
      createdBy: testUserId,
    };
    return await dynamicTableRepository.create(tableData);
  };

  describe('Basic Table CRUD Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      actualTestDatabaseId = await createTestDatabase();
    });

    it('should create a dynamic table with metadata and physical table', async () => {
      const tableData: CreateDynamicTableData = {
        databaseId: testDatabaseId,
        organizationId: testOrganizationId,
        name: 'Customer Table',
        dbName: 'customer_table_test',
        metadata: { description: 'Customer information table' },
        createdBy: testUserId,
      };

      const table = await dynamicTableRepository.create(tableData);

      expect(table.id).toBeDefined();
      expect(table.name).toBe('Customer Table');
      expect(table.dbName).toBe('customer_table_test');
      expect(table.databaseId).toBe(testDatabaseId);
      expect(table.organizationId).toBe(testOrganizationId);
      expect(table.metadata).toEqual({ description: 'Customer information table' });
      expect(table.createdBy).toBe(testUserId);
      expect(table.createdAt).toBeDefined();

      // Verify physical table was created by trying to query it
      const rows = await dynamicTableRepository.findRows(table.id);
      expect(rows).toEqual([]);
    });

    it('should find table by ID', async () => {
      testTable = await createTestTable('Find By ID Table');

      const foundTable = await dynamicTableRepository.findById(testTable.id);

      expect(foundTable).toBeDefined();
      expect(foundTable!.id).toBe(testTable.id);
      expect(foundTable!.name).toBe('Find By ID Table');
    });

    it('should return null for non-existent table ID', async () => {
      const foundTable = await dynamicTableRepository.findById(99999);

      expect(foundTable).toBeNull();
    });

    it('should find table by database name', async () => {
      const dbName = 'unique_db_name_test';
      testTable = await createTestTable('DB Name Test', dbName);

      const foundTable = await dynamicTableRepository.findByDbName(dbName);

      expect(foundTable).toBeDefined();
      expect(foundTable!.id).toBe(testTable.id);
      expect(foundTable!.dbName).toBe(dbName);
    });

    it('should find tables by organization', async () => {
      const table1 = await createTestTable('Org Table 1');
      const table2 = await createTestTable('Org Table 2');

      const tables = await dynamicTableRepository.findByOrganization(testOrganizationId);

      expect(tables).toHaveLength(2);
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('Org Table 1');
      expect(tableNames).toContain('Org Table 2');
    });

    it('should find tables by database', async () => {
      const table1 = await createTestTable('DB Table 1');
      const table2 = await createTestTable('DB Table 2');

      const tables = await dynamicTableRepository.findByDatabase(testDatabaseId);

      expect(tables).toHaveLength(2);
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('DB Table 1');
      expect(tableNames).toContain('DB Table 2');
    });

    it('should update table metadata', async () => {
      testTable = await createTestTable('Update Test Table');

      const updateData: UpdateDynamicTableData = {
        name: 'Updated Table Name',
        metadata: { description: 'Updated description', version: '2.0' },
      };

      const updatedTable = await dynamicTableRepository.update(testTable.id, updateData);

      expect(updatedTable.name).toBe('Updated Table Name');
      expect(updatedTable.metadata).toEqual({ description: 'Updated description', version: '2.0' });
      expect(updatedTable.dbName).toBe(testTable.dbName); // Unchanged
    });

    it('should throw error when updating non-existent table', async () => {
      const updateData: UpdateDynamicTableData = {
        name: 'New Name',
      };

      await expect(dynamicTableRepository.update(99999, updateData))
        .rejects.toThrow('Table with id 99999 not found or could not be updated');
    });

    it('should delete table and drop physical table', async () => {
      testTable = await createTestTable('Delete Test Table');

      await dynamicTableRepository.delete(testTable.id);

      const foundTable = await dynamicTableRepository.findById(testTable.id);
      expect(foundTable).toBeNull();
    });

    it('should throw error when deleting table with data', async () => {
      testTable = await createTestTable('Table With Data');

      // Add some data to make table non-deletable
      await dynamicTableRepository.insertRow(testTable.id, {});

      await expect(dynamicTableRepository.delete(testTable.id))
        .rejects.toThrow('Cannot delete table');
    });
  });

  describe('Physical Table Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
    });

    it('should create physical table with default columns', async () => {
      const dbName = 'physical_test_table';

      await dynamicTableRepository.createPhysicalTable(dbName);

      // Verify table was created by checking we can query it
      const result = await testDb.client`SELECT * FROM ${testDb.client(dbName)} LIMIT 0`;
      expect(result).toEqual([]);
    });

    it('should drop physical table', async () => {
      const dbName = 'drop_test_table';

      // Create then drop
      await dynamicTableRepository.createPhysicalTable(dbName);
      await dynamicTableRepository.dropPhysicalTable(dbName);

      // Verify table was dropped by expecting error when querying
      await expect(testDb.client`SELECT * FROM ${testDb.client(dbName)}`)
        .rejects.toThrow();
    });

    it('should rename physical table', async () => {
      const oldName = 'old_table_name';
      const newName = 'new_table_name';

      // Create table with old name
      await dynamicTableRepository.createPhysicalTable(oldName);

      // Rename it
      await dynamicTableRepository.renamePhysicalTable(oldName, newName);

      // Verify old name doesn't exist and new name does
      await expect(testDb.client`SELECT * FROM ${testDb.client(oldName)}`)
        .rejects.toThrow();

      const result = await testDb.client`SELECT * FROM ${testDb.client(newName)} LIMIT 0`;
      expect(result).toEqual([]);
    });
  });

  describe('Row CRUD Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
      testTable = await createTestTable('Row Test Table');
    });

    it('should insert row with empty data (default values)', async () => {
      const row = await dynamicTableRepository.insertRow(testTable.id, {});

      expect(row.id).toBeDefined();
      expect(row.created_at).toBeDefined();
      expect(row.updated_at).toBeDefined();
    });

    it('should insert row with custom data', async () => {
      const rowData: CreateRowData = {
        field_1: 'Test Value',
        field_2: 42,
        field_3: true,
      };

      const row = await dynamicTableRepository.insertRow(testTable.id, rowData);

      expect(row.id).toBeDefined();
      expect(row.field_1).toBe('Test Value');
      expect(row.field_2).toBe(42);
      expect(row.field_3).toBe(true);
    });

    it('should find row by ID', async () => {
      const insertedRow = await dynamicTableRepository.insertRow(testTable.id, {
        field_1: 'Find Me',
      });

      const foundRow = await dynamicTableRepository.findRowById(testTable.id, insertedRow.id);

      expect(foundRow).toBeDefined();
      expect(foundRow!.id).toBe(insertedRow.id);
      expect(foundRow!.field_1).toBe('Find Me');
    });

    it('should return null for non-existent row ID', async () => {
      const foundRow = await dynamicTableRepository.findRowById(testTable.id, '00000000-0000-0000-0000-000000000000');

      expect(foundRow).toBeNull();
    });

    it('should find rows with pagination', async () => {
      // Insert multiple rows
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Row 1' });
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Row 2' });
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Row 3' });

      const options: RowQueryOptions = {
        limit: 2,
        offset: 0,
        orderBy: 'created_at',
        orderDirection: 'DESC',
      };

      const rows = await dynamicTableRepository.findRows(testTable.id, options);

      expect(rows).toHaveLength(2);
      // Most recent first due to DESC order
      expect(rows[0].field_1).toBe('Row 3');
      expect(rows[1].field_1).toBe('Row 2');
    });

    it('should update row data', async () => {
      const insertedRow = await dynamicTableRepository.insertRow(testTable.id, {
        field_1: 'Original Value',
        field_2: 100,
      });

      const updateData: UpdateRowData = {
        field_1: 'Updated Value',
        field_2: 200,
      };

      const updatedRow = await dynamicTableRepository.updateRow(testTable.id, insertedRow.id, updateData);

      expect(updatedRow.id).toBe(insertedRow.id);
      expect(updatedRow.field_1).toBe('Updated Value');
      expect(updatedRow.field_2).toBe(200);
      expect(updatedRow.updated_at).toBeDefined();
    });

    it('should throw error when updating non-existent row', async () => {
      await expect(dynamicTableRepository.updateRow(testTable.id, '11111111-1111-1111-1111-111111111111', { field_1: 'Test' }))
        .rejects.toThrow('Row with id 11111111-1111-1111-1111-111111111111 not found');
    });

    it('should delete row', async () => {
      const insertedRow = await dynamicTableRepository.insertRow(testTable.id, {
        field_1: 'Delete Me',
      });

      await dynamicTableRepository.deleteRow(testTable.id, insertedRow.id);

      const foundRow = await dynamicTableRepository.findRowById(testTable.id, insertedRow.id);
      expect(foundRow).toBeNull();
    });
  });

  describe('Advanced Row Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
      testTable = await createTestTable('Advanced Row Test Table');
    });

    it('should bulk insert rows', async () => {
      const rowsData: CreateRowData[] = [
        { field_1: 'Bulk Row 1', field_2: 10 },
        { field_1: 'Bulk Row 2', field_2: 20 },
        { field_1: 'Bulk Row 3', field_2: 30 },
      ];

      const insertedRows = await dynamicTableRepository.bulkInsertRows(testTable.id, rowsData);

      expect(insertedRows).toHaveLength(3);
      expect(insertedRows[0].field_1).toBe('Bulk Row 1');
      expect(insertedRows[1].field_2).toBe(20);
      expect(insertedRows[2].field_1).toBe('Bulk Row 3');
    });

    it('should bulk update rows', async () => {
      // Insert test rows first
      const row1 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Update Me 1' });
      const row2 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Update Me 2' });

      const updates = [
        { id: row1.id, data: { field_1: 'Updated 1', field_2: 100 } },
        { id: row2.id, data: { field_1: 'Updated 2', field_2: 200 } },
      ];

      const updatedRows = await dynamicTableRepository.bulkUpdateRows(testTable.id, updates);

      expect(updatedRows).toHaveLength(2);
      expect(updatedRows[0].field_1).toBe('Updated 1');
      expect(updatedRows[1].field_2).toBe(200);
    });

    it('should bulk delete rows', async () => {
      // Insert test rows first
      const row1 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Delete Me 1' });
      const row2 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Delete Me 2' });
      const row3 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Keep Me' });

      await dynamicTableRepository.bulkDeleteRows(testTable.id, [row1.id, row2.id]);

      // Verify deleted rows are gone
      const foundRow1 = await dynamicTableRepository.findRowById(testTable.id, row1.id);
      const foundRow2 = await dynamicTableRepository.findRowById(testTable.id, row2.id);
      const foundRow3 = await dynamicTableRepository.findRowById(testTable.id, row3.id);

      expect(foundRow1).toBeNull();
      expect(foundRow2).toBeNull();
      expect(foundRow3).toBeDefined();
      expect(foundRow3!.field_1).toBe('Keep Me');
    });

    it('should execute bulk operation - INSERT', async () => {
      const bulkOp = {
        type: 'INSERT' as const,
        rows: [
          { data: { field_1: 'Bulk Insert 1' } },
          { data: { field_1: 'Bulk Insert 2' } },
        ],
      };

      const results = await dynamicTableRepository.bulkOperation(testTable.id, bulkOp);

      expect(results).toHaveLength(2);
      expect(results[0].field_1).toBe('Bulk Insert 1');
      expect(results[1].field_1).toBe('Bulk Insert 2');
    });

    it('should execute bulk operation - DELETE', async () => {
      const row1 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Delete Via Bulk 1' });
      const row2 = await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Delete Via Bulk 2' });

      const bulkOp = {
        type: 'DELETE' as const,
        rows: [
          { id: row1.id },
          { id: row2.id },
        ],
      };

      const results = await dynamicTableRepository.bulkOperation(testTable.id, bulkOp);

      expect(results).toHaveLength(0); // DELETE returns empty array
      
      // Verify rows are deleted
      const foundRow1 = await dynamicTableRepository.findRowById(testTable.id, row1.id);
      const foundRow2 = await dynamicTableRepository.findRowById(testTable.id, row2.id);
      expect(foundRow1).toBeNull();
      expect(foundRow2).toBeNull();
    });
  });

  describe('Row Queries and Filtering', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
      testTable = await createTestTable('Query Test Table');

      // Insert test data
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Apple', field_2: 10 });
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Banana', field_2: 20 });
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Cherry', field_2: 30 });
    });

    it('should count rows', async () => {
      const count = await dynamicTableRepository.countRows(testTable.id);

      expect(count).toBe(3);
    });

    it('should count rows with filters', async () => {
      const options = {
        filters: [
          { field: 'field_2', operator: 'gt' as const, value: 15 },
        ],
      };

      const count = await dynamicTableRepository.countRows(testTable.id, options);

      expect(count).toBe(2); // Banana and Cherry have field_2 > 15
    });

    it('should search rows', async () => {
      const searchResults = await dynamicTableRepository.searchRows(testTable.id, 'an');

      // Should find rows containing 'an' (Banana)
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].field_1).toBe('Banana');
    });

    it('should get distinct values', async () => {
      // Insert duplicate value
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Apple', field_2: 40 });

      const distinctValues = await dynamicTableRepository.getDistinctValues(testTable.id, 'field_1');

      expect(distinctValues).toHaveLength(3);
      expect(distinctValues).toContain('Apple');
      expect(distinctValues).toContain('Banana');
      expect(distinctValues).toContain('Cherry');
    });
  });

  describe('Table Management', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
      testTable = await createTestTable('Management Test Table');
    });

    it('should get table statistics', async () => {
      // Insert some test data
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Stats Row 1' });
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Stats Row 2' });

      const stats = await dynamicTableRepository.getTableStats(testTable.id);

      expect(stats.table.id).toBe(testTable.id);
      expect(stats.rowCount).toBe(2);
      expect(stats.fieldCount).toBeDefined();
      expect(stats.lastUpdated).toBeDefined();
    });

    it('should validate table operation - CREATE_TABLE', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: 'new_test_table',
        parameters: {},
      };

      const validation = await dynamicTableRepository.validateTableOperation(operation);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate table operation - invalid', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: '', // Missing table name
        parameters: {},
      };

      const validation = await dynamicTableRepository.validateTableOperation(operation);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Table name is required for CREATE_TABLE operation');
    });

    it('should execute table operation - CREATE_TABLE', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: 'operation_test_table',
        parameters: {},
      };

      await dynamicTableRepository.executeTableOperation(operation);

      // Verify table was created
      const result = await testDb.client`SELECT * FROM operation_test_table LIMIT 0`;
      expect(result).toEqual([]);
    });

    it('should determine if table can be deleted', async () => {
      // Empty table should be deletable
      const canDeleteEmpty = await dynamicTableRepository.canDeleteTable(testTable.id);
      expect(canDeleteEmpty).toBe(true);

      // Add data to make it non-deletable
      await dynamicTableRepository.insertRow(testTable.id, { field_1: 'Block deletion' });

      const canDeleteWithData = await dynamicTableRepository.canDeleteTable(testTable.id);
      expect(canDeleteWithData).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testDatabaseId = 1;
      testUserId = await createTestUser();
    });

    it('should handle table creation failure gracefully', async () => {
      const tableData: CreateDynamicTableData = {
        databaseId: testDatabaseId,
        organizationId: testOrganizationId,
        name: 'Invalid Table',
        dbName: 'invalid-table-name!@#', // Invalid PostgreSQL table name
        createdBy: testUserId,
      };

      await expect(dynamicTableRepository.create(tableData))
        .rejects.toThrow('Failed to create physical table');

      // Verify metadata wasn't left behind
      const foundTable = await dynamicTableRepository.findByDbName('invalid-table-name!@#');
      expect(foundTable).toBeNull();
    });

    it('should throw error for operations on non-existent table', async () => {
      await expect(dynamicTableRepository.insertRow(99999, { field_1: 'Test' }))
        .rejects.toThrow('Table with id 99999 not found');

      await expect(dynamicTableRepository.findRows(99999))
        .rejects.toThrow('Table with id 99999 not found');

      await expect(dynamicTableRepository.countRows(99999))
        .rejects.toThrow('Table with id 99999 not found');
    });

    it('should handle empty bulk operations', async () => {
      testTable = await createTestTable('Empty Bulk Test');

      const emptyInsert = await dynamicTableRepository.bulkInsertRows(testTable.id, []);
      expect(emptyInsert).toEqual([]);

      const emptyUpdate = await dynamicTableRepository.bulkUpdateRows(testTable.id, []);
      expect(emptyUpdate).toEqual([]);

      await expect(dynamicTableRepository.bulkDeleteRows(testTable.id, [])).resolves.toBeUndefined();
    });
  });
});