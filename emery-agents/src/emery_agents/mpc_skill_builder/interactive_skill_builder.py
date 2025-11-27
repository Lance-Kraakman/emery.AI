#!/usr/bin/env python3
"""
Interactive CLI for MPC Skill Builder.

A minimal command-line interface for generating MPC skill schemas
from natural language descriptions.
"""

import os
import sys
import json
from typing import Optional

# Add parent directory to Python path for imports
sys.path.insert(0, '/Users/lancekraakman/orchastrate/emery-agents/src')

try:
    from emery_agents.mpc_skill_builder import MPCSkillBuilder, generate_skill_schema
    from emery_agents.mpc_skill_builder.mpc_types import VariableType, ObjectiveType
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure MPC Skill Builder is properly installed")
    sys.exit(1)


def print_banner():
    """Print welcome banner."""
    print("=" * 60)
    print("🚀 MPC Skill Builder - Interactive CLI")
    print("=" * 60)
    print("Generate Model Predictive Control skill schemas from natural language")
    print()


def print_help():
    """Print help information."""
    print("""
📖 USAGE:
    python3 interactive_skill_builder.py [OPTIONS]

🎯 OPTIONS:
    -h, --help              Show this help message
    -m, --model MODEL       Specify HuggingFace model (default: Qwen/Qwen2.5-14B-Instruct)
    -d, --description TEXT  Use description directly (skip interactive prompt)
    -o, --output FILE       Save output to JSON file
    -v, --verbose           Show detailed progress

💡 EXAMPLES:
    # Interactive mode (default)
    python3 interactive_skill_builder.py

    # Direct description
    python3 interactive_skill_builder.py -d "Balance portfolio to minimize risk"

    # Custom model with output file
    python3 interactive_skill_builder.py -m "Qwen/Qwen2.5-32B-Instruct" -o schema.json

🔧 ENVIRONMENT:
    HF_TOKEN    Required: Your HuggingFace API token
    """)


def get_user_description() -> str:
    """Get system description from user interactively."""
    print("\n📝 Please describe your MPC system:")
    print("   (Examples: 'Manage tasks across teams', 'Balance investment portfolio', etc.)")
    print("   Enter 'quit' to exit, 'help' for examples\n")
    
    while True:
        try:
            description = input("🎯 System Description: ").strip()
            
            if description.lower() == 'quit':
                print("👋 Goodbye!")
                return None
            elif description.lower() == 'help':
                print_examples()
                continue
            elif len(description) < 10:
                print("⚠️  Please provide a more detailed description (at least 10 characters)")
                continue
            else:
                return description
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            return None
        except EOFError:
            print("\n👋 Goodbye!")
            return None


def print_examples():
    """Print example descriptions."""
    print("\n💡 Example System Descriptions:")
    print("1. 'Manage tasks across 3 teams with minimal delay and balanced workload'")
    print("2. 'Balance investment portfolio to minimize risk while maximizing returns'")
    print("3. 'Allocate compute resources across services to maximize throughput'")
    print("4. 'Control robot arm position to track reference trajectory smoothly'")
    print("5. 'Optimize traffic light timing to reduce congestion and improve flow'\n")


def print_schema_summary(schema, verbose: bool = False):
    """Print summary of generated schema."""
    print(f"\n✅ Skill Schema Generated Successfully!")
    print(f"📊 Summary:")
    print(f"   States: {len(schema.states)}")
    print(f"   Inputs: {len(schema.inputs)}")
    print(f"   Outputs: {len(schema.outputs)}")
    print(f"   Objectives: {len(schema.objectives)}")
    print(f"   Constraints: {len(schema.constraints)}")
    print(f"   Dynamics Equations: {len(schema.dynamics.equations)}")
    
    if verbose and schema.states:
        print(f"\n📈 States:")
        for i, state in enumerate(schema.states[:5], 1):
            print(f"   {i}. {state.name} ({state.var_type.value})")
            print(f"      {state.description}")
        if len(schema.states) > 5:
            print(f"   ... and {len(schema.states) - 5} more")
    
    if verbose and schema.objectives:
        print(f"\n🎯 Objectives:")
        for i, obj in enumerate(schema.objectives[:3], 1):
            print(f"   {i}. {obj.type.value} {obj.target_variable}")
            print(f"      {obj.description}")
        if len(schema.objectives) > 3:
            print(f"   ... and {len(schema.objectives) - 3} more")


def save_schema(schema, filename: str):
    """Save schema to JSON file."""
    try:
        # Convert schema to dict for JSON serialization
        schema_dict = {
            "system_description": schema.system_description,
            "states": [
                {
                    "name": s.name,
                    "type": s.var_type.value,
                    "description": s.description,
                    "bounds": {"min_val": s.bounds.min_val, "max_val": s.bounds.max_val} if s.bounds else None,
                    "unit": s.unit
                } for s in schema.states
            ],
            "inputs": [
                {
                    "name": i.name,
                    "type": i.var_type.value,
                    "description": i.description,
                    "bounds": {"min_val": i.bounds.min_val, "max_val": i.bounds.max_val} if i.bounds else None,
                    "unit": i.unit
                } for i in schema.inputs
            ],
            "outputs": [
                {
                    "name": o.name,
                    "type": o.var_type.value,
                    "description": o.description,
                    "unit": o.unit
                } for o in schema.outputs
            ],
            "objectives": [
                {
                    "type": obj.type.value,
                    "target_variable": obj.target_variable,
                    "description": obj.description,
                    "target_value": obj.target_value,
                    "weight": obj.weight
                } for obj in schema.objectives
            ],
            "planning": {
                "horizon": schema.planning.horizon.value,
                "sample_time": schema.planning.sample_time,
                "prediction_steps": schema.planning.prediction_steps,
                "control_interval": schema.planning.control_interval
            },
            "confidence_score": schema.confidence_score,
            "extraction_method": schema.extraction_method
        }
        
        with open(filename, 'w') as f:
            json.dump(schema_dict, f, indent=2)
        
        print(f"💾 Schema saved to: {filename}")
        
    except Exception as e:
        print(f"❌ Error saving schema: {e}")


def main():
    """Main CLI entry point."""
    # Parse command line arguments
    args = parse_arguments()
    
    print_banner()
    
    # Check for HF token
    if not os.getenv('HF_TOKEN'):
        print("⚠️  WARNING: HF_TOKEN environment variable not set")
        print("   Set it with: export HF_TOKEN='your_token_here'")
        print("   Get your token from: https://huggingface.co/settings/tokens\n")
    
    try:
        # Get description
        if args.description:
            description = args.description
            print(f"🎯 Using provided description: {description}")
        else:
            description = get_user_description()
            if description is None:
                return
        
        # Initialize builder
        print(f"\n🔧 Initializing MPC Skill Builder...")
        if args.verbose:
            print(f"   Model: {args.model}")
        
        builder = MPCSkillBuilder(model=args.model)
        
        # Generate schema
        print("🧠 Generating skill schema...")
        schema = builder.generate_from_description(description)
        
        # Show results
        print_schema_summary(schema, args.verbose)
        
        # Save if requested
        if args.output:
            save_schema(schema, args.output)
        
        print(f"\n🎉 MPC Skill Schema generation complete!")
        
    except KeyboardInterrupt:
        print("\n👋 Operation cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()


def parse_arguments():
    """Parse command line arguments."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Interactive MPC Skill Builder CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Remove custom help argument to avoid conflict with built-in -h/--help
    
    parser.add_argument(
        '-m', '--model',
        default='Qwen/Qwen2.5-14B-Instruct',
        help='HuggingFace model to use (default: Qwen/Qwen2.5-14B-Instruct)'
    )
    
    parser.add_argument(
        '-d', '--description',
        help='System description (skip interactive prompt)'
    )
    
    parser.add_argument(
        '-o', '--output',
        help='Save output to JSON file'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Show detailed progress and information'
    )
    
    return parser.parse_args()


if __name__ == "__main__":
    main()
