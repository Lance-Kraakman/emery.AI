import type { InputDefinition, OutputDefinition } from '@/app/mappers/skill-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

/** Map table field types to skill input types. Returns null for system fields that shouldn't be mapped. */
export const fieldTypeToInputType: Record<FieldType, InputDefinition['type'] | null> = {
  'text': 'text',
  'number': 'text',
  'boolean': 'text',
  'date': 'text',
  'single-select': 'text',
  'multi-select': 'text',
  'file': 'file',
  'document': 'document',
  'email': 'text',
  'phone': 'text',
  'json': 'text',
  'relation': 'text',
  'embedding': null,
  'autonumber': null,
  'last-updated': null,
  'created-at': null,
};

/** Map table field types to skill output types. Returns null for system fields that shouldn't be mapped. */
export const fieldTypeToOutputType: Record<FieldType, OutputDefinition['type'] | null> = {
  'text': 'text',
  'number': 'number',
  'boolean': 'boolean',
  'date': 'date',
  'single-select': 'single-select',
  'multi-select': 'multi-select',
  'file': 'file',
  'document': 'document',
  'email': 'email',
  'phone': 'phone',
  'json': 'json',
  'relation': 'text',
  'embedding': null,
  'autonumber': null,
  'last-updated': null,
  'created-at': null,
};
