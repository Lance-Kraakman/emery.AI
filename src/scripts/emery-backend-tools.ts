import { SimplifiedToolMetadata } from './fetch-pipedream-tools';

// Add Emery backend tools (hardcoded from actual Python implementations)
export const EMERY_BACKEND_TOOLS: Record<string, SimplifiedToolMetadata> = {
  // Base Tools (from base_tools.py)
  "file_reader": {
    id: "file_reader",
    app: "emery",
    name: "File Reader",
    description: "Read files from storage",
    type: "action",
    inputs: {
      file_path: {
        type: "string",
        description: "Path to the file to read",
        required: true
      }
    }
  },
  "document_reader": {
    id: "document_reader",
    app: "emery",
    name: "Document Reader",
    description: "Read documents",
    type: "action",
    inputs: {
      document_id: {
        type: "string",
        description: "Document ID to read",
        required: true
      }
    }
  },
  "table_query": {
    id: "table_query",
    app: "emery",
    name: "Table Query",
    description: "Query table data",
    type: "action",
    inputs: {
      query: {
        type: "string",
        description: "SQL query to execute",
        required: true
      }
    }
  },

  // CRUD Tools (from crud_tools.py)
  // AIDEV-NOTE: Tool names match category names directly (agents, tables, etc.)
  "agents": {
    id: "agents",
    app: "emery",
    name: "Agents",
    description: "Create, read, update, delete agents",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      agent_data: {
        type: "object",
        description: "Agent data for the operation",
        required: false
      }
    }
  },
  "documents": {
    id: "documents",
    app: "emery",
    name: "Documents",
    description: "Manage organization documents",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      document_data: {
        type: "object",
        description: "Document data for the operation",
        required: false
      }
    }
  },
  "files": {
    id: "files",
    app: "emery",
    name: "Files",
    description: "Manage organization files",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      file_data: {
        type: "object",
        description: "File data for the operation",
        required: false
      }
    }
  },
  "tables": {
    id: "tables",
    app: "emery",
    name: "Tables",
    description: "Comprehensive table and row management with 9 operations. TABLE: create_table (create new table), read_table (get details), update_table (modify metadata), delete_table (remove table), list_tables (list all). ROWS: create_row (add row), get_rows (query with pagination, default 100 rows), update_row (modify row), delete_row (remove row).",
    type: "action",
    inputs: {
      method: {
        type: "string",
        description: "Operation: create_table, read_table, update_table, delete_table, list_tables, create_row, get_rows, update_row, delete_row",
        required: true
      },
      table_id: {
        type: "string",
        description: "Table ID (required for most operations)",
        required: false
      },
      row_id: {
        type: "string",
        description: "Row ID (required for update_row, delete_row)",
        required: false
      },
      data: {
        type: "object",
        description: "Data payload. For create_table: {name, databaseId, description}. For create_row/update_row: field values {field_1: value1, field_2: value2}. For update_table: {name, description}",
        required: false
      },
      limit: {
        type: "number",
        description: "Max rows to return for get_rows (default: 100)",
        required: false
      },
      offset: {
        type: "number",
        description: "Pagination offset for get_rows (default: 0)",
        required: false
      },
      order_by: {
        type: "string",
        description: "Field to sort by for get_rows",
        required: false
      },
      order_direction: {
        type: "string",
        description: "Sort direction for get_rows: ASC or DESC",
        required: false
      },
      filters: {
        type: "object",
        description: "Filter criteria for queries",
        required: false
      }
    }
  },
  "teams": {
    id: "teams",
    app: "emery",
    name: "Teams",
    description: "Manage organization teams",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      team_data: {
        type: "object",
        description: "Team data for the operation",
        required: false
      }
    }
  },
  "databases": {
    id: "databases",
    app: "emery",
    name: "Databases",
    description: "Manage databases",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      database_data: {
        type: "object",
        description: "Database data for the operation",
        required: false
      }
    }
  },

  // Organizational Tools (from organizational_tools.py)
  "emery_database": {
    id: "emery_database",
    app: "emery",
    name: "Database Access",
    description: "Direct database access",
    type: "action",
    inputs: {
      query: {
        type: "string",
        description: "Database query to execute",
        required: true
      }
    }
  },
  "table_schema": {
    id: "table_schema",
    app: "emery",
    name: "Table Schema",
    description: "Get table schema information",
    type: "action",
    inputs: {
      table_name: {
        type: "string",
        description: "Name of the table",
        required: true
      }
    }
  },
  "table_data": {
    id: "table_data",
    app: "emery",
    name: "Table Data",
    description: "Access table data",
    type: "action",
    inputs: {
      table_name: {
        type: "string",
        description: "Name of the table",
        required: true
      },
      filters: {
        type: "object",
        description: "Filters to apply to the data",
        required: false
      }
    }
  },

  // API Tools (from api_tools.py)
  "measurement_api": {
    id: "measurement_api",
    app: "emery",
    name: "Measurement API",
    description: "Measurement data operations",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "API operation to perform",
        required: true
      },
      data: {
        type: "object",
        description: "Data for the operation",
        required: false
      }
    }
  },
  "kpi_api": {
    id: "kpi_api",
    app: "emery",
    name: "KPI API",
    description: "KPI management",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "API operation to perform",
        required: true
      },
      data: {
        type: "object",
        description: "Data for the operation",
        required: false
      }
    }
  },
  "analysis_api": {
    id: "analysis_api",
    app: "emery",
    name: "Analysis API",
    description: "Data analysis operations",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "API operation to perform",
        required: true
      },
      data: {
        type: "object",
        description: "Data for the operation",
        required: false
      }
    }
  },
  "process_api": {
    id: "process_api",
    app: "emery",
    name: "Process API",
    description: "Process management",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "API operation to perform",
        required: true
      },
      data: {
        type: "object",
        description: "Data for the operation",
        required: false
      }
    }
  },

  // AI Tools (from embedding_tool.py)
  "generate_embedding": {
    id: "generate_embedding",
    app: "emery",
    name: "Generate Embedding",
    description: "Generate vector embeddings for text using HuggingFace sentence-transformer models",
    type: "action",
    inputs: {
      text: {
        type: "string",
        description: "Text string or array of text strings to embed",
        required: true
      },
      model: {
        type: "string",
        description: "HuggingFace model ID (default: sentence-transformers/all-mpnet-base-v2). Supported models: all-mpnet-base-v2 (768d), all-MiniLM-L6-v2 (384d), all-MiniLM-L12-v2 (384d)",
        required: false
      },
      normalize: {
        type: "boolean",
        description: "Apply L2 normalization to embeddings (default: true)",
        required: false
      }
    }
  }
};
