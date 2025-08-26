'use client'

import type { Field } from '@/ddd/domain/fields/entities/field';

interface CellRendererProps {
  field: Field;
  value: any;
}

export default function CellRenderer({ field, value }: CellRendererProps) {
  if (value === null || value === undefined) return <span className="text-gray-500">-</span>;
  
  switch (field.type) {
    case 'boolean':
      return <span className="text-lg">{value ? '✓' : '✗'}</span>;
      
    case 'date':
      return <span>{value ? new Date(value).toLocaleDateString() : '-'}</span>;
      
    case 'url':
      return value ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline break-all"
        >
          {value.length > 30 ? `${value.substring(0, 30)}...` : value}
        </a>
      ) : (
        <span className="text-gray-500">-</span>
      );
      
    case 'email':
      return value ? (
        <a 
          href={`mailto:${value}`} 
          className="text-blue-600 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-gray-500">-</span>
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
      const stringValue = String(value);
      return (
        <span title={stringValue.length > 50 ? stringValue : undefined}>
          {stringValue.length > 50 ? `${stringValue.substring(0, 50)}...` : stringValue}
        </span>
      );
  }
}
