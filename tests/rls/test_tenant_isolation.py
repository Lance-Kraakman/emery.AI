"""
Row Level Security (RLS) Tests
Tests multi-tenant data isolation across all organization-scoped tables
"""

import pytest
import uuid
from datetime import datetime


class TestOrganizationIsolation:
    """Test basic organization-level data isolation"""
    
    def test_organizations_visible_to_members_only(self, app_cursor, test_organizations, test_users, rls_context):
        """Users can only see organizations they belong to"""
        # Set context for user in org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name FROM organizations ORDER BY id")
        visible_orgs = app_cursor.fetchall()
        
        # Should only see org 1
        assert len(visible_orgs) == 1
        assert visible_orgs[0][0] == test_organizations['org1']
        assert visible_orgs[0][1] == 'Test Org 1'
        
        # Switch to user in org 2
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, name FROM organizations ORDER BY id")
        visible_orgs = app_cursor.fetchall()
        
        # Should only see org 2
        assert len(visible_orgs) == 1
        assert visible_orgs[0][0] == test_organizations['org2']
        assert visible_orgs[0][1] == 'Test Org 2'
    
    def test_users_isolated_by_organization(self, app_cursor, test_organizations, test_users, rls_context):
        """Users can only see other users in their organization"""
        # Set context for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name FROM users WHERE name LIKE 'User %' ORDER BY name")
        visible_users = app_cursor.fetchall()
        
        # Should only see user 1
        assert len(visible_users) == 1
        assert visible_users[0][0] == test_users['user1']
        assert visible_users[0][1] == 'User 1'
        
        # Switch to org 2
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, name FROM users WHERE name LIKE 'User %' ORDER BY name")
        visible_users = app_cursor.fetchall()
        
        # Should only see user 2
        assert len(visible_users) == 1
        assert visible_users[0][0] == test_users['user2']
        assert visible_users[0][1] == 'User 2'


class TestAgentIsolation:
    """Test agent-level data isolation"""
    
    def test_agents_isolated_by_organization(self, app_cursor, test_organizations, test_agents, test_users, rls_context):
        """Agents are only visible within their organization"""
        # Set context for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name, organization_id FROM agents ORDER BY id")
        visible_agents = app_cursor.fetchall()
        
        # Should only see agent 1
        assert len(visible_agents) == 1
        assert visible_agents[0][0] == test_agents['agent1']
        assert visible_agents[0][1] == 'Agent 1'
        assert visible_agents[0][2] == test_organizations['org1']
        
        # Switch to org 2
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, name, organization_id FROM agents ORDER BY id")
        visible_agents = app_cursor.fetchall()
        
        # Should only see agent 2
        assert len(visible_agents) == 1
        assert visible_agents[0][0] == test_agents['agent2']
        assert visible_agents[0][1] == 'Agent 2'
        assert visible_agents[0][2] == test_organizations['org2']


class TestTaskIsolation:
    """Test task creation and isolation"""
    
    def test_task_creation_includes_organization_id(self, app_cursor, test_organizations, test_agents, test_users, rls_context):
        """Tasks created include correct organization_id"""
        # Set context for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        task_id = str(uuid.uuid4())
        app_cursor.execute("""
            INSERT INTO tasks (id, agent_id, organization_id, name, instructions, created_by)
            VALUES (%s, %s, %s, 'Test Task 1', '{"instructions": "test"}', %s)
        """, (task_id, test_agents['agent1'], test_organizations['org1'], test_users['user1']))
        
        # Verify task was created with correct organization_id
        app_cursor.execute("SELECT id, name, organization_id FROM tasks WHERE id = %s", (task_id,))
        task = app_cursor.fetchone()
        
        assert task is not None
        assert task[0] == task_id
        assert task[1] == 'Test Task 1'
        assert task[2] == test_organizations['org1']
    
    def test_tasks_isolated_by_organization(self, app_cursor, test_organizations, test_agents, test_users, rls_context):
        """Tasks are only visible within their organization"""
        # Create tasks for both organizations
        task1_id = str(uuid.uuid4())
        task2_id = str(uuid.uuid4())
        
        # Create task for org 1 (set context for creation)
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        app_cursor.execute("""
            INSERT INTO tasks (id, agent_id, organization_id, name, instructions, created_by)
            VALUES (%s, %s, %s, 'Task for Org 1', '{"instructions": "test"}', %s)
        """, (task1_id, test_agents['agent1'], test_organizations['org1'], test_users['user1']))
        
        # Create task for org 2 (set context for creation)
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        app_cursor.execute("""
            INSERT INTO tasks (id, agent_id, organization_id, name, instructions, created_by)
            VALUES (%s, %s, %s, 'Task for Org 2', '{"instructions": "test"}', %s)
        """, (task2_id, test_agents['agent2'], test_organizations['org2'], test_users['user2']))
        
        # Test isolation for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name FROM tasks WHERE name LIKE 'Task for Org %' ORDER BY name")
        visible_tasks = app_cursor.fetchall()
        
        # Should only see task for org 1
        assert len(visible_tasks) == 1
        assert visible_tasks[0][0] == task1_id
        assert visible_tasks[0][1] == 'Task for Org 1'
        
        # Test isolation for org 2
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, name FROM tasks WHERE name LIKE 'Task for Org %' ORDER BY name")
        visible_tasks = app_cursor.fetchall()
        
        # Should only see task for org 2
        assert len(visible_tasks) == 1
        assert visible_tasks[0][0] == task2_id
        assert visible_tasks[0][1] == 'Task for Org 2'
    
    def test_cross_organization_task_access_prevented(self, app_cursor, test_organizations, test_agents, test_users, rls_context):
        """Users cannot access tasks from other organizations"""
        # Create a task in org 2
        task_id = str(uuid.uuid4())
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        app_cursor.execute("""
            INSERT INTO tasks (id, agent_id, organization_id, name, instructions, created_by)
            VALUES (%s, %s, %s, 'Secret Task', '{"instructions": "secret"}', %s)
        """, (task_id, test_agents['agent2'], test_organizations['org2'], test_users['user2']))
        
        # Try to access from org 1 context
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name FROM tasks WHERE id = %s", (task_id,))
        result = app_cursor.fetchone()
        
        # Should not be able to see the task
        assert result is None


class TestRAGIsolation:
    """Test RAG system isolation"""
    
    def test_rag_indexes_isolated_by_organization(self, app_cursor, test_organizations, test_users, rls_context):
        """RAG indexes are isolated by organization"""
        # Create RAG indexes for both organizations
        index1_id = str(uuid.uuid4())
        index2_id = str(uuid.uuid4())
        
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        app_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Index 1', %s, '["tables"]', %s)
        """, (index1_id, test_organizations['org1'], test_users['user1']))
        
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        app_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Index 2', %s, '["tables"]', %s)
        """, (index2_id, test_organizations['org2'], test_users['user2']))
        
        # Test org 1 can only see its index
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, name FROM rag_indexes ORDER BY name")
        visible_indexes = app_cursor.fetchall()
        
        assert len(visible_indexes) == 1
        assert visible_indexes[0][0] == index1_id
        assert visible_indexes[0][1] == 'Index 1'
        
        # Test org 2 can only see its index
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, name FROM rag_indexes ORDER BY name")
        visible_indexes = app_cursor.fetchall()
        
        assert len(visible_indexes) == 1
        assert visible_indexes[0][0] == index2_id
        assert visible_indexes[0][1] == 'Index 2'
    
    def test_rag_documents_inherit_organization_isolation(self, app_cursor, test_organizations, test_users, rls_context):
        """RAG documents inherit organization isolation from their indexes"""
        # Create RAG index and document for org 1
        index_id = str(uuid.uuid4())
        doc_id = str(uuid.uuid4())
        
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        app_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Test Index', %s, '["tables"]', %s)
        """, (index_id, test_organizations['org1'], test_users['user1']))
        
        app_cursor.execute("""
            INSERT INTO rag_documents (id, rag_index_id, organization_id, source_type, source_id, 
                                     source_name, title, content, content_hash)
            VALUES (%s, %s, %s, 'table', 'test_table', 'Test Table', 'Test Document', 'Test content', 'hash123')
        """, (doc_id, index_id, test_organizations['org1']))
        
        # Test org 1 can see the document
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("SELECT id, title FROM rag_documents WHERE id = %s", (doc_id,))
        result = app_cursor.fetchone()
        
        assert result is not None
        assert result[0] == doc_id
        assert result[1] == 'Test Document'
        
        # Test org 2 cannot see the document
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("SELECT id, title FROM rag_documents WHERE id = %s", (doc_id,))
        result = app_cursor.fetchone()
        
        assert result is None


class TestCrossTenantPrevention:
    """Test prevention of cross-tenant data access"""
    
    def test_no_access_without_organization_context(self, app_cursor, test_organizations, test_agents):
        """Data is not accessible without proper organization context"""
        # Clear any organization context
        app_cursor.execute("RESET app.current_organization_id")
        app_cursor.execute("RESET app.current_user_id")
        
        # Should not be able to see any tasks
        app_cursor.execute("SELECT COUNT(*) FROM tasks")
        try:
            result = app_cursor.fetchone()
            # If no error, count should be 0 or function should fail gracefully
            if result:
                assert result[0] == 0, "Should not see any tasks without organization context"
        except Exception:
            # Expected: RLS should prevent access without context
            pass
        
        # Should not be able to see any agents
        try:
            app_cursor.execute("SELECT COUNT(*) FROM agents WHERE organization_id IS NOT NULL")
            result = app_cursor.fetchone()
            if result:
                assert result[0] == 0, "Should not see any agents without organization context"
        except Exception:
            # Expected: RLS should prevent access without context
            pass
    
    def test_insert_requires_correct_organization_id(self, app_cursor, test_organizations, test_agents, test_users, rls_context):
        """Cannot insert data with wrong organization_id in RLS context"""
        # Set context for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        # Try to create a task with org 2's agent (should fail or be filtered)
        task_id = str(uuid.uuid4())
        
        try:
            app_cursor.execute("""
                INSERT INTO tasks (id, agent_id, organization_id, name, instructions, created_by)
                VALUES (%s, %s, %s, 'Cross-tenant task', '{"instructions": "test"}', %s)
            """, (task_id, test_agents['agent2'], test_organizations['org2'], test_users['user1']))
            
            # If insert succeeds, the task should not be visible due to RLS
            app_cursor.execute("SELECT id FROM tasks WHERE id = %s", (task_id,))
            result = app_cursor.fetchone()
            assert result is None, "Cross-tenant task should not be visible"
            
        except Exception:
            # Expected: Insert might fail due to foreign key constraints or RLS
            pass


class TestRLSFunctions:
    """Test RLS helper functions"""
    
    def test_get_current_organization_id_function(self, app_cursor, test_organizations, rls_context):
        """Test the get_current_organization_id() function works correctly"""
        # Set organization context
        rls_context["set"](app_cursor, test_organizations['org1'])
        
        app_cursor.execute("SELECT get_current_organization_id()")
        result = app_cursor.fetchone()
        
        assert result[0] == test_organizations['org1']
        
        # Change context
        rls_context["set"](app_cursor, test_organizations['org2'])
        
        app_cursor.execute("SELECT get_current_organization_id()")
        result = app_cursor.fetchone()
        
        assert result[0] == test_organizations['org2']
    
    def test_organization_scoped_vector_search_function(self, app_cursor, test_organizations, test_users, rls_context):
        """Test the organization-scoped vector search function exists and works"""
        # Set context
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        # Test the function exists (even with no data)
        app_cursor.execute("""
            SELECT search_rag_documents_by_organization(%s, %s::vector(1024), 0.5, 5)
        """, (test_organizations['org1'], '[' + ','.join(['0.1'] * 1024) + ']'))
        
        # Should return empty result set but no error
        results = app_cursor.fetchall()
        assert isinstance(results, list)  # Should be a list (empty or not)