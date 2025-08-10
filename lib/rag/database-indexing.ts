// AIDEV-NOTE: RAG indexing service for database and table metadata descriptions
// Automatically indexes descriptions when databases/tables are created/updated

import { db } from "@/lib/db/client"
import { databases, tables, ragDocuments, ragIndexes } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import OpenAI from 'openai'
import crypto from 'crypto'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface DatabaseMetadata {
  id: number
  name: string
  slug: string
  metadata?: { description?: string; [key: string]: any } | null
  organizationId: number
  updatedAt: Date | null
}

interface TableMetadata {
  id: number
  name: string
  databaseId: number
  metadata?: { description?: string; [key: string]: any } | null
  organizationId: number
  updatedAt: Date | null
  database?: {
    name: string
    slug: string
  }
}

export class DatabaseIndexingService {
  private static instance: DatabaseIndexingService
  
  static getInstance(): DatabaseIndexingService {
    if (!DatabaseIndexingService.instance) {
      DatabaseIndexingService.instance = new DatabaseIndexingService()
    }
    return DatabaseIndexingService.instance
  }

  /**
   * Get or create a RAG index for database metadata in an organization
   */
  private async getOrCreateDatabaseIndex(organizationId: number) {
    // Check if index exists
    const existingIndex = await db
      .select()
      .from(ragIndexes)
      .where(and(
        eq(ragIndexes.organizationId, organizationId),
        eq(ragIndexes.name, 'Database Metadata')
      ))
      .limit(1)

    if (existingIndex.length > 0) {
      return existingIndex[0]
    }

    // Create new index
    const [newIndex] = await db
      .insert(ragIndexes)
      .values({
        name: 'Database Metadata',
        description: 'Searchable index of database and table descriptions',
        organizationId,
        domainTypes: ['tables', 'databases'],
        domainFilters: { organizationId },
        embeddingModel: 'text-embedding-ada-002',
        embeddingDimensions: 1536,
        status: 'active'
      })
      .returning()

    return newIndex
  }

  /**
   * Generate embedding for content
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: content,
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw error
    }
  }

  /**
   * Create content hash for change detection
   */
  private createContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Index a database's metadata
   */
  async indexDatabase(database: DatabaseMetadata) {
    if (!database.metadata?.description) {
      // No description to index
      return
    }

    try {
      const ragIndex = await this.getOrCreateDatabaseIndex(database.organizationId)
      
      const title = `Database: ${database.name}`
      const content = `Database: ${database.name}
Slug: ${database.slug}
Description: ${database.metadata.description}

This is a database that contains tables and data for the organization.`

      const contentHash = this.createContentHash(content)
      const embedding = await this.generateEmbedding(content)

      // Check if document already exists
      const existingDoc = await db
        .select()
        .from(ragDocuments)
        .where(and(
          eq(ragDocuments.ragIndexId, ragIndex.id),
          eq(ragDocuments.sourceType, 'database'),
          eq(ragDocuments.sourceId, database.id.toString())
        ))
        .limit(1)

      if (existingDoc.length > 0) {
        // Update existing document if content changed
        if (existingDoc[0].contentHash !== contentHash) {
          await db
            .update(ragDocuments)
            .set({
              title,
              content,
              contentHash,
              embedding,
              metadata: { database },
              indexedAt: new Date(),
              sourceUpdatedAt: database.updatedAt
            })
            .where(eq(ragDocuments.id, existingDoc[0].id))
        }
      } else {
        // Create new document
        await db
          .insert(ragDocuments)
          .values({
            ragIndexId: ragIndex.id,
            sourceType: 'database',
            sourceId: database.id.toString(),
            sourceName: database.name,
            title,
            content,
            contentHash,
            embedding,
            metadata: { database },
            sourceUpdatedAt: database.updatedAt
          })
      }

      // Update document count on index
      const docCount = await db
        .select({ count: ragDocuments.id })
        .from(ragDocuments)
        .where(eq(ragDocuments.ragIndexId, ragIndex.id))
      
      await db
        .update(ragIndexes)
        .set({ 
          documentCount: docCount.length,
          lastIndexedAt: new Date()
        })
        .where(eq(ragIndexes.id, ragIndex.id))

    } catch (error) {
      console.error('Failed to index database:', error)
      throw error
    }
  }

  /**
   * Index a table's metadata
   */
  async indexTable(table: TableMetadata) {
    if (!table.metadata?.description) {
      // No description to index
      return
    }

    try {
      const ragIndex = await this.getOrCreateDatabaseIndex(table.organizationId)
      
      const title = `Table: ${table.name}`
      const content = `Table: ${table.name}
Database: ${table.database?.name || 'Unknown Database'}
Description: ${table.metadata.description}

This is a table that stores structured data with fields and rows.`

      const contentHash = this.createContentHash(content)
      const embedding = await this.generateEmbedding(content)

      // Check if document already exists
      const existingDoc = await db
        .select()
        .from(ragDocuments)
        .where(and(
          eq(ragDocuments.ragIndexId, ragIndex.id),
          eq(ragDocuments.sourceType, 'table'),
          eq(ragDocuments.sourceId, table.id.toString())
        ))
        .limit(1)

      if (existingDoc.length > 0) {
        // Update existing document if content changed
        if (existingDoc[0].contentHash !== contentHash) {
          await db
            .update(ragDocuments)
            .set({
              title,
              content,
              contentHash,
              embedding,
              metadata: { table },
              indexedAt: new Date(),
              sourceUpdatedAt: table.updatedAt
            })
            .where(eq(ragDocuments.id, existingDoc[0].id))
        }
      } else {
        // Create new document
        await db
          .insert(ragDocuments)
          .values({
            ragIndexId: ragIndex.id,
            sourceType: 'table',
            sourceId: table.id.toString(),
            sourceName: table.name,
            title,
            content,
            contentHash,
            embedding,
            metadata: { table },
            sourceUpdatedAt: table.updatedAt
          })
      }

      // Update document count on index
      const docCount = await db
        .select({ count: ragDocuments.id })
        .from(ragDocuments)
        .where(eq(ragDocuments.ragIndexId, ragIndex.id))
      
      await db
        .update(ragIndexes)
        .set({ 
          documentCount: docCount.length,
          lastIndexedAt: new Date()
        })
        .where(eq(ragIndexes.id, ragIndex.id))

    } catch (error) {
      console.error('Failed to index table:', error)
      throw error
    }
  }

  /**
   * Remove a database or table from the index when deleted
   */
  async removeFromIndex(sourceType: 'database' | 'table', sourceId: string, organizationId: number) {
    try {
      const ragIndex = await this.getOrCreateDatabaseIndex(organizationId)
      
      await db
        .delete(ragDocuments)
        .where(and(
          eq(ragDocuments.ragIndexId, ragIndex.id),
          eq(ragDocuments.sourceType, sourceType),
          eq(ragDocuments.sourceId, sourceId)
        ))

      // Update document count on index
      const docCount = await db
        .select({ count: ragDocuments.id })
        .from(ragDocuments)
        .where(eq(ragDocuments.ragIndexId, ragIndex.id))
      
      await db
        .update(ragIndexes)
        .set({ 
          documentCount: docCount.length,
          lastIndexedAt: new Date()
        })
        .where(eq(ragIndexes.id, ragIndex.id))

    } catch (error) {
      console.error('Failed to remove from index:', error)
      throw error
    }
  }

  /**
   * Reindex all databases and tables for an organization
   */
  async reindexOrganization(organizationId: number) {
    try {
      console.log(`Starting reindex for organization ${organizationId}`)

      // Get all databases and tables for the organization
      const [databaseList, tableList] = await Promise.all([
        db.select().from(databases).where(eq(databases.organizationId, organizationId)),
        db.select({
          id: tables.id,
          name: tables.name,
          databaseId: tables.databaseId,
          metadata: tables.metadata,
          organizationId: tables.organizationId,
          updatedAt: tables.updatedAt,
          database: {
            name: databases.name,
            slug: databases.slug
          }
        })
        .from(tables)
        .leftJoin(databases, eq(tables.databaseId, databases.id))
        .where(eq(tables.organizationId, organizationId))
      ])

      // Index databases
      for (const database of databaseList) {
        if (database.metadata?.description) {
          await this.indexDatabase(database as DatabaseMetadata)
        }
      }

      // Index tables
      for (const table of tableList) {
        if (table.metadata?.description) {
          await this.indexTable(table as TableMetadata)
        }
      }

      console.log(`Reindex completed for organization ${organizationId}: ${databaseList.length} databases, ${tableList.length} tables`)
    } catch (error) {
      console.error('Failed to reindex organization:', error)
      throw error
    }
  }
}

// Export singleton instance
export const databaseIndexingService = DatabaseIndexingService.getInstance()