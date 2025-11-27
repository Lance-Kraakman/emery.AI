/**
 * Centralized data normalization utilities for the data grid
 * Provides consistent transformations between server data and UI display
 */

import type { FieldDTO } from '@/app/mappers/field-mapper'

// Core normalization interface
export interface NormalizationResult<T = any> {
  value: T
  isValid: boolean
  error?: string
}

// Main normalization class
export class DataNormalizer {
  /**
   * Normalize a value for a specific field type
   * Used when sending data TO the server
   */
  static normalizeForServer(field: FieldDTO, value: any): NormalizationResult {
    if (value === undefined || value === null) {
      return { value: null, isValid: true }
    }

    try {
      // Handle wrapped objects (DataSheetGrid pattern)
      let unwrappedValue = this.unwrapValue(value, field.name)

      // Type-specific normalization
      switch (field.type) {
        case 'number':
          return this.normalizeNumber(unwrappedValue, field.name)
        
        case 'boolean':
          return this.normalizeBoolean(unwrappedValue)
        
        case 'date':
          return this.normalizeDate(unwrappedValue)
        
        case 'text':
          return this.normalizeText(unwrappedValue)
        
        case 'relation':
        case 'file':
        case 'document':
          return { value: unwrappedValue, isValid: true }
        
        default:
          return { value: unwrappedValue, isValid: true }
      }
    } catch (error) {
      return { 
        value: value, 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Normalization failed' 
      }
    }
  }

  /**
   * Normalize a value for display in the UI
   * Used when displaying data FROM the server
   */
  static normalizeForDisplay(field: FieldDTO, value: any): NormalizationResult {
    if (value === undefined || value === null) {
      return { value: '', isValid: true }
    }

    // Clean up corrupted stringified objects
    if (typeof value === 'string' && value === '[object Object]') {
      return { value: '', isValid: true }
    }

    // For display, we want to ensure proper formatting
    switch (field.type) {
      case 'number':
        return { value: typeof value === 'number' ? value : null, isValid: true }
      
      case 'boolean':
        return { value: Boolean(value), isValid: true }
      
      case 'date':
        return { value: typeof value === 'string' ? value.split('T')[0] : value, isValid: true }
      
      default:
        return { value: value, isValid: true }
    }
  }

  /**
   * Unwrap values that DataSheetGrid wraps in objects
   * Handles patterns like: { "Phone Number": 123 } or { "0": "h", "1": "e", ... }
   */
  private static unwrapValue(value: any, fieldName: string): any {
    // If it's not an object, return as-is
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return value
    }

    // Pattern 1: Field name as key { "Phone Number": 123 }
    if (Object.prototype.hasOwnProperty.call(value, fieldName)) {
      return this.unwrapValue(value[fieldName], fieldName)
    }

    // Pattern 2: Array-like object with numeric keys { "0": "h", "1": "e", ... }
    const keys = Object.keys(value)
    const numericKeys = keys.filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))
    
    if (numericKeys.length > 0) {
      try {
        const chars = numericKeys.map(k => String(value[k]))
        const reconstructed = chars.join('')
        return reconstructed
      } catch (e) {
        // Fall through to other patterns
      }
    }

    // Pattern 3: Single key object (fallback)
    if (keys.length === 1) {
      return this.unwrapValue(value[keys[0]], fieldName)
    }

    // If we can't unwrap, return original
    return value
  }

  private static normalizeNumber(value: any, fieldName: string): NormalizationResult<number | null> {
    const num = Number(value)
    if (Number.isNaN(num)) {
      return { 
        value: null, 
        isValid: false, 
        error: `${fieldName} must be a number` 
      }
    }
    return { value: num, isValid: true }
  }

  private static normalizeBoolean(value: any): NormalizationResult<boolean> {
    return { value: Boolean(value), isValid: true }
  }

  private static normalizeDate(value: any): NormalizationResult<string> {
    if (value instanceof Date) {
      return { value: value.toISOString().split('T')[0], isValid: true }
    }
    return { value: String(value), isValid: true }
  }

  private static normalizeText(value: any): NormalizationResult<string> {
    return { value: String(value), isValid: true }
  }

  /**
   * Clean up corrupted data in server response
   * Used to fix existing data with '[object Object]' values
   */
  static cleanServerData(data: any[]): any[] {
    return data.map(row => {
      const cleanedRow = { ...row }

      Object.keys(cleanedRow).forEach(key => {
        if (cleanedRow[key] === '[object Object]') {
          cleanedRow[key] = ''
        }
      })

      return cleanedRow
    })
  }
}