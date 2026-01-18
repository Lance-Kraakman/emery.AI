import { NextRequest, NextResponse } from 'next/server';

type ToonFormatter<T> = (data: T, config: { includeMeta: boolean }) => string;

/**
 * Middleware for TOON format support.
 *
 * Query params:
 * - ?format=llm → TOON with key fields only
 * - ?format=llm&meta=1 → TOON with metadata
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const data = await fetchData();
 *   return withToonFormat(
 *     request,
 *     data,
 *     tablesToToon,
 *     () => NextResponse.json({ success: true, data })
 *   );
 * }
 * ```
 */
export function withToonFormat<T>(
  request: NextRequest,
  data: T,
  formatter: ToonFormatter<T>,
  jsonResponse: () => NextResponse
): NextResponse {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const includeMeta = searchParams.get('meta') === '1';

  if (format === 'llm') {
    const toonData = formatter(data, { includeMeta });
    return new NextResponse(toonData, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  return jsonResponse();
}
