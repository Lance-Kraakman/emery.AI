"""
Archetype mappings for abstract terms to MPC concepts.
"""

from typing import Dict, List, Tuple
import re


# Archetype mappings for common terms
ARCHETYPE_MAPPINGS = {
    # State variables (things that evolve over time)
    "states": {
        "queue": {"name": "queue_size", "type": "discrete", "description": "Number of items waiting in queue"},
        "workload": {"name": "workload", "type": "continuous", "description": "Current workload or utilization"},
        "load": {"name": "load_factor", "type": "continuous", "description": "System load factor"},
        "inventory": {"name": "inventory_level", "type": "discrete", "description": "Current inventory count"},
        "position": {"name": "position", "type": "continuous", "description": "Position in space"},
        "velocity": {"name": "velocity", "type": "continuous", "description": "Rate of change of position"},
        "temperature": {"name": "temperature", "type": "continuous", "description": "Temperature measurement"},
        "pressure": {"name": "pressure", "type": "continuous", "description": "Pressure measurement"},
        "level": {"name": "level", "type": "continuous", "description": "Level or height measurement"},
        "balance": {"name": "balance", "type": "continuous", "description": "Current balance or amount"},
        "capacity": {"name": "capacity_utilization", "type": "continuous", "description": "Percentage of capacity used"},
        "utilization": {"name": "utilization_rate", "type": "continuous", "description": "Resource utilization rate"},
        "backlog": {"name": "backlog_size", "type": "discrete", "description": "Number of pending items"},
        "progress": {"name": "progress_rate", "type": "continuous", "description": "Rate of progress completion"},
        "completion": {"name": "completion_rate", "type": "continuous", "description": "Task completion rate"},
    },
    
    # Control variables (actions we can take)
    "inputs": {
        "allocate": {"name": "allocation", "type": "discrete", "description": "Resource allocation decision"},
        "assign": {"name": "assignment", "type": "discrete", "description": "Task assignment decision"},
        "adjust": {"name": "adjustment", "type": "continuous", "description": "Adjustment parameter"},
        "control": {"name": "control_signal", "type": "continuous", "description": "Control signal input"},
        "power": {"name": "power_level", "type": "continuous", "description": "Power level setting"},
        "speed": {"name": "speed_setting", "type": "continuous", "description": "Speed setting"},
        "rate": {"name": "rate_setting", "type": "continuous", "description": "Rate setting"},
        "flow": {"name": "flow_rate", "type": "continuous", "description": "Flow rate control"},
        "invest": {"name": "investment_amount", "type": "continuous", "description": "Investment allocation"},
        "rebalance": {"name": "rebalance_weights", "type": "continuous", "description": "Portfolio rebalance weights"},
        "schedule": {"name": "schedule", "type": "discrete", "description": "Scheduling decision"},
        "prioritize": {"name": "priority_level", "type": "continuous", "description": "Priority setting"},
        "route": {"name": "routing_decision", "type": "discrete", "description": "Routing decision"},
    },
    
    # Output variables (measured results)
    "outputs": {
        "delay": {"name": "delay", "type": "continuous", "description": "Time delay measurement"},
        "throughput": {"name": "throughput", "type": "continuous", "description": "Throughput rate"},
        "efficiency": {"name": "efficiency", "type": "continuous", "description": "Efficiency metric"},
        "performance": {"name": "performance", "type": "continuous", "description": "Performance metric"},
        "cost": {"name": "cost", "type": "continuous", "description": "Cost measurement"},
        "profit": {"name": "profit", "type": "continuous", "description": "Profit measurement"},
        "return": {"name": "return_rate", "type": "continuous", "description": "Rate of return"},
        "risk": {"name": "risk_level", "type": "continuous", "description": "Risk measurement"},
        "quality": {"name": "quality_score", "type": "continuous", "description": "Quality metric"},
        "satisfaction": {"name": "satisfaction_score", "type": "continuous", "description": "Satisfaction metric"},
        "completion_time": {"name": "completion_time", "type": "continuous", "description": "Time to completion"},
        "waiting_time": {"name": "waiting_time", "type": "continuous", "description": "Waiting time duration"},
        "response_time": {"name": "response_time", "type": "continuous", "description": "Response time measurement"},
    },
    
    # External factors (disturbances)
    "disturbances": {
        "demand": {"name": "demand_rate", "type": "continuous", "description": "External demand rate"},
        "weather": {"name": "weather_condition", "type": "categorical", "description": "Weather conditions"},
        "market": {"name": "market_condition", "type": "continuous", "description": "Market conditions"},
        "traffic": {"name": "traffic_level", "type": "continuous", "description": "Traffic conditions"},
        "seasonal": {"name": "seasonal_factor", "type": "continuous", "description": "Seasonal variation"},
        "random": {"name": "random_disturbance", "type": "continuous", "description": "Random disturbance"},
        "noise": {"name": "measurement_noise", "type": "continuous", "description": "Measurement noise"},
    }
}

# Objective type mappings
OBJECTIVE_MAPPINGS = {
    "minimize": ["minimize", "reduce", "decrease", "lower", "cut"],
    "maximize": ["maximize", "increase", "raise", "boost", "improve", "optimize"],
    "track": ["track", "follow", "maintain", "keep", "hold"],
    "balance": ["balance", "equalize", "distribute", "spread", "share"],
    "stabilize": ["stabilize", "steady", "smooth", "dampen", "regulate"]
}

# Template-specific patterns
TEMPLATE_PATTERNS = {
    "workflow": {
        "common_states": ["workload", "queue_size", "progress_rate", "completion_rate"],
        "common_inputs": ["task_assignment", "priority_level", "resource_allocation"],
        "common_outputs": ["throughput", "delay", "completion_time"],
        "common_objectives": ["minimize_delay", "balance_workload", "maximize_throughput"]
    },
    "portfolio": {
        "common_states": ["portfolio_value", "risk_exposure", "asset_allocation"],
        "common_inputs": ["investment_amount", "rebalance_weights", "asset_selection"],
        "common_outputs": ["return_rate", "risk_level", "volatility"],
        "common_objectives": ["maximize_return", "minimize_risk", "balance_allocation"]
    },
    "robotics": {
        "common_states": ["position", "velocity", "orientation", "battery_level"],
        "common_inputs": ["control_signal", "power_level", "speed_setting"],
        "common_outputs": ["position_error", "energy_consumption", "task_completion"],
        "common_objectives": ["track_trajectory", "minimize_energy", "stabilize_motion"]
    }
}


class ArchetypeMapper:
    """Maps abstract terms to MPC archetypes using pattern matching."""
    
    def __init__(self):
        self.mappings = ARCHETYPE_MAPPINGS
        self.objective_mappings = OBJECTIVE_MAPPINGS
        self.template_patterns = TEMPLATE_PATTERNS
    
    def map_term_to_archetype(self, term: str, category: str) -> Dict:
        """Map a single term to its archetype."""
        term_lower = term.lower().strip()
        
        # Direct mapping
        if term_lower in self.mappings.get(category, {}):
            return self.mappings[category][term_lower]
        
        # Pattern matching
        for pattern, archetype in self.mappings.get(category, {}).items():
            if pattern in term_lower or term_lower in pattern:
                return archetype
        
        # Return generic archetype if no match found
        return {
            "name": term_lower.replace(" ", "_"),
            "type": "continuous" if category != "inputs" else "discrete",
            "description": f"Generated {category} variable from term: {term}"
        }
    
    def suggest_variables(self, terms: List[str], category: str, template: str = None) -> List[Dict]:
        """Suggest variables for a list of terms."""
        suggestions = []
        
        # Use template patterns if available
        if template and template in self.template_patterns:
            common_vars = self.template_patterns[template].get(f"common_{category}", [])
            for common_var in common_vars:
                if any(common_var in term.lower() for term in terms):
                    suggestions.append(self.map_term_to_archetype(common_var, category))
        
        # Map individual terms
        for term in terms:
            suggestion = self.map_term_to_archetype(term, category)
            if suggestion not in suggestions:
                suggestions.append(suggestion)
        
        return suggestions
    
    def map_objective_type(self, description: str) -> str:
        """Map objective description to objective type."""
        desc_lower = description.lower()
        
        for obj_type, keywords in self.objective_mappings.items():
            if any(keyword in desc_lower for keyword in keywords):
                return obj_type
        
        return "minimize"  # Default
    
    def get_template_suggestions(self, template: str) -> Dict[str, List[str]]:
        """Get template-specific variable suggestions."""
        return self.template_patterns.get(template, {})
