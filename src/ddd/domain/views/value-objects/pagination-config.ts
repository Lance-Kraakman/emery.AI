/**
 * PaginationConfig Value Object
 *
 * AIDEV-NOTE: Represents pagination settings for data source queries.
 * Enforces reasonable limits to prevent performance issues.
 * Immutable value object.
 */

export interface PaginationConfigProps {
  pageSize: number;
  offset?: number;
}

export class PaginationConfig {
  private static readonly MAX_PAGE_SIZE = 1000;
  private static readonly DEFAULT_PAGE_SIZE = 50;
  private static readonly MIN_PAGE_SIZE = 1;

  private constructor(
    private readonly _pageSize: number,
    private readonly _offset: number
  ) {
    this.validate();
  }

  static create(props: PaginationConfigProps): PaginationConfig {
    return new PaginationConfig(
      props.pageSize,
      props.offset ?? 0
    );
  }

  static createDefault(): PaginationConfig {
    return new PaginationConfig(
      PaginationConfig.DEFAULT_PAGE_SIZE,
      0
    );
  }

  private validate(): void {
    if (
      this._pageSize < PaginationConfig.MIN_PAGE_SIZE ||
      this._pageSize > PaginationConfig.MAX_PAGE_SIZE ||
      !Number.isInteger(this._pageSize)
    ) {
      throw new Error(
        `PaginationConfig pageSize must be an integer between ${PaginationConfig.MIN_PAGE_SIZE} and ${PaginationConfig.MAX_PAGE_SIZE}`
      );
    }

    if (this._offset < 0 || !Number.isInteger(this._offset)) {
      throw new Error("PaginationConfig offset must be a non-negative integer");
    }
  }

  get pageSize(): number {
    return this._pageSize;
  }

  get offset(): number {
    return this._offset;
  }

  /**
   * Calculate current page number (1-indexed)
   */
  get currentPage(): number {
    return Math.floor(this._offset / this._pageSize) + 1;
  }

  /**
   * Create next page configuration
   */
  nextPage(): PaginationConfig {
    return new PaginationConfig(
      this._pageSize,
      this._offset + this._pageSize
    );
  }

  /**
   * Create previous page configuration
   */
  previousPage(): PaginationConfig {
    const newOffset = Math.max(0, this._offset - this._pageSize);
    return new PaginationConfig(this._pageSize, newOffset);
  }

  /**
   * Create configuration for specific page number (1-indexed)
   */
  toPage(pageNumber: number): PaginationConfig {
    if (pageNumber < 1 || !Number.isInteger(pageNumber)) {
      throw new Error("Page number must be a positive integer");
    }
    return new PaginationConfig(
      this._pageSize,
      (pageNumber - 1) * this._pageSize
    );
  }

  /**
   * Converts to SQL LIMIT/OFFSET clause
   */
  toSQLClause(): string {
    return `LIMIT ${this._pageSize} OFFSET ${this._offset}`;
  }

  toJSON(): PaginationConfigProps {
    return {
      pageSize: this._pageSize,
      offset: this._offset,
    };
  }

  equals(other: PaginationConfig): boolean {
    return (
      this._pageSize === other._pageSize &&
      this._offset === other._offset
    );
  }
}
