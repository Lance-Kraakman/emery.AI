// AIDEV-NOTE: Template domain exports
// Re-exports all template domain types, entities, and value objects

// Types
export * from './types';

// Value Objects
export * from './value-objects';

// Entities
export { TemplateFactory } from './entities/template';
export type { Template, TemplatePersistenceRecord } from './entities/template';

// Repository Interface
export type { ITemplateRepository, ListTemplatesOptions } from './repositories/template-repository';
