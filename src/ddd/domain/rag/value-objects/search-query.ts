// AIDEV-NOTE: Value object for search queries
// Encapsulates search parameters and validation

export type SimilarityMetric = 'cosine' | 'euclidean' | 'inner_product';

export class SearchQuery {
  private readonly _text: string;
  private readonly _limit: number;
  private readonly _threshold: number;
  private readonly _similarityMetric: SimilarityMetric;

  constructor(
    text: string,
    limit: number = 10,
    threshold: number = 0.6,
    similarityMetric: SimilarityMetric = 'cosine'
  ) {
    if (!text || text.trim().length === 0) {
      throw new Error('Search query text cannot be empty');
    }

    if (limit <= 0 || limit > 100) {
      throw new Error('Search limit must be between 1 and 100');
    }

    if (threshold < 0 || threshold > 1) {
      throw new Error('Search threshold must be between 0 and 1');
    }

    this._text = text.trim();
    this._limit = limit;
    this._threshold = threshold;
    this._similarityMetric = similarityMetric;
  }

  get text(): string {
    return this._text;
  }

  get limit(): number {
    return this._limit;
  }

  get threshold(): number {
    return this._threshold;
  }

  get similarityMetric(): SimilarityMetric {
    return this._similarityMetric;
  }

  equals(other: SearchQuery): boolean {
    return (
      this._text === other._text &&
      this._limit === other._limit &&
      this._threshold === other._threshold &&
      this._similarityMetric === other._similarityMetric
    );
  }

  toString(): string {
    return `SearchQuery(text="${this._text}", limit=${this._limit}, threshold=${this._threshold}, metric=${this._similarityMetric})`;
  }

  static create(text: string, options?: {
    limit?: number;
    threshold?: number;
    similarityMetric?: SimilarityMetric;
  }): SearchQuery {
    return new SearchQuery(
      text,
      options?.limit,
      options?.threshold,
      options?.similarityMetric
    );
  }
}