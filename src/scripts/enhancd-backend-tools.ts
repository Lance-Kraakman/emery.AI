import { SimplifiedToolMetadata } from './fetch-pipedream-tools';

// Add enhancd.ai backend tools (hardcoded from actual Python implementations)
export const ENHANCD_BACKEND_TOOLS: Record<string, SimplifiedToolMetadata> = {
  // Base Tools (from base_tools.py)
  "file_reader": {
    id: "file_reader",
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
  // AIDEV-NOTE: Split into individual action tools to match Pipedream pattern
  // Naming convention: enhancd-{action}-{resource}

  // Agent CRUD Operations
  "enhancd-create-agent": {
    id: "enhancd-create-agent",
    app: "enhancd",
    name: "Create Agent",
    description: "Create a new AI agent",
    type: "action",
    inputs: {
      data: {
        type: "object",
        description: "Agent configuration data (name, role, description, etc.)",
        required: true
      }
    }
  },
  "enhancd-read-agent": {
    id: "enhancd-read-agent",
    app: "enhancd",
    name: "Read Agent",
    description: "Get details of a specific agent",
    type: "action",
    inputs: {
      agent_id: {
        type: "string",
        description: "Agent ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-agent": {
    id: "enhancd-update-agent",
    app: "enhancd",
    name: "Update Agent",
    description: "Update an existing agent",
    type: "action",
    inputs: {
      agent_id: {
        type: "string",
        description: "Agent ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated agent data",
        required: true
      }
    }
  },
  "enhancd-delete-agent": {
    id: "enhancd-delete-agent",
    app: "enhancd",
    name: "Delete Agent",
    description: "Delete an agent",
    type: "action",
    inputs: {
      agent_id: {
        type: "string",
        description: "Agent ID to delete",
        required: true
      }
    }
  },
  "enhancd-list-agents": {
    id: "enhancd-list-agents",
    app: "enhancd",
    name: "List Agents",
    description: "List all agents in the organization",
    type: "action",
    inputs: {}
  },

  // Document CRUD Operations
  "enhancd-create-document": {
    id: "enhancd-create-document",
    app: "enhancd",
    name: "Create Document",
    description: "Create a new document",
    type: "action",
    inputs: {
      data: {
        type: "object",
        description: "Document data",
        required: true
      }
    }
  },
  "enhancd-read-document": {
    id: "enhancd-read-document",
    app: "enhancd",
    name: "Read Document",
    description: "Get document details",
    type: "action",
    inputs: {
      document_id: {
        type: "string",
        description: "Document ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-document": {
    id: "enhancd-update-document",
    app: "enhancd",
    name: "Update Document",
    description: "Update an existing document",
    type: "action",
    inputs: {
      document_id: {
        type: "string",
        description: "Document ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated document data",
        required: true
      }
    }
  },
  "enhancd-delete-document": {
    id: "enhancd-delete-document",
    app: "enhancd",
    name: "Delete Document",
    description: "Delete a document",
    type: "action",
    inputs: {
      document_id: {
        type: "string",
        description: "Document ID to delete",
        required: true
      }
    }
  },
  "enhancd-list-documents": {
    id: "enhancd-list-documents",
    app: "enhancd",
    name: "List Documents",
    description: "List all documents in the organization",
    type: "action",
    inputs: {}
  },

  // File CRUD Operations
  "enhancd-create-file": {
    id: "enhancd-create-file",
    app: "enhancd",
    name: "Create File",
    description: "Upload a new file",
    type: "action",
    inputs: {
      data: {
        type: "object",
        description: "File data",
        required: true
      }
    }
  },
  "enhancd-read-file": {
    id: "enhancd-read-file",
    app: "enhancd",
    name: "Read File",
    description: "Get file details",
    type: "action",
    inputs: {
      file_id: {
        type: "string",
        description: "File ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-file": {
    id: "enhancd-update-file",
    app: "enhancd",
    name: "Update File",
    description: "Update file metadata",
    type: "action",
    inputs: {
      file_id: {
        type: "string",
        description: "File ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated file data",
        required: true
      }
    }
  },
  "enhancd-delete-file": {
    id: "enhancd-delete-file",
    app: "enhancd",
    name: "Delete File",
    description: "Delete a file",
    type: "action",
    inputs: {
      file_id: {
        type: "string",
        description: "File ID to delete",
        required: true
      }
    }
  },

  // Table Operations
  "enhancd-create-table": {
    id: "enhancd-create-table",
    app: "enhancd",
    name: "Create Table",
    description: "Create a new table in a database",
    type: "action",
    inputs: {
      name: {
        type: "string",
        description: "Table name",
        required: true
      },
      database_id: {
        type: "number",
        description: "Database ID where the table will be created",
        required: true
      },
      description: {
        type: "string",
        description: "Table description",
        required: false
      }
    }
  },
  "enhancd-read-table": {
    id: "enhancd-read-table",
    app: "enhancd",
    name: "Read Table",
    description: "Get table details and metadata",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-table": {
    id: "enhancd-update-table",
    app: "enhancd",
    name: "Update Table",
    description: "Update table metadata (name, description)",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated table data (name, description)",
        required: true
      }
    }
  },
  "enhancd-delete-table": {
    id: "enhancd-delete-table",
    app: "enhancd",
    name: "Delete Table",
    description: "Delete a table and all its data",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID to delete",
        required: true
      }
    }
  },
  "enhancd-list-tables": {
    id: "enhancd-list-tables",
    app: "enhancd",
    name: "List Tables",
    description: "List all tables in the organization",
    type: "action",
    inputs: {}
  },

  // Row Operations
  "enhancd-create-row": {
    id: "enhancd-create-row",
    app: "enhancd",
    name: "Create Row",
    description: "Add a new row to a table",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID where the row will be created",
        required: true
      },
      data: {
        type: "object",
        description: "Row field values (field_name: value)",
        required: true
      }
    }
  },
  "enhancd-get-rows": {
    id: "enhancd-get-rows",
    app: "enhancd",
    name: "Get Rows",
    description: "Query rows from a table with pagination and filtering",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID to query",
        required: true
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return (default: 100)",
        required: false
      },
      offset: {
        type: "number",
        description: "Pagination offset (default: 0)",
        required: false
      },
      order_by: {
        type: "string",
        description: "Field to sort by",
        required: false
      },
      order_direction: {
        type: "string",
        description: "Sort direction: ASC or DESC",
        required: false
      },
      filters: {
        type: "object",
        description: "Filter criteria",
        required: false
      }
    }
  },
  "enhancd-update-row": {
    id: "enhancd-update-row",
    app: "enhancd",
    name: "Update Row",
    description: "Update an existing row in a table",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID containing the row",
        required: true
      },
      row_id: {
        type: "string",
        description: "Row ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated field values",
        required: true
      }
    }
  },
  "enhancd-delete-row": {
    id: "enhancd-delete-row",
    app: "enhancd",
    name: "Delete Row",
    description: "Delete a row from a table",
    type: "action",
    inputs: {
      table_id: {
        type: "string",
        description: "Table ID containing the row",
        required: true
      },
      row_id: {
        type: "string",
        description: "Row ID to delete",
        required: true
      }
    }
  },

  // Team CRUD Operations
  "enhancd-create-team": {
    id: "enhancd-create-team",
    app: "enhancd",
    name: "Create Team",
    description: "Create a new team",
    type: "action",
    inputs: {
      data: {
        type: "object",
        description: "Team data",
        required: true
      }
    }
  },
  "enhancd-read-team": {
    id: "enhancd-read-team",
    app: "enhancd",
    name: "Read Team",
    description: "Get team details",
    type: "action",
    inputs: {
      team_id: {
        type: "string",
        description: "Team ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-team": {
    id: "enhancd-update-team",
    app: "enhancd",
    name: "Update Team",
    description: "Update an existing team",
    type: "action",
    inputs: {
      team_id: {
        type: "string",
        description: "Team ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated team data",
        required: true
      }
    }
  },
  "enhancd-delete-team": {
    id: "enhancd-delete-team",
    app: "enhancd",
    name: "Delete Team",
    description: "Delete a team",
    type: "action",
    inputs: {
      team_id: {
        type: "string",
        description: "Team ID to delete",
        required: true
      }
    }
  },
  "enhancd-list-teams": {
    id: "enhancd-list-teams",
    app: "enhancd",
    name: "List Teams",
    description: "List all teams in the organization",
    type: "action",
    inputs: {}
  },

  // Skill CRUD Operations
  "enhancd-read-skill": {
    id: "enhancd-read-skill",
    app: "enhancd",
    name: "Read Skill",
    description: "Get skill details including name, description, instructions, inputs, outputs, tools, and model configuration",
    type: "action",
    inputs: {
      skill_id: {
        type: "string",
        description: "Skill ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-skill": {
    id: "enhancd-update-skill",
    app: "enhancd",
    name: "Update Skill",
    description: "Update an existing skill's configuration including name, description, instructions, inputs, outputs, tools, and model",
    type: "action",
    inputs: {
      skill_id: {
        type: "string",
        description: "Skill ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated skill data. Can include: name, description, instructions, inputs (array of {name, type, required, description}), outputs (array of {name, type, description}), tools (array of tool configs), model (string or null)",
        required: true
      }
    }
  },
  "enhancd-list-skills": {
    id: "enhancd-list-skills",
    app: "enhancd",
    name: "List Skills",
    description: "List all skills in the organization, optionally filtered by agent",
    type: "action",
    inputs: {
      agent_id: {
        type: "string",
        description: "Optional agent ID to filter skills for a specific agent",
        required: false
      }
    }
  },

  // Database CRUD Operations
  "enhancd-create-database": {
    id: "enhancd-create-database",
    app: "enhancd",
    name: "Create Database",
    description: "Create a new database",
    type: "action",
    inputs: {
      data: {
        type: "object",
        description: "Database data (name, description)",
        required: true
      }
    }
  },
  "enhancd-read-database": {
    id: "enhancd-read-database",
    app: "enhancd",
    name: "Read Database",
    description: "Get database details",
    type: "action",
    inputs: {
      database_id: {
        type: "string",
        description: "Database ID to retrieve",
        required: true
      }
    }
  },
  "enhancd-update-database": {
    id: "enhancd-update-database",
    app: "enhancd",
    name: "Update Database",
    description: "Update database metadata",
    type: "action",
    inputs: {
      database_id: {
        type: "string",
        description: "Database ID to update",
        required: true
      },
      data: {
        type: "object",
        description: "Updated database data",
        required: true
      }
    }
  },
  "enhancd-delete-database": {
    id: "enhancd-delete-database",
    app: "enhancd",
    name: "Delete Database",
    description: "Delete a database",
    type: "action",
    inputs: {
      database_id: {
        type: "string",
        description: "Database ID to delete",
        required: true
      }
    }
  },
  "enhancd-list-databases": {
    id: "enhancd-list-databases",
    app: "enhancd",
    name: "List Databases",
    description: "List all databases in the organization",
    type: "action",
    inputs: {}
  },

  // Organizational Tools (from organizational_tools.py)
  "enhancd_database": {
    id: "enhancd_database",
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
    app: "enhancd",
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
