'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useEmeryData } from '@/hooks/useEmeryData'
import TableEditorClient from './TableEditorClient'

export default function DashboardMainContent() {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')
  const { data, isLoading } = useEmeryData()
  
  // Find the selected table
  const selectedTable = tableId 
    ? data.databases
        .flatMap(db => db.tables)
        .find(table => table.id.toString() === tableId)
    : null

  if (tableId && selectedTable) {
    return (
      <TableEditorClient 
        tableId={selectedTable.id} 
        tableName={selectedTable.name}
        organizationId={selectedTable.organizationId}
        onBack={() => window.history.back()}
      />
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Mission Control</h1>
        
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-2">Tables</h3>
                <p className="text-2xl font-bold text-primary">
                  {data.databases.reduce((acc, db) => acc + db.tables.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Across {data.databases.length} database{data.databases.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-2">Agents</h3>
                <p className="text-2xl font-bold text-primary">{data.agents.length}</p>
                <p className="text-sm text-muted-foreground">Active automation agents</p>
              </div>
              
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-2">Organization</h3>
                <p className="text-lg font-medium">{data.organization?.name || 'Loading...'}</p>
                <p className="text-sm text-muted-foreground">Current workspace</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Recent Tables</h2>
                {data.databases.length === 0 ? (
                  <div className="bg-card rounded-lg border p-6 text-center">
                    <p className="text-muted-foreground mb-4">No tables yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first table using the sidebar or{' '}
                      <a href="/dashboard/manage" className="text-primary hover:underline">
                        Orchestration
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.databases
                      .flatMap(db => db.tables)
                      .slice(0, 6)
                      .map(table => (
                        <a
                          key={table.id}
                          href={`/dashboard?tableId=${table.id}`}
                          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow"
                        >
                          <h4 className="font-medium mb-1">{table.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {table.createdAt 
                              ? new Date(table.createdAt).toLocaleDateString()
                              : 'Unknown date'
                            }
                          </p>
                        </a>
                      ))
                    }
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <a 
                    href="/dashboard/manage?tab=agents"
                    className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
                  >
                    <div className="text-2xl mb-2">🤖</div>
                    <h4 className="font-medium">Manage Agents</h4>
                    <p className="text-sm text-muted-foreground">Create and configure AI agents</p>
                  </a>
                  
                  <a 
                    href="/dashboard/manage?tab=organization"
                    className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
                  >
                    <div className="text-2xl mb-2">🏢</div>
                    <h4 className="font-medium">Organization</h4>
                    <p className="text-sm text-muted-foreground">Manage workspace settings</p>
                  </a>
                  
                  <a 
                    href="/dashboard/connections"
                    className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
                  >
                    <div className="text-2xl mb-2">🔗</div>
                    <h4 className="font-medium">OAuth Connections</h4>
                    <p className="text-sm text-muted-foreground">Connect external services</p>
                  </a>
                  
                  <a 
                    href="/settings"
                    className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
                  >
                    <div className="text-2xl mb-2">⚙️</div>
                    <h4 className="font-medium">Settings</h4>
                    <p className="text-sm text-muted-foreground">Configure preferences</p>
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}