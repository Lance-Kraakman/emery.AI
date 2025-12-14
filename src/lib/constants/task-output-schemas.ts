/**
 * Task Output Schemas
 *
 * Defines the expected output fields for each HuggingFace task type.
 * Used by the OutputMappingSection UI to show available fields for mapping.
 */

export interface OutputFieldDef {
  field: string;           // Field path, e.g., "label", "score", "box.xmin"
  type: 'text' | 'number' | 'boolean' | 'relation';
  description?: string;
}

/**
 * Output schemas per task type
 * Maps task type to available output fields
 */
export const TASK_OUTPUT_SCHEMAS: Record<string, OutputFieldDef[]> = {
  'image-classification': [
    { field: 'label', type: 'text', description: 'Classification label' },
    { field: 'score', type: 'number', description: 'Confidence score (0-1)' },
  ],

  'object-detection': [
    { field: 'label', type: 'text', description: 'Object label' },
    { field: 'score', type: 'number', description: 'Confidence score (0-1)' },
    { field: 'box.xmin', type: 'number', description: 'Bounding box X min' },
    { field: 'box.ymin', type: 'number', description: 'Bounding box Y min' },
    { field: 'box.xmax', type: 'number', description: 'Bounding box X max' },
    { field: 'box.ymax', type: 'number', description: 'Bounding box Y max' },
  ],

  'zero-shot-classification': [
    { field: 'label', type: 'text', description: 'Classification label' },
    { field: 'score', type: 'number', description: 'Confidence score (0-1)' },
  ],

  'speech-to-text': [
    { field: 'text', type: 'text', description: 'Transcribed text' },
  ],

  'question-answering': [
    { field: 'answer', type: 'text', description: 'Answer text' },
    { field: 'score', type: 'number', description: 'Confidence score (0-1)' },
  ],

  'summarization': [
    { field: 'text', type: 'text', description: 'Summary text' },
  ],

  'text-to-image': [
    // Binary output - handled separately, no field mapping
  ],

  'text-to-speech': [
    // Binary output - handled separately, no field mapping
  ],

  'feature-extraction': [
    // Embedding output - typically saved to embedding field directly
  ],
};

/**
 * Special fields available for all task types
 * Used for linking back to source rows
 */
export const SPECIAL_OUTPUT_FIELDS: OutputFieldDef[] = [
  {
    field: 'source.rowId',
    type: 'relation',
    description: 'Link to the source row that was processed',
  },
];

/**
 * Get output fields for a task type
 */
export function getOutputFieldsForTask(taskType: string): OutputFieldDef[] {
  const taskFields = TASK_OUTPUT_SCHEMAS[taskType] || [];
  return [...taskFields, ...SPECIAL_OUTPUT_FIELDS];
}

/**
 * Check if a task type supports field mapping
 * Binary output tasks (text-to-image, text-to-speech) don't use field mapping
 */
export function taskSupportsFieldMapping(taskType: string): boolean {
  const schema = TASK_OUTPUT_SCHEMAS[taskType];
  return schema !== undefined && schema.length > 0;
}

/**
 * Suggest default mode for a task type
 * - object-detection uses multi_row (one row per detection)
 * - classification tasks use single_row (top result only)
 */
export function suggestMappingMode(taskType: string): 'single_row' | 'multi_row' {
  if (taskType === 'object-detection') {
    return 'multi_row';
  }
  return 'single_row';
}
