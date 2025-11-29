'use client'

import React from 'react'
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { RelationField } from '@/components/tables/fields/RelationField';
import { FileField } from '@/components/tables/fields/FileField';
import { DocumentField } from '@/components/tables/fields/DocumentField';
import { EmbeddingField } from '@/components/tables/fields/EmbeddingField';
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector';
import { createFileArtifact, createDocumentArtifact } from '@/components/chat/types/chat-artifacts';
import { uiStateActions } from '@/stores/ui-state.store';

interface CellRendererProps {
  field: FieldDTO;
  value: any;
  readOnly?: boolean;
  organizationId?: number;
  tableId?: number;
}

export default function CellRenderer({ field, value, readOnly = false, organizationId, tableId }: CellRendererProps) {
  if (value === null || value === undefined) return <span className="text-gray-500">-</span>;

  // Handle file/document opening logic
  const handleFileOpen = async (file: any) => {
    try {
      const fileName = file.name || file.filename || 'Unknown File'
      let fileUrl = file.url || file.downloadUrl
      const mimeType = file.mimeType || file.contentType

      // If no URL, generate one from s3Key
      if (!fileUrl && file.s3Key) {
        try {
          const response = await fetch(`/api/files/download-url?s3Key=${encodeURIComponent(file.s3Key)}`)
          const result = await response.json()
          if (result.success && result.data?.downloadUrl) {
            fileUrl = result.data.downloadUrl
          }
        } catch (urlError) {
          console.error('Failed to get download URL:', urlError)
        }
      }

      console.log('Opening file:', { fileName, fileUrl, mimeType, file })

      // Create appropriate artifact using LlamaIndex chat-ui system
      if (FileTypeDetector.isTiptapDocument(mimeType)) {
        console.log('Creating TipTap document artifact for:', fileName)

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
          organizationId || 1, // Fallback to 1 if not provided
          tableId || 1, // Fallback to 1 if not provided
          field.id || 0,
          'edit',
          fileUrl
        )

        console.log('Opening document artifact in canvas:', documentArtifact)
        // Use global UI state to open artifact (works from any component)
        // const { openArtifact } = useChatCanvas()
        // openArtifact(documentArtifact)

      } else {
        const viewerType = FileTypeDetector.detectViewerType(fileName, mimeType)
        console.log('Creating file viewer artifact for:', { viewerType, fileName, fileUrl })

        const fileArtifact = createFileArtifact(
          file,
          tableId || 1, // Fallback to 1 if not provided
          field.id || 0,
          viewerType,
          fileUrl
        )

        console.log('Opening file artifact in canvas:', fileArtifact)
        // Use global UI state to open artifact (works from any component)
        uiStateActions.openArtifact(fileArtifact)
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
  };
  
  switch (field.type) {
    case 'boolean':
      return <span className="text-lg">{value ? '✓' : '✗'}</span>;
      
    case 'date':
      return <span>{value ? new Date(value).toLocaleDateString() : '-'}</span>;
      
    case 'text':
      const textValue = String(value);
      // Handle text that looks like URLs or emails with basic styling
      if (textValue.includes('@') && textValue.includes('.')) {
        return (
          <a 
            href={`mailto:${textValue}`} 
            className="text-blue-600 hover:underline"
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
            className="text-blue-600 hover:underline break-all"
          >
            {textValue.length > 30 ? `${textValue.substring(0, 30)}...` : textValue}
          </a>
        );
      }
      return (
        <span title={textValue.length > 50 ? textValue : undefined}>
          {textValue.length > 50 ? `${textValue.substring(0, 50)}...` : textValue}
        </span>
      );
      
    case 'relation':
      // Use unified RelationField component (display mode)
      return (
        <RelationField
          value={value || []}
          isEditMode={false}
          compact={true}
          fieldName={field.name}
          readOnly={readOnly}
          onRelationClick={(relation) => {
            console.log('Relation clicked:', relation);
            // TODO: Implement relation navigation/management
          }}
        />
      );

    case 'file':
      // Use unified FileField component (display mode)
      return (
        <FileField
          value={value || []}
          isEditMode={false}
          compact={true}
          fieldName={field.name}
          readOnly={readOnly}
          onFileOpen={handleFileOpen}
        />
      );

    case 'document':
      // Use unified DocumentField component (display mode)
      return (
        <DocumentField
          value={value || []}
          isEditMode={false}
          compact={true}
          field={field}
          readOnly={readOnly}
          onDocumentOpen={handleFileOpen}
        />
      );

    case 'embedding':
      // Use unified EmbeddingField component (display mode)
      return (
        <EmbeddingField
          value={value}
          isEditMode={false}
          compact={true}
        />
      );

    case 'number':
      return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;

    default:
      return <span>{String(value)}</span>;
  }
}
