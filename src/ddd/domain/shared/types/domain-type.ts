/**
 * Domain Type - represents different entity types in the system
 *
 * Used for context switching in chat, navigation, and metadata.
 * Previously part of the RAG system, now extracted as a shared type.
 *
 * AIDEV-NOTE: This replaced the DomainType from the removed RAG domain.
 * It represents the core entity types that can be referenced throughout the app.
 * Uses plural forms to match existing codebase conventions.
 */
export type DomainType =
  | 'tables'
  | 'agents'
  | 'files'
  | 'teams'
  | 'workflows'
  | 'organizations';
