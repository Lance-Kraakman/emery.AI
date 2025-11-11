"""
Refactored integration test with proper data flow and type safety.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from emery_agents.mpc_skill_agents.mpc_skill_refactored import MPCSkill
from emery_agents.mpc_skill_agents.core import (
    VariableConfig, GoalConfig, Constraint, PlanningHorizon, GoalType
)


def main():
    """Test refactored MPC system with proper data flow."""
    
    print("🔧 Testing Refactored MPC System...")
    
    # Create MPC skill
    mpc = MPCSkill()
    
    # Setup system
    result = mpc.setup_system(
        name="Temperature Control System",
        description="Room temperature control with heater"
    )
    print(f"✅ {result}")
    
    # Add variables using type-safe configs
    variables = [
        VariableConfig(name="room_temp", var_type="output", min_val=15.0, max_val=35.0),
        VariableConfig(name="heater_power", var_type="input", min_val=0.0, max_val=100.0),
        VariableConfig(name="outside_temp", var_type="output", min_val=-10.0, max_val=45.0)
    ]
    
    for var_config in variables:
        result = mpc.add_variable(var_config)
        print(f"✅ {result}")
    
    # Set goals using type-safe configs
    goals = [
        GoalConfig(
            goal_type=GoalType.TRACKING, 
            target_var="room_temp", 
            target_val=22.0, 
            cost_weight=2.0
        ),
        GoalConfig(
            goal_type=GoalType.OPTIMIZATION, 
            target_var="heater_power", 
            target_val=0.0,  # Minimize energy
            cost_weight=1.0
        )
    ]
    
    for goal_config in goals:
        result = mpc.set_goal(goal_config)
        print(f"✅ {result}")
    
    # Add constraints
    heater_constraint = Constraint(
        variable="heater_power",
        min_value=0.0,
        max_value=100.0
    )
    result = mpc.add_constraint(heater_constraint)
    print(f"✅ {result}")
    
    # Set planning horizon
    result = mpc.set_planning_horizon(PlanningHorizon.MEDIUM)
    print(f"✅ {result}")
    
    # Get status
    status = mpc.get_status()
    print(f"\n📊 MPC Status: {status}")
    
    # Test solve
    current_state = {
        "room_temp": 20.0,
        "outside_temp": 15.0,
        "heater_power": 50.0
    }
    
    print(f"\n🌡️ Current state: {current_state}")
    
    result = mpc.solve_mpc(current_state)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print("✅ MPC solution found!")
        print(f"📊 Control actions: {result.get('control_actions', {})}")
        print(f"📈 Predictions: {result.get('predictions', {})}")
    
    # Test smolagents integration
    print(f"\n🤖 Testing smolagents integration...")
    
    # Test status command
    result = mpc.forward("status", "{}")
    print(f"Status command: {result}")
    
    # Test solve command  
    result = mpc.forward("solve", '{"room_temp": 20.0}')
    print(f"Solve command: {result}")
    
    print("\n🎉 Refactored MPC system complete!")
    print("📋 Improvements:")
    print("   ✅ Type-safe configuration objects")
    print("   ✅ Centralized configuration state")
    print("   ✅ Better error handling")
    print("   ✅ Clean data flow")
    print("   ✅ Status monitoring")
    print("   ✅ Ready for emery-agents integration")


if __name__ == "__main__":
    main()