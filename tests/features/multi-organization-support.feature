Feature: Multi-Organization Support
  As a user of the Emery platform
  I want to be able to work with multiple organizations
  So that I can manage different workspaces and collaborate with different teams

  Background:
    Given the application is running
    And the database is clean

  Scenario: First user creates initial organization through setup
    Given I am a new user who has never signed in
    When I visit the application
    And I sign in with OAuth
    Then I should be redirected to the setup page
    When I fill in the organization setup form:
      | Field            | Value                           |
      | Organization Name| "My First Organization"         |
      | Mission          | "Building amazing products"     |
    And I submit the setup form
    Then I should be redirected to the dashboard
    And I should see "My First Organization" in the organization switcher
    And I should have "Super Admin" role in the organization
    And the organization switcher should show "My First Organization" as active

  Scenario: User creates additional organizations
    Given I am signed in as a user with an existing organization
    When I click on the organization switcher
    And I click "Create Organization"
    And I fill in the create organization form:
      | Field            | Value               |
      | Organization Name| "Second Workspace"  |
      | Mission          | "Another workspace" |
    And I click "Create"
    Then I should see "Second Workspace" in the organization switcher
    And the organization switcher should show "Second Workspace" as active
    And I should have "owner" role in "Second Workspace"

  Scenario: User switches between organizations
    Given I belong to multiple organizations:
      | Name              | Role  |
      | "Main Workspace"  | owner |
      | "Side Project"    | owner |
    And I am currently in "Main Workspace"
    When I click on the organization switcher
    And I select "Side Project"
    Then the organization switcher should show "Side Project" as active
    And I should see only tables belonging to "Side Project"
    And I should not see tables from "Main Workspace"

  Scenario: Data isolation between organizations
    Given I belong to two organizations:
      | Name          | Role  |
      | "Org Alpha"   | owner |
      | "Org Beta"    | owner |
    And I am in "Org Alpha"
    And I create a table named "Alpha Table" in "Org Alpha"
    When I switch to "Org Beta"
    Then I should not see "Alpha Table" in the table list
    When I create a table named "Beta Table" in "Org Beta"
    And I switch back to "Org Alpha"
    Then I should see "Alpha Table" but not "Beta Table"

  Scenario: Role-based permissions within organizations
    Given I have "Super Admin" role in "Main Org"
    And I am in "Main Org"
    When I access the System Management page
    Then I should see agents, tasks, and organization management options
    And I should be able to create and manage all resources

  Scenario: Organization ownership and permissions
    Given I create a new organization "My Company"
    Then I should automatically become the "owner" of "My Company"
    And I should have "Super Admin" role in "My Company"
    And I should be able to:
      | Action                    |
      | Create tables            |
      | Manage users             |
      | Create agents            |
      | Access organization settings |

Feature: Table Management with Multi-Organization Support
  As a user in a specific organization
  I want to manage tables within my organization's scope
  So that my data remains isolated and secure

  Scenario: Creating tables in current organization
    Given I am signed in and in organization "Tech Startup"
    When I create a new table named "Users"
    Then the table should be associated with "Tech Startup" organization
    And the table should appear in my table list
    When I switch to a different organization "Marketing Agency"
    Then I should not see the "Users" table

  Scenario: Cross-organization table access prevention
    Given user Alice is in "Company A" with table "Customers"
    And user Bob is in "Company B"
    When Bob tries to access Alice's "Customers" table via API
    Then Bob should receive a "403 Forbidden" error
    And Bob should not be able to see the table data

Feature: Authentication and Session Management
  As a user of the platform
  I want secure authentication with organization context
  So that I can safely access my organization's resources

  Scenario: OAuth authentication flow
    Given I am not signed in
    When I visit the application
    Then I should be redirected to the sign-in page
    When I click "Sign in with GitHub"
    And I complete the OAuth flow
    Then I should be authenticated
    And my session should include organization information

  Scenario: Session persistence across page refreshes
    Given I am signed in and in organization "My Org"
    When I refresh the page
    Then I should remain signed in
    And I should still be in organization "My Org"
    And the organization switcher should show "My Org" as active

Feature: Agent Management with Organization Scoping
  As an organization member
  I want to manage agents within my organization
  So that agents are scoped to my organization's context

  Scenario: Creating organization-scoped agents
    Given I am in organization "AI Company"
    When I create a new agent named "Customer Service Bot"
    Then the agent should belong to "AI Company"
    When I switch to organization "Marketing Firm"
    Then I should not see "Customer Service Bot" in the agents list

  Scenario: Agent execution with owner credentials
    Given I am in organization "Data Corp"
    And I have connected my Gmail account via OAuth
    And I create an agent "Email Assistant" 
    When the agent executes an email action
    Then it should use my connected Gmail credentials
    And it should only have access to my authorized services

Feature: API Security and Organization Context
  As a developer using the API
  I want all API endpoints to respect organization boundaries
  So that data remains secure and properly isolated

  Scenario: Authenticated API access with organization scoping
    Given I have an API key for organization "Dev Team"
    When I make a GET request to "/api/tables" with my API key
    Then I should only see tables from "Dev Team" organization
    And I should not see tables from other organizations

  Scenario: Unauthenticated API access prevention
    When I make a request to "/api/fields" without authentication
    Then I should receive a "401 Unauthorized" error
    When I make a request to "/api/rows" without authentication
    Then I should receive a "401 Unauthorized" error

  Scenario: Cross-organization API access prevention
    Given I have an API key for organization "Company X"
    And there is a table owned by organization "Company Y"
    When I try to access "Company Y"'s table via API
    Then I should receive a "403 Forbidden" error

Feature: Organization Settings and Management
  As an organization owner
  I want to manage my organization settings
  So that I can configure my workspace appropriately

  Scenario: Updating organization information
    Given I am an owner of organization "Startup Inc"
    When I access the organization management page
    And I update the organization mission to "Revolutionizing workflow"
    And I save the changes
    Then the organization mission should be updated
    And the changes should be reflected in the organization switcher

  Scenario: Managing organization members (Future Enhancement)
    Given I am an owner of organization "Big Corp"
    When I invite a user "john@example.com" to the organization
    Then they should receive an invitation
    When they accept the invitation
    Then they should appear in "Big Corp" organization members list
    And they should be able to switch to "Big Corp" organization

Feature: Error Handling and Edge Cases
  As a user of the platform
  I want appropriate error handling for edge cases
  So that I have a smooth experience even when things go wrong

  Scenario: Handling deleted organizations
    Given I am a member of organization "Temp Org"
    When the organization "Temp Org" is deleted by an admin
    And I try to access it
    Then I should be redirected to select a different organization
    Or I should be prompted to create a new organization if I have no others

  Scenario: Handling permission changes
    Given I have "Admin" role in organization "Company"
    When my role is changed to "Viewer"
    And I try to create a new table
    Then I should receive a permission denied error
    And the create table button should not be available

  Scenario: Network error handling
    Given I am using the application
    When the network connection is lost
    And I try to switch organizations
    Then I should see an appropriate error message
    And the application should gracefully handle the offline state