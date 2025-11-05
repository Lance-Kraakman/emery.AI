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
  "agent_crud": {
    id: "agent_crud",
    app: "emery",
    name: "Agent Management",
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
  "document_crud": {
    id: "document_crud",
    app: "emery",
    name: "Document Management",
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
  "file_crud": {
    id: "file_crud",
    app: "emery",
    name: "File Management",
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
  "table_crud": {
    id: "table_crud",
    app: "emery",
    name: "Table Management",
    description: "Manage data tables",
    type: "action",
    inputs: {
      operation: {
        type: "string",
        description: "CRUD operation (create, read, update, delete)",
        required: true
      },
      table_data: {
        type: "object",
        description: "Table data for the operation",
        required: false
      }
    }
  },
  "team_crud": {
    id: "team_crud",
    app: "emery",
    name: "Team Management",
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
  "database_crud": {
    id: "database_crud",
    app: "emery",
    name: "Database Management",
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
  }
};
