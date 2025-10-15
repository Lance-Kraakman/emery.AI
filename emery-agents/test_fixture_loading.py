#!/usr/bin/env python3
"""
Test Fixture Loading

AIDEV-NOTE: Quick test to verify fixture loading works correctly
before running the full agent test runner.
"""

import os
import sys

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from tests.fixtures.fixture_loader import FixtureLoader


def test_fixture_loading():
    """Test that fixture loading works correctly."""
    print("🧪 Testing Fixture Loading...")
    print("=" * 50)
    
    loader = FixtureLoader()
    
    # Test agent loading
    print("📋 Loading agents...")
    agents = loader.load_agents()
    print(f"✅ Loaded {len(agents)} agents:")
    for i, agent in enumerate(agents, 1):
        print(f"   {i}. {agent.name} ({agent.role})")
        print(f"      📝 {agent.description}")
        print(f"      🎭 Persona: {agent.persona}")
        print(f"      🔧 Tools: {len(agent.tools)}")
        print(f"      📚 Capabilities: {len(agent.capabilities)}")
        
        # Show capabilities
        for cap in agent.capabilities:
            print(f"         - {cap.name}: {len(cap.steps)} steps")
        print()
    
    # Test task loading
    print("📋 Loading tasks...")
    tasks = loader.load_tasks()
    print(f"✅ Loaded {len(tasks)} tasks:")
    for task_data in tasks:
        print(f"   📋 {task_data['name']} (Agent {task_data['agentId']})")
        print(f"      Status: {task_data.get('status', 'unknown')}")
        if 'capabilityName' in task_data:
            print(f"      Capability: {task_data['capabilityName']}")
        if 'instructions' in task_data:
            if isinstance(task_data['instructions'], dict):
                print(f"      Instructions: {task_data['instructions']['instructions'][:60]}...")
            else:
                print(f"      Instructions: {task_data['instructions'][:60]}...")
        print()
    
    # Test scenario creation
    print("📋 Creating test scenarios...")
    scenarios = loader.get_test_scenarios()
    print(f"✅ Created {len(scenarios)} scenarios:")
    for i, scenario in enumerate(scenarios, 1):
        execution_mode = scenario["execution_mode"]
        mode_icon = "🎯" if execution_mode == "capability" else "🧠"
        
        print(f"   {i:2d}. {mode_icon} {scenario['name']}")
        print(f"       Mode: {execution_mode}-based execution")
        
        task = scenario["task"]
        if task.capability_name:
            print(f"       Capability: {task.capability_name}")
        elif task.instruction_config:
            print(f"       Auto-routing: {task.instruction_config.instructions[:50]}...")
        print()
    
    print("🎉 Fixture loading test completed successfully!")
    print(f"📊 Summary: {len(agents)} agents, {len(tasks)} tasks, {len(scenarios)} scenarios")
    

if __name__ == "__main__":
    test_fixture_loading()