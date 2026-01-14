#!/usr/bin/env python3
"""
Create test fixtures for evals.
Creates tables and agents, updates .env with IDs.
"""

import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path


def api_request(url: str, method: str = "GET", data: dict = None, api_key: str = None) -> dict:
    """Make API request and return JSON response."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()}"}
    except Exception as e:
        return {"error": str(e)}


def extract_id(obj) -> int | None:
    """Extract ID from various response formats."""
    if obj is None:
        return None
    if isinstance(obj, int):
        return obj
    if isinstance(obj, dict):
        # Handle {_value, _type} format
        if "_value" in obj:
            return obj["_value"]
        if "id" in obj:
            return extract_id(obj["id"])
    return None


def main():
    # Load environment
    base_url = os.environ.get("EMERY_BASE_URL", "http://localhost:3002")
    api_key = os.environ.get("EMERY_API_KEY", "")
    database_id = int(os.environ.get("TEST_DATABASE_ID", "1"))

    if not api_key:
        print("ERROR: EMERY_API_KEY required")
        print("  export EMERY_API_KEY=user_xxx")
        sys.exit(1)

    # Check API health
    print("Checking API...")
    health = api_request(f"{base_url}/api/health")
    if "error" in health:
        print(f"ERROR: API not reachable at {base_url}")
        sys.exit(1)
    print("API is up")

    # Get organization ID from databases
    print("Getting organization ID...")
    dbs = api_request(f"{base_url}/api/databases", api_key=api_key)
    if "error" in dbs or not dbs.get("data"):
        print(f"ERROR: Could not get databases: {dbs}")
        sys.exit(1)

    org_id = dbs["data"][0].get("organizationId")
    print(f"Organization ID: {org_id}")

    # Create test table
    print("\nCreating test table...")
    table_resp = api_request(
        f"{base_url}/api/tables",
        method="POST",
        data={"name": "Eval Test Table", "databaseId": database_id, "description": "Created by eval setup"},
        api_key=api_key
    )

    table_id = extract_id(table_resp.get("data")) or extract_id(table_resp)
    if table_id:
        print(f"Created table ID: {table_id}")
    else:
        # Try to find existing table
        print(f"Table creation response: {table_resp}")
        tables = api_request(f"{base_url}/api/tables?databaseId={database_id}", api_key=api_key)
        if tables.get("data"):
            table_id = extract_id(tables["data"][0])
            print(f"Using existing table ID: {table_id}")
        else:
            table_id = 1
            print(f"Warning: Using default table ID: {table_id}")

    # Check existing agents
    print("\nChecking agents...")
    agents_resp = api_request(f"{base_url}/api/agents", api_key=api_key)
    agents = agents_resp.get("agents", [])
    print(f"Found {len(agents)} existing agent(s)")

    # Find or create agents
    test_agent_id = None
    schema_builder_id = None
    skill_builder_id = None

    for agent in agents:
        agent_id = extract_id(agent)
        role = agent.get("role", "")
        if not test_agent_id:
            test_agent_id = agent_id
        if role == "schema_builder":
            schema_builder_id = agent_id
        elif role == "skill_builder":
            skill_builder_id = agent_id

    # Create missing agents
    def create_agent(name: str, role: str, description: str) -> int | None:
        print(f"Creating agent: {name} (role: {role})...")
        # Pass empty trigger to avoid API's broken default
        resp = api_request(
            f"{base_url}/api/agents",
            method="POST",
            data={
                "name": name,
                "role": role,
                "description": description,
                "organizationId": str(org_id),
                "trigger": None,  # Explicitly pass null to skip default
            },
            api_key=api_key
        )
        agent_id = extract_id(resp.get("agent")) or extract_id(resp.get("data")) or extract_id(resp)
        if agent_id:
            print(f"  Created agent ID: {agent_id}")
            return agent_id
        else:
            print(f"  Failed: {resp}")
            return None

    if not test_agent_id:
        test_agent_id = create_agent("Eval Test Agent", "general", "General purpose agent for eval tests")

    if not schema_builder_id:
        schema_builder_id = create_agent("Eval Schema Builder", "schema_builder", "Schema builder agent for eval tests")

    if not skill_builder_id:
        skill_builder_id = create_agent("Eval Skill Builder", "skill_builder", "Skill builder agent for eval tests")

    # Fallback
    schema_builder_id = schema_builder_id or test_agent_id
    skill_builder_id = skill_builder_id or test_agent_id

    # Output results
    print("\n" + "=" * 40)
    print("Test Fixtures:")
    print(f"TEST_DATABASE_ID={database_id}")
    print(f"TEST_TABLE_ID={table_id}")
    print(f"TEST_AGENT_ID={test_agent_id}")
    print(f"SCHEMA_BUILDER_AGENT_ID={schema_builder_id}")
    print(f"SKILL_BUILDER_AGENT_ID={skill_builder_id}")
    print("=" * 40)

    # Update .env file
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        # Read existing, filter out old values
        lines = []
        skip_keys = {"TEST_TABLE_ID", "TEST_AGENT_ID", "SCHEMA_BUILDER_AGENT_ID", "SKILL_BUILDER_AGENT_ID"}
        with open(env_path) as f:
            for line in f:
                if not any(line.startswith(f"{k}=") for k in skip_keys):
                    lines.append(line.rstrip())

        # Add new values
        lines.append(f"TEST_TABLE_ID={table_id}")
        lines.append(f"TEST_AGENT_ID={test_agent_id}")
        lines.append(f"SCHEMA_BUILDER_AGENT_ID={schema_builder_id}")
        lines.append(f"SKILL_BUILDER_AGENT_ID={skill_builder_id}")

        with open(env_path, "w") as f:
            f.write("\n".join(lines) + "\n")

        print("\nUpdated .env file")

    print("\nSetup complete! Run: ./run-evals.sh")


if __name__ == "__main__":
    main()
