/**
 * Task Output Schemas
 *
 * Defines the expected output fields for each HuggingFace task type.
 * Used by the OutputMappingSection UI to show available fields for mapping.
 *
 * NOTE: "Task" here refers to HuggingFace task types (image-classification, object-detection, etc.)
 * In the UI, this is displayed as "Operation" mode. The terminology difference is intentional -
 * "task" aligns with HuggingFace's API naming, while "operation" is more user-friendly.
 *
 * AIDEV-NOTE: Extended to support all output types including binary outputs (2025-01)
 * - 'file' type maps to our file field type (stores URL/S3 path)
 * - 'embedding' type maps to our embedding field type (stores vector arrays)
 */

export interface OutputFieldDef {
  field: string;           // Field path, e.g., "label", "score", "box.xmin"
  type: 'text' | 'number' | 'boolean' | 'relation' | 'file' | 'embedding';
  description?: string;
}

/**
 * Output schemas per task type
 * Maps task type to available output fields
 *
 * NOTE: Binary outputs (images, audio, video) are uploaded to S3 first,
 * then the URL is mapped to a 'file' type field in the database.
 */
export const TASK_OUTPUT_SCHEMAS: Record<string, OutputFieldDef[]> = {
  // ============================================================================
  // CLASSIFICATION & DETECTION TASKS
  // Return structured JSON with labels/scores
  // ============================================================================

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

  'image-segmentation': [
    { field: 'label', type: 'text', description: 'Segment label' },
    { field: 'score', type: 'number', description: 'Confidence score (0-1)' },
    { field: 'mask', type: 'text', description: 'Base64-encoded mask image' },
  ],

  // ============================================================================
  // TEXT OUTPUT TASKS
  // Return text strings
  // ============================================================================

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

  'translation': [
    { field: 'text', type: 'text', description: 'Translated text' },
  ],

  'image-to-text': [
    { field: 'text', type: 'text', description: 'Generated text description' },
  ],

  // ============================================================================
  // BINARY OUTPUT TASKS (Image/Audio/Video)
  // Upload to S3, then map URL to file field
  // ============================================================================

  'text-to-image': [
    { field: 'url', type: 'file', description: 'Generated image URL' },
  ],

  'text-to-speech': [
    { field: 'url', type: 'file', description: 'Generated audio URL' },
  ],

  'text-to-video': [
    { field: 'url', type: 'file', description: 'Generated video URL' },
  ],

  'image-to-image': [
    { field: 'url', type: 'file', description: 'Transformed image URL' },
  ],

  // ============================================================================
  // EMBEDDING TASKS
  // Return vector arrays for semantic search/RAG
  // ============================================================================

  'feature-extraction': [
    { field: 'embedding', type: 'embedding', description: 'Vector embedding array' },
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
 * - object-detection, image-segmentation use multi_row (one row per item)
 * - everything else uses single_row (single result)
 */
export function suggestMappingMode(taskType: string): 'single_row' | 'multi_row' {
  const multiRowTasks = ['object-detection', 'image-segmentation'];
  if (multiRowTasks.includes(taskType)) {
    return 'multi_row';
  }
  return 'single_row';
}
