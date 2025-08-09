Feature: OAuth Integration and Agent System
  As a user who wants to automate workflows
  I want to connect external services and create agents
  So that I can automate tasks using my connected accounts

  Background:
    Given I am signed in to organization "Automation Corp"
    And I have "Admin" permissions in the organization

Feature: OAuth Connection Management
  As a user
  I want to connect my external service accounts
  So that agents can perform actions on my behalf

  Scenario: Connecting to Gmail via OAuth
    Given I am on the OAuth connections page
    When I click "Connect Gmail"
    Then I should be redirected to Google OAuth consent screen
    When I grant permission to access my Gmail
    Then I should be redirected back to the connections page
    And I should see "Gmail" as connected
    And my Gmail connection should be stored securely via Pipedream Connect

  Scenario: Connecting multiple services
    Given I am on the OAuth connections page
    When I connect the following services:
      | Service | Permissions              |
      | Gmail   | Read, Send emails        |
      | Slack   | Read, Write messages     |
      | GitHub  | Read repositories        |
    Then I should see all three services as connected
    And each service should show the granted permissions
    And I should be able to disconnect any service

  Scenario: Disconnecting OAuth services
    Given I have Gmail connected via OAuth
    When I click "Disconnect" next to Gmail
    And I confirm the disconnection
    Then Gmail should be removed from my connected services
    And agents should no longer be able to access my Gmail account
    When I try to reconnect Gmail
    Then I should go through the OAuth flow again

  Scenario: OAuth token refresh and expiration handling
    Given I have connected services with expiring tokens
    When a service token expires
    Then the system should automatically refresh the token via Pipedream
    And my agents should continue working without interruption
    When a refresh fails due to revoked permissions
    Then I should be notified to reconnect the service

Feature: Agent Creation and Management
  As a workflow automation user
  I want to create and manage AI agents
  So that I can automate repetitive tasks

  Scenario: Creating a basic agent
    Given I am on the System Management page
    When I click "Create Agent"
    And I fill in the agent form:
      | Field       | Value                           |
      | Name        | "Email Assistant"               |
      | Description | "Helps with email management"   |
      | Role        | "assistant"                     |
    And I select capabilities:
      | Capability        | Steps                    |
      | "Email Management"| Send email, Read inbox   |
    And I save the agent
    Then I should see "Email Assistant" in my agents list
    And the agent should be assigned to my organization

  Scenario: Agent with multiple capabilities
    Given I want to create a comprehensive assistant
    When I create an agent with capabilities:
      | Name              | Description                    | Tools        |
      | "Data Processing" | "Process and analyze data"     | python, sql  |
      | "Communication"   | "Send updates via email/slack" | email, slack |
      | "File Management" | "Organize and backup files"    | storage, ftp |
    Then the agent should be created with all three capabilities
    And each capability should have its defined steps and tools

  Scenario: Agent execution with OAuth credentials
    Given I have connected my Gmail account
    And I have an agent "Email Assistant" with email capabilities
    When I execute the agent with a task "Send summary email to team"
    Then the agent should use my connected Gmail credentials
    And it should send the email from my Gmail account
    And I should see the execution result and status

  Scenario: Agent API key generation
    Given I have created an agent "Data Processor"
    When I view the agent details
    Then I should see an API key generated for the agent
    And the API key should start with "ag_"
    And I should be able to regenerate the API key if needed
    When I use the API key to execute the agent via API
    Then the agent should execute successfully

Feature: Agent Capabilities and Steps
  As an agent creator
  I want to define detailed capabilities and execution steps
  So that agents can perform complex, multi-step workflows

  Scenario: Creating a capability with code steps
    Given I am creating an agent capability
    When I define a capability "Data Analysis":
      | Step | Type      | Instructions                    | Model    |
      | 1    | CODE_STEP | "Analyze CSV data for patterns" | claude-3 |
      | 2    | CODE_STEP | "Generate summary statistics"   | claude-3 |
    Then the capability should be saved with the defined steps
    And each step should specify the AI model to use

  Scenario: Creating a capability with tool steps
    Given I am creating an agent capability
    When I define a capability "Email Workflow":
      | Step | Type      | Instructions        | Tools       |
      | 1    | TOOL_STEP | "Read recent emails" | email_read  |
      | 2    | TOOL_STEP | "Send response"     | email_send  |
    Then the capability should be saved with tool specifications
    And the agent should be able to execute these tool-based steps

  Scenario: Mixed capability with code and tool steps
    Given I want to create a comprehensive workflow
    When I define a capability "Customer Support":
      | Step | Type      | Instructions                      | Tools/Model |
      | 1    | TOOL_STEP | "Fetch customer email"            | email_read  |
      | 2    | CODE_STEP | "Analyze sentiment and urgency"   | claude-3    |
      | 3    | TOOL_STEP | "Update CRM with classification"  | crm_update  |
      | 4    | CODE_STEP | "Generate personalized response"  | claude-3    |
      | 5    | TOOL_STEP | "Send reply email"                | email_send  |
    Then the capability should handle the mixed step types correctly
    And execution should flow seamlessly between code and tool steps

Feature: Agent Execution and Task Management
  As a user with agents
  I want to execute agents and track their progress
  So that I can monitor automated workflows

  Scenario: Synchronous agent execution
    Given I have an agent "Quick Responder" with simple capabilities
    When I execute the agent with parameters:
      | Parameter | Value                    |
      | "message" | "Hello, how can I help?" |
      | "context" | "Customer support chat"  |
    Then the agent should execute immediately
    And I should receive the result within a reasonable time
    And the execution status should be "completed"

  Scenario: Asynchronous agent execution with webhooks
    Given I have an agent "Data Processor" with long-running tasks
    When I execute the agent asynchronously with webhook URL
    And I provide a webhook URL for result delivery
    Then the agent should start execution immediately
    And I should receive an execution ID
    When the agent completes its task
    Then I should receive the result via webhook
    And the webhook payload should include execution status and results

  Scenario: Agent execution failure handling
    Given I have an agent that requires Gmail access
    But my Gmail connection has expired
    When I try to execute the agent
    Then I should receive an error about missing credentials
    And the agent execution status should be "failed"
    And I should be prompted to reconnect Gmail

  Scenario: Task queuing and execution tracking
    Given I execute multiple agent tasks simultaneously
    When I submit 5 tasks to different agents
    Then I should see all tasks in the task management interface
    And each task should show its current status
    And I should be able to cancel pending tasks
    When tasks complete
    Then I should see updated statuses and results

Feature: Agent Security and Access Control
  As a security-conscious user
  I want agent access to be properly controlled
  So that my data and credentials remain secure

  Scenario: Agent ownership verification
    Given I have created an agent "Personal Assistant"
    When another user tries to execute my agent
    Then they should be denied access
    And they should receive a "403 Forbidden" error
    When I execute my own agent
    Then it should work normally with my OAuth credentials

  Scenario: Organization-scoped agent visibility
    Given I have agents in organization "Company A"
    When I switch to organization "Company B"
    Then I should not see agents from "Company A"
    And I should only see agents that belong to "Company B"
    When I create an agent in "Company B"
    Then it should only be visible within "Company B"

  Scenario: API key security
    Given I have an agent with an API key
    When I make API calls using the agent's API key
    Then the calls should be authenticated successfully
    When someone tries to use an invalid or expired API key
    Then they should receive a "401 Unauthorized" error
    When I regenerate the API key
    Then the old key should become invalid immediately

  Scenario: OAuth credential isolation
    Given user Alice has connected her Gmail in "Company A"
    And user Bob is in "Company B"
    When Bob's agent tries to access email services
    Then it should not have access to Alice's Gmail credentials
    And Bob should only be able to use his own connected services

Feature: Agent Proxy System
  As a developer using agents programmatically
  I want a universal proxy for OAuth-enabled services
  So that agents can access any connected service seamlessly

  Scenario: Universal OAuth proxy usage
    Given I have connected multiple services (Gmail, Slack, GitHub)
    And I have an agent with appropriate API key
    When I make a proxy request to send a Slack message:
      ```
      POST /api/agents/proxy
      Authorization: Bearer ag_agent_api_key
      {
        "service": "slack",
        "action": "send_message",
        "params": {
          "channel": "#general",
          "text": "Hello from agent!"
        }
      }
      ```
    Then the message should be sent via my connected Slack account
    And I should receive a success response

  Scenario: Service capability discovery
    Given I have various services connected
    When I make a request to `/api/agents/{id}/capabilities`
    Then I should see all available services and their actions
    And only services I have connected should be listed
    And each service should show available actions/endpoints

  Scenario: Error handling in proxy requests
    Given I have an agent but no Slack connection
    When I try to use the proxy to send a Slack message
    Then I should receive an error about missing Slack connection
    And the error should include instructions to connect Slack

Feature: Webhook Integration and Security
  As a developer integrating with the agent system
  I want secure webhook handling
  So that I can receive agent results safely

  Scenario: Webhook signature verification
    Given I have configured a webhook URL for agent results
    When an agent completes execution
    Then the webhook payload should include an HMAC signature
    And I should be able to verify the signature matches the payload
    When I receive a webhook with invalid signature
    Then I should reject it as potentially malicious

  Scenario: Webhook retry mechanism
    Given I have a webhook endpoint that sometimes fails
    When an agent completes but my webhook endpoint is down
    Then the system should retry delivering the webhook
    And it should use exponential backoff for retries
    When my endpoint comes back online
    Then I should receive the delayed webhook payload

  Scenario: Development webhook bypass
    Given I am in development mode
    When I execute an agent without providing a webhook URL
    Then the agent should execute synchronously
    And I should receive the result directly in the API response
    And no webhook should be attempted