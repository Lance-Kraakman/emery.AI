"""
Proper do-mpc integration with correct API mapping.
"""

import numpy as np
import do_mpc
from typing import Dict, List, Optional, Tuple, Any
from .core import SystemDescription, Goal, GoalType, Constraint, MPCPlanner


class MPCSolver:
    """do-mpc based solver with proper API integration."""
    
    def __init__(self, system: SystemDescription, planner: MPCPlanner):
        self.system = system
        self.planner = planner
        self.model = None
        self.mpc = None
        self.simulator = None
        self._setup_model()
    
    def _setup_model(self):
        """Setup do-mpc model with correct API."""
        self.model = do_mpc.model.Model('continuous')
        
        # Add variables based on system description
        for var_name, var in self.system.variables.items():
            if var.is_input:
                # Control inputs (_u)
                self.model.set_variable(var_name, '_u', var_name)
            elif var.is_output:
                # Measured outputs (_x)
                self.model.set_variable(var_name, '_x', var_name)
            else:
                # Internal states (_x)
                self.model.set_variable(var_name, '_x', var_name)
        
        # Add system dynamics equations
        self._add_dynamics()
        
        # Setup model
        self.model.setup()
    
    def _add_dynamics(self):
        """Add system dynamics. In practice, this would be generated from LLM analysis."""
        # Simple thermal system example for temperature control
        # dT_room/dt = -alpha*(T_room - T_outside) + beta*heater_power
        
        # Get CasADi variables
        T_room = self.model.x['room_temp']
        T_outside = self.model.x['outside_temp'] 
        heater_power = self.model.u['heater_power']
        
        # Parameters
        alpha = 0.1  # Heat loss coefficient
        beta = 0.5   # Heater effectiveness
        
        # System dynamics
        dT_room = -alpha * (T_room - T_outside) + beta * heater_power
        self.model.set_rhs('room_temp', dT_room)
        
        # Outside temperature dynamics (disturbance)
        dT_outside = 0.01 * (-T_outside + 20)  # Slowly returns to 20deg
        self.model.set_rhs('outside_temp', dT_outside)
    
    def setup_mpc(self, goals: List[Goal], constraints: List[Constraint]):
        """Setup MPC controller with proper do-mpc API."""
        self.mpc = do_mpc.controller.MPC(self.model)
        
        # Set prediction horizon
        self.mpc.set_param('n_horizon', self.planner.prediction_steps)
        self.mpc.set_param('t_step', self.planner.sample_time)
        
        # Set objective based on goals
        mterm = 0  # Terminal cost
        lterm = 0  # Stage cost
        
        for goal in goals:
            if goal.type == GoalType.TRACKING:
                # Tracking: minimize error from setpoint
                var = self.model.x[goal.target_variable]
                setpoint = goal.target_value if goal.target_value is not None else 0
                lterm += goal.cost_weight * (var - setpoint)**2
                
            elif goal.type == GoalType.OPTIMIZATION:
                # Optimization: minimize the variable itself (e.g., energy)
                if goal.target_variable in self.model.u:
                    var = self.model.u[goal.target_variable]
                else:
                    var = self.model.x[goal.target_variable]
                lterm += goal.cost_weight * var**2
        
        # Set objective terms
        self.mpc.set_objective(mterm=mterm, lterm=lterm)
        
        # Set bounds on variables
        for var_name, var in self.system.variables.items():
            if var.is_input:
                # Input bounds
                if var.min_value is not None:
                    self.mpc.bounds['lower', 'u', var_name] = var.min_value
                if var.max_value is not None:
                    self.mpc.bounds['upper', 'u', var_name] = var.max_value
            else:
                # State bounds  
                if var.min_value is not None:
                    self.mpc.bounds['lower', 'x', var_name] = var.min_value
                if var.max_value is not None:
                    self.mpc.bounds['upper', 'x', var_name] = var.max_value
        
        # Add additional constraints
        for constraint in constraints:
            if constraint.variable in self.model.x:
                # State constraint
                if constraint.min_value is not None:
                    self.mpc.bounds['lower', 'x', constraint.variable] = constraint.min_value
                if constraint.max_value is not None:
                    self.mpc.bounds['upper', 'x', constraint.variable] = constraint.max_value
            elif constraint.variable in self.model.u:
                # Input constraint
                if constraint.min_value is not None:
                    self.mpc.bounds['lower', 'u', constraint.variable] = constraint.min_value
                if constraint.max_value is not None:
                    self.mpc.bounds['upper', 'u', constraint.variable] = constraint.max_value
        
        # Setup MPC
        self.mpc.setup()
    
    def setup_simulator(self):
        """Setup do-mpc simulator."""
        self.simulator = do_mpc.simulator.Simulator(self.model)
        self.simulator.setup()
    
    def solve(self, current_state: Dict[str, float]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Solve MPC problem for current state."""
        if not self.mpc:
            raise ValueError("MPC not setup. Call setup_mpc() first.")
        
        # Set initial state
        x0 = self.model.x0
        for var_name, value in current_state.items():
            if var_name in x0:
                x0[var_name] = value
        
        # Solve optimization
        u0 = self.mpc.make_step(x0)
        
        # Generate predictions (simplified)
        predictions = {
            'states': {},
            'inputs': {},
            'time': np.arange(self.planner.prediction_steps) * self.planner.sample_time
        }
        
        # Extract control actions
        control_actions = {}
        for var_name in u0:
            control_actions[var_name] = float(u0[var_name])
        
        return control_actions, predictions