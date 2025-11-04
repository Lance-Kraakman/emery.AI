// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var agent_worker_pb = require('./agent_worker_pb.js');

function serialize_emery_agents_CancelMessageRequest(arg) {
  if (!(arg instanceof agent_worker_pb.CancelMessageRequest)) {
    throw new Error('Expected argument of type emery.agents.CancelMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_CancelMessageRequest(buffer_arg) {
  return agent_worker_pb.CancelMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_CancelMessageResponse(arg) {
  if (!(arg instanceof agent_worker_pb.CancelMessageResponse)) {
    throw new Error('Expected argument of type emery.agents.CancelMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_CancelMessageResponse(buffer_arg) {
  return agent_worker_pb.CancelMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_CancelTaskRequest(arg) {
  if (!(arg instanceof agent_worker_pb.CancelTaskRequest)) {
    throw new Error('Expected argument of type emery.agents.CancelTaskRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_CancelTaskRequest(buffer_arg) {
  return agent_worker_pb.CancelTaskRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_CancelTaskResponse(arg) {
  if (!(arg instanceof agent_worker_pb.CancelTaskResponse)) {
    throw new Error('Expected argument of type emery.agents.CancelTaskResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_CancelTaskResponse(buffer_arg) {
  return agent_worker_pb.CancelTaskResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_Empty(arg) {
  if (!(arg instanceof agent_worker_pb.Empty)) {
    throw new Error('Expected argument of type emery.agents.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_Empty(buffer_arg) {
  return agent_worker_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_ProcessMessageRequest(arg) {
  if (!(arg instanceof agent_worker_pb.ProcessMessageRequest)) {
    throw new Error('Expected argument of type emery.agents.ProcessMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_ProcessMessageRequest(buffer_arg) {
  return agent_worker_pb.ProcessMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_ProcessMessageResponse(arg) {
  if (!(arg instanceof agent_worker_pb.ProcessMessageResponse)) {
    throw new Error('Expected argument of type emery.agents.ProcessMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_ProcessMessageResponse(buffer_arg) {
  return agent_worker_pb.ProcessMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_TaskProgress(arg) {
  if (!(arg instanceof agent_worker_pb.TaskProgress)) {
    throw new Error('Expected argument of type emery.agents.TaskProgress');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_TaskProgress(buffer_arg) {
  return agent_worker_pb.TaskProgress.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_TaskRequest(arg) {
  if (!(arg instanceof agent_worker_pb.TaskRequest)) {
    throw new Error('Expected argument of type emery.agents.TaskRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_TaskRequest(buffer_arg) {
  return agent_worker_pb.TaskRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_emery_agents_WorkerInfo(arg) {
  if (!(arg instanceof agent_worker_pb.WorkerInfo)) {
    throw new Error('Expected argument of type emery.agents.WorkerInfo');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_emery_agents_WorkerInfo(buffer_arg) {
  return agent_worker_pb.WorkerInfo.deserializeBinary(new Uint8Array(buffer_arg));
}


// Service for executing agent tasks on worker instances
var AgentWorkerService = exports.AgentWorkerService = {
  // Execute a task and stream progress updates back to the API server
executeTask: {
    path: '/emery.agents.AgentWorker/ExecuteTask',
    requestStream: false,
    responseStream: true,
    requestType: agent_worker_pb.TaskRequest,
    responseType: agent_worker_pb.TaskProgress,
    requestSerialize: serialize_emery_agents_TaskRequest,
    requestDeserialize: deserialize_emery_agents_TaskRequest,
    responseSerialize: serialize_emery_agents_TaskProgress,
    responseDeserialize: deserialize_emery_agents_TaskProgress,
  },
  // Get worker health status and available skills
getWorkerInfo: {
    path: '/emery.agents.AgentWorker/GetWorkerInfo',
    requestStream: false,
    responseStream: false,
    requestType: agent_worker_pb.Empty,
    responseType: agent_worker_pb.WorkerInfo,
    requestSerialize: serialize_emery_agents_Empty,
    requestDeserialize: deserialize_emery_agents_Empty,
    responseSerialize: serialize_emery_agents_WorkerInfo,
    responseDeserialize: deserialize_emery_agents_WorkerInfo,
  },
  // Cancel a running task
cancelTask: {
    path: '/emery.agents.AgentWorker/CancelTask',
    requestStream: false,
    responseStream: false,
    requestType: agent_worker_pb.CancelTaskRequest,
    responseType: agent_worker_pb.CancelTaskResponse,
    requestSerialize: serialize_emery_agents_CancelTaskRequest,
    requestDeserialize: deserialize_emery_agents_CancelTaskRequest,
    responseSerialize: serialize_emery_agents_CancelTaskResponse,
    responseDeserialize: deserialize_emery_agents_CancelTaskResponse,
  },
};

exports.AgentWorkerClient = grpc.makeGenericClientConstructor(AgentWorkerService, 'AgentWorker');
// gRPC Chat Processing Service - AI operations only (stateless)
var ChatProcessingServiceService = exports.ChatProcessingServiceService = {
  // Process a message and stream AI response (no database operations)
processMessage: {
    path: '/emery.agents.ChatProcessingService/ProcessMessage',
    requestStream: false,
    responseStream: true,
    requestType: agent_worker_pb.ProcessMessageRequest,
    responseType: agent_worker_pb.ProcessMessageResponse,
    requestSerialize: serialize_emery_agents_ProcessMessageRequest,
    requestDeserialize: deserialize_emery_agents_ProcessMessageRequest,
    responseSerialize: serialize_emery_agents_ProcessMessageResponse,
    responseDeserialize: deserialize_emery_agents_ProcessMessageResponse,
  },
  // Cancel an in-progress message processing
cancelMessage: {
    path: '/emery.agents.ChatProcessingService/CancelMessage',
    requestStream: false,
    responseStream: false,
    requestType: agent_worker_pb.CancelMessageRequest,
    responseType: agent_worker_pb.CancelMessageResponse,
    requestSerialize: serialize_emery_agents_CancelMessageRequest,
    requestDeserialize: deserialize_emery_agents_CancelMessageRequest,
    responseSerialize: serialize_emery_agents_CancelMessageResponse,
    responseDeserialize: deserialize_emery_agents_CancelMessageResponse,
  },
};

exports.ChatProcessingServiceClient = grpc.makeGenericClientConstructor(ChatProcessingServiceService, 'ChatProcessingService');
