'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Download, Edit } from 'lucide-react'
import TiptapEditor from './TiptapEditor'

interface FileMetadata {
  id: string
  name: string
  size: number
  mimeType: string
  s3Key: string
  uploadedAt: string
}

interface FileViewerProps {
  file: FileMetadata
  onClose: () => void
  onFileUpdate?: () => void
}

export default function FileViewer({ file, onClose, onFileUpdate }: FileViewerProps) {
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view')
  const [isEditable, setIsEditable] = useState(false)

  useEffect(() => {
    // Check if file is editable (Tiptap files)
    const editableTypes = [
      'application/json', // Tiptap documents saved as JSON
      'text/plain',
      'text/markdown',
    ]
    
    const isEditableFile = editableTypes.includes(file.mimeType) || 
                          file.name.endsWith('.tiptap') ||
                          file.name.endsWith('.json') ||
                          file.name.endsWith('.md') ||
                          file.name.endsWith('.txt')
    
    setIsEditable(isEditableFile)
  }, [file])

  const handleDownload = async () => {
    try {
      // For Tiptap files, we'll download the current version content
      if (isEditable) {
        const response = await fetch(`/api/files/${file.id}/versions`)
        if (response.ok) {
          const versions = await response.json()
          const currentVersion = versions.find((v: any) => v.isCurrent)
          if (currentVersion) {
            const blob = new Blob([JSON.stringify(currentVersion.content, null, 2)], {
              type: 'application/json'
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = file.name
            a.click()
            URL.revokeObjectURL(url)
            return
          }
        }
      }
      
      // For other files, generate download URL from S3
      const response = await fetch(`/api/files/${file.id}/download?tableId=1&fieldId=1`)
      if (response.ok) {
        const { downloadUrl } = await response.json()
        window.open(downloadUrl, '_blank')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleSave = async (content: any) => {
    // Update the file metadata if needed
    if (onFileUpdate) {
      onFileUpdate()
    }
  }

  const getFileIcon = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (isEditable) return '📝'
    return '📁'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get initial content for Tiptap editor
  const [initialContent, setInitialContent] = useState(null)
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    if (isEditable && viewMode === 'edit') {
      loadInitialContent()
    }
  }, [isEditable, viewMode, file.id])

  const loadInitialContent = async () => {
    setLoadingContent(true)
    try {
      const response = await fetch(`/api/files/${file.id}/versions`)
      if (response.ok) {
        const versions = await response.json()
        const currentVersion = versions.find((v: any) => v.isCurrent)
        if (currentVersion) {
          setInitialContent(currentVersion.content)
        } else {
          // No versions exist, create initial version
          setInitialContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start writing...' }] }] })
        }
      }
    } catch (error) {
      console.error('Error loading content:', error)
      setInitialContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Error loading content...' }] }] })
    } finally {
      setLoadingContent(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFileIcon(file.mimeType, file.name)}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{file.name}</h2>
              <p className="text-sm text-gray-500">
                {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditable && (
              <button
                onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                <Edit size={16} />
                {viewMode === 'edit' ? 'Exit Edit' : 'Edit'}
              </button>
            )}
            
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
            >
              <Download size={16} />
              Download
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isEditable && viewMode === 'edit' ? (
            loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading content...</p>
                </div>
              </div>
            ) : (
              <TiptapEditor
                fileId={file.id}
                fileName={file.name}
                initialContent={initialContent}
                onSave={handleSave}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">File Preview</h3>
                <p className="text-gray-500 mb-4">
                  {isEditable 
                    ? 'Click Edit to modify this document with the rich text editor'
                    : 'Preview not available for this file type'
                  }
                </p>
                {isEditable && (
                  <button
                    onClick={() => setViewMode('edit')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Open in Editor
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}