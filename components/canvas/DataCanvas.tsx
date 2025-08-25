'use client'

import { BaseCanvas } from './BaseCanvas'
import { Database, Plus, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * DataCanvas - Canvas for Data tables management page
 * 
 * Features:
 * - Data table listing and management
 * - Table creation and schema editing
 * - Data viewing and editing
 * 
 * AIDEV-NOTE: Data page canvas for managing database tables and data.
 */

interface DataCanvasProps {
  tableId?: string
  tableName?: string
  children?: React.ReactNode
}

export function DataCanvas({ tableId, tableName, children }: DataCanvasProps) {
  const title = tableId ? (tableName || 'Data Table') : 'Data Tables'
  const subtitle = tableId ? `Manage table data and schema` : 'Create and manage your data tables'

  return (
    <BaseCanvas
      title={title}
      subtitle={subtitle}
      icon={tableId ? <Table className="h-5 w-5" /> : <Database className="h-5 w-5" />}
      headerActions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {tableId ? 'Add Row' : 'New Table'}
        </Button>
      }
    >
      <div className="flex-1 overflow-auto">
        {children || (
          <div className="p-6">
            <div className="text-center py-12">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tables found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first data table to start managing your data.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Table
              </Button>
            </div>
          </div>
        )}
      </div>
    </BaseCanvas>
  )
}