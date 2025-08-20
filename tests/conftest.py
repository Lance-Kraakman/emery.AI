"""
Pytest configuration for RLS testing
Provides fixtures for database connections and test data setup
"""

import pytest
import psycopg2
import uuid
from datetime import datetime
from typing import Dict, Any, Generator

# Database configuration - using test container
DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,  # Test container port
    'database': 'emery_test',
    'user': 'postgres',
    'password': 'test_password'
}

@pytest.fixture(scope="session")
def db_connection():
    """Create a database connection for the test session"""
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    yield conn
    conn.close()

@pytest.fixture(scope="function")
def db_cursor(db_connection):
    """Create a database cursor for each test function"""
    cursor = db_connection.cursor()
    yield cursor
    cursor.close()

@pytest.fixture(scope="function")
def app_user_connection():
    """Create a connection as the application user (non-superuser) for RLS testing"""
    app_config = DB_CONFIG.copy()
    app_config.update({'user': 'test_app_user', 'password': 'test_password'})
    
    try:
        conn = psycopg2.connect(**app_config)
        conn.autocommit = True
        yield conn
        conn.close()
    except psycopg2.OperationalError:
        # Create app_user if it doesn't exist
        admin_conn = psycopg2.connect(**DB_CONFIG)
        admin_conn.autocommit = True
        admin_cursor = admin_conn.cursor()
        
        try:
            admin_cursor.execute("""
                CREATE USER test_app_user WITH PASSWORD 'test_password';
                GRANT CONNECT ON DATABASE emery_test TO test_app_user;
                GRANT USAGE ON SCHEMA public TO test_app_user;
                GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_app_user;
                GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO test_app_user;
                GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO test_app_user;
            """)
        except psycopg2.errors.DuplicateObject:
            pass  # User already exists
        
        admin_cursor.close()
        admin_conn.close()
        
        # Try connecting again
        conn = psycopg2.connect(**app_config)
        conn.autocommit = True
        yield conn
        conn.close()

@pytest.fixture(scope="function")
def app_cursor(app_user_connection):
    """Create an application user cursor for RLS testing"""
    cursor = app_user_connection.cursor()
    yield cursor
    cursor.close()

@pytest.fixture(scope="function")
def test_organizations(db_cursor) -> Dict[str, int]:
    """Create test organizations for isolation testing"""
    orgs = {}
    
    # Create Organization 1
    db_cursor.execute("""
        INSERT INTO organizations (name, mission) 
        VALUES ('Test Org 1', 'First test organization')
        RETURNING id
    """)
    orgs['org1'] = db_cursor.fetchone()[0]
    
    # Create Organization 2
    db_cursor.execute("""
        INSERT INTO organizations (name, mission) 
        VALUES ('Test Org 2', 'Second test organization')
        RETURNING id
    """)
    orgs['org2'] = db_cursor.fetchone()[0]
    
    yield orgs
    
    # Cleanup (delete dependent records first)
    db_cursor.execute("DELETE FROM rag_documents WHERE organization_id IN (%s, %s)", (orgs['org1'], orgs['org2']))
    db_cursor.execute("DELETE FROM rag_indexes WHERE organization_id IN (%s, %s)", (orgs['org1'], orgs['org2']))
    db_cursor.execute("DELETE FROM organizations WHERE id IN (%s, %s)", (orgs['org1'], orgs['org2']))

@pytest.fixture(scope="function")
def test_users(db_cursor, test_organizations) -> Dict[str, str]:
    """Create test users for each organization"""
    users = {}
    
    # Generate unique emails to avoid constraint violations
    test_id = str(uuid.uuid4())[:8]
    
    # User for Org 1
    user1_id = str(uuid.uuid4())
    db_cursor.execute("""
        INSERT INTO users (id, name, email, current_organization_id) 
        VALUES (%s, 'User 1', %s, %s)
    """, (user1_id, f'user1-{test_id}@test.com', test_organizations['org1']))
    users['user1'] = user1_id
    
    # User for Org 2
    user2_id = str(uuid.uuid4())
    db_cursor.execute("""
        INSERT INTO users (id, name, email, current_organization_id) 
        VALUES (%s, 'User 2', %s, %s)
    """, (user2_id, f'user2-{test_id}@test.com', test_organizations['org2']))
    users['user2'] = user2_id
    
    # Create user-organization relationships
    db_cursor.execute("""
        INSERT INTO user_organizations (user_id, organization_id, role) 
        VALUES (%s, %s, 'admin'), (%s, %s, 'admin')
    """, (user1_id, test_organizations['org1'], user2_id, test_organizations['org2']))
    
    yield users
    
    # Cleanup (delete dependent records first)
    db_cursor.execute("DELETE FROM rag_documents WHERE organization_id IN (%s, %s)", (test_organizations['org1'], test_organizations['org2']))
    db_cursor.execute("DELETE FROM rag_indexes WHERE organization_id IN (%s, %s)", (test_organizations['org1'], test_organizations['org2']))
    db_cursor.execute("DELETE FROM users WHERE id IN (%s, %s)", (users['user1'], users['user2']))

@pytest.fixture(scope="function")
def test_agents(db_cursor, test_organizations, test_users) -> Dict[str, int]:
    """Create test agents for each organization"""
    agents = {}
    
    # Agent for Org 1
    db_cursor.execute("""
        INSERT INTO agents (name, owner_id, organization_id, description) 
        VALUES ('Agent 1', %s, %s, 'Test agent for org 1')
        RETURNING id
    """, (test_users['user1'], test_organizations['org1']))
    agents['agent1'] = db_cursor.fetchone()[0]
    
    # Agent for Org 2
    db_cursor.execute("""
        INSERT INTO agents (name, owner_id, organization_id, description) 
        VALUES ('Agent 2', %s, %s, 'Test agent for org 2')
        RETURNING id
    """, (test_users['user2'], test_organizations['org2']))
    agents['agent2'] = db_cursor.fetchone()[0]
    
    yield agents
    
    # Cleanup (delete tasks first due to foreign keys)
    db_cursor.execute("DELETE FROM tasks WHERE agent_id IN (%s, %s)", (agents['agent1'], agents['agent2']))
    db_cursor.execute("DELETE FROM agents WHERE id IN (%s, %s)", (agents['agent1'], agents['agent2']))

@pytest.fixture(scope="function")
def rls_context():
    """Helper to set RLS context in database connections"""
    def set_context(cursor, org_id: int, user_id: str = None):
        cursor.execute(f"SET app.current_organization_id = {org_id}")
        if user_id:
            cursor.execute(f"SET app.current_user_id = '{user_id}'")
    
    def clear_context(cursor):
        cursor.execute("RESET app.current_organization_id")
        cursor.execute("RESET app.current_user_id")
    
    return {"set": set_context, "clear": clear_context}