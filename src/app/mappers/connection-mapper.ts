import type { Connection } from '@/src/ddd/domain/connections/entities/connection';

export interface ConnectionDTO {
  id: string;
  app: string;
  account_name: string;
  status: string;
  raw_status?: string;
  created_at: string;
  updated_at: string;
}

export class ConnectionMapper {
  /**
   * Convert domain Connection entity to DTO for UI consumption
   * Maintains compatibility with existing NormalizedConnection interface
   */
  static toDTO(connection: Connection): ConnectionDTO {
    return {
      id: connection.connectionId.value,
      app: connection.appName.value,
      account_name: connection.accountName,
      status: connection.status,
      raw_status: connection.status,
      created_at: connection.connectedAt.toISOString(),
      updated_at: connection.connectedAt.toISOString(), // Use connectedAt as updated_at for now
    };
  }

  /**
   * Convert array of domain entities to DTOs
   */
  static toDTOArray(connections: Connection[]): ConnectionDTO[] {
    return connections.map(connection => this.toDTO(connection));
  }
}