# Tools Registry Redesign - Reference-to-Execution Auto-binding

## Current Problem

The tools system has two disconnected parts:
1. **Reference tools**: `@doc:filename`, `@agent:name` (point to user data, don't execute)
2. **System tools**: `@tool:document_reader`, `@tool:python_repl` (can execute, don't know about user data)

## Proposed Solution: Auto-binding Architecture

### Core Concept: Smart @ Prefixes

When users type `@doc:myfile.pdf`, the system should:
1. Show available documents AND the `document_reader` capability
2. Auto-bind the reference to the execution tool
3. Execute `document_reader(document_id="myfile.pdf")` seamlessly

### Registry Structure Simplification

#### 1. Reference Execution Tools
Tools that can handle both reference context and execution:

```json
{
  "reference_execution_tools": [
    {
      "id": "doc_reader",
      "display_name": "Document Reader",
      "maps_to_references": ["@doc:", "@document:"],
      "backend_class": "DocumentReaderTool",
      "auto_bind_parameter": "document_id"
    },
    {
      "id": "doc_writer",
      "display_name": "Document Writer",
      "maps_to_references": ["@doc:", "@document:"],
      "backend_class": "DocumentWriterTool",
      "auto_bind_parameter": "document_id"
    },
    {
      "id": "table_query",
      "display_name": "Table Query",
      "maps_to_references": ["@table:"],
      "backend_class": "TableQueryTool",
      "auto_bind_parameter": "table_name"
    },
    {
      "id": "agent_reader",
      "display_name": "Agent Reader",
      "maps_to_references": ["@agent:"],
      "backend_class": "AgentReaderTool",
      "auto_bind_parameter": "agent_id"
    },
    {
      "id": "file_reader",
      "display_name": "File Reader",
      "maps_to_references": ["@file:"],
      "backend_class": "FileReaderTool",
      "auto_bind_parameter": "file_path"
    }
  ]
}
```

#### 2. System Tools
General utilities without reference context:

```json
{
  "system_tools": [
    {
      "id": "python_repl",
      "display_name": "Python REPL",
      "category": "utility",
      "backend_class": "PythonReplTool"
    },
    {
      "id": "web_search",
      "display_name": "Web Search",
      "category": "utility",
      "backend_class": "WebSearchTool"
    }
  ]
}
```

#### 3. Pipedream OAuth Tools
Loaded dynamically from metadata:

```json
{
  "pipedream_config": {
    "enabled": true,
    "metadata_path": "./emery-agents/src/emery_agents/execution/tools/pipedream_metadata.json",
    "load_strategy": "curated_only"
  }
}
```

### Auto-binding Implementation

#### ToolDropdown Enhancement
When user types `@doc:`:
1. **Show user's documents** from ReferenceToolSearch
2. **Show available capabilities**: `doc_reader`, `doc_writer`
3. **Smart autocomplete**: `@doc:myfile.pdf` + `(via doc_reader)`

#### CustomChatInput Processing
When message contains `@doc:myfile.pdf`:
1. **Auto-bind to execution tool**: Find `doc_reader` that maps to `@doc:`
2. **Inject reference context**: `doc_reader(document_id="myfile.pdf")`
3. **Transparent execution**: User just sees it working

### Benefits

1. **Simplified Mental Model**: `@doc:myfile.pdf` just works
2. **Unified Interface**: No confusion between references and execution
3. **Smart Autocomplete**: Shows both data and capabilities
4. **Backwards Compatible**: Existing references still work
5. **Smolagent Ready**: Maps directly to emery-agents tools

### Migration Strategy

#### Phase 1: Update Registry Structure
- Keep existing tools-registry.json format
- Add `maps_to_references` metadata to reference tools
- Update StaticToolRegistry to understand auto-binding

#### Phase 2: Enhance UI Components
- Update ToolDropdown to show references + capabilities
- Update CustomChatInput to auto-bind on send
- Maintain existing @ format display

#### Phase 3: Full Migration
- Replace tools-registry.json with simplified structure
- Remove legacy reference/execution separation
- Optimize for auto-binding performance

### Technical Implementation

#### Auto-binding Service
```typescript
interface AutoBindingService {
  bindReferenceToTool(reference: string): ToolBinding | null;
  getToolsForReference(prefix: string): ToolDTO[];
  executeWithContext(tool: ToolDTO, context: ReferenceContext): Promise<any>;
}

interface ToolBinding {
  tool: ToolDTO;
  parameter: string;
  value: string;
}
```

#### Updated ToolDTO
```typescript
interface ToolDTO {
  // ... existing fields
  mapsToReferences?: string[];  // ["@doc:", "@document:"]
  autoBindParameter?: string;   // "document_id"
}
```

This design provides a clean path forward while maintaining backwards compatibility and setting up the foundation for the auto-binding system.