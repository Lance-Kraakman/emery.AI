/**
 * Normalize select field metadata to ensure options have valid id and color.
 *
 * Agent tooling and external API callers may omit `id` or `color` on options.
 * This normalizes them before persistence so rendering never hits undefined.
 */

const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

export function normalizeSelectMetadata(
  fieldType: string,
  metadata: Record<string, any>
): Record<string, any> {
  if (
    (fieldType !== 'single-select' && fieldType !== 'multi-select') ||
    !metadata?.options ||
    !Array.isArray(metadata.options)
  ) {
    return metadata;
  }

  return {
    ...metadata,
    options: metadata.options.map((opt: any, i: number) => ({
      id: typeof opt.id === 'number' ? opt.id : i + 1,
      value: opt.value ?? '',
      color: opt.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    })),
  };
}
