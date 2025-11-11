"""
Example usage of the MPC Skill Library.

This demonstrates how to use the MPC library with smolagents.
"""

from smolagents import CodeAgent, DuckDuckGoSearchTool
from mpc_skill_agents import MPCSkill, SystemDescription, Variable, Goal, GoalType

def main():
    """Example MPC control scenario."""
    
    # Create MPC skill
    mpc_skill = MPCSkill()
    
    # Setup a temperature control system
    print("🔧 Setting up MPC system...")
    mpc_skill.setup_system(
        name="Temperature Control", 
        description="Control room temperature using heater power"
    )
    
    # Add variables
    mpc_skill.add_variable("temperature", "output", min_val=15, max_val=35)
    mpc_skill.add_variable("heater_power", "input", min_val=0, max_val=100)
    
    # Set tracking goal
    mpc_skill.set_goal("tracking", "temperature", target_val=22.0)
    
    # Set planning horizon
    mpc_skill.set_planning_horizon("medium")
    
    print("✅ MPC system configured!")
    
    # Create agent with MPC skill
    agent = CodeAgent(
        tools=[mpc_skill, DuckDuckGoSearchTool()],
        model="gpt-4o-mini"
    )
    
    # Test the MPC skill
    current_state = {"temperature": 20.0}
    
    print("🎯 Solving MPC problem...")
    result = mpc_skill.solve_mpc(current_state)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print(f"✅ Solution found: {result['control_actions']}")
        print(f"📈 Predictions: {result['predictions']}")
    
    # Example with agent
    print("\n🤖 Testing with smolagents...")
    response = agent.run(
        "Use the MPC skill to optimize the temperature control system"
    )
    print(f"Agent response: {response}")


if __name__ == "__main__":
    main()