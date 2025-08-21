# Emery Agents Backend Architecture

This document outlines the backend architecture for the Emery Agents system, which follows the principles of Clean Architecture. The goal of this architecture is to create a system that is robust, maintainable, testable, and independent of frameworks and external agencies.

## Architectural Goals

- **Separation of Concerns**: Each part of the application has a distinct responsibility.
- **Testability**: The business logic can be tested without external dependencies like databases or web servers.
- **Independence**: The core application is independent of frameworks, UI, and databases.
- **Maintainability**: The structure is easy to understand, making it easier to add new features or fix bugs.

## The Layers

The application is divided into three logical layers, with a focus on simplicity for a stateless execution service.

```
src/emery_agents/
├── grpc/                 # (API Layer) gRPC server definitions
├── application/          # (Application Layer) Use cases and services
│   └── services/
├── domain/               # (Domain Layer) Core business logic and models
│   └── entities/
└── integrations/         # (Infrastructure Layer) Concrete implementations
```

### 1. Domain Layer

This is the core of the application. It contains the data structures that define the business objects.

-   **`domain/entities/`**: Contains the core data structures of the application (e.g., `Agent`, `Task`). These are simple, stateless data classes.

**Key Rule**: The Domain layer has zero dependencies on any other layer in the application.

### 2. Application Layer

This layer contains the application-specific business logic. It orchestrates the domain entities to perform use cases.

-   **`application/services/`**: Contains the services that implement the application's use cases (e.g., `AgentService`). This is the primary orchestrator of business logic.

**Key Rule**: The Application layer depends on the Domain layer and the Infrastructure layer.

### 3. Infrastructure & API Layers

For this stateless service, the Infrastructure and API layers are closely related.

-   **`integrations/`**: Contains the code that integrates with external systems (e.g., `SmolAgentsOrchestrator`). These are treated as implementation details of the Application layer.
-   **`grpc/`**: This is the entry point of the application. It handles incoming requests, calls the appropriate service in the Application layer, and returns a response.

## Request Flow

A typical request flows through the system as follows:

1.  An incoming gRPC request is received by the **API Layer** (`grpc/server.py`).
2.  The API layer calls the appropriate method on a service in the **Application Layer** (e.g., `AgentService.execute_task`), passing in the necessary data from the request.
3.  The service in the Application layer instantiates and uses clients from the **Infrastructure Layer** (e.g., `SmolAgentsOrchestrator`) to perform its work.
4.  The service executes the business logic and returns a result to the API layer.
5.  The API layer formats the result and sends it back to the client.

## Developer Guide

When adding a new feature:

1.  **Start with the Domain**: Define any new entities that are needed.
2.  **Update the Application Service**: Add a new method to the service to implement the use case.
3.  **Add Infrastructure**: If the new use case requires a new external integration, add it in the `integrations` directory.
4.  **Expose via the API**: Add a new endpoint in the API layer to call the new service method.
