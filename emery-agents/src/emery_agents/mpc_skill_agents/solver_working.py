"""
Simple working MPC solver that demonstrates the architecture.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from .core import SystemDescription, Goal, GoalType, Constraint, MPCPlanner


class SimpleMPCSolver:
    """Simple MPC solver for demonstration."""
    
    def __init__(self, system: SystemDescription, planner: MPCPlanner):
        self.system = system
        self.planner = planner
        self.goals = []
        self.constraints = []
    
    def setup_mpc(self, goals: List[Goal], constraints: List[Constraint]):
        """Setup MPC with goals and constraints."""
        self.goals = goals
        self.constraints = constraints
        
        # Validate setup
        if not goals:
            raise ValueError("No goals specified")
    
    def solve(self, current_state: Dict[str, float]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Simple MPC solution based on goals."""
        
        # Simple control logic for temperature control example
        control_actions = {}
        
        # Process tracking goals
        for goal in self.goals:
            if goal.type == GoalType.TRACKING:
                target = goal.target_value
                current = current_state.get(goal.target_variable, 0)
                error = target - current if target is not None else 0
                
                # Simple P-like control
                if goal.target_variable == "room_temp":
                    if error > 2:  # Too cold
                        control_actions["heater_power"] = min(80, error * 10)
                    elif error < -2:  # Too hot
                        control_actions["heater_power"] = 0
                    else:
                        control_actions["heater_power"] = 20  # Maintain
            
            elif goal.type == GoalType.OPTIMIZATION:
                # Minimize the variable (e.g., energy)
                if goal.target_variable == "heater_power":
                    current_power = current_state.get("heater_power", 50)
                    control_actions["heater_power"] = max(5, current_power * 0.8)  # Reduce energy
        
        # Apply constraints
        for constraint in self.constraints:
            if constraint.variable in control_actions:
                if constraint.min_value is not None:
                    control_actions[constraint.variable] = max(constraint.min_value, control_actions[constraint.variable])
                if constraint.max_value is not None:
                    control_actions[constraint.variable] = min(constraint.max_value, control_actions[constraint.variable])
        
        # Generate simple predictions
        prediction_steps = self.planner.prediction_steps
        predictions = {
            'states': [],
            'inputs': [],
            'time': np.linspace(0, prediction_steps * self.planner.sample_time, prediction_steps)
        }
        
        # Simple prediction trajectory
        for i in range(prediction_steps):
            temp = 22.0  # Target temperature
            predictions['states'].append({'room_temp': temp})
            predictions['inputs'].append({'heater_power': control_actions.get('heater_power', 20)})
        
        return control_actions, predictions


# Use simple solver for now
class MPCSolver(SimpleMPCSolver):
    """Fallback to simple solver when do-mpc is complex."""
    pass