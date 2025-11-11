# MPC Skill Schema Builder

A comprehensive system for generating adaptive MPC (Model Predictive Control) skill schemas from natural language descriptions.

## Overview

The MPC Skill Schema Builder converts user descriptions of complex systems into structured MPC skill schemas that can be used for control and optimization. It uses LLM-based extraction, embedding-based archetype mapping, and template-driven generation to create complete skill definitions.

## Features

- 🧠 **Natural Language Processing**: Extract MPC components from user descriptions
- 🎯 **Template-Aware Generation**: Support for workflow, portfolio, robotics, and other domains
- 🔗 **Embedding-Based Mapping**: Map abstract terms to known MPC archetypes
- ⚙️ **Dynamics Generation**: Generate pseudo-Python system dynamics
- 🎛️ **Interactive Editing**: User confirmation and editing interface
- 📊 **Structured Output**: Complete JSON skill schema

## Architecture

```
mpc_skill_schema/
├── core/              # Core data structures and types
├── llm/               # LLM integration and extraction
├── embeddings/         # Embedding-based archetype mapping
├── prompts/           # Jinja2 templates for LLM prompts
├── builder/           # Main orchestration and user interface
├── examples/          # Usage examples
└── validation/        # Schema validation (future)
```

## Quick Start

### Basic Usage

```python
from mpc_skill_schema import generate_skill_from_user_input

# Generate skill schema from user description
schema = generate_skill_from_user_input(
    user_text="Manage multiple tasks across three teams. Minimize delays and balance workload.",
    template="workflow",
    interactive=False  # Auto-accept suggestions
)

print(f"Generated {len(schema['states'])} states, {len(schema['objectives'])} objectives")
```

### Interactive Usage

```python
# Interactive mode with user confirmation
schema = generate_skill_from_user_input(
    user_text="Balance investment portfolio to minimize risk while maximizing returns.",
    template="portfolio",
    interactive=True  # Prompt for confirmation
)
```

## Input Description Examples

### Workflow Management
```
"Schedule tasks across 3 teams with minimal delay. Each team has different capacity and skills. 
Tasks have dependencies and priorities. Balance workload between teams while respecting task dependencies."
```

### Portfolio Optimization
```
"Balance investment portfolio to minimize risk while maximizing returns. Portfolio includes 
stocks, bonds, and real estate assets. Consider market volatility and economic conditions."
```

### Resource Allocation
```
"Allocate compute resources across multiple services to maximize throughput. Services have 
different resource requirements and priorities. Handle variable workload patterns."
```

## Generated Schema Structure

The system generates a complete SkillSchema with the following components:

### System Variables
- **States**: Variables that evolve over time (workload, queue sizes, position)
- **Inputs**: Control variables we can manipulate (task allocation, power level)
- **Outputs**: Measured results (throughput, delay, cost)
- **External Factors**: Disturbances (demand, weather, market conditions)

### Objectives
- **Minimize**: Costs, delays, errors, energy consumption
- **Maximize**: Throughput, efficiency, profit, performance
- **Track**: Follow reference trajectories
- **Balance**: Distribute workload or resources
- **Stabilize**: Maintain steady state

### Constraints
- **Bounds**: Physical limits (capacity, maximum values)
- **Rate**: Maximum rate of change
- **Logical**: Dependencies and precedence
- **Precedence**: Task ordering requirements

### System Dynamics
Generated as pseudo-Python functions:
```python
def system_dynamics(states, inputs, disturbances):
    """System dynamics for multi-team task management."""
    
    # Extract variables
    workload = states['team_workload']
    task_allocation = inputs['task_allocation']
    
    # State equations
    d_workload = task_allocation - states['completion_rate']
    
    return [d_workload, ...]
```

### Planning Configuration
- **Horizon**: Short (10-15 steps), Medium (25-35 steps), Long (50-75 steps)
- **Sample Time**: Time step for control updates
- **Prediction Steps**: Number of prediction steps
- **Control Interval**: How often to apply control actions

## Examples

### Workflow Skill Example
```python
from mpc_skill_schema.examples import workflow_skill_example

schema = workflow_skill_example()
# Returns complete workflow skill schema
```

### Portfolio Skill Example
```python
from mpc_skill_schema.examples import portfolio_skill_example

schema = portfolio_skill_example()
# Returns complete portfolio skill schema
```

### Resource Allocation Example
```python
from mpc_skill_schema.examples import resource_allocation_example

schema = resource_allocation_example()
# Returns complete resource allocation skill schema
```

## LLM Integration

The system uses HuggingFace InferenceClient for LLM integration:

```python
from mpc_skill_schema.llm import HuggingFaceLLMClient

# Initialize with custom model
llm_client = HuggingFaceLLMClient(
    model_id="microsoft/DialoGPT-medium",
    api_token="your_hf_token"
)

schema = generate_skill_from_user_input(
    user_text="Your system description",
    llm_client=llm_client
)
```

## Embedding-Based Archetype Mapping

The system maps abstract terms to MPC concepts using embeddings:

| Abstract Term | Mapped Archetype | Category |
|---------------|------------------|----------|
| "queue" | "queue_size" | State |
| "workload" | "utilization_rate" | State |
| "allocate" | "resource_assignment" | Input |
| "delay" | "completion_time" | Output |
| "balance" | "variance_minimization" | Objective |

## User Interface

The interactive user interface allows:

- ✅ **Confirmation**: Review and accept/reject suggestions
- ✏️ **Editing**: Modify variable properties, objectives, constraints
- ➕ **Adding**: Add missing variables or objectives
- 🗑️ **Removal**: Remove irrelevant suggestions
- 📝 **Dynamics Editing**: Modify system equations

## Output Format

The system outputs a complete JSON schema:

```json
{
  "system_description": "User description",
  "states": [...],
  "inputs": [...],
  "outputs": [...],
  "dynamics": {
    "representation": "pseudo_python",
    "equations": [...],
    "assumptions": [...],
    "parameters": {...}
  },
  "objectives": [...],
  "constraints": [...],
  "planning": {...},
  "external_factors": [...],
  "variable_priorities": {...},
  "template": "workflow",
  "confidence_score": 0.8,
  "extraction_method": "llm"
}
```

## Dependencies

- `huggingface_hub`: For LLM integration
- `jinja2`: For prompt templates
- `sentence-transformers`: For embedding-based mapping (optional)
- `numpy`: For numerical operations

## Installation

```bash
# Install dependencies
pip install huggingface_hub jinja2 sentence-transformers numpy

# Set HuggingFace token
export HF_TOKEN="your_huggingface_token"
```

## Demo

Run the included demo to see the system in action:

```bash
cd mpc_skill_schema
python3 simple_demo.py
```

This will generate an example skill schema and display the complete output structure.

## Integration with Emery Agents

The MPC Skill Schema Builder integrates with the existing emery-agents system:

- Compatible with existing gRPC architecture
- Uses same type system and data structures
- Follows established patterns for LLM integration
- Supports the existing testing framework

## Future Enhancements

- [ ] Real-time validation of generated schemas
- [ ] Integration with MPC solvers (do-mpc, casadi)
- [ ] Visual schema editor
- [ ] Template customization framework
- [ ] Performance benchmarking
- [ ] Multi-language support

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new functionality
3. Update documentation for new features
4. Ensure compatibility with existing emery-agents system

## License

This project is part of the emery-agents system and follows the same licensing terms.
