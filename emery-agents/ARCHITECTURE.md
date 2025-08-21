# Emery Agents Backend Architecture

This document outlines the backend architecture for the Emery Agents system, which follows the principles of Clean Architecture. The goal of this architecture is to create a system that is robust, maintainable, testable, and independent of frameworks and external agencies.

## Architectural Goals

- **Separation of Concerns**: Each part of the application has a distinct responsibility.
- **Testability**: The business logic can be tested without external dependencies like databases or web servers.
- **Independence**: The core application is independent of frameworks, UI, and databases.
- **Maintainability**: The structure is easy to understand, making it easier to add new features or fix bugs.

## The Layers

The application is divided into four distinct layers. The fundamental rule is that dependencies can only point inwards. The inner layers know nothing about the outer layers.

```
src/emery_agents/
├── api/                  # (Presentation Layer) gRPC server definitions
├── application/          # (Application Layer) Use cases and services
│   └── services/
├── domain/               # (Domain Layer) Core business logic and models
│   ├── entities/
│   └── repositories/
└── infrastructure/       # (Infrastructure Layer) Concrete implementations
    ├── repositories/
    └── integrations/
```

### 1. Domain Layer

This is the core of the application. It contains the enterprise-wide business logic and data structures.

-   **`domain/entities/`**: Contains the core data structures of the application (e.g., `Agent`, `Task`). These are simple data classes with no logic.
-   **`domain/repositories/`**: Defines the abstract interfaces for data access (e.g., `IAgentRepository`, `IOrchestrator`). These interfaces are implemented by the Infrastructure layer.

**Key Rule**: The Domain layer has zero dependencies on any other layer in the application.

### 2. Application Layer

This layer contains the application-specific business logic. It orchestrates the domain entities to perform use cases.

-   **`application/services/`**: Contains the services that implement the application's use cases (e.g., `AgentService`). These services are called by the Presentation layer.

**Key Rule**: The Application layer depends on the Domain layer, but not on the Infrastructure or Presentation layers.

### 3. Infrastructure Layer

This layer contains the concrete implementations of the interfaces defined in the Domain layer. It is where all the details about external agencies (databases, file systems, external APIs) are kept.

-   **`infrastructure/repositories/`**: Contains the concrete implementations of the repository interfaces (e.g., `InMemoryAgentRepository`).
-   **`infrastructure/integrations/`**: Contains the code that integrates with external systems (e.g., `SmolAgentsOrchestrator`).

**Key Rule**: The Infrastructure layer depends on the Domain layer.

### 4. API (Presentation) Layer

This is the outermost layer. It is responsible for handling incoming requests and sending responses.

-   **`api/`** (represented by `grpc/` in our current structure): Contains the gRPC server and protocol buffer definitions. Its only job is to receive requests, call the appropriate service in the Application layer, and return a response.

**Key Rule**: The API layer depends on the Application layer.

## Request Flow

A typical request flows through the system as follows:

1.  An incoming gRPC request is received by the **API Layer** (`grpc/server.py`).
2.  The API layer calls the appropriate method on a service in the **Application Layer** (e.g., `AgentService.execute_task`).
3.  The service in the Application layer uses the repository interfaces from the **Domain Layer** to interact with the data layer.
4.  The Dependency Injection container provides the concrete implementation of the repository from the **Infrastructure Layer**.
5.  The service executes the business logic and returns a result to the API layer.
6.  The API layer formats the result and sends it back to the client.

## Developer Guide

When adding a new feature:

1.  **Start with the Domain**: Define any new entities or repository interfaces that are needed.
2.  **Create the Application Service**: Create a new service in the Application layer to implement the use case.
3.  **Implement the Infrastructure**: Provide concrete implementations for any new repository interfaces.
4.  **Expose via the API**: Add a new endpoint in the API layer to call the new service.
