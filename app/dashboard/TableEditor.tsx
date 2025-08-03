'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Edit, Trash2, Save, X } from 'lucide-react'

interface Field {
  id: number
  tableId: number
  name: string
  slug: string
  type: 'text' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'relation'
  required: boolean
  orderIndex: number
}

interface Row {
  id: string
  created_at: string
  updated_at: string
  [key: string]: any
}

interface TableEditorProps {
  tableId: number
  onBack: () => void
}

export default function TableEditor({ tableId, onBack }: TableEditorProps) {
  const [fields, setFields] = useState<Field[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [showNewField, setShowNewField] = useState(false)
  const [showNewRow, setShowNewRow] = useState(false)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [newField, setNewField] = useState({
    name: '',
    type: 'text' as const,
    required: false
  })
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})
  const [editRowData, setEditRowData] = useState<Record<string, any>>({})

  useEffect(() => {
    loadFields()
    loadRows()
  }, [tableId])

  const loadFields = async () => {
    try {
      const response = await fetch(`/api/fields?tableId=${tableId}`)
      if (response.ok) {
        const data = await response.json()
        setFields(data)
      }
    } catch (error) {
      console.error('Error loading fields:', error)
    }
  }

  const loadRows = async () => {
    try {
      const response = await fetch(`/api/rows?tableId=${tableId}`)
      if (response.ok) {
        const data = await response.json()
        setRows(data)
      }
    } catch (error) {
      console.error('Error loading rows:', error)
    }
  }

  const createField = async () => {
    if (!newField.name.trim()) return

    try {
      const response = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          name: newField.name,
          type: newField.type,
          required: newField.required
        })
      })

      if (response.ok) {
        setNewField({ name: '', type: 'text', required: false })
        setShowNewField(false)
        loadFields()
        loadRows() // Reload to get updated column structure
      }
    } catch (error) {
      console.error('Error creating field:', error)
    }
  }

  const deleteField = async (fieldId: number) => {
    if (!confirm('Are you sure you want to delete this field?')) return

    try {
      const response = await fetch(`/api/fields?id=${fieldId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadFields()
        loadRows()
      }
    } catch (error) {
      console.error('Error deleting field:', error)
    }
  }

  const createRow = async () => {
    try {
      const response = await fetch('/api/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          data: newRowData
        })
      })

      if (response.ok) {
        setNewRowData({})
        setShowNewRow(false)
        loadRows()
      }
    } catch (error) {
      console.error('Error creating row:', error)
    }
  }

  const updateRow = async (rowId: string) => {
    try {
      const response = await fetch('/api/rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          rowId,
          data: editRowData
        })
      })

      if (response.ok) {
        setEditingRow(null)
        setEditRowData({})
        loadRows()
      }
    } catch (error) {
      console.error('Error updating row:', error)
    }
  }

  const deleteRow = async (rowId: string) => {
    if (!confirm('Are you sure you want to delete this row?')) return

    try {
      const response = await fetch(`/api/rows?tableId=${tableId}&rowId=${rowId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadRows()
      }
    } catch (error) {
      console.error('Error deleting row:', error)
    }
  }

  const startEditRow = (row: Row) => {
    setEditingRow(row.id)
    const rowData: Record<string, any> = {}
    fields.forEach(field => {
      const fieldKey = `field_${field.id}`
      rowData[field.slug] = row[fieldKey]
    })
    setEditRowData(rowData)
  }

  const renderFieldInput = (field: Field, value: any, onChange: (value: any) => void) => {
    const baseClass = "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    
    switch (field.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            className={baseClass}
          />
        )
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        )
      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            placeholder="user@example.com"
          />
        )
      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            placeholder="https://example.com"
          />
        )
      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        )
      case 'relation':
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                onChange(e.target.value);
              }
            }}
            className={`${baseClass} h-20 font-mono text-xs`}
            placeholder='{"id": "123", "name": "Related Item"}'
          />
        )
      case 'text':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Table Editor</h1>
        </div>
      </div>

      <div className="p-6">
        {/* Fields Management */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Fields</h2>
            <button
              onClick={() => setShowNewField(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Plus size={16} />
              Add Field
            </button>
          </div>

          {showNewField && (
            <div className="mb-4 p-4 border rounded-lg bg-white">
              <h3 className="font-medium mb-3">Add New Field</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Field name"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  className="px-3 py-2 border rounded-md"
                />
                <select
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value as any })}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="text">📝 Text</option>
                  <option value="number">🔢 Number</option>
                  <option value="boolean">☑️ Checkbox</option>
                  <option value="email">📧 Email</option>
                  <option value="url">🔗 URL</option>
                  <option value="date">📅 Date</option>
                  <option value="relation">🔗 Relation</option>
                </select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  />
                  Required
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={createField}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowNewField(false)}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((field) => (
              <div key={field.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      {field.type === 'text' && '📝'}
                      {field.type === 'number' && '🔢'}
                      {field.type === 'boolean' && '☑️'}
                      {field.type === 'email' && '📧'}
                      {field.type === 'url' && '🔗'}
                      {field.type === 'date' && '📅'}
                      {field.type === 'relation' && '🔗'}
                      {field.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {field.type} {field.required && '• required'}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteField(field.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rows Management */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Data</h2>
            <button
              onClick={() => setShowNewRow(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Row
            </button>
          </div>

          {showNewRow && (
            <div className="mb-4 p-4 border rounded-lg bg-white">
              <h3 className="font-medium mb-3">Add New Row</h3>
              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.name} {field.required && '*'}
                    </label>
                    {renderFieldInput(
                      field,
                      newRowData[field.slug],
                      (value) => setNewRowData({ ...newRowData, [field.slug]: value })
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-3">
                  <button
                    onClick={createRow}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Row
                  </button>
                  <button
                    onClick={() => setShowNewRow(false)}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {fields.length > 0 ? (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">ID</th>
                      {fields.map((field) => (
                        <th key={field.id} className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                          {field.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Created</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{row.id.slice(0, 8)}...</td>
                        {fields.map((field) => (
                          <td key={field.id} className="px-4 py-3 text-sm text-gray-900">
                            {editingRow === row.id ? (
                              renderFieldInput(
                                field,
                                editRowData[field.slug],
                                (value) => setEditRowData({ ...editRowData, [field.slug]: value })
                              )
                            ) : (
                              <span className="block max-w-xs truncate">
                                {field.type === 'boolean' 
                                  ? (row[`field_${field.id}`] ? '✅ Yes' : '❌ No')
                                  : field.type === 'email' 
                                  ? (row[`field_${field.id}`] ? 
                                      <a href={`mailto:${row[`field_${field.id}`]}`} className="text-blue-600 hover:underline">
                                        {row[`field_${field.id}`]}
                                      </a> : '-')
                                  : field.type === 'url'
                                  ? (row[`field_${field.id}`] ? 
                                      <a href={row[`field_${field.id}`]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {row[`field_${field.id}`]}
                                      </a> : '-')
                                  : field.type === 'date'
                                  ? (row[`field_${field.id}`] ? new Date(row[`field_${field.id}`]).toLocaleDateString() : '-')
                                  : field.type === 'relation'
                                  ? (row[`field_${field.id}`] ? 
                                      <div className="font-mono text-xs bg-gray-100 p-1 rounded max-w-xs">
                                        {typeof row[`field_${field.id}`] === 'object' 
                                          ? JSON.stringify(row[`field_${field.id}`], null, 0)
                                          : row[`field_${field.id}`]}
                                      </div> : '-')
                                  : (row[`field_${field.id}`] || '-')
                                }
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingRow === row.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateRow(row.id)}
                                className="p-1 text-green-600 hover:text-green-800"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="p-1 text-gray-600 hover:text-gray-800"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditRow(row)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="p-1 text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-white border rounded-lg">
              <p className="text-gray-500">Add fields to start managing data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}