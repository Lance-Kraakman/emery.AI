"""
Main MPC Skill Builder - consolidated implementation with modern HuggingFace client.
"""

import json
from typing import Optional, Dict, Any, List
from jinja2 import Template

from .client import HuggingFaceClient
from .schemas_simple import (
    ComponentExtraction, SystemDynamics, Objective, 
    Constraint, PlanningConfig, VariablePriorities
)
from .mpc_types import (
    SkillSchema, StateVariable, ControlVariable, OutputVariable, 
    ExternalFactor, VariableType, ObjectiveType, PlanningHorizon,
    VariableBounds, SystemDynamics as SystemDynamicsType
)


class MPCSkillBuilder:
    """
    Consolidated MPC Skill Builder with modern HuggingFace structured outputs.
    
    Replaces the entire builder/llm/extractors/generators/mappers split
    with a single, clean implementation.
    """
    
    def __init__(self, model: str = "Qwen/Qwen2.5-14B-Instruct", token: Optional[str] = None):
        """
        Initialize MPC Skill Builder.
        
        Args:
            model: HuggingFace model name
            token: HF API token (defaults to HF_TOKEN env var)
        """
        self.client = HuggingFaceClient(model=model, token=token)
    
    def generate_from_description(self, description: str, template: Optional[str] = None) -> SkillSchema:
        """
        Generate complete MPC skill schema from natural language description.
        
        Args:
            description: Natural language system description
            template: Optional system template (workflow, portfolio, etc.)
            
        Returns:
            Complete SkillSchema with all components
        """
        print(f"🔧 Generating MPC skill schema for: {description}")
        
        # Step 1: Extract all components
        print("🧠 Extracting system components...")
        components = self._extract_components(description, template)
        print(f"✅ Found {len(components.states)} states, {len(components.inputs)} inputs, "
              f"{len(components.outputs)} outputs, {len(components.disturbances)} disturbances")
        
        # Step 2: Generate system dynamics
        print("⚙️ Generating system dynamics...")
        dynamics = self._generate_dynamics(description, components)
        print(f"✅ Generated {len(dynamics.equations)} dynamics equations")
        
        # Step 3: Map objectives and constraints
        print("🎯 Mapping objectives and constraints...")
        objectives_data = self._map_objectives(description, components)
        print(f"✅ Extracted {len(objectives_data.objectives)} objectives, "
              f"{len(objectives_data.constraints)} constraints")
        
        # Step 4: Assemble final schema
        print("🏗️ Assembling final skill schema...")
        schema = self._assemble_schema(
            description, components, dynamics, objectives_data, template
        )
        print("✅ Skill schema generation complete!")
        
        return schema
    
    def _extract_components(self, description: str, template: Optional[str] = None) -> ComponentExtraction:
        """Extract all MPC components from description."""
        prompt = self._load_template("extract_components.j2").render(
            user_description=description,
            template=template
        )
        
        messages = [{"role": "user", "content": prompt}]
        return self.client.generate_structured(messages, ComponentExtraction)
    
    def _generate_dynamics(self, description: str, components: ComponentExtraction) -> SystemDynamics:
        """Generate system dynamics equations."""
        prompt = self._load_template("generate_dynamics.j2").render(
            user_description=description,
            states=[s.__dict__ for s in components.states],
            inputs=[i.__dict__ for i in components.inputs],
            disturbances=[d.__dict__ for d in components.disturbances],
            system_name="MPC System"
        )
        
        messages = [{"role": "user", "content": prompt}]
        return self.client.generate_structured(messages, SystemDynamics)
    
    def _map_objectives(self, description: str, components: ComponentExtraction) -> Dict[str, Any]:
        """Map objectives, constraints, and planning configuration."""
        prompt = self._load_template("map_objectives.j2").render(
            user_description=description,
            states=[s.__dict__ for s in components.states],
            inputs=[i.__dict__ for i in components.inputs],
            outputs=[o.__dict__ for o in components.outputs]
        )
        
        messages = [{"role": "user", "content": prompt}]
        
        # For now, we'll use a simple combined response
        # In a more complex implementation, we might split this into separate calls
        class ObjectivesResponse:
            objectives: List[Dict] = []
            constraints: List[Dict] = []
            planning: Dict = {}
            variable_priorities: Dict = {}
        
        try:
            response = self.client.generate_text(messages, max_tokens=1024)
            # Try to parse as JSON first
            try:
                parsed = json.loads(response)
                objectives = parsed.get("objectives", [])
                constraints = parsed.get("constraints", [])
                planning = parsed.get("planning", {})
                variable_priorities = parsed.get("variable_priorities", {})
            except:
                # Fallback: create basic objectives from description
                objectives = self._extract_basic_objectives(description)
                constraints = []
                planning = {"horizon": "medium", "sample_time": 0.1}
                variable_priorities = {}
        except Exception as e:
            print(f"⚠️ Error in objectives mapping: {e}")
            objectives = self._extract_basic_objectives(description)
            constraints = []
            planning = {"horizon": "medium", "sample_time": 0.1}
            variable_priorities = {}
        
        return {
            "objectives": objectives,
            "constraints": constraints,
            "planning": planning,
            "variable_priorities": variable_priorities
        }
    
    def _extract_basic_objectives(self, description: str) -> List[Dict]:
        """Extract basic objectives from description using simple keyword matching."""
        objectives = []
        desc_lower = description.lower()
        
        if any(word in desc_lower for word in ["minimize", "reduce", "decrease", "lower"]):
            objectives.append({
                "type": "minimize",
                "target_variable": "cost",
                "weight": 1.0,
                "description": "Minimize costs based on description"
            })
        
        if any(word in desc_lower for word in ["maximize", "increase", "improve", "optimize"]):
            objectives.append({
                "type": "maximize", 
                "target_variable": "performance",
                "weight": 1.0,
                "description": "Maximize performance based on description"
            })
        
        if any(word in desc_lower for word in ["balance", "distribute", "allocate"]):
            objectives.append({
                "type": "balance",
                "target_variable": "workload",
                "weight": 1.0,
                "description": "Balance workload based on description"
            })
        
        return objectives
    
    def _assemble_schema(
        self, 
        description: str,
        components: ComponentExtraction,
        dynamics: SystemDynamics,
        objectives_data: Dict[str, Any],
        template: Optional[str] = None
    ) -> SkillSchema:
        """Assemble final SkillSchema from all components."""
        
        # Convert extracted variables to proper types
        states = [
            StateVariable(
                name=s.name,
                var_type=VariableType(s.type),
                description=s.description,
                bounds=VariableBounds(**s.bounds) if s.bounds else None,
                unit=s.unit
            ) for s in components.states
        ]
        
        inputs = [
            ControlVariable(
                name=i.name,
                var_type=VariableType(i.type),
                description=i.description,
                bounds=VariableBounds(**i.bounds) if i.bounds else None,
                unit=i.unit
            ) for i in components.inputs
        ]
        
        outputs = [
            OutputVariable(
                name=o.name,
                var_type=VariableType(o.type),
                description=o.description,
                unit=o.unit
            ) for o in components.outputs
        ]
        
        external_factors = [
            ExternalFactor(
                name=d.name,
                var_type=VariableType(d.type),
                description=d.description,
                characteristics=d.characteristics
            ) for d in components.disturbances
        ]
        
        # Convert objectives
        objectives = [
            Objective(
                type=ObjectiveType(obj.get("type", "minimize")),
                target_variable=obj.get("target_variable", ""),
                description=obj.get("description", ""),
                target_value=obj.get("target_value"),
                weight=obj.get("weight", 1.0)
            ) for obj in objectives_data.get("objectives", [])
        ]
        
        # Convert constraints
        constraints = [
            Constraint(
                variable=con.get("variable", ""),
                constraint_type=con.get("constraint_type", "bounds"),
                value=con.get("value", {}),
                description=con.get("description", "")
            ) for con in objectives_data.get("constraints", [])
        ]
        
        # Convert planning config
        planning_dict = objectives_data.get("planning", {})
        planning = PlanningConfig(
            horizon=PlanningHorizon(planning_dict.get("horizon", "medium")),
            sample_time=planning_dict.get("sample_time", 0.1),
            prediction_steps=planning_dict.get("prediction_steps"),
            control_interval=planning_dict.get("control_interval", 1)
        )
        
        # Convert system dynamics
        system_dynamics = SystemDynamicsType(
            representation=dynamics.representation,
            equations=dynamics.equations,
            assumptions=dynamics.assumptions,
            parameters=dynamics.parameters
        )
        
        return SkillSchema(
            system_description=description,
            states=states,
            inputs=inputs,
            outputs=outputs,
            dynamics=system_dynamics,
            objectives=objectives,
            constraints=constraints,
            planning=planning,
            external_factors=external_factors,
            variable_priorities=objectives_data.get("variable_priorities", {}),
            template=template,
            confidence_score=0.8,
            extraction_method="llm"
        )
    
    def _load_template(self, name: str) -> Template:
        """Load Jinja2 template from package resources."""
        try:
            from importlib.resources import files
            template_path = files(__package__).joinpath("prompts").joinpath(name)
            return Template(template_path.read_text())
        except Exception:
            # Fallback for development
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            template_path = os.path.join(current_dir, "prompts", name)
            with open(template_path, 'r') as f:
                return Template(f.read())