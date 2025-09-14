'use client'

import React from 'react'
import { BasePage } from './BasePage'
import { Database, Plus, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * DataPage - Page for Data tables management
 * 
 * Features:
 * - Data table listing and management
 * - Table creation and schema editing
 * - Data viewing and editing
 * 
 * AIDEV-NOTE: Data page for managing database tables and data.
 */

interface DataPageProps {
  tableId?: string
  tableName?: string
  children?: React.ReactNode
}

export function DataPage({ tableId, tableName, children }: DataPageProps) {
  const title = tableId ? (tableName || 'Data Table') : 'Data Tables'
  const subtitle = tableId ? `Manage table data and schema` : 'Create and manage your data tables'

  return (
    <BasePage
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
      <div className="h-full flex flex-col overflow-hidden">
        {children || (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
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
    </BasePage>
  )
}