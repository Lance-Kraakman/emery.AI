import type { FieldSource, RowIdSource } from '@/app/mappers/skill-mapper';

// --- RowIdSource serialization ---

/** Serialize RowIdSource to string for Select value */
export function serializeRowIdSource(source: RowIdSource | undefined): string {
  if (!source) return '';
  switch (source.type) {
    case 'static': return `static:${source.staticId}`;
    case 'skill_input': return `input:${source.skillInput}`;
    case 'skill_output': return `output:${source.skillOutput}`;
    case 'table_ref': return `table:${source.tableRef?.order}:${source.tableRef?.field}`;
    case 'source_row': return 'source_row';
    default: return '';
  }
}

/** Deserialize string to RowIdSource */
export function deserializeRowIdSource(value: string): RowIdSource | undefined {
  if (!value) return undefined;
  if (value === 'source_row') {
    return { type: 'source_row' };
  } else if (value.startsWith('input:')) {
    return { type: 'skill_input', skillInput: value.slice(6) };
  } else if (value.startsWith('output:')) {
    return { type: 'skill_output', skillOutput: value.slice(7) };
  } else if (value.startsWith('table:')) {
    const parts = value.slice(6).split(':');
    if (parts.length >= 2) {
      return { type: 'table_ref', tableRef: { order: parseInt(parts[0]), field: parts.slice(1).join(':') } };
    }
  } else if (value.startsWith('static:')) {
    return { type: 'static', staticId: value.slice(7) };
  }
  return undefined;
}

// --- FieldSource serialization ---

/** Serialize FieldSource to string for Select value */
export function serializeFieldSource(source: FieldSource): string {
  if (source.type === 'skill_output') {
    return `output:${source.name}`;
  } else if (source.type === 'skill_input') {
    return `input:${source.name}`;
  } else {
    return `table:${source.order}:${source.field}`;
  }
}

/** Deserialize string to FieldSource */
export function deserializeFieldSource(value: string): FieldSource | null {
  if (value.startsWith('output:')) {
    return { type: 'skill_output', name: value.slice(7) };
  } else if (value.startsWith('input:')) {
    return { type: 'skill_input', name: value.slice(6) };
  } else if (value.startsWith('table:')) {
    const parts = value.slice(6).split(':');
    if (parts.length >= 2) {
      return { type: 'table_ref', order: parseInt(parts[0]), field: parts.slice(1).join(':') };
    }
  }
  // Backwards compat: handle old 'skill:' prefix
  if (value.startsWith('skill:')) {
    return { type: 'skill_output', name: value.slice(6) };
  }
  return null;
}

// --- FieldSource helpers ---

/** Create a FieldSource from skill output name */
export function createSkillOutputSource(name: string): FieldSource {
  return { type: 'skill_output', name };
}

/** Create a FieldSource from skill input name */
export function createSkillInputSource(name: string): FieldSource {
  return { type: 'skill_input', name };
}

/** Create a FieldSource from table reference */
export function createTableRefSource(order: number, field: string): FieldSource {
  return { type: 'table_ref', order, field };
}

/** Get display label for a FieldSource */
export function getFieldSourceLabel(source: FieldSource): string {
  if (source.type === 'skill_output') {
    return source.name;
  } else if (source.type === 'skill_input') {
    return `[input] ${source.name}`;
  } else {
    return `Table #${source.order} → ${source.field}`;
  }
}
