// AIDEV-NOTE: Unit tests for RagIndex domain entity
// Tests business rules and domain logic without infrastructure dependencies

import { describe, it, expect } from 'vitest';
import { RagIndex } from '@/lib/domain/rag/entities/rag-index';
import { OrganizationId } from '@/lib/domain/rag/value-objects/organization-id';

describe('RagIndex Domain Entity', () => {
  const validCreationParams = {
    name: 'Test Index',
    description: 'Test description',
    organizationId: OrganizationId.fromNumber(1),
    domainTypes: ['tables', 'files'] as const,
    createdBy: 'user-123'
  };

  describe('Creation', () => {
    it('should create a new RAG index with valid parameters', () => {
      const index = RagIndex.create(validCreationParams);

      expect(index.name).toBe('Test Index');
      expect(index.description).toBe('Test description');
      expect(index.organizationId.value).toBe(1);
      expect(index.domainTypes).toEqual(['tables', 'files']);
      expect(index.status).toBe('created');
      expect(index.documentCount).toBe(0);
      expect(index.createdBy).toBe('user-123');
      expect(index.embeddingModel).toBe('sentence-transformers/all-mpnet-base-v2');
      expect(index.embeddingDimensions).toBe(768);
    });

    it('should throw error for empty name', () => {
      expect(() => {
        RagIndex.create({
          ...validCreationParams,
          name: ''
        });
      }).toThrow('Index name cannot be empty');
    });

    it('should throw error for empty domain types', () => {
      expect(() => {
        RagIndex.create({
          ...validCreationParams,
          domainTypes: []
        });
      }).toThrow('At least one domain type must be specified');
    });

    it('should throw error for invalid domain type', () => {
      expect(() => {
        RagIndex.create({
          ...validCreationParams,
          domainTypes: ['invalid-type'] as any
        });
      }).toThrow('Invalid domain type: invalid-type');
    });
  });

  describe('Business Logic', () => {
    let index: RagIndex;

    beforeEach(() => {
      index = RagIndex.create(validCreationParams);
    });

    it('should start indexing when status is not building', () => {
      index.startIndexing();
      expect(index.status).toBe('building');
    });

    it('should throw error when starting indexing while already building', () => {
      index.startIndexing();
      expect(() => index.startIndexing()).toThrow('Index is already being built');
    });

    it('should complete indexing successfully', () => {
      index.startIndexing();
      index.completeIndexing(100);
      
      expect(index.status).toBe('active');
      expect(index.documentCount).toBe(100);
      expect(index.lastIndexedAt).toBeInstanceOf(Date);
    });

    it('should fail indexing when building', () => {
      index.startIndexing();
      index.failIndexing();
      
      expect(index.status).toBe('error');
    });

    it('should pause active index', () => {
      index.startIndexing();
      index.completeIndexing(50);
      index.pause();
      
      expect(index.status).toBe('paused');
    });

    it('should resume paused index', () => {
      index.startIndexing();
      index.completeIndexing(50);
      index.pause();
      index.resume();
      
      expect(index.status).toBe('active');
    });

    it('should check domain type inclusion', () => {
      expect(index.includesDomainType('tables')).toBe(true);
      expect(index.includesDomainType('files')).toBe(true);
      expect(index.includesDomainType('agents')).toBe(false);
    });

    it('should check ownership', () => {
      const ownerId = OrganizationId.fromNumber(1);
      const otherId = OrganizationId.fromNumber(2);
      
      expect(index.isOwnedBy(ownerId)).toBe(true);
      expect(index.isOwnedBy(otherId)).toBe(false);
    });

    it('should allow deletion when not building', () => {
      expect(index.canBeDeleted()).toBe(true);
      
      index.startIndexing();
      expect(index.canBeDeleted()).toBe(false);
      
      index.completeIndexing(10);
      expect(index.canBeDeleted()).toBe(true);
    });
  });

  describe('Updates', () => {
    let index: RagIndex;

    beforeEach(() => {
      index = RagIndex.create(validCreationParams);
    });

    it('should update name and description', () => {
      index.updateDetails({
        name: 'Updated Name',
        description: 'Updated description'
      });

      expect(index.name).toBe('Updated Name');
      expect(index.description).toBe('Updated description');
    });

    it('should update domain types', () => {
      index.updateDetails({
        domainTypes: ['agents', 'teams']
      });

      expect(index.domainTypes).toEqual(['agents', 'teams']);
    });

    it('should validate name during update', () => {
      expect(() => {
        index.updateDetails({ name: '' });
      }).toThrow('Index name cannot be empty');
    });
  });

  describe('Persistence', () => {
    it('should convert to persistence format', () => {
      const index = RagIndex.create(validCreationParams);
      const persistence = index.toPersistence();

      expect(persistence.id).toBeDefined();
      expect(persistence.organizationId).toBe(1);
      expect(persistence.name).toBe('Test Index');
      expect(persistence.domainTypes).toEqual(['tables', 'files']);
      expect(persistence.status).toBe('created');
    });

    it('should recreate from persistence', () => {
      const originalIndex = RagIndex.create(validCreationParams);
      const persistence = originalIndex.toPersistence();
      
      const recreatedIndex = RagIndex.fromPersistence(persistence);

      expect(recreatedIndex.id.value).toBe(originalIndex.id.value);
      expect(recreatedIndex.name).toBe(originalIndex.name);
      expect(recreatedIndex.organizationId.value).toBe(originalIndex.organizationId.value);
      expect(recreatedIndex.domainTypes).toEqual(originalIndex.domainTypes);
    });
  });
});