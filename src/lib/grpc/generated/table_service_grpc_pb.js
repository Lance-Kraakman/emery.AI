// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var table_service_pb = require('./table_service_pb.js');

function serialize_emery_tables_AddFieldRequest(arg) {
  if (!(arg instanceof table_service_pb.AddFieldRequest)) {
    throw new Error('Expected argument of type emery.tables.AddFieldRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_AddFieldRequest(buffer_arg) {
  return table_service_pb.AddFieldRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_CreateRowsRequest(arg) {
  if (!(arg instanceof table_service_pb.CreateRowsRequest)) {
    throw new Error('Expected argument of type emery.tables.CreateRowsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_CreateRowsRequest(buffer_arg) {
  return table_service_pb.CreateRowsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_CreateRowsResponse(arg) {
  if (!(arg instanceof table_service_pb.CreateRowsResponse)) {
    throw new Error('Expected argument of type emery.tables.CreateRowsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_CreateRowsResponse(buffer_arg) {
  return table_service_pb.CreateRowsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_CreateTableRequest(arg) {
  if (!(arg instanceof table_service_pb.CreateTableRequest)) {
    throw new Error('Expected argument of type emery.tables.CreateTableRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_CreateTableRequest(buffer_arg) {
  return table_service_pb.CreateTableRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteFieldRequest(arg) {
  if (!(arg instanceof table_service_pb.DeleteFieldRequest)) {
    throw new Error('Expected argument of type emery.tables.DeleteFieldRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteFieldRequest(buffer_arg) {
  return table_service_pb.DeleteFieldRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteFieldResponse(arg) {
  if (!(arg instanceof table_service_pb.DeleteFieldResponse)) {
    throw new Error('Expected argument of type emery.tables.DeleteFieldResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteFieldResponse(buffer_arg) {
  return table_service_pb.DeleteFieldResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteRowsRequest(arg) {
  if (!(arg instanceof table_service_pb.DeleteRowsRequest)) {
    throw new Error('Expected argument of type emery.tables.DeleteRowsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteRowsRequest(buffer_arg) {
  return table_service_pb.DeleteRowsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteRowsResponse(arg) {
  if (!(arg instanceof table_service_pb.DeleteRowsResponse)) {
    throw new Error('Expected argument of type emery.tables.DeleteRowsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteRowsResponse(buffer_arg) {
  return table_service_pb.DeleteRowsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteTableRequest(arg) {
  if (!(arg instanceof table_service_pb.DeleteTableRequest)) {
    throw new Error('Expected argument of type emery.tables.DeleteTableRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteTableRequest(buffer_arg) {
  return table_service_pb.DeleteTableRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_DeleteTableResponse(arg) {
  if (!(arg instanceof table_service_pb.DeleteTableResponse)) {
    throw new Error('Expected argument of type emery.tables.DeleteTableResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_DeleteTableResponse(buffer_arg) {
  return table_service_pb.DeleteTableResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_FieldResponse(arg) {
  if (!(arg instanceof table_service_pb.FieldResponse)) {
    throw new Error('Expected argument of type emery.tables.FieldResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_FieldResponse(buffer_arg) {
  return table_service_pb.FieldResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetFieldsRequest(arg) {
  if (!(arg instanceof table_service_pb.GetFieldsRequest)) {
    throw new Error('Expected argument of type emery.tables.GetFieldsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetFieldsRequest(buffer_arg) {
  return table_service_pb.GetFieldsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetFieldsResponse(arg) {
  if (!(arg instanceof table_service_pb.GetFieldsResponse)) {
    throw new Error('Expected argument of type emery.tables.GetFieldsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetFieldsResponse(buffer_arg) {
  return table_service_pb.GetFieldsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetRowsRequest(arg) {
  if (!(arg instanceof table_service_pb.GetRowsRequest)) {
    throw new Error('Expected argument of type emery.tables.GetRowsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetRowsRequest(buffer_arg) {
  return table_service_pb.GetRowsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetRowsResponse(arg) {
  if (!(arg instanceof table_service_pb.GetRowsResponse)) {
    throw new Error('Expected argument of type emery.tables.GetRowsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetRowsResponse(buffer_arg) {
  return table_service_pb.GetRowsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetTableRequest(arg) {
  if (!(arg instanceof table_service_pb.GetTableRequest)) {
    throw new Error('Expected argument of type emery.tables.GetTableRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetTableRequest(buffer_arg) {
  return table_service_pb.GetTableRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetTableStatsRequest(arg) {
  if (!(arg instanceof table_service_pb.GetTableStatsRequest)) {
    throw new Error('Expected argument of type emery.tables.GetTableStatsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetTableStatsRequest(buffer_arg) {
  return table_service_pb.GetTableStatsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_GetTableStatsResponse(arg) {
  if (!(arg instanceof table_service_pb.GetTableStatsResponse)) {
    throw new Error('Expected argument of type emery.tables.GetTableStatsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_GetTableStatsResponse(buffer_arg) {
  return table_service_pb.GetTableStatsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_ListTablesRequest(arg) {
  if (!(arg instanceof table_service_pb.ListTablesRequest)) {
    throw new Error('Expected argument of type emery.tables.ListTablesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_ListTablesRequest(buffer_arg) {
  return table_service_pb.ListTablesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_ListTablesResponse(arg) {
  if (!(arg instanceof table_service_pb.ListTablesResponse)) {
    throw new Error('Expected argument of type emery.tables.ListTablesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_ListTablesResponse(buffer_arg) {
  return table_service_pb.ListTablesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_QueryRowsRequest(arg) {
  if (!(arg instanceof table_service_pb.QueryRowsRequest)) {
    throw new Error('Expected argument of type emery.tables.QueryRowsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_QueryRowsRequest(buffer_arg) {
  return table_service_pb.QueryRowsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_QueryRowsResponse(arg) {
  if (!(arg instanceof table_service_pb.QueryRowsResponse)) {
    throw new Error('Expected argument of type emery.tables.QueryRowsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_QueryRowsResponse(buffer_arg) {
  return table_service_pb.QueryRowsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_TableResponse(arg) {
  if (!(arg instanceof table_service_pb.TableResponse)) {
    throw new Error('Expected argument of type emery.tables.TableResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_TableResponse(buffer_arg) {
  return table_service_pb.TableResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_UpdateFieldRequest(arg) {
  if (!(arg instanceof table_service_pb.UpdateFieldRequest)) {
    throw new Error('Expected argument of type emery.tables.UpdateFieldRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_UpdateFieldRequest(buffer_arg) {
  return table_service_pb.UpdateFieldRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_UpdateRowsRequest(arg) {
  if (!(arg instanceof table_service_pb.UpdateRowsRequest)) {
    throw new Error('Expected argument of type emery.tables.UpdateRowsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_UpdateRowsRequest(buffer_arg) {
  return table_service_pb.UpdateRowsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_UpdateRowsResponse(arg) {
  if (!(arg instanceof table_service_pb.UpdateRowsResponse)) {
    throw new Error('Expected argument of type emery.tables.UpdateRowsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_UpdateRowsResponse(buffer_arg) {
  return table_service_pb.UpdateRowsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_tables_UpdateTableRequest(arg) {
  if (!(arg instanceof table_service_pb.UpdateTableRequest)) {
    throw new Error('Expected argument of type emery.tables.UpdateTableRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_tables_UpdateTableRequest(buffer_arg) {
  return table_service_pb.UpdateTableRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


// Delta Lake Table Service - Handles table and row operations using Delta Lake
var TableServiceService = exports.TableServiceService = {
  createTable: {
    path: '/emery.tables.TableService/CreateTable',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.CreateTableRequest,
    responseType: table_service_pb.TableResponse,
    requestSerialize: serialize_emery_tables_CreateTableRequest,
    requestDeserialize: deserialize_emery_tables_CreateTableRequest,
    responseSerialize: serialize_emery_tables_TableResponse,
    responseDeserialize: deserialize_emery_tables_TableResponse,
  },
  getTable: {
    path: '/emery.tables.TableService/GetTable',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.GetTableRequest,
    responseType: table_service_pb.TableResponse,
    requestSerialize: serialize_emery_tables_GetTableRequest,
    requestDeserialize: deserialize_emery_tables_GetTableRequest,
    responseSerialize: serialize_emery_tables_TableResponse,
    responseDeserialize: deserialize_emery_tables_TableResponse,
  },
  updateTable: {
    path: '/emery.tables.TableService/UpdateTable',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.UpdateTableRequest,
    responseType: table_service_pb.TableResponse,
    requestSerialize: serialize_emery_tables_UpdateTableRequest,
    requestDeserialize: deserialize_emery_tables_UpdateTableRequest,
    responseSerialize: serialize_emery_tables_TableResponse,
    responseDeserialize: deserialize_emery_tables_TableResponse,
  },
  deleteTable: {
    path: '/emery.tables.TableService/DeleteTable',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.DeleteTableRequest,
    responseType: table_service_pb.DeleteTableResponse,
    requestSerialize: serialize_emery_tables_DeleteTableRequest,
    requestDeserialize: deserialize_emery_tables_DeleteTableRequest,
    responseSerialize: serialize_emery_tables_DeleteTableResponse,
    responseDeserialize: deserialize_emery_tables_DeleteTableResponse,
  },
  listTables: {
    path: '/emery.tables.TableService/ListTables',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.ListTablesRequest,
    responseType: table_service_pb.ListTablesResponse,
    requestSerialize: serialize_emery_tables_ListTablesRequest,
    requestDeserialize: deserialize_emery_tables_ListTablesRequest,
    responseSerialize: serialize_emery_tables_ListTablesResponse,
    responseDeserialize: deserialize_emery_tables_ListTablesResponse,
  },
  // Row operations with strong typing (bulk operations)
createRows: {
    path: '/emery.tables.TableService/CreateRows',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.CreateRowsRequest,
    responseType: table_service_pb.CreateRowsResponse,
    requestSerialize: serialize_emery_tables_CreateRowsRequest,
    requestDeserialize: deserialize_emery_tables_CreateRowsRequest,
    responseSerialize: serialize_emery_tables_CreateRowsResponse,
    responseDeserialize: deserialize_emery_tables_CreateRowsResponse,
  },
  getRows: {
    path: '/emery.tables.TableService/GetRows',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.GetRowsRequest,
    responseType: table_service_pb.GetRowsResponse,
    requestSerialize: serialize_emery_tables_GetRowsRequest,
    requestDeserialize: deserialize_emery_tables_GetRowsRequest,
    responseSerialize: serialize_emery_tables_GetRowsResponse,
    responseDeserialize: deserialize_emery_tables_GetRowsResponse,
  },
  updateRows: {
    path: '/emery.tables.TableService/UpdateRows',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.UpdateRowsRequest,
    responseType: table_service_pb.UpdateRowsResponse,
    requestSerialize: serialize_emery_tables_UpdateRowsRequest,
    requestDeserialize: deserialize_emery_tables_UpdateRowsRequest,
    responseSerialize: serialize_emery_tables_UpdateRowsResponse,
    responseDeserialize: deserialize_emery_tables_UpdateRowsResponse,
  },
  deleteRows: {
    path: '/emery.tables.TableService/DeleteRows',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.DeleteRowsRequest,
    responseType: table_service_pb.DeleteRowsResponse,
    requestSerialize: serialize_emery_tables_DeleteRowsRequest,
    requestDeserialize: deserialize_emery_tables_DeleteRowsRequest,
    responseSerialize: serialize_emery_tables_DeleteRowsResponse,
    responseDeserialize: deserialize_emery_tables_DeleteRowsResponse,
  },
  // Zero-copy Arrow IPC query (updated to use Arrow IPC for performance)
queryRows: {
    path: '/emery.tables.TableService/QueryRows',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.QueryRowsRequest,
    responseType: table_service_pb.QueryRowsResponse,
    requestSerialize: serialize_emery_tables_QueryRowsRequest,
    requestDeserialize: deserialize_emery_tables_QueryRowsRequest,
    responseSerialize: serialize_emery_tables_QueryRowsResponse,
    responseDeserialize: deserialize_emery_tables_QueryRowsResponse,
  },
  // Get table statistics from Delta Lake metadata (no data loading)
getTableStats: {
    path: '/emery.tables.TableService/GetTableStats',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.GetTableStatsRequest,
    responseType: table_service_pb.GetTableStatsResponse,
    requestSerialize: serialize_emery_tables_GetTableStatsRequest,
    requestDeserialize: deserialize_emery_tables_GetTableStatsRequest,
    responseSerialize: serialize_emery_tables_GetTableStatsResponse,
    responseDeserialize: deserialize_emery_tables_GetTableStatsResponse,
  },
  // Field management operations for dynamic table schema evolution
addField: {
    path: '/emery.tables.TableService/AddField',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.AddFieldRequest,
    responseType: table_service_pb.FieldResponse,
    requestSerialize: serialize_emery_tables_AddFieldRequest,
    requestDeserialize: deserialize_emery_tables_AddFieldRequest,
    responseSerialize: serialize_emery_tables_FieldResponse,
    responseDeserialize: deserialize_emery_tables_FieldResponse,
  },
  updateField: {
    path: '/emery.tables.TableService/UpdateField',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.UpdateFieldRequest,
    responseType: table_service_pb.FieldResponse,
    requestSerialize: serialize_emery_tables_UpdateFieldRequest,
    requestDeserialize: deserialize_emery_tables_UpdateFieldRequest,
    responseSerialize: serialize_emery_tables_FieldResponse,
    responseDeserialize: deserialize_emery_tables_FieldResponse,
  },
  deleteField: {
    path: '/emery.tables.TableService/DeleteField',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.DeleteFieldRequest,
    responseType: table_service_pb.DeleteFieldResponse,
    requestSerialize: serialize_emery_tables_DeleteFieldRequest,
    requestDeserialize: deserialize_emery_tables_DeleteFieldRequest,
    responseSerialize: serialize_emery_tables_DeleteFieldResponse,
    responseDeserialize: deserialize_emery_tables_DeleteFieldResponse,
  },
  getFields: {
    path: '/emery.tables.TableService/GetFields',
    requestStream: false,
    responseStream: false,
    requestType: table_service_pb.GetFieldsRequest,
    responseType: table_service_pb.GetFieldsResponse,
    requestSerialize: serialize_emery_tables_GetFieldsRequest,
    requestDeserialize: deserialize_emery_tables_GetFieldsRequest,
    responseSerialize: serialize_emery_tables_GetFieldsResponse,
    responseDeserialize: deserialize_emery_tables_GetFieldsResponse,
  },
};

exports.TableServiceClient = grpc.makeGenericClientConstructor(TableServiceService, 'TableService');
