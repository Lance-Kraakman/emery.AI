"""
User confirmation and editing interface for MPC Skill Schema Builder.
"""

from typing import List, Dict, Any, Optional
from ..core.schema import Objective, Constraint, SystemDynamics
from ..core.types import VariableType


class UserConfirmationInterface:
    """Interface for user confirmation and editing of suggested components."""
    
    def __init__(self, interactive: bool = True):
        """
        Initialize user interface.
        
        Args:
            interactive: Whether to prompt for user input (False for auto-accept)
        """
        self.interactive = interactive
    
    def confirm_variables(self, variables: List[Dict], category: str) -> List[Dict]:
        """
        Display variables for user confirmation/editing.
        
        Args:
            variables: List of variable dictionaries
            category: Category name (states, inputs, outputs, disturbances)
            
        Returns:
            Confirmed/edited list of variables
        """
        if not self.interactive:
            return variables
        
        print(f"\n=== {category.upper()} ===")
        print(f"Found {len(variables)} {category}:")
        
        confirmed = []
        for i, var in enumerate(variables):
            print(f"\n{i+1}. {var['name']} ({var['type']})")
            print(f"   Description: {var['description']}")
            if 'bounds' in var and var['bounds']:
                print(f"   Bounds: {var['bounds']}")
            if 'unit' in var and var['unit']:
                print(f"   Unit: {var['unit']}")
            
            if self._get_user_confirmation(f"Keep this {category[:-1]}? (y/n/e/d)", 'y'):
                confirmed.append(var)
            elif self._get_user_confirmation("Edit this variable? (y/n)", 'n'):
                edited_var = self._edit_variable(var)
                if edited_var:
                    confirmed.append(edited_var)
        
        # Ask if user wants to add more
        while self._get_user_confirmation(f"\nAdd more {category}? (y/n)", 'n'):
            new_var = self._add_new_variable(category)
            if new_var:
                confirmed.append(new_var)
        
        return confirmed
    
    def confirm_objectives(self, objectives: List[Objective]) -> List[Objective]:
        """Display objectives for user confirmation/editing."""
        if not self.interactive:
            return objectives
        
        print("\n=== OBJECTIVES ===")
        print(f"Found {len(objectives)} objectives:")
        
        confirmed = []
        for i, obj in enumerate(objectives):
            print(f"\n{i+1}. {obj.type.value} {obj.target_variable}")
            print(f"   Weight: {obj.weight}")
            if obj.target_value is not None:
                print(f"   Target: {obj.target_value}")
            print(f"   Description: {obj.description}")
            
            if self._get_user_confirmation("Keep this objective? (y/n/e/d)", 'y'):
                confirmed.append(obj)
            elif self._get_user_confirmation("Edit this objective? (y/n)", 'n'):
                edited_obj = self._edit_objective(obj)
                if edited_obj:
                    confirmed.append(edited_obj)
        
        # Ask if user wants to add more
        while self._get_user_confirmation("\nAdd more objectives? (y/n)", 'n'):
            new_obj = self._add_new_objective()
            if new_obj:
                confirmed.append(new_obj)
        
        return confirmed
    
    def confirm_constraints(self, constraints: List[Constraint]) -> List[Constraint]:
        """Display constraints for user confirmation/editing."""
        if not self.interactive:
            return constraints
        
        print("\n=== CONSTRAINTS ===")
        print(f"Found {len(constraints)} constraints:")
        
        confirmed = []
        for i, constraint in enumerate(constraints):
            print(f"\n{i+1}. {constraint.variable} ({constraint.constraint_type})")
            print(f"   Value: {constraint.value}")
            print(f"   Description: {constraint.description}")
            
            if self._get_user_confirmation("Keep this constraint? (y/n/e/d)", 'y'):
                confirmed.append(constraint)
            elif self._get_user_confirmation("Edit this constraint? (y/n)", 'n'):
                edited_constraint = self._edit_constraint(constraint)
                if edited_constraint:
                    confirmed.append(edited_constraint)
        
        # Ask if user wants to add more
        while self._get_user_confirmation("\nAdd more constraints? (y/n)", 'n'):
            new_constraint = self._add_new_constraint()
            if new_constraint:
                confirmed.append(new_constraint)
        
        return confirmed
    
    def edit_dynamics(self, dynamics: SystemDynamics) -> SystemDynamics:
        """Allow user to edit dynamics equations."""
        if not self.interactive:
            return dynamics
        
        print("\n=== SYSTEM DYNAMICS ===")
        print(f"Representation: {dynamics.representation}")
        print("\nEquations:")
        for i, eq in enumerate(dynamics.equations):
            print(f"{i+1}. {eq}")
        
        print(f"\nAssumptions:")
        for i, assumption in enumerate(dynamics.assumptions):
            print(f"{i+1}. {assumption}")
        
        print(f"\nParameters:")
        for param, value in dynamics.parameters.items():
            print(f"  {param}: {value}")
        
        if self._get_user_confirmation("Edit dynamics? (y/n)", 'n'):
            # Simple editing - in real implementation would use text editor
            print("Editing dynamics (enter 'done' when finished):")
            edited_equations = []
            
            for eq in dynamics.equations:
                print(f"Current: {eq}")
                new_eq = input("New equation (or press Enter to keep): ").strip()
                if new_eq:
                    edited_equations.append(new_eq)
                else:
                    edited_equations.append(eq)
            
            dynamics.equations = edited_equations
        
        return dynamics
    
    def _get_user_confirmation(self, prompt: str, default: str = 'y') -> bool:
        """Get yes/no confirmation from user."""
        while True:
            response = input(f"{prompt} [{default}]: ").strip().lower()
            if not response:
                response = default
            
            if response in ['y', 'yes']:
                return True
            elif response in ['n', 'no']:
                return False
            else:
                print("Please enter 'y' or 'n'")
    
    def _edit_variable(self, var: Dict) -> Optional[Dict]:
        """Edit a variable dictionary."""
        print(f"\nEditing variable: {var['name']}")
        
        # Edit name
        new_name = input(f"Name [{var['name']}]: ").strip()
        if new_name:
            var['name'] = new_name
        
        # Edit type
        print(f"Available types: {[t.value for t in VariableType]}")
        new_type = input(f"Type [{var['type']}]: ").strip()
        if new_type and new_type in [t.value for t in VariableType]:
            var['type'] = new_type
        
        # Edit description
        new_desc = input(f"Description [{var['description']}]: ").strip()
        if new_desc:
            var['description'] = new_desc
        
        return var
    
    def _edit_objective(self, obj: Objective) -> Optional[Objective]:
        """Edit an objective."""
        print(f"\nEditing objective: {obj.type.value} {obj.target_variable}")
        
        # Edit target variable
        new_target = input(f"Target variable [{obj.target_variable}]: ").strip()
        if new_target:
            obj.target_variable = new_target
        
        # Edit weight
        new_weight = input(f"Weight [{obj.weight}]: ").strip()
        if new_weight:
            try:
                obj.weight = float(new_weight)
            except ValueError:
                print("Invalid weight, keeping original")
        
        # Edit target value
        new_target_val = input(f"Target value [{obj.target_value}]: ").strip()
        if new_target_val:
            try:
                obj.target_value = float(new_target_val)
            except ValueError:
                print("Invalid target value, keeping original")
        
        return obj
    
    def _edit_constraint(self, constraint: Constraint) -> Optional[Constraint]:
        """Edit a constraint."""
        print(f"\nEditing constraint: {constraint.variable}")
        
        # Edit variable
        new_var = input(f"Variable [{constraint.variable}]: ").strip()
        if new_var:
            constraint.variable = new_var
        
        # Edit value
        new_value = input(f"Value [{constraint.value}]: ").strip()
        if new_value:
            try:
                # Try to parse as JSON, fallback to string
                import json
                constraint.value = json.loads(new_value)
            except:
                constraint.value = new_value
        
        return constraint
    
    def _add_new_variable(self, category: str) -> Optional[Dict]:
        """Add a new variable."""
        print(f"\nAdding new {category[:-1]}:")
        
        name = input("Name: ").strip()
        if not name:
            return None
        
        print(f"Available types: {[t.value for t in VariableType]}")
        var_type = input("Type: ").strip()
        if var_type not in [t.value for t in VariableType]:
            var_type = "continuous"
        
        description = input("Description: ").strip()
        if not description:
            description = f"User-added {category[:-1]}"
        
        return {
            "name": name,
            "type": var_type,
            "description": description
        }
    
    def _add_new_objective(self) -> Optional[Objective]:
        """Add a new objective."""
        print("\nAdding new objective:")
        
        target_var = input("Target variable: ").strip()
        if not target_var:
            return None
        
        print(f"Available types: {[t.value for t in ObjectiveType]}")
        obj_type_str = input("Objective type: ").strip()
        
        type_map = {
            "minimize": ObjectiveType.MINIMIZE,
            "maximize": ObjectiveType.MAXIMIZE,
            "track": ObjectiveType.TRACK,
            "balance": ObjectiveType.BALANCE,
            "stabilize": ObjectiveType.STABILIZE
        }
        
        obj_type = type_map.get(obj_type_str, ObjectiveType.MINIMIZE)
        
        weight_str = input("Weight (default 1.0): ").strip()
        weight = float(weight_str) if weight_str else 1.0
        
        target_val_str = input("Target value (optional): ").strip()
        target_val = float(target_val_str) if target_val_str else None
        
        description = input("Description: ").strip()
        if not description:
            description = f"User-added objective for {target_var}"
        
        return Objective(
            type=obj_type,
            target_variable=target_var,
            target_value=target_val,
            weight=weight,
            description=description
        )
    
    def _add_new_constraint(self) -> Optional[Constraint]:
        """Add a new constraint."""
        print("\nAdding new constraint:")
        
        variable = input("Variable: ").strip()
        if not variable:
            return None
        
        constraint_type = input("Constraint type (bounds/rate/logical/precedence): ").strip()
        if not constraint_type:
            constraint_type = "bounds"
        
        value_str = input("Value (JSON format or simple value): ").strip()
        if not value_str:
            return None
        
        try:
            import json
            value = json.loads(value_str)
        except:
            value = value_str
        
        description = input("Description: ").strip()
        if not description:
            description = f"User-added constraint for {variable}"
        
        return Constraint(
            variable=variable,
            constraint_type=constraint_type,
            value=value,
            description=description
        )
