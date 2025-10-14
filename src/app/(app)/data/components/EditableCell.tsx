"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { FileMetadata } from "@/types/db"
import type { FieldValue as DomainFieldValue, DocumentArrayFieldValue, FileFieldValue, FileArrayFieldValue, RelationArrayFieldValue } from "@/ddd/domain/tables/value-objects/field-values"
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field"
import { uploadFileAction } from "@/app/actions/files"
import { PlusCircle, ExternalLink } from "lucide-react"
import { DocumentField } from "@/components/tables/fields/DocumentField"
import { FileField } from "@/components/tables/fields/FileField"
import { RelationField } from "@/components/tables/fields/RelationField"
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
        // Use unified RelationField component (display mode)
        return (
          <RelationField
            value={(value as RelationArrayFieldValue) || []}
            isEditMode={false}
            compact={true}
            fieldName={field.name}
            onRelationClick={(relation) => {
              console.log('Relation clicked:', relation);
              // TODO: Implement relation navigation/management
            }}
          />
        )
      case "file":
        // Use unified FileField component (display mode)
        return (
          <FileField
            value={(value as FileArrayFieldValue) || []}
            isEditMode={false}
            compact={true}
            fieldName={field.name}
            onFileOpen={handleFileOpen}
          />
        )
      case "document":
        // Use unified DocumentField component (display mode)
        return (
          <DocumentField
            value={value as DocumentArrayFieldValue || []}
            isEditMode={false}
            compact={true}
            field={field}
            onDocumentOpen={handleFileOpen}
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
        <div className="p-1 min-w-[200px]">
          <RelationField
            value={(editValue as RelationArrayFieldValue) || []}
            onChange={(newValue) => {
              setEditValue(newValue);
              onSave?.(newValue);
            }}
            isEditMode={true}
            compact={true}
            relatedTableId={field.relatedTableId || undefined}
            multiple={false}
            required={field.required || false}
          />
        </div>
      )

    case "file":
      return (
        <div className="p-1 min-w-[200px]">
          <FileField
            value={(editValue as FileArrayFieldValue) || []}
            onChange={(newValue) => {
              setEditValue(newValue);
              onSave?.(newValue);
            }}
            isEditMode={true}
            compact={true}
            onFileOpen={handleFileOpen}
            maxFiles={10}
          />
        </div>
      )

    case "document":
      return (
        <div className="p-1 min-w-[200px]">
          <DocumentField
            value={(editValue as DocumentArrayFieldValue) || []}
            onChange={(newValue) => {
              setEditValue(newValue);
              onSave?.(newValue);
            }}
            isEditMode={true}
            compact={true}
            field={field}
            organizationId={organizationId}
            tableId={tableId}
            onDocumentOpen={handleFileOpen}
          />
        </div>
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
