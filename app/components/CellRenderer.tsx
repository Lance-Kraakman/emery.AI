'use client'

import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';

interface CellRendererProps {
  field: TableField;
  value: any;
}

export default function CellRenderer({ field, value }: CellRendererProps) {
  if (value === null || value === undefined) return <span className="text-gray-500">-</span>;
  
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
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-gray-500">-</span>;
      }
      return (
        <div className="space-y-1">
          {value.slice(0, 3).map((item: any, index: number) => (
            <div 
              key={item.id || index} 
              className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block mr-1"
            >
              {item.value || item.id || 'Unknown'}
            </div>
          ))}
          {value.length > 3 && (
            <div className="text-xs text-gray-500">+{value.length - 3} more</div>
          )}
        </div>
      );
      
    case 'file':
      if (!value?.files || !Array.isArray(value.files) || value.files.length === 0) {
        return <span className="text-gray-500">-</span>;
      }
      return (
        <div className="space-y-1">
          {value.files.slice(0, 2).map((file: any, index: number) => (
            <div 
              key={file.id || index} 
              className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block mr-1"
            >
              {file.name || 'File'}
            </div>
          ))}
          {value.files.length > 2 && (
            <div className="text-xs text-gray-500">+{value.files.length - 2} more files</div>
          )}
        </div>
      );
      
    case 'number':
      return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;
      
    default:
      return <span>{String(value)}</span>;
  }
}
