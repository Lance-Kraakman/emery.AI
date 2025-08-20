import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb } from '@/lib/db/test-client'
import { eq } from 'drizzle-orm'

describe('Database Operations', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(async () => {
    await testDb.close()
  })

  describe('Organizations', () => {
    it('should have test organization available', async () => {
      const orgs = await testDb.client.query('SELECT * FROM organizations')
      expect(orgs.rows).toHaveLength(1)
      expect(orgs.rows[0].name).toBe('Test Org')
      expect(orgs.rows[0].mission).toBe('Testing organization')
    })

    it('should be able to create new organization', async () => {
      await testDb.reset()  // Reset before test to ensure clean state
      
      await testDb.client.query(
        'INSERT INTO organizations (name, mission) VALUES ($1, $2)',
        ['New Org', 'New test org']
      )
      
      const orgs = await testDb.client.query('SELECT * FROM organizations ORDER BY id')
      expect(orgs.rows).toHaveLength(2)
      expect(orgs.rows[1].name).toBe('New Org')
    })
  })

  describe('Users', () => {
    it('should have test user available', async () => {
      const users = await testDb.client.query('SELECT * FROM users')
      expect(users.rows).toHaveLength(1)
      expect(users.rows[0].name).toBe('Test User')
      expect(users.rows[0].email).toBe('test@example.com')
      expect(users.rows[0].current_organization_id).toBe(1)
    })

    it('should be able to create new user with UUID', async () => {
      // Generate a proper UUID for testing
      const uuidResult = await testDb.client.query('SELECT gen_random_uuid() as uuid')
      const userId = uuidResult.rows[0].uuid
      
      const result = await testDb.client.query(
        'INSERT INTO users (id, name, email, current_organization_id) VALUES ($1, $2, $3, $4) RETURNING id, name',
        [userId, 'Jane Doe', 'jane@example.com', 1]
      )
      
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Jane Doe')
      expect(result.rows[0].id).toBe(userId)
    })
  })

  describe('Dynamic Tables System', () => {
    it('should create table metadata', async () => {
      // Create database first (required by new schema)
      const dbResult = await testDb.client.query(
        'INSERT INTO databases (name, slug, organization_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Database', 'test-db', 1, '550e8400-e29b-41d4-a716-446655440000']
      )
      const databaseId = dbResult.rows[0].id
      
      const result = await testDb.client.query(
        'INSERT INTO tables (name, db_name, database_id, organization_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, name',
        ['Customer Table', 'customer_table', databaseId, 1, '550e8400-e29b-41d4-a716-446655440000']
      )
      
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Customer Table')
      expect(result.rows[0].id).toBeTruthy()
    })

    it('should create fields for table', async () => {
      // Create database first
      const dbResult = await testDb.client.query(
        'INSERT INTO databases (name, slug, organization_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Database 2', 'test-db-2', 1, '550e8400-e29b-41d4-a716-446655440000']
      )
      const databaseId = dbResult.rows[0].id
      
      // Create table first
      const tableResult = await testDb.client.query(
        'INSERT INTO tables (name, db_name, database_id, organization_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Product Table', 'product_table', databaseId, 1, '550e8400-e29b-41d4-a716-446655440000']
      )
      const tableId = tableResult.rows[0].id

      // Add fields (using slug field from new schema)
      await testDb.client.query(
        'INSERT INTO fields (name, slug, type, table_id) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
        ['name', 'name', 'text', tableId, 'price', 'price', 'number', tableId]
      )

      const fields = await testDb.client.query(
        'SELECT * FROM fields WHERE table_id = $1 ORDER BY id',
        [tableId]
      )

      expect(fields.rows).toHaveLength(2)
      expect(fields.rows[0].name).toBe('name')
      expect(fields.rows[0].type).toBe('text')
      expect(fields.rows[1].name).toBe('price')
      expect(fields.rows[1].type).toBe('number')
    })
  })

  describe('Agent System', () => {
    it('should create agent for organization', async () => {
      const result = await testDb.client.query(
        `INSERT INTO agents (name, description, organization_id, owner_id) 
         VALUES ($1, $2, $3, $4) RETURNING id, name`,
        ['Test Agent', 'AI assistant for testing', 1, '550e8400-e29b-41d4-a716-446655440000']
      )

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Test Agent')
    })

    it('should enforce organization ownership', async () => {
      // Create agent
      const agentResult = await testDb.client.query(
        `INSERT INTO agents (name, organization_id, owner_id) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['Org Agent', 1, '550e8400-e29b-41d4-a716-446655440000']
      )
      const agentId = agentResult.rows[0].id

      // Verify agent belongs to organization
      const agents = await testDb.client.query(
        'SELECT * FROM agents WHERE organization_id = $1',
        [1]
      )

      expect(agents.rows).toHaveLength(1)
      expect(agents.rows[0].id).toBe(agentId)
    })
  })

  describe('Database Reset', () => {
    it('should reset database between tests', async () => {
      // Start fresh
      await testDb.reset()
      
      // Add some data
      await testDb.client.query(
        'INSERT INTO organizations (name, mission) VALUES ($1, $2)',
        ['Temp Org', 'Temporary']
      )
      
      // Verify data was added
      let orgs = await testDb.client.query('SELECT * FROM organizations')
      expect(orgs.rows).toHaveLength(2)
      
      // Reset
      await testDb.reset()
      
      // Check that only test data remains
      orgs = await testDb.client.query('SELECT * FROM organizations')
      expect(orgs.rows).toHaveLength(1)
      expect(orgs.rows[0].name).toBe('Test Org')
    })
  })
})