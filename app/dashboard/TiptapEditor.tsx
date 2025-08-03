'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useState, useEffect, useCallback } from 'react'
import { Save, Edit, Eye, RotateCcw, Clock } from 'lucide-react'
import ClientOnly from '../components/ClientOnly'

interface TiptapEditorProps {
  fileId: string
  fileName: string
  initialContent?: any
  readOnly?: boolean
  onSave?: (content: any) => Promise<void>
  onVersionChange?: (versionId: number) => void
}

interface FileVersion {
  id: number
  versionNumber: number
  content: any
  createdAt: string
  createdBy: string | null
  isCurrent: boolean
  changeSummary: string | null
}

// Inner component that contains all Tiptap logic
function TiptapEditorInner({ 
  fileId, 
  fileName, 
  initialContent, 
  readOnly = false,
  onSave,
  onVersionChange 
}: TiptapEditorProps) {
  const [isEditing, setIsEditing] = useState(!readOnly)
  const [isSaving, setIsSaving] = useState(false)
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Only initialize editor after component is mounted
  const editor = useEditor(
    isMounted ? {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: 'Start writing your document...',
        }),
        CharacterCount.configure({
          limit: 50000, // 50k character limit
        }),
      ],
      content: initialContent || '<p>Start writing...</p>',
      editable: isEditing,
      onUpdate: () => {
        setHasUnsavedChanges(true)
      },
    } : null
  )

  // Set mounted state after component mounts
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Load versions when component mounts
  useEffect(() => {
    loadVersions()
  }, [fileId])

  // Update editor content when switching versions
  useEffect(() => {
    if (selectedVersion && editor) {
      const version = versions.find(v => v.id === selectedVersion)
      if (version) {
        editor.commands.setContent(version.content)
        setHasUnsavedChanges(false)
      }
    }
  }, [selectedVersion, versions, editor])

  const loadVersions = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}/versions`)
      if (response.ok) {
        const data = await response.json()
        setVersions(data)
        
        // Set current version as selected if none selected
        if (!selectedVersion) {
          const currentVersion = data.find((v: FileVersion) => v.isCurrent)
          if (currentVersion) {
            setSelectedVersion(currentVersion.id)
          }
        }
      }
    } catch (error) {
      console.error('Error loading versions:', error)
    }
  }

  const handleSave = async () => {
    if (!editor || !hasUnsavedChanges) return

    setIsSaving(true)
    try {
      const content = editor.getJSON()
      
      // Save new version
      const response = await fetch(`/api/files/${fileId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          changeSummary: `Updated at ${new Date().toLocaleString()}`
        })
      })

      if (response.ok) {
        setHasUnsavedChanges(false)
        await loadVersions() // Reload versions
        if (onSave) {
          await onSave(content)
        }
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEdit = () => {
    if (isEditing && hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Save before switching to view mode?')) {
        handleSave().then(() => {
          setIsEditing(false)
          editor?.setEditable(false)
        })
        return
      }
    }
    
    setIsEditing(!isEditing)
    editor?.setEditable(!isEditing)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getWordCount = () => {
    if (!editor) return 0
    return editor.storage.characterCount.words()
  }

  const getCharacterCount = () => {
    if (!editor) return { characters: 0, limit: 50000 }
    return {
      characters: editor.storage.characterCount.characters(),
      limit: 50000
    }
  }

  if (!isMounted || !editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{fileName}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span>Words: {getWordCount()}</span>
              <span>Characters: {getCharacterCount().characters}/{getCharacterCount().limit}</span>
              {hasUnsavedChanges && <span className="text-orange-600">• Unsaved changes</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
            >
              <Clock size={16} />
              Versions ({versions.length})
            </button>
            
            <button
              onClick={toggleEdit}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
            >
              {isEditing ? <Eye size={16} /> : <Edit size={16} />}
              {isEditing ? 'View' : 'Edit'}
            </button>
            
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Versions Sidebar */}
        {showVersions && (
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Version History</h3>
              <div className="space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedVersion === version.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">v{version.versionNumber}</span>
                      {version.isCurrent && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(version.createdAt)}
                    </div>
                    {version.changeSummary && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {version.changeSummary}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
              <EditorContent 
                editor={editor} 
                className="prose prose-lg max-w-none focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tiptap Styles */}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: 500px;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        
        .prose h1 { font-size: 2em; font-weight: bold; margin: 1em 0 0.5em 0; }
        .prose h2 { font-size: 1.5em; font-weight: bold; margin: 1em 0 0.5em 0; }
        .prose h3 { font-size: 1.25em; font-weight: bold; margin: 1em 0 0.5em 0; }
        .prose p { margin: 0.75em 0; line-height: 1.6; }
        .prose ul, .prose ol { margin: 1em 0; padding-left: 2em; }
        .prose li { margin: 0.25em 0; }
        .prose blockquote { 
          border-left: 4px solid #e5e7eb; 
          padding-left: 1em; 
          margin: 1em 0; 
          color: #6b7280; 
        }
        .prose code { 
          background: #f3f4f6; 
          padding: 0.125em 0.25em; 
          border-radius: 0.25rem; 
          font-size: 0.875em; 
        }
        .prose pre { 
          background: #1f2937; 
          color: #f9fafb; 
          padding: 1em; 
          border-radius: 0.5rem; 
          overflow-x: auto; 
        }
        .prose strong { font-weight: bold; }
        .prose em { font-style: italic; }
      `}</style>
    </div>
  )
}

// Main export that wraps with ClientOnly
export default function TiptapEditor(props: TiptapEditorProps) {
  return (
    <ClientOnly
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading editor...</p>
          </div>
        </div>
      }
    >
      <TiptapEditorInner {...props} />
    </ClientOnly>
  )
}