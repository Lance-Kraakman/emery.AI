'use client'

// AIDEV-NOTE: Relation field component following Baserow's JSON blob pattern
// AIDEV-TODO: Add search functionality and pagination for large datasets

import { useState, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { getRowsData } from '@/app/actions/rows';
import { getTables } from '@/app/actions/tables';

interface RelationItem {
  id: string;
  value: string; // Display value from the related record
  [key: string]: any; // Additional metadata
}

interface RelationFieldProps {
  value: RelationItem[] | null | undefined;
  onChange: (value: RelationItem[]) => void;
  relatedTableId: number | null | undefined;
  workspaceId: number;
  disabled?: boolean;
}

export default function RelationField({ 
  value, 
  onChange, 
  relatedTableId, 
  workspaceId,
  disabled = false 
}: RelationFieldProps) {
  const [availableRecords, setAvailableRecords] = useState<any[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [relatedTable, setRelatedTable] = useState<any>(null);

  const currentValues = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (relatedTableId) {
      loadRelatedData();
    }
  }, [relatedTableId, workspaceId]);

  const loadRelatedData = async () => {
    if (!relatedTableId) return;

    try {
      setIsLoading(true);
      
      // Get table info and records
      const [tables, records] = await Promise.all([
        getTables(),
        getRowsData(relatedTableId, 100, 0)
      ]);

      const table = tables.find(t => t.id.value === relatedTableId);
      setRelatedTable(table);
      setAvailableRecords(Array.from(records) as any[]);
    } catch (error) {
      console.error('Error loading related data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addRelation = (record: any) => {
    const relationItem: RelationItem = {
      id: record.id,
      value: getDisplayValue(record),
      ...record // Include full record data for flexibility
    };

    // Check if already selected
    if (currentValues.some(item => item.id === record.id)) {
      return;
    }

    onChange([...currentValues, relationItem]);
    setShowSelector(false);
    setSearchQuery('');
  };

  const removeRelation = (id: string) => {
    onChange(currentValues.filter(item => item.id !== id));
  };

  const getDisplayValue = (record: any): string => {
    // Try to find a meaningful display field
    // Priority: name, title, first text field, or id
    const keys = Object.keys(record);
    
    for (const key of ['name', 'title']) {
      if (keys.includes(`field_${key}`) && record[`field_${key}`]) {
        return record[`field_${key}`];
      }
    }

    // Find first text field
    for (const key of keys) {
      if (key.startsWith('field_') && typeof record[key] === 'string' && record[key]) {
        return record[key];
      }
    }

    return record.id || 'Unknown';
  };

  const filteredRecords = availableRecords.filter(record => {
    if (!searchQuery) return true;
    const displayValue = getDisplayValue(record).toLowerCase();
    return displayValue.includes(searchQuery.toLowerCase());
  });

  if (!relatedTableId) {
    return (
      <div className="text-gray-500 text-sm">
        No related table selected
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Selected Relations */}
      <div className="space-y-2 mb-2">
        {currentValues.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
            <span className="flex-1 text-sm">{item.value}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeRelation(item.id)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Button */}
      {!disabled && (
        <button
          type="button"
          onClick={() => setShowSelector(true)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
        >
          <Plus size={16} />
          Add Relation
        </button>
      )}

      {/* Relation Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-96 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Select from {relatedTable?.name || 'Related Table'}
              </h3>
              <button
                onClick={() => {
                  setShowSelector(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Records List */}
            <div className="overflow-y-auto max-h-48">
              {isLoading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  {searchQuery ? 'No matching records' : 'No records available'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredRecords.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => addRelation(record)}
                      disabled={currentValues.some(item => item.id === record.id)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium">{getDisplayValue(record)}</div>
                      <div className="text-xs text-gray-500">ID: {record.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
