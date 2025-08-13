# System Architecture Overview

This document provides a comprehensive explanation of the key systems that make up the Emery.AI platform. The application is a sophisticated, multi-tenant platform designed for automating tasks using AI agents. It is built with a modern web stack, featuring a Next.js frontend and backend, a PostgreSQL database, and a separate Python environment for executing agent capabilities.

## 1. The Scheduler System

The scheduler system is responsible for triggering the execution of agents based on a variety of conditions. It is a robust and flexible system that enables time-based, event-driven, and webhook-based automation.

### Core Components

*   **`AgentScheduler`**: This is the heart of the system, responsible for managing and executing all scheduled tasks. It runs as a background process on the server and is initialized automatically on startup.
*   **`startup.ts`**: This module ensures that the `AgentScheduler` is started only in the appropriate server-side environments, preventing it from running during client-side rendering, tests, or production builds.
*   **`DatabaseTriggerManager`**: This component manages the creation and removal of PostgreSQL triggers, which are essential for the `DATABASE_EVENT` trigger functionality.

### How It Works

The scheduler supports three types of triggers:

1.  **CRON Triggers**: For time-based scheduling, the system uses the `node-cron` library. When an agent is configured with a CRON trigger, the `AgentScheduler` creates a cron job that executes the agent at the specified time or interval.
2.  **DATABASE\_EVENT Triggers**: This feature allows agents to be triggered in real-time in response to database changes (e.g., `INSERT`, `UPDATE`, `DELETE`). It uses PostgreSQL's `LISTEN/NOTIFY` system to send notifications to the `AgentScheduler` when a change occurs in a monitored table.
3.  **WEBHOOK Triggers**: The system is designed to support webhooks, allowing agents to be triggered by external systems.

### Key Features

*   **Automatic Initialization**: The scheduler starts automatically when the server boots up.
*   **Dynamic Updates**: The `AgentScheduler` periodically checks for new or updated agents and automatically adjusts its schedule.
*   **Graceful Shutdown**: The scheduler is designed to shut down gracefully, ensuring that any in-progress tasks are handled correctly.
*   **gRPC Integration**: When a trigger condition is met, the scheduler executes the agent's capability via a gRPC call.

## 2. The Backend System

The backend is a hybrid system that leverages the strengths of both Node.js and Python.

*   **Next.js Application**: The core of the backend is a Next.js application that serves both the user interface and a set of API endpoints. It is responsible for managing users, organizations, agents, and tasks.
*   **Python Agent Workers**: The actual execution of agent capabilities is offloaded to a separate Python environment. Each worker is a gRPC server that listens for tasks from the Next.js application.
*   **Database**: The system uses a PostgreSQL database to store all of its data. The database schema is managed using Drizzle ORM.

## 3. The gRPC Communication System

The communication between the Next.js application and the Python agent workers is handled by gRPC.

*   **Protocol Buffers (Protobuf)**: The gRPC communication is defined by a `.proto` file, which serves as a contract between the client and the server.
*   **Streaming Support**: The gRPC implementation supports streaming, which allows the Python worker to send real-time progress updates back to the Next.js application.
*   **Service Discovery**: The system includes a `WorkerRegistry` that is responsible for managing connections to multiple worker instances, allowing for a multi-tenant architecture.

## 4. The Authentication System

The authentication system is built on top of NextAuth.js.

*   **OAuth Integration**: The system supports authentication via GitHub and Google.
*   **Role-Based Access Control (RBAC)**: The application features an RBAC system that allows for fine-grained control over user permissions.
*   **Multi-Tenancy**: The authentication system is designed to support multiple organizations. Users can be members of multiple organizations, and the system ensures that they can only access the data and resources of the organization they are currently logged into.
