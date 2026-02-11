'use client'

import React from 'react'
import { CanvasBase } from '../../../components/canvas/CanvasBase'
import { Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * DataPage - Wrapper for Data tables management
 *
 * Uses CanvasBase for minimal wrapper with collapse functionality.
 * Pages manage their own headers and styling.
 *
 * AIDEV-NOTE: Data page wrapper for managing database tables and data.
 */

interface DataPageProps {
  tableId?: string
  tableName?: string
  children?: React.ReactNode
}

export function DataPage({ tableId, tableName, children }: DataPageProps) {
  return (
    <CanvasBase>
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
    </CanvasBase>
  )
}