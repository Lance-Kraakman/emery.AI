import { embed, embedMany } from 'ai'
import { getEmbeddingModel } from '@/lib/ai/models'
import { db } from '@/lib/db/client'
import { ragIndexes, ragDocuments, ragQueryLogs, tables, fields, organizations, agents, databases } from '@/lib/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import crypto from 'crypto'
// Note: Using raw SQL for pgvector operations since drizzle-specific helpers aren't available

export interface RagIndex {
  id: string
  name: string
  description?: string
  organizationId?: number
  agentId?: number
  roleId?: number
  domainTypes: string[]
  domainFilters?: any
  embeddingModel: string
  embeddingDimensions: number
  status: string
  documentCount: number
}

export interface RagDocument {
  id: string
  sourceType: string
  sourceId: string
  sourceName: string
  title: string
  content: string
  metadata?: any
  similarity?: number
}

export interface RagQueryResult {
  documents: RagDocument[]
  totalCount: number
  query: string
}

// AIDEV-NOTE: Best practices RAG service using pgvector for optimal vector similarity search
export class RagService {
  private embeddingModel = getEmbeddingModel()

  // Initialize pgvector extension and create indexes
  async initializeVectorExtension(): Promise<void> {
    try {
      // Enable pgvector extension
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
      
      // Create vector indexes for fast similarity search
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS rag_documents_embedding_cosine_idx 
        ON rag_documents USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100)
      `)
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS rag_documents_embedding_l2_idx 
        ON rag_documents USING ivfflat (embedding vector_l2_ops) 
        WITH (lists = 100)
      `)

      console.log('pgvector extension and indexes initialized')
    } catch (error) {
      console.error('Failed to initialize pgvector:', error)
    }
  }

  // Create a new RAG index with configurable domain filtering
  async createIndex(params: {
    name: string
    description?: string
    organizationId?: number
    agentId?: number
    roleId?: number
    domainTypes: string[] // ["tables", "files", "agents", "workflows"]
    domainFilters?: any
    createdBy: string
  }): Promise<string> {
    const [index] = await db.insert(ragIndexes).values({
      name: params.name,
      description: params.description,
      organizationId: params.organizationId,
      agentId: params.agentId,
      roleId: params.roleId,
      domainTypes: params.domainTypes,
      domainFilters: params.domainFilters,
      createdBy: params.createdBy,
    }).returning({ id: ragIndexes.id })

    // Initialize vector extension if not already done
    await this.initializeVectorExtension()

    // Start indexing in background
    this.reindexData(index.id).catch(console.error)

    return index.id
  }

  // Get RAG index by ID
  async getIndex(indexId: string): Promise<RagIndex | null> {
    const [index] = await db.select().from(ragIndexes).where(eq(ragIndexes.id, indexId))
    if (!index) return null

    return {
      id: index.id,
      name: index.name,
      description: index.description,
      organizationId: index.organizationId,
      agentId: index.agentId,
      roleId: index.roleId,
      domainTypes: index.domainTypes as string[],
      domainFilters: index.domainFilters,
      embeddingModel: index.embeddingModel,
      embeddingDimensions: index.embeddingDimensions,
      status: index.status,
      documentCount: index.documentCount,
    }
  }

  // List indexes for organization/agent/role with proper scoping
  async listIndexes(params: {
    organizationId?: number
    agentId?: number
    roleId?: number
  }): Promise<RagIndex[]> {
    const conditions = []
    if (params.organizationId) conditions.push(eq(ragIndexes.organizationId, params.organizationId))
    if (params.agentId) conditions.push(eq(ragIndexes.agentId, params.agentId))
    if (params.roleId) conditions.push(eq(ragIndexes.roleId, params.roleId))

    const indexes = await db.select().from(ragIndexes).where(and(...conditions))
    
    return indexes.map(index => ({
      id: index.id,
      name: index.name,
      description: index.description,
      organizationId: index.organizationId,
      agentId: index.agentId,
      roleId: index.roleId,
      domainTypes: index.domainTypes as string[],
      domainFilters: index.domainFilters,
      embeddingModel: index.embeddingModel,
      embeddingDimensions: index.embeddingDimensions,
      status: index.status,
      documentCount: index.documentCount,
    }))
  }

  // Reindex data with efficient batch processing
  async reindexData(indexId: string): Promise<void> {
    const index = await this.getIndex(indexId)
    if (!index) throw new Error('RAG index not found')

    // Update status to building
    await db.update(ragIndexes)
      .set({ status: 'building' })
      .where(eq(ragIndexes.id, indexId))

    try {
      // Clear existing documents for this index
      await db.delete(ragDocuments).where(eq(ragDocuments.ragIndexId, indexId))

      let totalDocuments = 0

      // Index organization data if included
      if (index.domainTypes.includes('organizations')) {
        totalDocuments += await this.indexOrganizations(indexId, index)
      }

      // Index databases if included in domain types
      if (index.domainTypes.includes('databases')) {
        totalDocuments += await this.indexDatabases(indexId, index)
      }

      // Index tables if included in domain types
      if (index.domainTypes.includes('tables')) {
        totalDocuments += await this.indexTables(indexId, index)
      }

      // Index agents if included
      if (index.domainTypes.includes('agents')) {
        totalDocuments += await this.indexAgents(indexId, index)
      }

      // Index files if included in domain types
      if (index.domainTypes.includes('files')) {
        totalDocuments += await this.indexFiles(indexId, index)
      }

      // AIDEV-TODO: Add workflow indexing
      
      // Update index status and document count
      await db.update(ragIndexes)
        .set({ 
          status: 'active',
          lastIndexedAt: new Date(),
          documentCount: totalDocuments
        })
        .where(eq(ragIndexes.id, indexId))

    } catch (error) {
      await db.update(ragIndexes)
        .set({ status: 'error' })
        .where(eq(ragIndexes.id, indexId))
      throw error
    }
  }

  // Index organization tables with batch processing
  private async indexTables(indexId: string, ragIndex: RagIndex): Promise<number> {
    const conditions = []
    if (ragIndex.organizationId) {
      conditions.push(eq(tables.organizationId, ragIndex.organizationId))
    }

    const tablesToIndex = await db.select({
      id: tables.id,
      name: tables.name,
      dbName: tables.dbName,
      databaseId: tables.databaseId,
      metadata: tables.metadata,
      organizationId: tables.organizationId,
      databaseName: databases.name,
      databaseSlug: databases.slug,
    }).from(tables)
      .leftJoin(databases, eq(tables.databaseId, databases.id))
      .where(and(...conditions))

    // Process tables in batches for better performance
    const batchSize = 10
    const batches = []
    for (let i = 0; i < tablesToIndex.length; i += batchSize) {
      batches.push(tablesToIndex.slice(i, i + batchSize))
    }

    let documentCount = 0
    for (const batch of batches) {
      const documentsToInsert = await Promise.all(
        batch.map(async (table) => {
          const tableFields = await db.select().from(fields).where(eq(fields.tableId, table.id))
          const schemaContent = this.generateTableSchemaContent(table, tableFields)
          
          // Generate embedding for the content
          const { embedding } = await embed({
            model: this.embeddingModel,
            value: schemaContent,
          })
          
          return {
            ragIndexId: indexId,
            sourceType: 'table',
            sourceId: table.id.toString(),
            sourceName: table.name,
            title: `Table: ${table.name} (Database: ${table.databaseName || 'Unknown'})`,
            content: schemaContent,
            metadata: {
              tableId: table.id,
              tableName: table.name,
              databaseId: table.databaseId,
              databaseName: table.databaseName,
              databaseSlug: table.databaseSlug,
              tableMetadata: table.metadata,
              organizationId: table.organizationId,
              fieldCount: tableFields.length,
            },
            embedding,
            contentHash: crypto.createHash('md5').update(schemaContent).digest('hex'),
          }
        })
      )

      // Batch insert for better performance
      await db.insert(ragDocuments).values(documentsToInsert)
      documentCount += documentsToInsert.length
    }

    return documentCount
  }

  // Index databases with metadata
  private async indexDatabases(indexId: string, ragIndex: RagIndex): Promise<number> {
    const conditions = []
    if (ragIndex.organizationId) {
      conditions.push(eq(databases.organizationId, ragIndex.organizationId))
    }

    const databasesToIndex = await db.select({
      id: databases.id,
      name: databases.name,
      slug: databases.slug,
      metadata: databases.metadata,
      organizationId: databases.organizationId,
    }).from(databases).where(and(...conditions))

    // Process databases in batches
    const batchSize = 10
    const batches = []
    for (let i = 0; i < databasesToIndex.length; i += batchSize) {
      batches.push(databasesToIndex.slice(i, i + batchSize))
    }

    let documentCount = 0
    for (const batch of batches) {
      const documentsToInsert = await Promise.all(
        batch.map(async (database) => {
          const databaseContent = this.generateDatabaseContent(database)
          
          // Generate embedding for the content
          const { embedding } = await embed({
            model: this.embeddingModel,
            value: databaseContent,
          })
          
          return {
            ragIndexId: indexId,
            sourceType: 'database',
            sourceId: database.id.toString(),
            sourceName: database.name,
            title: `Database: ${database.name}`,
            content: databaseContent,
            metadata: {
              databaseId: database.id,
              slug: database.slug,
              databaseMetadata: database.metadata,
              organizationId: database.organizationId,
            },
            embedding,
            contentHash: crypto.createHash('md5').update(databaseContent).digest('hex'),
          }
        })
      )

      // Batch insert for better performance
      await db.insert(ragDocuments).values(documentsToInsert)
      documentCount += documentsToInsert.length
    }

    return documentCount
  }

  // Index agents for workflow context
  private async indexOrganizations(indexId: string, ragIndex: RagIndex): Promise<number> {
    if (!ragIndex.organizationId) {
      return 0
    }

    // Get organization data
    const [organization] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        mission: organizations.mission,
        sharedTools: organizations.sharedTools,
        sharedServers: organizations.sharedServers,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(eq(organizations.id, ragIndex.organizationId))

    if (!organization) {
      return 0
    }

    // Generate organization content for indexing
    const organizationContent = this.generateOrganizationContent(organization)
    
    // Generate embedding for the content
    const { embedding } = await embed({
      model: this.embeddingModel,
      value: organizationContent,
    })
    
    // Insert organization document
    await db.insert(ragDocuments).values({
      ragIndexId: indexId,
      sourceType: 'organization',
      sourceId: organization.id.toString(),
      sourceName: organization.name,
      title: `Organization: ${organization.name}`,
      content: organizationContent,
      metadata: {
        organizationId: organization.id,
        sharedToolsCount: organization.sharedTools?.length || 0,
        sharedServersCount: organization.sharedServers?.length || 0,
        createdAt: organization.createdAt,
      },
      embedding,
      contentHash: crypto.createHash('md5').update(organizationContent).digest('hex'),
    })

    return 1
  }

  private async indexAgents(indexId: string, ragIndex: RagIndex): Promise<number> {
    if (!ragIndex.organizationId) {
      return 0
    }

    // Get agents for this organization
    const organizationAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        role: agents.role,
        description: agents.description,
        persona: agents.persona,
        tools: agents.tools,
        servers: agents.servers,
        capabilities: agents.capabilities,
        status: agents.status,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(eq(agents.organizationId, ragIndex.organizationId))

    if (organizationAgents.length === 0) {
      return 0
    }

    // Process agents in batches for better performance
    const batchSize = 10
    const batches = []
    for (let i = 0; i < organizationAgents.length; i += batchSize) {
      batches.push(organizationAgents.slice(i, i + batchSize))
    }

    let documentCount = 0
    for (const batch of batches) {
      const documentsToInsert = await Promise.all(
        batch.map(async (agent) => {
          const agentContent = this.generateAgentContent(agent)
          
          // Generate embedding for the content
          const { embedding } = await embed({
            model: this.embeddingModel,
            value: agentContent,
          })
          
          return {
            ragIndexId: indexId,
            sourceType: 'agent',
            sourceId: agent.id.toString(),
            sourceName: agent.name,
            title: `Agent: ${agent.name}`,
            content: agentContent,
            metadata: {
              agentId: agent.id,
              role: agent.role,
              status: agent.status,
              organizationId: ragIndex.organizationId,
              toolCount: Array.isArray(agent.tools) ? agent.tools.length : 0,
              serverCount: Array.isArray(agent.servers) ? agent.servers.length : 0,
              capabilityCount: Array.isArray(agent.capabilities) ? agent.capabilities.length : 0,
            },
            embedding,
            contentHash: crypto.createHash('md5').update(agentContent).digest('hex'),
          }
        })
      )

      // Batch insert for better performance
      if (documentsToInsert.length > 0) {
        await db.insert(ragDocuments).values(documentsToInsert)
        documentCount += documentsToInsert.length
      }
    }

    return documentCount
  }

  // Generate comprehensive table schema content with enhanced relationship context
  private generateTableSchemaContent(
    table: { id: number; name: string; dbName: string; metadata?: any; databaseName?: string | null; databaseSlug?: string | null },
    fields: any[]
  ): string {
    const fieldsDescription = fields.map(field => {
      let desc = `- ${field.name} (${field.type})`
      if (field.required) desc += ' *required*'
      if (field.relatedTableId) {
        desc += ` → relates to table ID ${field.relatedTableId} (relationship field for cross-table data connections)`
      }
      if (field.type === 'file') {
        desc += ' → stores uploaded files (documents, spreadsheets, images, etc.)'
      }
      return desc
    }).join('\n')

    // Count different field types for better context
    const fieldTypes = fields.reduce((acc, field) => {
      acc[field.type] = (acc[field.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const fieldTypeSummary = Object.entries(fieldTypes)
      .map(([type, count]) => `${count} ${type} field${count > 1 ? 's' : ''}`)
      .join(', ')

    const description = table.metadata?.description 
      ? `\nDescription: ${table.metadata.description}` 
      : ''

    const databaseName = table.databaseName || 'Unknown Database'

    const relationshipFields = fields.filter(f => f.relatedTableId)
    const fileFields = fields.filter(f => f.type === 'file')

    let relationshipContext = ''
    if (relationshipFields.length > 0) {
      relationshipContext = `\nRelationships: This table connects to other tables through ${relationshipFields.length} relationship field${relationshipFields.length > 1 ? 's' : ''}: ${relationshipFields.map(f => f.name).join(', ')}`
    }

    let fileContext = ''
    if (fileFields.length > 0) {
      fileContext = `\nFile Storage: This table can store files in ${fileFields.length} field${fileFields.length > 1 ? 's' : ''}: ${fileFields.map(f => f.name).join(', ')}. These files are uploaded documents, spreadsheets, images, or other data that belong to records in this table.`
    }

    return `Table: ${table.name}
Database: ${databaseName}
Purpose: Structured data storage and workflow operations${description}

Schema Overview: ${fieldTypeSummary} (${fields.length} total fields)
${fieldsDescription}${relationshipContext}${fileContext}

Data Context: This table is part of the "${databaseName}" database and contains structured data for the organization. Records in this table may have relationships to other tables and can include uploaded files that contain additional data or documentation.

Usage: This table supports data analysis, reporting, workflow automation, and integration with other Emery systems. The dynamic schema allows for flexible data operations while maintaining type safety and relationships.`
  }

  // Generate comprehensive database content for indexing
  private generateDatabaseContent(database: {
    id: number;
    name: string;
    slug: string;
    metadata?: any;
    organizationId: number;
  }): string {
    const description = database.metadata?.description
      ? `\nDescription: ${database.metadata.description}`
      : ''

    return `Database: ${database.name}
Slug: ${database.slug}
Organization: ${database.organizationId}${description}

Purpose: This database organizes related tables and data for the organization. It provides logical grouping of tables that share common purposes or domains within the Emery platform.

Capabilities: The database supports dynamic table creation, field management, data operations, and integration with workflow automation. Tables within this database can be used for data analysis, reporting, and agent-powered workflows.

Context: This is a database within the Emery platform, which provides dynamic database management, workflow automation, and team collaboration capabilities.`
  }

  // Generate comprehensive organization content for indexing
  private generateOrganizationContent(organization: {
    id: number
    name: string
    mission?: string | null
    sharedTools?: string[] | null
    sharedServers?: string[] | null
    createdAt?: Date | null
  }): string {
    const toolsList = organization.sharedTools && organization.sharedTools.length > 0
      ? `\nShared Tools:\n${organization.sharedTools.map(tool => `- ${tool}`).join('\n')}`
      : '\nShared Tools: None configured'

    const serversList = organization.sharedServers && organization.sharedServers.length > 0
      ? `\nShared Servers:\n${organization.sharedServers.map(server => `- ${server}`).join('\n')}`
      : '\nShared Servers: None configured'

    const createdDate = organization.createdAt 
      ? `\nEstablished: ${organization.createdAt.toLocaleDateString()}`
      : ''

    return `Organization: ${organization.name}
${organization.mission ? `Mission: ${organization.mission}` : 'Mission: Not specified'}${createdDate}${toolsList}${serversList}

About: ${organization.name} is an active organization on the Emery platform, which provides dynamic database management, workflow automation, and team collaboration capabilities. This organization can create tables, manage data, build workflows with agents, and coordinate team activities using shared resources and tools.

Capabilities: The organization has access to Emery's full feature set including dynamic table creation, field management, data operations, agent-powered workflows, team collaboration, role-based access control, and integration with external services through shared tools and servers.`
  }

  // Generate comprehensive agent content for indexing
  private generateAgentContent(agent: {
    id: number
    name: string
    role?: string | null
    description?: string | null
    persona?: string | null
    tools?: any
    servers?: any
    capabilities?: any
    status?: string | null
    createdAt?: Date | null
  }): string {
    const toolsList = agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0
      ? `\nTools: ${agent.tools.map((tool: any) => typeof tool === 'string' ? tool : tool.name || 'Unknown').join(', ')}`
      : '\nTools: None configured'

    const serversList = agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0
      ? `\nServers: ${agent.servers.map((server: any) => typeof server === 'string' ? server : server.name || 'Unknown').join(', ')}`
      : '\nServers: None configured'

    const capabilitiesDesc = agent.capabilities && Array.isArray(agent.capabilities) && agent.capabilities.length > 0
      ? `\nCapabilities: ${agent.capabilities.length} configured capabilities including ${agent.capabilities.map((cap: any) => cap.name || 'unnamed capability').join(', ')}`
      : '\nCapabilities: None configured'

    const createdDate = agent.createdAt 
      ? `\nCreated: ${agent.createdAt.toLocaleDateString()}`
      : ''

    return `Agent: ${agent.name}
${agent.role ? `Role: ${agent.role}` : 'Role: Not specified'}
${agent.description ? `Description: ${agent.description}` : 'Description: Not provided'}
${agent.persona ? `Persona: ${agent.persona}` : 'Persona: Default assistant'}
Status: ${agent.status || 'active'}${createdDate}${toolsList}${serversList}${capabilitiesDesc}

About: ${agent.name} is an AI agent configured within the Emery platform for workflow automation and task execution. This agent can process requests, execute workflows, and integrate with various tools and services to accomplish organizational objectives.

Functionality: The agent operates within the Emery ecosystem to handle automated workflows, data processing, integration tasks, and other organizational processes as configured through its capabilities and available tools.`
  }

  // LlamaIndex-powered file processing with HuggingFace embeddings
  private async processFileWithLlamaIndex(s3Key: string, mimeType: string, fileName: string): Promise<Array<{content: string, metadata: any}> | null> {
    try {
      console.log(`[LLAMAINDEX] Processing ${fileName} with LlamaIndex`)
      
      // Download file from S3 to temporary location
      const { s3Client, BUCKET_NAME } = await import('@/lib/s3/client')
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const fs = await import('fs/promises')
      const path = await import('path')
      const os = await import('os')
      
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }))

      if (!response.Body) {
        console.log(`[LLAMAINDEX] No body found for ${fileName}`)
        return null
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const reader = response.Body.transformToWebStream().getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      
      const buffer = Buffer.concat(chunks)
      
      // Create temporary file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'emery-rag-'))
      const tempFilePath = path.join(tempDir, fileName)
      await fs.writeFile(tempFilePath, buffer)

      try {
        // Use LlamaIndex to process the document
        const { SimpleDirectoryReader } = await import('llamaindex')
        const { SentenceSplitter } = await import('llamaindex')
        const { QuestionsAnsweredExtractor } = await import('llamaindex')

        // Initialize LlamaIndex components
        const reader = new SimpleDirectoryReader()
        const splitter = new SentenceSplitter({
          chunkSize: 1024,
          chunkOverlap: 50
        })
        
        // Load and process document
        const documents = await reader.loadData({ directoryPath: tempDir })
        console.log(`[LLAMAINDEX] Loaded ${documents.length} documents from ${fileName}`)
        
        if (documents.length === 0) {
          return null
        }

        // Process each document
        const processedChunks: Array<{content: string, metadata: any}> = []
        
        for (const doc of documents) {
          // Split into chunks
          const textChunks = await splitter.splitText(doc.text)
          console.log(`[LLAMAINDEX] Split ${fileName} into ${textChunks.length} chunks`)
          
          // Create processed chunks with metadata
          textChunks.forEach((chunkText, index) => {
            processedChunks.push({
              content: chunkText,
              metadata: {
                ...doc.metadata,
                chunkIndex: index,
                totalChunks: textChunks.length,
                chunkSize: chunkText.length,
                fileName: fileName,
                mimeType: mimeType
              }
            })
          })
        }

        return processedChunks

      } finally {
        // Clean up temporary file
        await fs.rm(tempDir, { recursive: true })
      }

    } catch (error) {
      console.error(`[LLAMAINDEX] Error processing ${fileName}:`, error)
      return null
    }
  }

  // Index files with content extraction
  private async indexFiles(indexId: string, ragIndex: RagIndex): Promise<number> {
    if (!ragIndex.organizationId) {
      return 0
    }

    console.log('[FILE-INDEX] Starting file indexing for organization', ragIndex.organizationId)

    // Get all file fields from tables in this organization
    const fileFields = await db.execute(sql`
      SELECT DISTINCT 
        f.id as field_id,
        f.name as field_name, 
        f.slug as field_slug,
        t.id as table_id,
        t.name as table_name,
        t.db_name as table_db_name,
        d.name as database_name
      FROM fields f
      JOIN tables t ON f.table_id = t.id  
      JOIN databases d ON t.database_id = d.id
      WHERE f.type = 'file' 
      AND t.organization_id = ${ragIndex.organizationId}
    `)

    if (fileFields.length === 0) {
      console.log('[FILE-INDEX] No file fields found')
      return 0
    }

    console.log(`[FILE-INDEX] Found ${fileFields.length} file fields`)

    let documentCount = 0

    for (const field of fileFields) {
      try {
        // Get all rows with files in this field
        const rows = await db.execute(sql`
          SELECT id, ${sql.raw(`field_${field.field_id}`)} as file_data, created_at, updated_at
          FROM ${sql.raw(field.table_db_name)} 
          WHERE ${sql.raw(`field_${field.field_id}`)} IS NOT NULL
          AND ${sql.raw(`field_${field.field_id}`)} != '[]'
        `)

        console.log(`[FILE-INDEX] Processing ${rows.length} rows with files in field ${field.field_name}`)

        for (const row of rows) {
          try {
            const fileData = typeof row.file_data === 'string' ? JSON.parse(row.file_data) : row.file_data
            
            if (Array.isArray(fileData)) {
              for (const file of fileData) {
                // Use LlamaIndex for superior document processing
                const processedChunks = await this.processFileWithLlamaIndex(file.s3Key, file.mimeType, file.name)
                
                if (processedChunks && processedChunks.length > 0) {
                  console.log(`[FILE-INDEX] Processing ${processedChunks.length} chunks from ${file.name}`)
                  
                  // Base context for all chunks
                  const baseContext = `

CONTEXT AND RELATIONSHIPS:
- This file belongs to the "${field.table_name}" table in the "${field.database_name}" database
- Stored in field: "${field.field_name}" (field type: file)
- This file contains data that is related to and belongs with other records in the "${field.table_name}" table
- Use this file's content in context with the "${field.table_name}" table structure and data when answering questions
- File location: Table "${field.table_name}" → Field "${field.field_name}" → File "${file.name}"

CONTENT QUESTIONS: This content can answer questions like:
- What information is contained in ${file.name}?
- What data does ${file.name} have?
- Tell me about the contents of ${file.name}`

                  // Process each LlamaIndex chunk
                  for (let chunkIndex = 0; chunkIndex < processedChunks.length; chunkIndex++) {
                    const chunk = processedChunks[chunkIndex]
                    const enhancedContent = `${chunk.content}${baseContext}

CHUNK INFO: This is chunk ${chunkIndex + 1} of ${processedChunks.length} from ${file.name}, processed by LlamaIndex`

                    // Generate HuggingFace embedding for the enhanced content
                    const { embedding } = await embed({
                      model: this.embeddingModel,
                      value: enhancedContent,
                    })

                    await db.insert(ragDocuments).values({
                      ragIndexId: indexId,
                      sourceType: 'file',
                      sourceId: `${file.id}-chunk-${chunkIndex}`,
                      sourceName: file.name,
                      title: `File: ${file.name} (Chunk ${chunkIndex + 1}/${processedChunks.length}) - ${field.database_name} → ${field.table_name} → ${field.field_name}`,
                      content: enhancedContent,
                      metadata: {
                        fileId: file.id,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.mimeType,
                        chunkIndex: chunkIndex,
                        totalChunks: processedChunks.length,
                        chunkSize: chunk.content.length,
                        tableId: field.table_id,
                        tableName: field.table_name,
                        databaseName: field.database_name,
                        fieldId: field.field_id,
                        fieldName: field.field_name,
                        uploadedAt: file.uploadedAt,
                        organizationId: ragIndex.organizationId,
                        contextPath: `${field.database_name} → ${field.table_name} → ${field.field_name}`,
                        llamaIndexMetadata: chunk.metadata,
                        processingMethod: 'llamaindex'
                      },
                      embedding,
                      contentHash: crypto.createHash('md5').update(enhancedContent).digest('hex'),
                    })

                    documentCount++
                  }
                  
                  console.log(`[FILE-INDEX] Successfully indexed ${file.name} (${file.mimeType}) as ${processedChunks.length} LlamaIndex chunks`)
                } else {
                  console.log(`[FILE-INDEX] Failed to process file: ${file.name} with LlamaIndex`)
                }
              }
            }
          } catch (error) {
            console.error(`[FILE-INDEX] Error processing row:`, error)
          }
        }
      } catch (error) {
        console.error(`[FILE-INDEX] Error processing field ${field.field_name}:`, error)
      }
    }

    console.log(`[FILE-INDEX] Indexed ${documentCount} files total`)
    return documentCount
  }

  // Vector similarity search using pgvector
  async search(params: {
    indexId: string
    query: string
    limit?: number
    threshold?: number
    userId?: string
    agentId?: number
    sessionId?: string
    similarityMetric?: 'cosine' | 'euclidean' | 'inner_product'
  }): Promise<RagQueryResult> {
    const { 
      indexId, 
      query, 
      limit = 10, 
      threshold = 0.6,
      similarityMetric = 'cosine' 
    } = params

    try {
      // Generate embedding for the query
      const { embedding: queryEmbedding } = await embed({
        model: this.embeddingModel,
        value: query,
      })

      // Choose similarity operator based on metric
      let similarityOperator: string
      let orderDirection: 'ASC' | 'DESC' = 'ASC' // Lower is better for distance metrics
      
      switch (similarityMetric) {
        case 'cosine':
          similarityOperator = '<=>'  // Cosine distance
          break
        case 'euclidean': 
          similarityOperator = '<->'  // Euclidean distance
          break
        case 'inner_product':
          similarityOperator = '<#>'  // Inner product
          orderDirection = 'DESC'     // Higher is better for inner product
          break
        default:
          similarityOperator = '<=>'  // Default to cosine distance
      }

      // Perform vector similarity search using raw SQL
      const rawResults = await db.execute(sql`
        SELECT 
          id, 
          source_type, 
          source_id, 
          source_name, 
          title, 
          content, 
          metadata,
          embedding ${sql.raw(similarityOperator)} ${JSON.stringify(queryEmbedding)}::vector as similarity
        FROM rag_documents
        WHERE rag_index_id = ${indexId}
        ORDER BY embedding ${sql.raw(similarityOperator)} ${JSON.stringify(queryEmbedding)}::vector ${sql.raw(orderDirection)}
        LIMIT ${limit * 2}
      `)

      // Convert distance to similarity score and apply threshold
      const scoredDocuments = rawResults.map((doc: any) => {
        let similarity: number
        if (similarityMetric === 'inner_product') {
          similarity = Math.max(0, Number(doc.similarity)) // Inner product can be negative
        } else {
          // Convert distance to similarity (1 - distance, clamped to 0-1)
          similarity = Math.max(0, Math.min(1, 1 - Number(doc.similarity)))
        }
        
        return {
          id: doc.id,
          sourceType: doc.source_type,
          sourceId: doc.source_id,
          sourceName: doc.source_name,
          title: doc.title,
          content: doc.content,
          metadata: doc.metadata,
          similarity,
        }
      }).filter(doc => doc.similarity >= threshold)
        .slice(0, limit)

      // Log query for analytics
      try {
        await db.insert(ragQueryLogs).values({
          ragIndexId: indexId,
          query,
          queryEmbedding,
          resultsCount: scoredDocuments.length,
          topResults: scoredDocuments.slice(0, 5),
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId,
          similarityMetric,
          threshold,
        })
      } catch (e) {
        console.log('Query logging failed, continuing:', e)
      }

      return {
        documents: scoredDocuments,
        totalCount: scoredDocuments.length,
        query,
      }

    } catch (error) {
      console.error('Vector search failed, falling back to text search:', error)
      
      // Fallback to basic text search if vector search fails
      const documents = await db.select({
        id: ragDocuments.id,
        sourceType: ragDocuments.sourceType,
        sourceId: ragDocuments.sourceId,
        sourceName: ragDocuments.sourceName,
        title: ragDocuments.title,
        content: ragDocuments.content,
        metadata: ragDocuments.metadata,
      }).from(ragDocuments)
        .where(eq(ragDocuments.ragIndexId, indexId))
        .limit(limit)

      const queryLower = query.toLowerCase()
      const scoredDocuments = documents.map(doc => ({
        id: doc.id,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        sourceName: doc.sourceName,
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata,
        similarity: this.calculateTextSimilarity(queryLower, doc.content.toLowerCase()),
      })).filter(doc => doc.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)

      return {
        documents: scoredDocuments,
        totalCount: scoredDocuments.length,
        query,
      }
    }
  }

  // Simple text similarity calculation
  private calculateTextSimilarity(query: string, content: string): number {
    const queryWords = query.split(/\s+/)
    const contentWords = content.split(/\s+/)
    
    let matches = 0
    for (const queryWord of queryWords) {
      if (queryWord.length > 2 && contentWords.some(word => word.includes(queryWord))) {
        matches++
      }
    }
    
    return matches / queryWords.length
  }

  // Get performance metrics for the RAG system
  async getIndexStats(indexId: string): Promise<any> {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_documents,
        AVG(pg_column_size(embedding)) as avg_embedding_size,
        pg_size_pretty(pg_total_relation_size('rag_documents')) as total_size
      FROM rag_documents
      WHERE rag_index_id = ${indexId}
    `)

    return stats[0]
  }

  // Clean up resources
  async deleteIndex(indexId: string): Promise<void> {
    await db.delete(ragDocuments).where(eq(ragDocuments.ragIndexId, indexId))
    await db.delete(ragQueryLogs).where(eq(ragQueryLogs.ragIndexId, indexId))
    await db.delete(ragIndexes).where(eq(ragIndexes.id, indexId))
  }
}

export const ragService = new RagService()