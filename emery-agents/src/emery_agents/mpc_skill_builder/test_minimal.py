#!/usr/bin/env python3
"""
Minimal test for MPC Skill Builder - check imports and basic structure.
"""

import os
import sys

# Add parent directory to Python path for imports
sys.path.insert(0, '/Users/lancekraakman/orchastrate/emery-agents/src')

print("🔧 Testing MPC Skill Builder imports...")

try:
    # Test individual imports
    from emery_agents.mpc_skill_builder.types import SkillSchema, VariableType, ObjectiveType
    print("✅ Successfully imported types")
    
    from emery_agents.mpc_skill_builder.schemas import ComponentExtraction, SystemDynamics
    print("✅ Successfully imported schemas")
    
    from emery_agents.mpc_skill_builder.client import HuggingFaceClient
    print("✅ Successfully imported client")
    
    from emery_agents.mpc_skill_builder.generator import MPCSkillBuilder
    print("✅ Successfully imported generator")
    
    # Test basic object creation (without API calls)
    print("\n🔧 Testing basic object creation...")
    
    # Test SkillSchema creation
    schema = SkillSchema(
        system_description="Test system",
        states=[],
        inputs=[],
        outputs=[],
        dynamics=None,
        objectives=[],
        constraints=[],
        planning=None,
        external_factors=[],
        variable_priorities={}
    )
    print("✅ Successfully created SkillSchema object")
    
    # Test enum values
    print(f"📊 VariableType values: {[vt.value for vt in VariableType]}")
    print(f"🎯 ObjectiveType values: {[ot.value for ot in ObjectiveType]}")
    
    print("\n✅ All basic tests passed!")
    print("🚀 MPC Skill Builder is ready for use!")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Checking file structure...")
    
    # Check if files exist
    base_path = "/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_builder"
    files = ["__init__.py", "types.py", "schemas.py", "client.py", "generator.py"]
    
    for file in files:
        path = os.path.join(base_path, file)
        exists = "✅" if os.path.exists(path) else "❌"
        print(f"  {exists} {file}")
    
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()