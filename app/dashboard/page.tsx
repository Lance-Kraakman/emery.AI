'use client'

import { useState, useEffect } from 'react'
import { Plus, Table, Settings, Trash2 } from 'lucide-react'
import TableEditor from './TableEditor'

interface Workspace {
  id: number
  name: string
  userId: string
}

interface Table {
  id: number
  workspaceId: number
  name: string
  dbName: string
  createdAt: string
}

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null)
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [showNewTable, setShowNewTable] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newTableName, setNewTableName] = useState('')
  
  const mockUserId = 'user-123'

  useEffect(() => {
    loadWorkspaces()
  }, [])

  useEffect(() => {
    if (selectedWorkspace) {
      loadTables()
    }
  }, [selectedWorkspace])

  const loadWorkspaces = async () => {
    try {
      const response = await fetch(`/api/workspaces?userId=${mockUserId}`)
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data)
        if (data.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
    }
  }

  const loadTables = async () => {
    if (!selectedWorkspace) return
    
    try {
      const response = await fetch(`/api/tables?workspaceId=${selectedWorkspace}`)
      if (response.ok) {
        const data = await response.json()
        setTables(data)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mockUserId, name: newWorkspaceName })
      })
      
      if (response.ok) {
        setNewWorkspaceName('')
        setShowNewWorkspace(false)
        loadWorkspaces()
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
    }
  }

  const createTable = async () => {
    if (!newTableName.trim() || !selectedWorkspace) return
    
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: selectedWorkspace, name: newTableName })
      })
      
      if (response.ok) {
        setNewTableName('')
        setShowNewTable(false)
        loadTables()
      }
    } catch (error) {
      console.error('Error creating table:', error)
    }
  }

  const deleteTable = async (tableId: number) => {
    if (!confirm('Are you sure you want to delete this table?')) return
    
    try {
      const response = await fetch(`/api/tables?id=${tableId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        loadTables()
        if (selectedTable === tableId) {
          setSelectedTable(null)
        }
      }
    } catch (error) {
      console.error('Error deleting table:', error)
    }
  }

  if (selectedTable) {
    return <TableEditor tableId={selectedTable} onBack={() => setSelectedTable(null)} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r min-h-screen p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Workspaces</h2>
              <button
                onClick={() => setShowNewWorkspace(true)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <Plus size={16} />
              </button>
            </div>
            
            {showNewWorkspace && (
              <div className="mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Workspace name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && createWorkspace()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={createWorkspace}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewWorkspace(false)}
                    className="px-3 py-1 border text-sm rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => setSelectedWorkspace(workspace.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                    selectedWorkspace === workspace.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {workspace.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {selectedWorkspace ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
                <button
                  onClick={() => setShowNewTable(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={16} />
                  New Table
                </button>
              </div>

              {showNewTable && (
                <div className="mb-6 p-4 border rounded-lg bg-white">
                  <h3 className="font-medium mb-3">Create New Table</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Table name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md"
                      onKeyPress={(e) => e.key === 'Enter' && createTable()}
                    />
                    <button
                      onClick={createTable}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewTable(false)}
                      className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map((table) => (
                  <div key={table.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Table className="text-blue-600" size={20} />
                        <div>
                          <h3 className="font-medium text-gray-900">{table.name}</h3>
                          <p className="text-sm text-gray-500">
                            Created {new Date(table.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedTable(table.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={() => deleteTable(table.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {tables.length === 0 && (
                <div className="text-center py-12">
                  <Table className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tables yet</h3>
                  <p className="text-gray-500 mb-4">Create your first table to get started</p>
                  <button
                    onClick={() => setShowNewTable(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Table
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a workspace</h3>
              <p className="text-gray-500">Choose a workspace from the sidebar to view tables</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}