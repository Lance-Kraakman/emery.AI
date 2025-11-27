/**
 * Path Generators - Convert IDs to human-readable paths
 * 
 * Transforms database/table/field IDs into breadcrumb paths for AI context.
 * Uses existing data access patterns to lookup names.
 * 
 * AIDEV-NOTE: Simple path generation using existing data structures.
 * No complex caching - just ID lookups for human-readable context.
 */

import { useEmery } from '@/contexts/EmeryStoreProvider'

// Path generation results
export interface PathInfo {
  path: string           // "Sales DB → Customers → Meeting Notes"
  breadcrumb: string[]   // ["Sales DB", "Customers", "Meeting Notes"]
  shortPath: string      // "Sales/Customers/Notes"
}

// Data lookup interfaces (using existing patterns)
interface DatabaseInfo {
  id: number
  name: string
}

interface TableInfo {
  id: number
  name: string
  databaseId: number
}

interface FieldInfo {
  id: number
  name: string
  tableId: number
}

interface AgentInfo {
  id: string
  name: string
  description?: string
}

/**
 * Generate path for document context
 */
export function generateDocumentPath(
  tableId: number,
  fieldId: number,
  options: {
    databases?: DatabaseInfo[]
    tables?: TableInfo[]
    fields?: FieldInfo[]
  } = {}
): PathInfo {
  try {
    // Find the field
    const field = options.fields?.find(f => f.id === fieldId)
    if (!field) {
      return {
        path: `Table ${tableId} → Field ${fieldId}`,
        breadcrumb: [`Table ${tableId}`, `Field ${fieldId}`],
        shortPath: `table-${tableId}/field-${fieldId}`
      }
    }

    // Find the table
    const table = options.tables?.find(t => t.id === field.tableId)
    if (!table) {
      return {
        path: `Table ${tableId} → ${field.name}`,
        breadcrumb: [`Table ${tableId}`, field.name],
        shortPath: `table-${tableId}/${field.name.toLowerCase().replace(/\s+/g, '-')}`
      }
    }

    // Find the database
    const database = options.databases?.find(d => d.id === table.databaseId)
    if (!database) {
      return {
        path: `Database ${table.databaseId} → ${table.name} → ${field.name}`,
        breadcrumb: [`Database ${table.databaseId}`, table.name, field.name],
        shortPath: `db-${table.databaseId}/${table.name}/${field.name}`.toLowerCase().replace(/\s+/g, '-')
      }
    }

    // Full path available
    const breadcrumb = [database.name, table.name, field.name]
    return {
      path: breadcrumb.join(' → '),
      breadcrumb,
      shortPath: breadcrumb.join('/').toLowerCase().replace(/\s+/g, '-')
    }

  } catch (error) {
    console.warn('Error generating document path:', error)
    return {
      path: `Table ${tableId} → Field ${fieldId}`,
      breadcrumb: [`Table ${tableId}`, `Field ${fieldId}`],
      shortPath: `table-${tableId}/field-${fieldId}`
    }
  }
}

/**
 * Generate path for table context
 */
export function generateTablePath(
  tableId: number,
  options: {
    databases?: DatabaseInfo[]
    tables?: TableInfo[]
  } = {}
): PathInfo {
  try {
    // Find the table
    const table = options.tables?.find(t => t.id === tableId)
    if (!table) {
      return {
        path: `Table ${tableId}`,
        breadcrumb: [`Table ${tableId}`],
        shortPath: `table-${tableId}`
      }
    }

    // Find the database
    const database = options.databases?.find(d => d.id === table.databaseId)
    if (!database) {
      return {
        path: `Database ${table.databaseId} → ${table.name}`,
        breadcrumb: [`Database ${table.databaseId}`, table.name],
        shortPath: `db-${table.databaseId}/${table.name}`.toLowerCase().replace(/\s+/g, '-')
      }
    }

    // Full path available
    const breadcrumb = [database.name, table.name]
    return {
      path: breadcrumb.join(' → '),
      breadcrumb,
      shortPath: breadcrumb.join('/').toLowerCase().replace(/\s+/g, '-')
    }

  } catch (error) {
    console.warn('Error generating table path:', error)
    return {
      path: `Table ${tableId}`,
      breadcrumb: [`Table ${tableId}`],
      shortPath: `table-${tableId}`
    }
  }
}

/**
 * Generate path for agent context
 */
export function generateAgentPath(
  agentId: string,
  options: {
    agents?: AgentInfo[]
  } = {}
): PathInfo {
  try {
    // Find the agent
    const agent = options.agents?.find(a => a.id === agentId)
    if (!agent) {
      return {
        path: `Agent ${agentId}`,
        breadcrumb: [`Agent ${agentId}`],
        shortPath: `agent-${agentId}`
      }
    }

    return {
      path: agent.name,
      breadcrumb: [agent.name],
      shortPath: agent.name.toLowerCase().replace(/\s+/g, '-')
    }

  } catch (error) {
    console.warn('Error generating agent path:', error)
    return {
      path: `Agent ${agentId}`,
      breadcrumb: [`Agent ${agentId}`],
      shortPath: `agent-${agentId}`
    }
  }
}

/**
 * Hook to get path generators with current Emery data
 */
export function usePathGenerators() {
  const { data: emeryData } = useEmery()

  // Extract data for lookups
  const databases = emeryData?.databases || []
  const tables = databases.flatMap(db => 
    (db.tables || []).map(table => ({
      ...table,
      databaseId: db.id
    }))
  )
  // AIDEV-NOTE: Fields are not directly included in TableDTO
  // In a full implementation, would need separate field fetching
  const fields: FieldInfo[] = []
  const agents = emeryData?.agents || []

  return {
    /**
     * Generate document path with current data context
     */
    generateDocumentPath: (tableId: number, fieldId: number) => {
      return generateDocumentPath(tableId, fieldId, {
        databases,
        tables,
        fields
      })
    },

    /**
     * Generate table path with current data context
     */
    generateTablePath: (tableId: number) => {
      return generateTablePath(tableId, {
        databases,
        tables
      })
    },

    /**
     * Generate agent path with current data context
     */
    generateAgentPath: (agentId: string) => {
      return generateAgentPath(agentId, {
        agents
      })
    },

    // Raw data for other uses
    databases,
    tables,
    fields,
    agents
  }
}

/**
 * Standalone path generators for use outside React components
 */
export const pathGenerators = {
  document: generateDocumentPath,
  table: generateTablePath,
  agent: generateAgentPath
}

// AIDEV-NOTE: These generators convert IDs to human-readable paths using existing data.
// The hook pattern leverages current Emery context for up-to-date data.
// Fallback to ID-based paths when data isn't available.