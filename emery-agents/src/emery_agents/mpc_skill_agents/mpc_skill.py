"""
MPC skill for smolagents integration.
"""

from typing import Dict, List, Any, Optional
from smolagents import Tool
from .core import SystemDescription, Variable, Goal, GoalType, Constraint, MPCPlanner, PlanningHorizon
from .solver import MPCSolver


class MPCSkill(Tool):
    """Main MPC skill for smolagents agents."""
    
    name = "mpc_control"
    description = "Model Predictive Control skill for optimization and control tasks"
    inputs = {
        "action": {
            "type": "string", 
            "description": "MPC action to execute"
        },
        "parameters": {
            "type": "string", 
            "description": "Parameters for the MPC action (JSON string)",
            "nullable": True
        }
    }
    output_type = "string"
    
    def __init__(self):
        super().__init__()
        self.solver: Optional[MPCSolver] = None
        self.system: Optional[SystemDescription] = None
        self.planner: Optional[MPCPlanner] = None
        self.goals: List[Goal] = []
        self.constraints: List[Constraint] = []
    
    def setup_system(self, name: str, description: str) -> str:
        """Setup MPC system from natural language description."""
        self.system = SystemDescription(name=name, description=description)
        return f"Created MPC system: {name}"
    
    def add_variable(self, name: str, var_type: str = "output", 
                     min_val: float = None, max_val: float = None) -> str:
        """Add a variable to the MPC system."""
        if not self.system:
            return "Error: Setup system first"
        
        var = Variable(
            name=name,
            is_input=(var_type == "input"),
            is_output=(var_type == "output"),
            min_value=min_val,
            max_value=max_val
        )
        self.system.add_variable(var)
        return f"Added variable: {name}"
    
    def set_goal(self, goal_type: str, target_var: str, target_val: float = None) -> str:
        """Set control goal."""
        try:
            goal = Goal(
                type=GoalType(goal_type),
                target_variable=target_var,
                target_value=target_val
            )
            self.goals.append(goal)
            return f"Set {goal_type} goal for {target_var}"
        except ValueError:
            return f"Invalid goal type: {goal_type}. Use tracking, optimization, or stabilization"
    
    def set_planning_horizon(self, horizon: str = "medium") -> str:
        """Set planning horizon."""
        try:
            self.planner = MPCPlanner(horizon=PlanningHorizon(horizon))
            return f"Set planning horizon to {horizon}"
        except ValueError:
            return f"Invalid horizon: {horizon}. Use short, medium, or long"
    
    def solve_mpc(self, current_state: Dict[str, float]) -> Dict[str, Any]:
        """Solve MPC problem and return control actions."""
        if not all([self.system, self.planner, self.goals]):
            return {"error": "Setup system, planner, and goals first"}
        
        try:
            self.solver = MPCSolver(self.system, self.planner)
            self.solver.setup_mpc(self.goals, self.constraints)
            
            control_actions, predictions = self.solver.solve(current_state)
            
            return {
                "control_actions": control_actions,
                "predictions": predictions,
                "status": "success"
            }
        except Exception as e:
            return {"error": str(e), "status": "failed"}
    
    def forward(self, action: str, parameters: str = "{}") -> str:
        """Main entry point for smolagents."""
        # Parse natural language input and route to appropriate method
        # This is a simplified version - in practice would use LLM parsing
        
        if "setup" in action.lower() and "system" in action.lower():
            # Extract system name and description from input
            return self.setup_system("MPC System", action)
        
        elif "add" in action.lower() and "variable" in action.lower():
            # Parse variable addition
            return "Use add_variable() method with specific parameters"
        
        elif "solve" in action.lower() or "optimize" in action.lower():
            # Parse current state and solve
            current_state = {}  # Would parse from input
            result = self.solve_mpc(current_state)
            return f"MPC Solution: {result}"
        
        else:
            return "MPC Skill ready. Use commands: setup system, add variable, set goal, solve mpc"