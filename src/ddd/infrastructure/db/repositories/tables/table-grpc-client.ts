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
  AddFieldRequest,
  UpdateFieldRequest,
  DeleteFieldRequest,
  GetFieldsRequest,
  TableResponse,
  DeleteTableResponse,
  ListTablesResponse,
  CreateRowsResponse,
  GetRowsResponse,
  UpdateRowsResponse,
  DeleteRowsResponse,
  QueryRowsResponse,
  GetTableStatsResponse,
  FieldResponse,
  DeleteFieldResponse,
  GetFieldsResponse,
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
      ...config,
      // Use tools port for application operations to avoid circular dependency
      address: config.address || process.env.GRPC_TOOLS_ADDRESS || 'localhost:50052'
    };
    
    this.client = new TableServiceClient(
      this.config.address,
      grpc.credentials.createInsecure(),
      {
        'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
        'grpc.max_send_message_length': 4 * 1024 * 1024, // 4MB
        'grpc.max_concurrent_streams': 1000
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
/**
   * Create multiple rows in a table
   */
  async createRows(request: CreateRowsRequest): Promise<CreateRowsResponse> {
    const callId = `grpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] [TABLE-GRPC-CLIENT] CreateRows START - call_id: ${callId}, table_id: ${request.tableId}`);
    console.log(`[${timestamp}] [TABLE-GRPC-CLIENT] Request details - call_id: ${callId}, rows_count: ${request.rowsData.length}`);
    console.log(`[${timestamp}] [TABLE-GRPC-CLIENT] Request data preview - call_id: ${callId}, first_row_id: ${request.rowsData[0]?.id || 'N/A'}`);
    
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 30000;
      const deadline = new Date(Date.now() + timeout);
      const metadata = new grpc.Metadata();
      
      // Add tracking metadata
      metadata.add('x-call-id', callId);
      metadata.add('x-source', 'nextjs_repository');
      metadata.add('x-timeout', timeout.toString());
      
      console.log(`[${new Date().toISOString()}] [TABLE-GRPC-CLIENT] Making gRPC call - call_id: ${callId}, deadline: ${deadline.toISOString()}, timeout: ${timeout}ms`);
      console.log(`[${new Date().toISOString()}] [TABLE-GRPC-CLIENT] gRPC address: ${this.config.address} - call_id: ${callId}`);
      
      const grpcStart = Date.now();
      
      this.client.createRows(request, metadata, { deadline }, (error, response) => {
        const grpcTime = Date.now() - grpcStart;
        const totalTime = Date.now() - startTime;
        const responseTimestamp = new Date().toISOString();
        
        if (error) {
          console.error(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] ❌ ERROR - call_id: ${callId}, grpc_time: ${grpcTime}ms, total_time: ${totalTime}ms`);
          console.error(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] Error details - call_id: ${callId}, code: ${error.code}, message: ${error.message}`);
          console.error(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] Error stack - call_id: ${callId}`, error);
          reject(error);
        } else if (response) {
          console.log(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] ✅ SUCCESS - call_id: ${callId}, grpc_time: ${grpcTime}ms, total_time: ${totalTime}ms`);
          console.log(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] Response details - call_id: ${callId}, success: ${response.success}, rows_created: ${response.rowsCreated}`);
          resolve(response);
        } else {
          console.error(`[${responseTimestamp}] [TABLE-GRPC-CLIENT] ❌ NO_RESPONSE - call_id: ${callId}, grpc_time: ${grpcTime}ms, total_time: ${totalTime}ms`);
          reject(new Error('No response received from gRPC service'));
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
      const timeout = this.config.timeout || 30000;
      const deadline = new Date(Date.now() + timeout);
      const metadata = new grpc.Metadata();
      this.client.updateRows(request, metadata, { deadline }, (error, response) => {
        if (error) {
          reject(error);
        } else if (response) {
          resolve(response);
        } else {
          reject(new Error('No response received from gRPC service'));
        }
      });
    });
  }

  /**
    * Delete multiple rows
    */
  async deleteRows(request: DeleteRowsRequest): Promise<DeleteRowsResponse> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 30000;
      const deadline = new Date(Date.now() + timeout);
      const metadata = new grpc.Metadata();
      this.client.deleteRows(request, metadata, { deadline }, (error, response) => {
        if (error) {
          reject(error);
        } else if (response) {
          resolve(response);
        } else {
          reject(new Error('No response received from gRPC service'));
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
   * Add a new field to an existing table
   */
  async addField(request: AddFieldRequest): Promise<FieldResponse> {
    return new Promise((resolve, reject) => {
      this.client.addField(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Update an existing field in a table
   */
  async updateField(request: UpdateFieldRequest): Promise<FieldResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateField(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Delete a field from a table
   */
  async deleteField(request: DeleteFieldRequest): Promise<DeleteFieldResponse> {
    return new Promise((resolve, reject) => {
      this.client.deleteField(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response!);
        }
      });
    });
  }

  /**
   * Get all fields for a table
   */
  async getFields(request: GetFieldsRequest): Promise<GetFieldsResponse> {
    return new Promise((resolve, reject) => {
      this.client.getFields(request, (error, response) => {
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