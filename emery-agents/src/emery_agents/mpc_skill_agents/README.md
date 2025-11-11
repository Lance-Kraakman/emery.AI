# MPC Skill Agents Library

A clean, minimal library for MPC-based skills that integrates with smolagents.

## Architecture

**Direct UX Mapping:**
- System Description Card → `SystemDescription`
- Variable Selection Card → `Variable` class
- Goal/Use-case Card → `Goal` + `GoalType`
- Planning Horizon Card → `MPCPlanner`
- Variable Priorities Card → `VariableTunerTool`
- Constraints/Limits Card → `Constraint` class
- Generate/Preview Card → `MPCSolver` predictions

## Key Features

1. **Clean Dataclasses**: Minimal boilerplate with type hints
2. **do-mpc Integration**: Uses professional MPC solver for mathematics
3. **smolagents Compatible**: Works as tools for AI agents
4. **UX-Driven**: Direct mapping from your 8-step workflow
5. **LLM-Assisted**: Natural language system description parsing

## Quick Example

```python
from mpc_skill_agents import MPCSkill

# Create MPC skill
mpc = MPCSkill()

# Setup system
mpc.setup_system("Temperature Control", "Control room temperature")
mpc.add_variable("temperature", "output", 15, 35)
mpc.add_variable("heater_power", "input", 0, 100)

# Set goals
mpc.set_goal("tracking", "temperature", 22.0)
mpc.set_planning_horizon("medium")

# Solve
result = mpc.solve_mpc({"temperature": 20.0})
print(f"Control actions: {result['control_actions']}")
```

## Installation

```bash
pip install do-mpc numpy casadi
```

## File Structure

```
mpc_skill_agents/
├── __init__.py          # Main exports
├── core/
│   └── __init__.py      # Core dataclasses (System, Variable, Goal, etc.)
├── solver.py            # do-mpc integration
├── mpc_skill.py         # Main smolagents skill
├── tools.py             # Additional MPC tools
├── tests.py             # Simple tests
└── example.py           # Usage examples
```

## How It Works

1. **LLM parses** natural language system description
2. **Dataclasses store** system configuration cleanly  
3. **do-mpc handles** the mathematical optimization
4. **smolagents integrates** MPC as a tool for agents
5. **Predictions feed back** to the UX for visualization

This keeps the library simple while leveraging powerful tools for each part of the workflow.