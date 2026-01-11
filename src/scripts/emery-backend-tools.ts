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
  // AIDEV-NOTE: Split into individual action tools to match Pipedream pattern
  // Naming convention: emery-{action}-{resource}

  // Agent CRUD Operations
  "emery-create-agent": {
    id: "emery-create-agent",
    app: "emery",
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
  "emery-read-agent": {
    id: "emery-read-agent",
    app: "emery",
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
  "emery-update-agent": {
    id: "emery-update-agent",
    app: "emery",
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
  "emery-delete-agent": {
    id: "emery-delete-agent",
    app: "emery",
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
  "emery-list-agents": {
    id: "emery-list-agents",
    app: "emery",
    name: "List Agents",
    description: "List all agents in the organization",
    type: "action",
    inputs: {}
  },

  // Document CRUD Operations
  "emery-create-document": {
    id: "emery-create-document",
    app: "emery",
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
  "emery-read-document": {
    id: "emery-read-document",
    app: "emery",
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
  "emery-update-document": {
    id: "emery-update-document",
    app: "emery",
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
  "emery-delete-document": {
    id: "emery-delete-document",
    app: "emery",
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
  "emery-list-documents": {
    id: "emery-list-documents",
    app: "emery",
    name: "List Documents",
    description: "List all documents in the organization",
    type: "action",
    inputs: {}
  },

  // File CRUD Operations
  "emery-create-file": {
    id: "emery-create-file",
    app: "emery",
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
  "emery-read-file": {
    id: "emery-read-file",
    app: "emery",
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
  "emery-update-file": {
    id: "emery-update-file",
    app: "emery",
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
  "emery-delete-file": {
    id: "emery-delete-file",
    app: "emery",
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
  "emery-create-table": {
    id: "emery-create-table",
    app: "emery",
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
  "emery-read-table": {
    id: "emery-read-table",
    app: "emery",
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
  "emery-update-table": {
    id: "emery-update-table",
    app: "emery",
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
  "emery-delete-table": {
    id: "emery-delete-table",
    app: "emery",
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
  "emery-list-tables": {
    id: "emery-list-tables",
    app: "emery",
    name: "List Tables",
    description: "List all tables in the organization",
    type: "action",
    inputs: {}
  },

  // Row Operations
  "emery-create-row": {
    id: "emery-create-row",
    app: "emery",
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
  "emery-get-rows": {
    id: "emery-get-rows",
    app: "emery",
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
  "emery-update-row": {
    id: "emery-update-row",
    app: "emery",
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
  "emery-delete-row": {
    id: "emery-delete-row",
    app: "emery",
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
  "emery-create-team": {
    id: "emery-create-team",
    app: "emery",
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
  "emery-read-team": {
    id: "emery-read-team",
    app: "emery",
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
  "emery-update-team": {
    id: "emery-update-team",
    app: "emery",
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
  "emery-delete-team": {
    id: "emery-delete-team",
    app: "emery",
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
  "emery-list-teams": {
    id: "emery-list-teams",
    app: "emery",
    name: "List Teams",
    description: "List all teams in the organization",
    type: "action",
    inputs: {}
  },

  // Skill CRUD Operations
  "emery-read-skill": {
    id: "emery-read-skill",
    app: "emery",
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
  "emery-update-skill": {
    id: "emery-update-skill",
    app: "emery",
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
  "emery-list-skills": {
    id: "emery-list-skills",
    app: "emery",
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
  "emery-create-database": {
    id: "emery-create-database",
    app: "emery",
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
  "emery-read-database": {
    id: "emery-read-database",
    app: "emery",
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
  "emery-update-database": {
    id: "emery-update-database",
    app: "emery",
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
  "emery-delete-database": {
    id: "emery-delete-database",
    app: "emery",
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
  "emery-list-databases": {
    id: "emery-list-databases",
    app: "emery",
    name: "List Databases",
    description: "List all databases in the organization",
    type: "action",
    inputs: {}
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
