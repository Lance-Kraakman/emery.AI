Feature: Task Permissions RBAC Manual Testing
  As a system administrator
  I want to verify that task assignment permissions work correctly
  So that users can only assign tasks according to their permissions

  Background:
    Given I have access to the application
    And I can create test organizations, users, and agents
    And I can modify agent task permissions in the database

  # Default Agent Task Assignment Permissions

  Scenario: Agent owner can always assign tasks to their own agent
    Given I am logged in as "owner@example.com"
    And I own an agent named "My Agent"
    When I create a task for "My Agent"
    Then the task should be created successfully
    And the task should be assigned to "My Agent"

  Scenario: Non-owner cannot assign tasks to agent by default
    Given I have two users:
      | email              | role   |
      | owner@example.com  | member |
      | other@example.com  | member |
    And "owner@example.com" owns an agent named "Owner's Agent"
    And the agent has default permissions (no special access granted)
    When I am logged in as "other@example.com"
    And I try to create a task for "Owner's Agent"
    Then the task creation should fail
    And I should see a permission denied error

  Scenario: Organization admin can assign tasks to any agent by default
    Given I have two users:
      | email              | role   |
      | owner@example.com  | member |
      | admin@example.com  | admin  |
    And "owner@example.com" owns an agent named "Owner's Agent"
    And the agent has default permissions (allowOrgAdmins: true)
    When I am logged in as "admin@example.com"
    And I create a task for "Owner's Agent"
    Then the task should be created successfully

  # Custom Agent Task Assignment Permissions

  Scenario: Specific user can assign tasks when added to allowedUsers
    Given I have two users:
      | email              | role   |
      | owner@example.com  | member |
      | allowed@example.com| member |
    And "owner@example.com" owns an agent named "Owner's Agent"
    And I update the agent's task permissions:
      """
      {
        "assignment": {
          "allowedUsers": ["allowed@example.com"],
          "allowOrgAdmins": true
        }
      }
      """
    When I am logged in as "allowed@example.com"
    And I create a task for "Owner's Agent"
    Then the task should be created successfully

  Scenario: Team members can assign tasks when allowTeamMembers is true
    Given I have a team named "Dev Team"
    And I have users:
      | email                 | role   | team     |
      | owner@example.com     | member | -        |
      | teammate@example.com  | member | Dev Team |
    And "owner@example.com" owns an agent named "Owner's Agent"
    And "teammate@example.com" is a member of "Dev Team"
    And I update the agent's task permissions:
      """
      {
        "assignment": {
          "allowTeamMembers": true,
          "teamId": "Dev Team ID"
        }
      }
      """
    When I am logged in as "teammate@example.com"
    And I create a task for "Owner's Agent"
    Then the task should be created successfully

  Scenario: Organization admin access can be disabled
    Given I have two users:
      | email              | role   |
      | owner@example.com  | member |
      | admin@example.com  | admin  |
    And "owner@example.com" owns an agent named "Owner's Agent"
    And I update the agent's task permissions:
      """
      {
        "assignment": {
          "allowOrgAdmins": false,
          "allowedUsers": []
        }
      }
      """
    When I am logged in as "admin@example.com"
    And I try to create a task for "Owner's Agent"
    Then the task creation should fail
    And I should see a permission denied error

  # Team Task Assignment (Future Feature)

  @pending
  Scenario: Team member can assign tasks to team
    Given I have a team named "Support Team"
    And I have a user "member@example.com" who is a member of "Support Team"
    And the team has task assignment enabled
    When I am logged in as "member@example.com"
    And I create a task for "Support Team"
    Then the task should be created successfully
    And the task should be assigned to the team pool

  @pending
  Scenario: Non-team member cannot assign tasks to team
    Given I have a team named "Support Team"
    And I have a user "outsider@example.com" who is NOT a member of "Support Team"
    When I am logged in as "outsider@example.com"
    And I try to create a task for "Support Team"
    Then the task creation should fail
    And I should see a permission denied error

  # Agent-to-Agent Task Assignment

  Scenario: Agent can assign tasks to another agent when permitted
    Given I have two agents:
      | agent        | owner              |
      | Agent A      | owner1@example.com |
      | Agent B      | owner2@example.com |
    And I update "Agent B" task permissions:
      """
      {
        "assignment": {
          "allowedAgents": ["Agent A ID"]
        }
      }
      """
    When "Agent A" creates a task for "Agent B" via automation
    Then the task should be created successfully
    And the task should be assigned to "Agent B"

  # Task Routing Permissions

  Scenario: Agent can route tasks based on routing permissions
    Given I have an agent "Router Agent" with routing permissions:
      """
      {
        "routing": {
          "allowAnyTeamAgent": true
        }
      }
      """
    And I have another agent "Worker Agent" in the same team
    When "Router Agent" routes a task to "Worker Agent"
    Then the task should be routed successfully

  # Cross-Organization Isolation

  Scenario: Cannot assign tasks across organizations
    Given I have two organizations:
      | org          | user              |
      | Org 1        | user1@example.com |
      | Org 2        | user2@example.com |
    And "user1@example.com" owns an agent "Agent 1" in "Org 1"
    When I am logged in as "user2@example.com" in "Org 2"
    And I try to create a task for "Agent 1" from "Org 1"
    Then the task creation should fail
    And I should see an error that the agent doesn't exist or access is denied

  # Manual Testing Steps

  Scenario Outline: Manual permission verification
    Given I am testing permission scenario: "<scenario>"
    When I perform the following steps:
      | Step | Action                                          | Expected Result |
      | 1    | Log in as <user>                               | Success         |
      | 2    | Navigate to agent <agent>                      | Visible/Hidden  |
      | 3    | Click "Create Task" button                     | <button_state>  |
      | 4    | Fill task details and submit                   | <submit_result> |
      | 5    | Check database for task creation               | <db_result>     |

    Examples:
      | scenario              | user              | agent         | button_state | submit_result | db_result   |
      | Owner access          | owner@test.com    | Own Agent     | Enabled      | Success       | Task exists |
      | Non-owner blocked     | other@test.com    | Other's Agent | Disabled     | Blocked       | No task     |
      | Admin override        | admin@test.com    | Any Agent     | Enabled      | Success       | Task exists |
      | Allowed user          | allowed@test.com  | Permitted Agent| Enabled     | Success       | Task exists |

  # Database Verification Queries

  Scenario: Verify RLS policies are correctly configured
    When I run the following SQL queries:
      """sql
      -- Check RLS is enabled on tasks table
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'tasks';

      -- List all RLS policies on tasks table
      SELECT polname, polcmd, polpermissive 
      FROM pg_policy 
      WHERE polrelid = 'tasks'::regclass;

      -- Check agent task permissions
      SELECT 
        a.id,
        a.name,
        a.owner_id,
        a.task_permissions
      FROM agents a
      WHERE a.organization_id = <test_org_id>;

      -- Verify task creation with context
      SET app.current_user_id = '<test_user_id>';
      SET app.current_organization_id = '<test_org_id>';
      
      -- Attempt to insert a task (should respect RLS)
      INSERT INTO tasks (id, agent_id, name, organization_id, created_by)
      VALUES (gen_random_uuid(), <agent_id>, 'Test Task', <org_id>, '<user_id>');
      """
    Then I should verify the RLS policies are enforcing permissions correctly

  # Manual Test Checklist

  Scenario: Complete manual test checklist
    Given I need to verify the task permissions system
    Then I should complete the following checklist:
      | ✓ | Test Case                                      | Pass/Fail | Notes |
      |---|------------------------------------------------|-----------|-------|
      | □ | Agent owner can create tasks                  |           |       |
      | □ | Non-owner cannot create tasks by default      |           |       |
      | □ | Org admin can create tasks (when allowed)     |           |       |
      | □ | Org admin blocked when allowOrgAdmins=false   |           |       |
      | □ | Specific users in allowedUsers can create     |           |       |
      | □ | Team members can create (when allowed)        |           |       |
      | □ | Cross-organization access is blocked          |           |       |
      | □ | Agent-to-agent task assignment works          |           |       |
      | □ | Task routing permissions work                 |           |       |
      | □ | RLS policies are active (non-superuser test)  |           |       |

  # Notes for Manual Testing

  """
  IMPORTANT: For RLS policies to work correctly:
  
  1. Do NOT test as database superuser (postgres)
  2. Use application-level user accounts with proper roles
  3. Ensure context is set: organizationId and userId
  4. Check that migrations 0006-0009 have been applied
  5. Verify policies with: SELECT * FROM pg_policies WHERE tablename = 'tasks';
  
  Test Data Setup:
  - Create at least 2 organizations
  - Create 3+ users with different roles (owner, admin, member)
  - Create 2+ agents with different owners
  - Create at least 1 team with members
  - Modify agent task permissions as needed for each scenario
  
  Expected Behaviors:
  - Default: Only agent owner can assign tasks
  - With allowOrgAdmins=true: Org admins can assign
  - With allowedUsers: Listed users can assign
  - With allowTeamMembers: Team members can assign
  - Cross-org: Always blocked regardless of permissions
  """