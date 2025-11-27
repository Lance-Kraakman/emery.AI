/**
 * S3 Table Path Value Object
 * 
 * Encapsulates S3 path logic for table storage following the pattern:
 * org_{organizationId}/db_{databaseId}/table_{tableId}/
 * 
 * AIDEV-NOTE: Domain value object for S3 path construction and validation
 */

export class S3TablePath {
  private readonly _organizationId: number;
  private readonly _databaseId: number;
  private readonly _tableId: number;
  private readonly _path: string;

  constructor(organizationId: number, databaseId: number, tableId: number) {
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      throw new Error('Organization ID must be a positive integer');
    }
    if (!Number.isInteger(databaseId) || databaseId <= 0) {
      throw new Error('Database ID must be a positive integer');
    }
    if (!Number.isInteger(tableId) || tableId <= 0) {
      throw new Error('Table ID must be a positive integer');
    }

    this._organizationId = organizationId;
    this._databaseId = databaseId;
    this._tableId = tableId;
    this._path = `org_${organizationId}/db_${databaseId}/table_${tableId}/`;
  }

  get organizationId(): number {
    return this._organizationId;
  }

  get databaseId(): number {
    return this._databaseId;
  }

  get tableId(): number {
    return this._tableId;
  }

  get path(): string {
    return this._path;
  }

  // Get specific file paths within the table directory
  getDataPath(filename = 'data.arrow'): string {
    return `${this._path}${filename}`;
  }

  getManifestPath(): string {
    return `${this._path}manifest.json`;
  }

  getSchemaPath(): string {
    return `${this._path}schema.json`;
  }

  // Get partition paths for large tables
  getPartitionPath(partitionIndex: number): string {
    return `${this._path}partitions/part_${partitionIndex.toString().padStart(6, '0')}.arrow`;
  }

  // Parse S3 path back to components
  static fromPath(path: string): S3TablePath {
    const pathPattern = /^org_(\d+)\/db_(\d+)\/table_(\d+)\/$/;
    const match = path.match(pathPattern);
    
    if (!match) {
      throw new Error(`Invalid S3 table path format: ${path}`);
    }

    const [, orgId, dbId, tableId] = match;
    return new S3TablePath(
      parseInt(orgId, 10),
      parseInt(dbId, 10), 
      parseInt(tableId, 10)
    );
  }

  // Check if two paths are equal
  equals(other: S3TablePath): boolean {
    return this._path === other._path;
  }

  toString(): string {
    return this._path;
  }
}