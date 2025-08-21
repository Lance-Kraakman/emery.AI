// AIDEV-NOTE: Example showing how to use repository test utilities
// Demonstrates clean, reusable patterns for repository testing

import { describe, it, expect, beforeEach } from 'vitest';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';
import { 
  setupRepositoryMocks, 
  testDataFactories, 
  testScenarios,
  assertions 
} from './test-utils';

describe('DrizzleDynamicTableRepository (using test utilities)', () => {
  let repository: DrizzleDynamicTableRepository;
  let mocks: ReturnType<typeof setupRepositoryMocks>;

  beforeEach(() => {
    const mockTable = testDataFactories.dynamicTable();
    mocks = setupRepositoryMocks([mockTable]);
    repository = new DrizzleDynamicTableRepository(mocks.mockDb, mocks.mockRawClient);
  });

  describe('findById', () => {
    it('should return table when found', async () => {
      const result = await repository.findById(1);
      
      expect(result).toEqual(testDataFactories.dynamicTable());
      expect(mocks.mockDb.select).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      testScenarios.simulateEmptyResult(mocks.mockDb);
      
      const result = await repository.findById(999);
      
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      testScenarios.simulateDatabaseError(mocks.mockDb, 'select');
      
      await expect(repository.findById(1)).rejects.toThrow('Database connection failed');
    });
  });

  describe('create', () => {
    it('should create table successfully', async () => {
      const createData = testDataFactories.createTableData();
      
      const result = await repository.create(createData);
      
      expect(result).toEqual(testDataFactories.dynamicTable());
      assertions.expectDrizzleInsert(mocks.mockDb, createData);
      assertions.expectRawSql(mocks.mockRawClient, ['CREATE TABLE', 'test_table_123']);
    });

    it('should rollback on physical table creation failure', async () => {
      testScenarios.simulateSqlError(mocks.mockRawClient, 'Table creation failed');
      
      await expect(repository.create(testDataFactories.createTableData()))
        .rejects.toThrow('Failed to create physical table');
      
      expect(mocks.mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('insertRow', () => {
    beforeEach(() => {
      // Mock table lookup for row operations
      mocks.chains.select.limit.mockResolvedValue([testDataFactories.dynamicTable()]);
    });

    it('should insert row with data', async () => {
      const rowData = { field_1: 'Test', field_2: 42 };
      const expectedRow = testDataFactories.dynamicTableRow(rowData);
      
      mocks.mockRawClient.unsafe.mockResolvedValue([expectedRow]);
      
      const result = await repository.insertRow(1, rowData);
      
      expect(result).toEqual(expectedRow);
      assertions.expectRawSqlUnsafe(
        mocks.mockRawClient, 
        'INSERT INTO "test_table_123"',
        ['Test', 42]
      );
    });

    it('should insert with default values when no data', async () => {
      const expectedRow = testDataFactories.dynamicTableRow();
      mocks.mockRawClient.mockResolvedValue([expectedRow]);
      
      const result = await repository.insertRow(1, {});
      
      expect(result).toEqual(expectedRow);
      assertions.expectRawSql(mocks.mockRawClient, ['DEFAULT VALUES']);
    });
  });
});