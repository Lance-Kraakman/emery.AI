"""
Integration example for MPC skill with emery-agents system.

This shows how to use the MPC library within your existing agent framework.
"""

import sys
import os

from emery_agents.mpc_skill_agents.mpc_skill import MPCSkill
from emery_agents.mpc_skill_agents.core import PlanningHorizon
sys.path.append(os.path.dirname(__file__))


def main():
    """Example of using MPC skill with emery-agents."""
    
    print("🤖 Testing MPC Skill Integration...")
    
    # Create MPC skill
    mpc_skill = MPCSkill()
    
    # Setup a simple temperature control system
    print("🔧 Setting up MPC system...")
    mpc_skill.setup_system(
        name="Room Temperature Control",
        description="Maintain comfortable room temperature using heater control"
    )
    
    # Add system variables
    mpc_skill.add_variable("room_temp", "output", 15.0, 35.0)
    mpc_skill.add_variable("heater_power", "input", 0.0, 100.0)
    mpc_skill.add_variable("outside_temp", "output", -10.0, 45.0)
    
    # Set control goals
    mpc_skill.set_goal("tracking", "room_temp", 22.0)
    mpc_skill.set_goal("optimization", "heater_power", 0.0)  # Minimize energy (target = 0)
    
    # Set planning parameters
    result = mpc_skill.set_planning_horizon(PlanningHorizon.MEDIUM)
    print(f"📅 Planner setup result: {result}")
    
    print(f"🎯 Goals set: {len(mpc_skill.goals)} goals")
    print(f"📋 System variables: {len(mpc_skill.system.variables)} variables")
    if mpc_skill.planner:
        print(f"⏰ Planner: {mpc_skill.planner.horizon.name} horizon")
    else:
        print("❌ Planner is None")
    
    print("✅ MPC system configured!")
    
    # Test with sample data
    current_state = {
        "room_temp": 20.0,
        "outside_temp": 15.0,
        "heater_power": 50.0
    }
    
    print(f"🌡️ Current state: {current_state}")
    
    # Solve MPC problem
    result = mpc_skill.solve_mpc(current_state)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print("✅ MPC solution found!")
        print(f"📊 Control actions: {result.get('control_actions', {})}")
        print(f"📈 Predictions available: {len(result.get('predictions', {}))}")
    
    print("\n🎉 MPC skill integration ready!")
    print("📋 Next steps:")
    print("   1. Add to your emery-agents skill registry")
    print("   2. Configure with your LLM API")
    print("   3. Integrate with your gRPC services")
    print("   4. Connect to UX frontend")

if __name__ == "__main__":
    main()