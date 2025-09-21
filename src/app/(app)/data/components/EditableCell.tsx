"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { FileMetadata } from "@/types/db"
import type { FieldValue as DomainFieldValue, DocumentArrayFieldValue, FileFieldValue, FileArrayFieldValue } from "@/ddd/domain/tables/value-objects/field-values"
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field"
import { uploadFileAction } from "@/app/actions/files"
import { PlusCircle, ExternalLink } from "lucide-react"
import { DocumentFieldCell } from "./DocumentFieldCell"
import { FileTypeDetector } from "@/ddd/domain/tables/services/file-type-detector"
import { createFileArtifact, createDocumentArtifact } from "@/components/chat/types/chat-artifacts"

interface EditableCellProps {
  field: FieldDTO;
  value: DomainFieldValue;
  organizationId: number;
  tableId: number;
  onSave?: (value: DomainFieldValue) => void;
  onCancel?: (value: DomainFieldValue) => void;
}

export function EditableCell({ field, value, organizationId, tableId, onSave, onCancel }: EditableCellProps) {
  // Handle document fields completely separately - they manage their own state  
  if (field.type === "document") {
    return (
      <DocumentFieldCell
        field={field}
        value={value as DocumentArrayFieldValue}
        organizationId={organizationId}
        tableId={tableId}
        onSave={onSave || (() => {})}
      />
    )
  }

  // AIDEV-NOTE: Canvas integration will be replaced with LlamaIndex chat-ui artifacts
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  // File opening logic using domain service
  const handleFileOpen = (file: any) => {
    try {
      const fileName = file.name || file.filename || 'Unknown File'
      const fileUrl = file.url || file.downloadUrl
      const mimeType = file.mimeType || file.contentType
      
      console.log('Opening file:', { fileName, fileUrl, mimeType, file })
      
      // Create appropriate artifact using LlamaIndex chat-ui system
      if (FileTypeDetector.isTiptapDocument(mimeType)) {
        console.log('Creating TipTap document artifact for:', fileName)
        
        // Create document artifact from file
        const documentFieldValue = {
          ...file,
          documentMetadata: {
            title: fileName.replace('.tiptap.json', ''),
            version: 1,
            documentType: 'tiptap' as const
          }
        }
        
        const documentArtifact = createDocumentArtifact(
          documentFieldValue,
          organizationId,
          tableId,
          field.id || 0,
          'edit', // TipTap documents are editable
          fileUrl
        )
        
        console.log('Created document artifact:', documentArtifact)
        // AIDEV-TODO: Show artifact in LlamaIndex canvas programmatically
        // For now, artifacts are created but need to be shown via chat interaction
        
      } else {
        const viewerType = FileTypeDetector.detectViewerType(fileName, mimeType)
        console.log('Creating file viewer artifact for:', { viewerType, fileName, fileUrl })
        
        const fileArtifact = createFileArtifact(
          file,
          tableId,
          field.id || 0,
          viewerType,
          fileUrl
        )
        
        console.log('Created file artifact:', fileArtifact)
        // AIDEV-TODO: Show artifact in LlamaIndex canvas programmatically
        // For now, artifacts are created but need to be shown via chat interaction
      }
      
    } catch (error) {
      console.error('Error opening file:', error, file)
      
      // Fallback: open file externally if we have a URL
      const fileUrl = file.url || file.downloadUrl
      if (fileUrl) {
        window.open(fileUrl, '_blank')
      } else {
        alert('Unable to open file - no URL available')
      }
    }
  }


  const handleSave = () => {
    onSave?.(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
    onCancel?.(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!onSave) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organizationId.toString())
      formData.append('tableId', tableId.toString())
      formData.append('fieldName', field.name)

      const result = await uploadFileAction(formData)

      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      const fileMetadata = result.data as FileMetadata
      // Convert FileMetadata to FileFieldValue format
      const newFile: FileFieldValue = {
        id: fileMetadata.id,
        name: fileMetadata.name,
        size: fileMetadata.size,
        mimeType: fileMetadata.mimeType || 'application/octet-stream', // Provide default if missing
        s3Key: fileMetadata.s3Key,
        uploadedAt: fileMetadata.uploadedAt
      }
      const updatedFiles = Array.isArray(value) ? [...(value as FileArrayFieldValue), newFile] : [newFile]
      onSave(updatedFiles as DomainFieldValue)
    } catch (err) {
      console.error(err)
      // TODO: Show error to user
    } finally {
      setUploading(false)
    }
  }

  const formatDisplayValue = () => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground italic text-xs">—</span>
    }

    switch (field.type) {
      case "boolean":
        return <Checkbox checked={Boolean(value)} disabled />
      case "date":
        try {
          // Type narrowing: ensure value is string for date parsing
          if (typeof value !== 'string') {
            return <span className="text-muted-foreground italic text-xs">Invalid date</span>
          }
          const date = new Date(value)
          return format(date, "MMM d, yyyy")
        } catch {
          return <span className="text-muted-foreground italic text-xs">Invalid date</span>
        }
      case "number":
        return typeof value === "number" ? value.toLocaleString() : String(value)
      case "text":
        const textValue = String(value);
        // Handle text that looks like URLs or emails
        if (textValue.includes('@') && textValue.includes('.')) {
          return (
            <a 
              href={`mailto:${textValue}`} 
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {textValue}
            </a>
          );
        }
        if (textValue.startsWith('http://') || textValue.startsWith('https://')) {
          return (
            <a 
              href={textValue} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {textValue}
            </a>
          );
        }
        return <span>{textValue}</span>
      case "relation":
        // Handle relation data with proper type narrowing
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 3).map((item: any, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {item.value || item.title || item.name || item.id || "Related"}
                </Badge>
              ))}
              {value.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{value.length - 3} more
                </Badge>
              )}
            </div>
          )
        }
        return <span className="text-muted-foreground italic text-xs">No relation</span>
      case "file":
        // File fields are always arrays in DTO
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 2).map((file: any, idx: number) => (
                <div 
                  key={idx} 
                  className="relative"
                  onMouseEnter={() => setHoveredFileIndex(idx)}
                  onMouseLeave={() => setHoveredFileIndex(null)}
                >
                  <Badge variant="outline" className="text-xs">
                    {file.name || file.filename || "File"}
                  </Badge>
                  {hoveredFileIndex === idx && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFileOpen(file)}
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-white shadow-sm border-gray-200 hover:bg-gray-50 z-10"
                      title="Open file"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {value.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{value.length - 2} more
                </Badge>
              )}
            </div>
          )
        }
        return <span className="text-muted-foreground italic text-xs">No files</span>
      case "document":
        // Handle document fields - delegate to DocumentFieldCell
        return (
          <DocumentFieldCell
            field={field}
            value={value as DocumentArrayFieldValue}
            organizationId={organizationId}
            tableId={tableId}
            onSave={onSave || (() => {})}
          />
        )
      default:
        const strValue = String(value)
        return (
          <span className="truncate block max-w-[200px]" title={strValue}>
            {strValue}
          </span>
        )
    }
  }

  if (!isEditing) {
    return (
      <div
        className="min-h-[28px] flex items-center p-1 cursor-pointer hover:bg-muted/30 transition-colors rounded-sm"
        onClick={() => setIsEditing(true)}
      >
        {formatDisplayValue()}
      </div>
    )
  }

  switch (field.type as FieldType) {
    case "boolean":
      return (
        <div className="p-1">
          <Checkbox
            checked={Boolean(editValue)}
            onCheckedChange={(checked) => {
              setEditValue(checked)
              onSave?.(checked)
              setIsEditing(false)
            }}
          />
        </div>
      )

    case "date":
      return (
        <div className="p-1">
          <Input
            type="date"
            value={typeof editValue === 'string' ? editValue : ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )

    case "number":
      return (
        <div className="p-1">
          <Input
            type="number"
            value={typeof editValue === 'number' ? editValue.toString() : ""}
            onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : "")}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )


    case "relation":
      return (
        <div className="p-1">
          <Input
            type="text"
            value={typeof editValue === 'object' && editValue !== null ? JSON.stringify(editValue) : String(editValue || "")}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                setEditValue(parsed)
              } catch {
                setEditValue(e.target.value)
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-mono"
            autoFocus
            placeholder="JSON relation data"
          />
        </div>
      )

    case "file":
      return (
        <div className="p-1 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0])
              }
            }}
            disabled={uploading}
          />
          <div className="flex flex-wrap gap-1">
            {Array.isArray(value) && value.map((file: any, idx: number) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {file.name || file.filename || "File"}
              </Badge>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      )

    case "document":
      // Document fields use DocumentFieldCell component - no separate edit mode needed
      return (
        <DocumentFieldCell
          field={field}
          value={value as DocumentArrayFieldValue}
          organizationId={organizationId}
          tableId={tableId}
          onSave={onSave || (() => {})}
        />
      )

    default:
      return (
        <div className="p-1">
          <Input
            type="text"
            value={typeof editValue === 'string' ? editValue : String(editValue || "")}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )
  }
}
