# Emery System Architecture Analysis

## System Overview

Emery is a sophisticated AI agent orchestration platform built on a hybrid architecture combining NextJS frontend with Python gRPC workers, PostgreSQL with pgvector for vector search, and dynamic database management capabilities.

## Data Communication Interface Map

### 1. Cross-System Communication Flow

```
┌─────────────────┐    HTTP/Server Actions    ┌──────────────────┐
│   NextJS App    │ ←─────────────────────────→ │   Dynamic DB     │
│   (Frontend)    │                            │   (PostgreSQL)   │
└─────────────────┘                            └──────────────────┘
         │                                              │
         │ gRPC Streaming                               │ pgvector Search
         ▼                                              ▼
┌─────────────────┐    Protocol Buffers       ┌──────────────────┐
│ Python Workers  │ ←─────────────────────────→ │   RAG Service    │
│ (Agent Exec)    │                            │   (Vector DB)    │
└─────────────────┘                            └──────────────────┘
         │                                              │
         │ Tool/OAuth API Calls                         │ HF Embeddings
         ▼                                              ▼
┌─────────────────┐    OAuth Proxy             ┌──────────────────┐
│ External APIs   │ ←─────────────────────────→ │  HuggingFace     │
│ (Gmail, Slack)  │                            │   (AI Models)    │
└─────────────────┘                            └──────────────────┘
```

### 2. Component-to-Component Interface Matrix

| Source Component | Target Component | Interface Type | Data Format | Authentication |
|------------------|------------------|----------------|-------------|----------------|
| NextJS Frontend | Dynamic Database | Server Actions | TypeScript Types | Session-based |
| NextJS Frontend | gRPC Workers | gRPC Streaming | Protocol Buffers | Organization ID |
| NextJS Frontend | RAG Service | HTTP API | JSON + Vectors | Session-based |
| NextJS Frontend | External APIs | OAuth Proxy | JSON | User OAuth Tokens |
| gRPC Workers | Dynamic Database | SQL Queries | Raw SQL + JSONB | Connection Pool |
| gRPC Workers | External APIs | HTTP/OAuth | JSON API Calls | Delegated Tokens |
| RAG Service | HuggingFace | HTTP API | JSON + Embeddings | HF Token |
| RAG Service | Dynamic Database | Vector Search | pgvector Queries | Connection Pool |
| Scheduler | gRPC Workers | gRPC Calls | Protocol Buffers | Organization ID |
| Scheduler | Dynamic Database | SQL Triggers | LISTEN/NOTIFY | Connection Pool |

## 3. Key Interface Definitions

### NextJS ↔ Dynamic Database
```typescript
// Server Actions interface
interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Dynamic table operations
interface CreateRowData {
  tableId: number;
  data: Record<string, any>; // Field slug → value
}

// Field management
interface CreateFieldData {
  tableId: number;
  name: string;
  type: FieldType;
  required: boolean;
}
```

### NextJS ↔ gRPC Workers
```typescript
// Agent execution request
interface AgentExecutionRequest {
  agentId: number;
  instructions: string;
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>;
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>;
  executionId: string;
  metadata?: Record<string, any>;
}

// Streaming progress updates
interface TaskProgress {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  step_id?: string;
  progress_percent: number;
  output_data?: any;
  error?: string;
}
```

### NextJS ↔ RAG Service
```typescript
// Vector search interface
interface RagSearchRequest {
  indexId: string;
  query: string;
  limit?: number;
  threshold?: number;
  userId?: string;
  sessionId?: string;
}

interface RagSearchResult {
  documents: Array<{
    id: string;
    title: string;
    content: string;
    sourceType: string;
    sourceName: string;
    similarity: number;
  }>;
  totalResults: number;
}
```

### gRPC Workers ↔ External APIs
```typescript
// OAuth proxy interface
interface OAuthProxyRequest {
  service: string; // 'gmail', 'slack', 'github'
  action: string;  // 'send_email', 'post_message'
  params: Record<string, any>;
  agentId: number;
}

interface OAuthProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
}
```

## 4. Data Flow Patterns

### Agent Execution Flow
```
1. User Request (NextJS)
   ↓ Server Action
2. Agent Lookup (Database)
   ↓ gRPC Request
3. Worker Execution (Python)
   ↓ Streaming Updates
4. Real-time Progress (Database)
   ↓ OAuth API Calls
5. External Service Interaction
   ↓ Result Aggregation
6. Final Response (NextJS)
```

### RAG-Enhanced Chat Flow
```
1. User Query (Chat UI)
   ↓ HuggingFace Embedding
2. Vector Search (pgvector)
   ↓ Context Retrieval
3. Enhanced Prompt (RAG Context)
   ↓ AI Model Inference
4. Contextual Response (Streaming)
   ↓ Source Attribution
5. User Interface Update
```

### Scheduler Trigger Flow
```
1. Trigger Event (CRON/DB/Webhook)
   ↓ Agent Resolution
2. Task Creation (Database)
   ↓ gRPC Execution
3. Worker Processing (Python)
   ↓ Status Updates
4. Completion Tracking (Database)
```

## 5. Security and Authentication Patterns

### Multi-Layer Authentication
```
Layer 1: NextAuth Session (Frontend access)
Layer 2: Organization RBAC (Resource access)
Layer 3: Agent Ownership (Agent execution)
Layer 4: OAuth Delegation (External APIs)
```

### API Security Patterns
- **HMAC Signatures**: Webhook verification
- **Bearer Tokens**: Agent API keys
- **Session Cookies**: Frontend authentication
- **OAuth Tokens**: External service access
- **SQL Parameterization**: Injection prevention

## 6. Performance and Scalability Patterns

### Database Optimization
- **Connection Pooling**: Shared postgres client
- **Vector Indexing**: pgvector IVFFlat indexes
- **JSONB Indexes**: GIN indexes for relation fields
- **Query Optimization**: Parameterized queries

### gRPC Performance
- **Streaming**: Real-time progress updates
- **Connection Reuse**: Worker connection pooling
- **Organization Routing**: Multi-tenant worker discovery
- **Health Monitoring**: 30-second cached health checks

### Frontend Performance
- **Server Components**: Reduced client-side JavaScript
- **Code Splitting**: Feature-based component loading
- **State Management**: Efficient React patterns
- **Cache Invalidation**: Automatic via revalidatePath()

## 7. Error Handling and Resilience

### Error Propagation Patterns
```
Python Worker Error
  ↓ gRPC Status
NextJS gRPC Client
  ↓ Database Update
Task Status: 'failed'
  ↓ User Notification
Frontend Error Display
```

### Graceful Degradation
- **Partial System Failures**: Components continue operating
- **Fallback Mechanisms**: Alternative processing paths
- **Error Isolation**: Failed components don't affect others
- **Recovery Patterns**: Automatic retry and reconnection

## 8. Integration Points Summary

### Critical Integration Points
1. **gRPC Protocol Buffers**: Type-safe Python ↔ TypeScript communication
2. **Server Actions**: Type-safe frontend ↔ database operations  
3. **OAuth Proxy**: Secure external API integration
4. **Vector Search**: RAG-enhanced AI responses
5. **Database Triggers**: Real-time event processing
6. **Streaming APIs**: Long-running task monitoring

### Technology Stack Integration
- **NextJS 15**: App Router with Server Actions
- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL + pgvector**: Hybrid SQL + vector storage
- **Protocol Buffers**: Cross-language serialization
- **HuggingFace**: AI model inference and embeddings
- **NextAuth v4**: Session management and OAuth

This architecture demonstrates a sophisticated distributed system with clear separation of concerns, type safety across boundaries, and robust integration patterns that support the complex requirements of an AI agent orchestration platform.