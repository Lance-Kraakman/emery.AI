/**
 * Chat Reference Value Objects
 *
 * Value objects for chat references (documents, files, agents, tables, databases).
 * Moved from application layer to domain layer for proper DDD organization.
 *
 * AIDEV-NOTE: References are immutable value objects that represent linkable
 * content in chat messages. They provide type safety and validation.
 */

import { ReferenceCategory } from './reference-types'

/**
 * Chat reference value object
 */
export class Reference {
  constructor(
    public readonly id: string,
    public readonly insertText: string,
    public readonly displayName: string,
    public readonly description: string,
    public readonly category: ReferenceCategory
  ) {
    if (!id?.trim()) {
      throw new Error('Reference ID is required')
    }
    if (!insertText?.trim()) {
      throw new Error('Reference insert text is required')
    }
    if (!displayName?.trim()) {
      throw new Error('Reference display name is required')
    }
    if (!description?.trim()) {
      throw new Error('Reference description is required')
    }
    if (!Object.values(ReferenceCategory).includes(category)) {
      throw new Error(`Invalid reference category: ${category}`)
    }
  }

  /**
   * Create a document reference
   */
  static document(
    id: string,
    title: string,
    tableName: string,
    databaseName?: string
  ): Reference {
    const path = databaseName ? `${databaseName}/${tableName}/${title}` : `${tableName}/${title}`
    return new Reference(
      id,
      `@doc:${path}`,
      title,
      `Document in ${tableName} table`,
      ReferenceCategory.DOC
    )
  }

  /**
   * Create a file reference
   */
  static file(
    id: string,
    fileName: string,
    tableName: string,
    mimeType?: string,
    databaseName?: string
  ): Reference {
    const path = databaseName ? `${databaseName}/${tableName}/${fileName}` : `${tableName}/${fileName}`
    const typeInfo = mimeType ? ` (${mimeType})` : ''
    return new Reference(
      id,
      `@file:${path}`,
      fileName,
      `File in ${tableName} table${typeInfo}`,
      ReferenceCategory.FILE
    )
  }

  /**
   * Create an agent reference
   */
  static agent(
    id: string,
    name: string,
    description?: string
  ): Reference {
    const slug = name.replace(/:\s*/g, '').toLowerCase().replace(/\s+/g, '-')
    return new Reference(
      id,
      `@agent:${slug}`,
      name,
      description || `${name} agent`,
      ReferenceCategory.AGENT
    )
  }

  /**
   * Create a table reference
   */
  static table(
    id: string,
    tableName: string,
    databaseName: string,
    description?: string
  ): Reference {
    return new Reference(
      id,
      `@table:${databaseName}/${tableName}`,
      tableName,
      description || `Table in ${databaseName}`,
      ReferenceCategory.TABLE
    )
  }

  /**
   * Create a database reference
   */
  static database(
    id: string,
    databaseName: string,
    description?: string
  ): Reference {
    return new Reference(
      id,
      `@database:${databaseName}`,
      databaseName,
      description || `Database - ${databaseName}`,
      ReferenceCategory.DATABASE
    )
  }

  /**
   * Create a skill reference
   */
  static skill(
    id: string,
    skillName: string,
    description?: string
  ): Reference {
    const slug = skillName.replace(/:\s*/g, '').toLowerCase().replace(/\s+/g, '-')
    return new Reference(
      id,
      `@skill:${slug}`,
      skillName,
      description || `Skill - ${skillName}`,
      ReferenceCategory.SKILL
    )
  }

  /**
   * Check if this reference matches a search query
   */
  matchesSearch(query: string): boolean {
    const searchTerms = query.toLowerCase().split(' ')
    const searchableText = [
      this.displayName,
      this.description,
      this.insertText
    ].join(' ').toLowerCase()

    return searchTerms.every(term => searchableText.includes(term))
  }

  /**
   * Get the reference path from insert text
   */
  get referencePath(): string {
    return this.insertText.substring(this.insertText.indexOf(':') + 1)
  }

  /**
   * Get the reference prefix (@doc, @file, etc.)
   */
  get referencePrefix(): string {
    return this.insertText.substring(0, this.insertText.indexOf(':'))
  }

  /**
   * Check if this reference equals another
   */
  equals(other: Reference): boolean {
    return this.id === other.id && this.category === other.category
  }

  /**
   * Convert to plain object for serialization
   */
  toPlain(): {
    id: string
    insertText: string
    displayName: string
    description: string
    category: ReferenceCategory
  } {
    return {
      id: this.id,
      insertText: this.insertText,
      displayName: this.displayName,
      description: this.description,
      category: this.category
    }
  }

  /**
   * Create from plain object
   */
  static fromPlain(plain: {
    id: string
    insertText: string
    displayName: string
    description: string
    category: ReferenceCategory
  }): Reference {
    return new Reference(
      plain.id,
      plain.insertText,
      plain.displayName,
      plain.description,
      plain.category
    )
  }
}

// Legacy interface for backward compatibility during migration
export interface SimpleReference {
  id: string;
  insertText: string;
  displayName: string;
  description: string;
  category: 'doc' | 'file' | 'agent' | 'table' | 'database' | 'skill';
}

/**
 * Convert legacy SimpleReference to Reference value object
 */
export function referenceFromSimple(simple: SimpleReference): Reference {
  return new Reference(
    simple.id,
    simple.insertText,
    simple.displayName,
    simple.description,
    simple.category as ReferenceCategory
  )
}

/**
 * Convert Reference value object to legacy SimpleReference
 */
export function referenceToSimple(reference: Reference): SimpleReference {
  return {
    id: reference.id,
    insertText: reference.insertText,
    displayName: reference.displayName,
    description: reference.description,
    category: reference.category
  }
}