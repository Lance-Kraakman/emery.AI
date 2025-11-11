"""
Refactored MPC skill with proper data flow and type safety.
"""

from typing import Dict, List, Any, Optional, Union
from smolagents import Tool
from dataclasses import dataclass
from .core import (
    SystemDescription, Variable, Goal, GoalType, Constraint, 
    MPCPlanner, PlanningHorizon
)
from .solver_working import MPCSolver


@dataclass
class VariableConfig:
    """Configuration for adding variables."""
    name: str
    var_type: str = "output"
    min_val: Optional[float] = None
    max_val: Optional[float] = None


@dataclass 
class GoalConfig:
    """Configuration for setting goals."""
    goal_type: GoalType
    target_var: str
    target_val: Optional[float] = None
    cost_weight: float = 1.0


@dataclass
class MPCConfig:
    """Complete MPC configuration."""
    system: Optional[SystemDescription] = None
    planner: Optional[MPCPlanner] = None
    goals: List[Goal] = None
    constraints: List[Constraint] = None
    
    def __post_init__(self):
        if self.goals is None:
            self.goals = []
        if self.constraints is None:
            self.constraints = []
    
    def is_ready(self) -> bool:
        """Check if MPC is properly configured."""
        return all([self.system, self.planner, self.goals])


class MPCSkill(Tool):
    """Refactored MPC skill with proper data flow."""
    
    name = "mpc_control"
    description = "Model Predictive Control skill for optimization and control tasks"
    inputs = {
        "action": {
            "type": "string", 
            "description": "MPC action to execute"
        },
        "parameters": {
            "type": "string", 
            "description": "Parameters for MPC action (JSON string)",
            "nullable": True
        }
    }
    output_type = "string"
    
    def __init__(self):
        super().__init__()
        self.config = MPCConfig()
        self.solver: Optional[MPCSolver] = None
    
    def setup_system(self, name: str, description: str) -> str:
        """Setup MPC system."""
        self.config.system = SystemDescription(name=name, description=description)
        return f"Created MPC system: {name}"
    
    def add_variable(self, config: Union[VariableConfig, Dict]) -> str:
        """Add variable using type-safe configuration."""
        if not self.config.system:
            return "Error: Setup system first"
        
        if isinstance(config, dict):
            config = VariableConfig(**config)
        
        var = Variable(
            name=config.name,
            is_input=(config.var_type == "input"),
            is_output=(config.var_type == "output"),
            min_value=config.min_val,
            max_value=config.max_val
        )
        self.config.system.add_variable(var)
        return f"Added variable: {config.name}"
    
    def set_goal(self, config: Union[GoalConfig, Dict]) -> str:
        """Set goal using type-safe configuration."""
        if isinstance(config, dict):
            config = GoalConfig(**config)
        
        goal = Goal(
            type=config.goal_type,
            target_variable=config.target_var,
            target_value=config.target_val,
            cost_weight=config.cost_weight
        )
        self.config.goals.append(goal)
        return f"Set {config.goal_type.value} goal for {config.target_var}"
    
    def set_planning_horizon(self, horizon: PlanningHorizon) -> str:
        """Set planning horizon."""
        self.config.planner = MPCPlanner(horizon=horizon)
        return f"Set planning horizon to {horizon.name}"
    
    def add_constraint(self, constraint: Constraint) -> str:
        """Add constraint to system."""
        self.config.constraints.append(constraint)
        return f"Added constraint for {constraint.variable}"
    
    def solve_mpc(self, current_state: Dict[str, float]) -> Dict[str, Any]:
        """Solve MPC problem."""
        if not self.config.is_ready():
            return {"error": "Setup system, planner, and goals first"}
        
        try:
            self.solver = MPCSolver(self.config.system, self.config.planner)
            self.solver.setup_mpc(self.config.goals, self.config.constraints)
            
            control_actions, predictions = self.solver.solve(current_state)
            
            return {
                "control_actions": control_actions,
                "predictions": predictions,
                "status": "success"
            }
        except Exception as e:
            return {"error": str(e), "status": "failed"}
    
    def get_status(self) -> Dict[str, Any]:
        """Get current MPC configuration status."""
        return {
            "system": self.config.system.name if self.config.system else None,
            "variables": len(self.config.system.variables) if self.config.system else 0,
            "goals": len(self.config.goals),
            "constraints": len(self.config.constraints),
            "planner": self.config.planner.horizon.name if self.config.planner else None,
            "ready": self.config.is_ready()
        }
    
    def forward(self, action: str, parameters: str = "{}") -> str:
        """Main entry point for smolagents."""
        if "status" in action.lower():
            status = self.get_status()
            return f"MPC Status: {status}"
        
        elif "solve" in action.lower() or "optimize" in action.lower():
            current_state = {}  # Would parse from parameters
            result = self.solve_mpc(current_state)
            return f"MPC Solution: {result}"
        
        else:
            return "MPC Skill ready. Use: status, solve, optimize"