"""
Simple tests for MPC library.
"""

import pytest
from .core import SystemDescription, Variable, Goal, GoalType, Constraint, MPCPlanner, PlanningHorizon
from .mpc_skill import MPCSkill
from .tools import SystemBuilderTool, VariableTunerTool, ConstraintEditorTool


def test_system_description():
    """Test basic system creation."""
    system = SystemDescription("Test System", "A test system")
    
    temp_var = Variable(
        name="temperature",
        is_output=True,
        min_value=0,
        max_value=100
    )
    
    system.add_variable(temp_var)
    
    assert "temperature" in system.variables
    assert len(system.get_outputs()) == 1
    assert system.get_outputs()[0].name == "temperature"


def test_goal_creation():
    """Test goal creation."""
    goal = Goal(
        type=GoalType.TRACKING,
        target_variable="temperature",
        target_value=25.0
    )
    
    assert goal.type == GoalType.TRACKING
    assert goal.target_variable == "temperature"
    assert goal.target_value == 25.0


def test_mpc_planner():
    """Test MPC planner configuration."""
    planner = MPCPlanner()
    assert planner.horizon.value == 25  # Medium default
    assert planner.prediction_steps == 25
    
    short_planner = MPCPlanner(horizon=PlanningHorizon.SHORT)
    assert short_planner.prediction_steps == 10


def test_mpc_skill():
    """Test MPC skill basic functionality."""
    skill = MPCSkill()
    
    # Setup system
    result = skill.setup_system("Test System", "A temperature control system")
    assert "Test System" in result
    
    # Add variable
    result = skill.add_variable("temperature", "output", 0, 100)
    assert "temperature" in result
    
    # Set goal
    result = skill.set_goal("tracking", "temperature", 25.0)
    assert "tracking" in result
    
    # Set planning horizon
    result = skill.set_planning_horizon("short")
    assert "short" in result


def test_system_builder_tool():
    """Test system builder tool."""
    tool = SystemBuilderTool()
    
    result = tool("Temperature control system with heater")
    
    assert "suggested_variables" in result
    assert len(result["suggested_variables"]) > 0
    
    var_names = [v["name"] for v in result["suggested_variables"]]
    assert "temperature" in var_names
    assert "heater_power" in var_names


def test_variable_tuner_tool():
    """Test variable tuner tool."""
    tool = VariableTunerTool()
    
    result = tool("temperature", priority=2.0)
    
    assert result["variable"] == "temperature"
    assert result["priority"] == 2.0


def test_constraint_editor_tool():
    """Test constraint editor tool."""
    tool = ConstraintEditorTool()
    
    result = tool("temperature", min_val=0, max_val=100)
    
    assert result["constraint"]["variable"] == "temperature"
    assert result["constraint"]["min_value"] == 0
    assert result["constraint"]["max_value"] == 100


if __name__ == "__main__":
    # Run quick tests
    test_system_description()
    test_goal_creation()
    test_mpc_planner()
    test_mpc_skill()
    test_system_builder_tool()
    test_variable_tuner_tool()
    test_constraint_editor_tool()
    
    print("All tests passed! ✅")