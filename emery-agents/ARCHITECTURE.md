# Emery Agents Backend Architecture

This document outlines the backend architecture for the Emery Agents system, which follows the principles of Clean Architecture. The goal of this architecture is to create a system that is robust, maintainable, testable, and independent of frameworks and external agencies.

## Architectural Goals

- **Separation of Concerns**: Each part of the application has a distinct responsibility.
- **Testability**: The business logic can be tested without external dependencies like databases or web servers.
- **Independence**: The core application is independent of frameworks, UI, and databases.
- **Maintainability**: The structure is easy to understand, making it easier to add new features or fix bugs.

## The Layers

The application is divided into four distinct layers, following the principles of Clean Architecture.

```
src/emery_agents/
├── grpc/                 # (API Layer) gRPC server definitions
├── application/          # (Application Layer) Use cases and services
│   └── services/
├── domain/               # (Domain Layer) Core business logic and models
│   ├── entities/
│   └── repositories/
└── infrastructure/       # (Infrastructure Layer) Concrete implementations
    └── repositories/
```

### 1. Domain Layer

This is the core of the application. It contains the enterprise-wide business logic and data structures.

-   **`domain/entities/`**: Contains the core data structures of the application (e.g., `Agent`, `Task`).
-   **`domain/repositories/`**: Defines the abstract interfaces for any external dependencies, such as the `IToolRepository`.

**Key Rule**: The Domain layer has zero dependencies on any other layer.

### 2. Application Layer

This layer contains the application-specific business logic.

-   **`application/services/`**: Contains the `AgentService`, which is the primary orchestrator of the agent execution logic.

**Key Rule**: The Application layer depends only on the Domain layer.

### 3. Infrastructure Layer

This layer contains the concrete implementations of the interfaces defined in the Domain layer.

-   **`infrastructure/repositories/`**: Contains concrete repository implementations, such as the `ToolRegistryRepository`.
-   **`integrations/`**: Contains other external-facing code.

**Key Rule**: The Infrastructure layer depends on the Domain layer.

## Request Flow

A typical request flows through the system as follows:

1.  An incoming gRPC request is received by the **API Layer** (`grpc/server.py`).
2.  The API layer, acting as the **Composition Root**, instantiates the concrete `ToolRegistryRepository` from the **Infrastructure Layer**.
3.  It then instantiates the `AgentService` from the **Application Layer**, injecting the repository into its constructor.
4.  The API layer calls the `execute_task` method on the `AgentService`.
5.  The `AgentService` uses the `IToolRepository` interface from the **Domain Layer** to load the necessary tools, without knowing the concrete implementation.
6.  The service executes the business logic and returns a result to the API layer.
7.  The API layer formats the result and sends it back to the client.

## Developer Guide

When adding a new feature:

1.  **Start with the Domain**: Define any new entities or repository interfaces.
2.  **Update the Application Service**: Add or modify services to implement the new use case, depending only on domain interfaces.
3.  **Add Infrastructure**: Create concrete implementations for any new repository interfaces.
4.  **Expose via the API**: Update the gRPC server to compose and call the new services.
