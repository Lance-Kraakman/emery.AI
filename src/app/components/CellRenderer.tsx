'use client'

import React from 'react'
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { RelationFieldDisplay } from '@/components/tables/field-displays/RelationFieldDisplay';
import { FileFieldDisplay } from '@/components/tables/field-displays/FileFieldDisplay';
import { DocumentFieldDisplay } from '@/components/tables/field-displays/DocumentFieldDisplay';

interface CellRendererProps {
  field: FieldDTO;
  value: any;
}

export default function CellRenderer({ field, value }: CellRendererProps) {
  if (value === null || value === undefined) return <span className="text-gray-500">-</span>;

  // Handle file/document opening logic
  const handleFileOpen = (file: any) => {
    try {
      const fileName = file.name || file.filename || 'Unknown File'
      const fileUrl = file.url || file.downloadUrl
      const mimeType = file.mimeType || file.contentType
      
      console.log('Opening file:', { fileName, fileUrl, mimeType, file })
      
      // Fallback: open file externally if we have a URL
      if (fileUrl) {
        window.open(fileUrl, '_blank')
      } else {
        alert('Unable to open file - no URL available')
      }
    } catch (error) {
      console.error('Error opening file:', error, file)
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
      // Use the new RelationFieldDisplay component for consistent UI
      return (
        <RelationFieldDisplay 
          value={value || []} 
          fieldName={field.name}
          onRelationClick={(relation) => {
            console.log('Relation clicked:', relation);
            // TODO: Implement relation navigation/management
          }}
        />
      );
      
    case 'file':
      // Use the new FileFieldDisplay component for consistent UI
      return (
        <FileFieldDisplay 
          value={value || []} 
          fieldName={field.name}
          onFileOpen={handleFileOpen}
        />
      );
      
    case 'document':
      // Use the new DocumentFieldDisplay component for consistent UI
      return (
        <DocumentFieldDisplay 
          value={value || []} 
          fieldName={field.name}
          onDocumentOpen={handleFileOpen}
        />
      );
      
    case 'number':
      return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;
      
    default:
      return <span>{String(value)}</span>;
  }
}
