/**
 * gRPC Table Client
 * 
 * Low-level gRPC client for communicating with Python table service.
 * Handles connection management, error handling, and response parsing.
 * Uses the generated TypeScript client for proper type safety.
 */

import * as grpc from '@grpc/grpc-js';
import {
  TableServiceClient,
  CreateTableRequest,
  GetTableRequest,
  UpdateTableRequest,
  DeleteTableRequest,
  ListTablesRequest,
  CreateRowsRequest,
  GetRowsRequest,
  UpdateRowsRequest,
  DeleteRowsRequest,
  QueryRowsRequest,
  GetTableStatsRequest,
  TableResponse,
  DeleteTableResponse,
  ListTablesResponse,
  CreateRowsResponse,
  GetRowsResponse,
  UpdateRowsResponse,
  DeleteRowsResponse,
  QueryRowsResponse,
  GetTableStatsResponse,
} from '@/lib/grpc/generated/table_service';

export interface GrpcClientConfig {
  address: string;
  timeout?: number;
}

export class GrpcTableClient {
  private client: TableServiceClient;
  private config: GrpcClientConfig;

  constructor(config: GrpcClientConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      ...config
    };
    
    this.client = new TableServiceClient(
      this.config.address,
      grpc.credentials.createInsecure(),
      {
        'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
        'grpc.max_send_message_length': 4 * 1024 * 1024, // 4MB
      }
    );
  }

  /**
   * Create a new table
   */
  async createTable(request: CreateTableRequest): Promise<TableResponse> {
    return new Promise((resolve, reject) => {
      this.client.createTable(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Get table metadata
   */
  async getTable(request: GetTableRequest): Promise<TableResponse> {
    return new Promise((resolve, reject) => {
      this.client.getTable(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Update table metadata
   */
  async updateTable(request: UpdateTableRequest): Promise<TableResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateTable(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Delete a table
   */
  async deleteTable(request: DeleteTableRequest): Promise<DeleteTableResponse> {
    return new Promise((resolve, reject) => {
      this.client.deleteTable(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * List tables for an organization
   */
  async listTables(request: ListTablesRequest): Promise<ListTablesResponse> {
    return new Promise((resolve, reject) => {
      this.client.listTables(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Create multiple rows in a table
   */
  async createRows(request: CreateRowsRequest): Promise<CreateRowsResponse> {
    return new Promise((resolve, reject) => {
      this.client.createRows(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Get multiple rows by IDs
   */
  async getRows(request: GetRowsRequest): Promise<GetRowsResponse> {
    return new Promise((resolve, reject) => {
      this.client.getRows(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Update multiple rows
   */
  async updateRows(request: UpdateRowsRequest): Promise<UpdateRowsResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateRows(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Delete multiple rows
   */
  async deleteRows(request: DeleteRowsRequest): Promise<DeleteRowsResponse> {
    return new Promise((resolve, reject) => {
      this.client.deleteRows(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Query rows with filters and pagination
   */
  async queryRows(request: QueryRowsRequest): Promise<QueryRowsResponse> {
    return new Promise((resolve, reject) => {
      this.client.queryRows(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Get table statistics from Delta Lake metadata
   *
   * This method reads only the transaction log (_delta_log/*.json) to get
   * row count and file sizes without loading actual data files.
   * Much faster than loading all rows, especially for large tables.
   */
  async getTableStats(request: GetTableStatsRequest): Promise<GetTableStatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.getTableStats(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Close the gRPC connection
   */
  close(): void {
    this.client.close();
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return !!this.client;
  }
}