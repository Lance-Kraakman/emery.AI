'use client'

import { useState, useRef } from 'react'
import { Upload, X, File, Download } from 'lucide-react'
import { uploadFileAction } from '@/app/actions/files'

interface FileMetadata {
  id: string
  name: string
  size: number
  mimeType: string
  s3Key: string
  uploadedAt: string
}

interface FileUploadProps {
  value: { files: FileMetadata[] } | null
  onChange: (value: { files: FileMetadata[] }) => void
  organizationId: number
  tableId: number
  fieldId: number
}

export default function FileUpload({ value, onChange, organizationId, tableId, fieldId }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentFiles = value?.files || []

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organizationId.toString())
      formData.append('tableId', tableId.toString())
      formData.append('fieldId', fieldId.toString())

      const result = await uploadFileAction(formData);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const fileMetadata = result.data as FileMetadata;
      
      // Add the new file to the current files
      const updatedFiles = [...currentFiles, fileMetadata];
      onChange({ files: updatedFiles })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0]) // For now, handle one file at a time
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const removeFile = (fileId: string) => {
    const updatedFiles = currentFiles.filter(f => f.id !== fileId)
    onChange({ files: updatedFiles })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    return '📁'
  }

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="text-blue-600">
            <Upload className="w-6 h-6 mx-auto mb-2 animate-pulse" />
            <p>Uploading...</p>
          </div>
        ) : (
          <div className="text-gray-500 cursor-pointer">
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <p>Click to upload or drag and drop</p>
            <p className="text-sm">PDF, DOC, images, etc.</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* File List */}
      {currentFiles.length > 0 && (
        <div className="space-y-2">
          {currentFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">{getFileIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {/* TODO: Implement download */}}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
