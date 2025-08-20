import { describe, it, expect } from 'vitest'
import { parseConnectionString } from '@/lib/db/client-parser'

describe('Database Client Parser', () => {
  it('should parse standard PostgreSQL connection string', () => {
    const connectionString = 'postgresql://user:password@localhost:5432/database'
    const result = parseConnectionString(connectionString)
    
    expect(result).toBe(connectionString)
  })

  it('should parse JSON credentials from AWS Secrets Manager', () => {
    const jsonCredentials = JSON.stringify({
      username: 'testuser',
      password: 'testpass',
      engine: 'postgres',
      host: 'test.rds.amazonaws.com',
      port: 5432,
      dbname: 'testdb'
    })
    
    const result = parseConnectionString(jsonCredentials)
    const expected = 'postgresql://testuser:testpass@test.rds.amazonaws.com:5432/testdb?sslmode=disable'
    
    expect(result).toBe(expected)
  })

  it('should handle missing port in JSON credentials (defaults to 5432)', () => {
    const jsonCredentials = JSON.stringify({
      username: 'testuser', 
      password: 'testpass',
      host: 'test.amazonaws.com',
      dbname: 'testdb'
      // port missing - should default to 5432
    })
    
    const result = parseConnectionString(jsonCredentials)
    const expected = 'postgresql://testuser:testpass@test.amazonaws.com:5432/testdb'
    
    expect(result).toBe(expected)
  })

  it('should handle special characters in credentials', () => {
    const jsonCredentials = JSON.stringify({
      username: 'user@domain',
      password: 'pass!@#$%^&*()',
      host: 'test.amazonaws.com',
      port: 5432,
      dbname: 'test-db'
    })
    
    const result = parseConnectionString(jsonCredentials)
    // Note: In real usage, credentials would need proper URL encoding
    const expected = 'postgresql://user@domain:pass!@#$%^&*()@test.amazonaws.com:5432/test-db'
    
    expect(result).toBe(expected)
  })

  it('should handle malformed JSON by returning original string', () => {
    const malformedJson = '{"username": "test"' // incomplete JSON
    const result = parseConnectionString(malformedJson)
    
    expect(result).toBe(malformedJson)
  })

  it('should handle non-JSON strings by returning them unchanged', () => {
    const regularString = 'not-a-connection-string'
    const result = parseConnectionString(regularString)
    
    expect(result).toBe(regularString)
  })

  it('should handle empty string', () => {
    const result = parseConnectionString('')
    expect(result).toBe('')
  })

  it('should handle null input gracefully', () => {
    const result = parseConnectionString(null as any)
    expect(result).toBeNull()
  })
})