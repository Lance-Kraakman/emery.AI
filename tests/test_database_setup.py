#!/usr/bin/env python3
"""
Test Database Setup
Creates an isolated test database for RLS testing
"""

import os
import psycopg2
import subprocess
import sys
from typing import Dict, Any

# Test database configuration
TEST_DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'user': 'postgres',
    'password': 'dashlet'
}

def create_test_database():
    """Create a dedicated test database"""
    test_db_name = 'emery_test'
    
    # Connect to postgres database to create test database
    admin_config = TEST_DB_CONFIG.copy()
    admin_config['database'] = 'postgres'
    
    try:
        conn = psycopg2.connect(**admin_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Drop test database if it exists
        cursor.execute(f"DROP DATABASE IF EXISTS {test_db_name}")
        print(f"✅ Dropped existing test database: {test_db_name}")
        
        # Create test database
        cursor.execute(f"CREATE DATABASE {test_db_name}")
        print(f"✅ Created test database: {test_db_name}")
        
        cursor.close()
        conn.close()
        
        return test_db_name
        
    except Exception as e:
        print(f"❌ Failed to create test database: {e}")
        return None

def setup_test_database_schema(test_db_name: str):
    """Apply migrations to test database"""
    print(f"🔧 Setting up schema in test database: {test_db_name}")
    
    # Set environment variable for test database
    env = os.environ.copy()
    env['DATABASE_URL'] = f"postgresql://postgres:dashlet@localhost:5433/{test_db_name}"
    
    try:
        # Run migrations on test database
        result = subprocess.run(
            ['pnpm', 'db:migrate'],
            env=env,
            capture_output=True,
            text=True,
            cwd='/Users/lancekraakman/orchastrate'
        )
        
        if result.returncode == 0:
            print("✅ Test database schema applied successfully")
            return True
        else:
            print(f"❌ Migration failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to apply migrations: {e}")
        return False

def create_test_app_user(test_db_name: str):
    """Create application user for RLS testing"""
    test_config = TEST_DB_CONFIG.copy()
    test_config['database'] = test_db_name
    
    try:
        conn = psycopg2.connect(**test_config)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Create test application user
        cursor.execute("""
            CREATE USER IF NOT EXISTS test_app_user WITH PASSWORD 'test_password';
            GRANT CONNECT ON DATABASE emery_test TO test_app_user;
            GRANT USAGE ON SCHEMA public TO test_app_user;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_app_user;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO test_app_user;
            GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO test_app_user;
        """)
        
        print("✅ Created test application user")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test user: {e}")
        return False

def verify_test_database(test_db_name: str):
    """Verify test database is working correctly"""
    test_config = TEST_DB_CONFIG.copy()
    test_config['database'] = test_db_name
    
    try:
        conn = psycopg2.connect(**test_config)
        cursor = conn.cursor()
        
        # Test basic functionality
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        
        # Test RLS functions exist
        cursor.execute("SELECT get_current_organization_id()")
        
        # Test tables exist
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('organizations', 'users', 'agents', 'tasks', 'rag_documents')
        """)
        tables = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Test database verification passed - found {len(tables)} key tables")
        return True
        
    except Exception as e:
        print(f"❌ Test database verification failed: {e}")
        return False

def main():
    """Setup complete test database environment"""
    print("🧪 Setting up isolated test database for RLS testing")
    print("=" * 60)
    
    # Step 1: Create test database
    test_db_name = create_test_database()
    if not test_db_name:
        sys.exit(1)
    
    # Step 2: Apply schema
    if not setup_test_database_schema(test_db_name):
        sys.exit(1)
    
    # Step 3: Create test users
    if not create_test_app_user(test_db_name):
        sys.exit(1)
    
    # Step 4: Verify setup
    if not verify_test_database(test_db_name):
        sys.exit(1)
    
    print("\n🎉 Test database setup completed successfully!")
    print(f"📝 Test database name: {test_db_name}")
    print(f"📝 Connection: postgresql://postgres:dashlet@localhost:5433/{test_db_name}")
    print("\n💡 Update your test configuration to use this database.")

if __name__ == "__main__":
    main()