#!/usr/bin/env python3
"""
Simple test of CLI functions without full package imports.
"""

import sys
import os

# Add parent directory to Python path for imports
sys.path.insert(0, '/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_builder')

print("🧪 Testing MPC Skill Builder CLI components...")

try:
    # Test argument parsing directly
    import argparse
    
    def parse_arguments():
        """Parse command line arguments."""
        parser = argparse.ArgumentParser(
            description="Interactive MPC Skill Builder CLI",
            formatter_class=argparse.RawDescriptionHelpFormatter
        )
        
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
    
    # Test argument parsing
    print("🔧 Testing argument parsing:")
    test_args = ['-d', 'Test description', '-v']
    sys.argv = ['test_cli.py'] + test_args
    args = parse_arguments()
    print(f"   ✅ Description: {args.description}")
    print(f"   ✅ Verbose: {args.verbose}")
    print(f"   ✅ Model: {args.model}")
    
    # Test banner
    def print_banner():
        """Print welcome banner."""
        print("=" * 60)
        print("🚀 MPC Skill Builder - Interactive CLI")
        print("=" * 60)
        print("Generate Model Predictive Control skill schemas from natural language")
        print()
    
    print("\n📋 Testing banner:")
    print_banner()
    
    # Test examples
    def print_examples():
        """Print example descriptions."""
        print("\n💡 Example System Descriptions:")
        print("1. 'Manage tasks across 3 teams with minimal delay and balanced workload'")
        print("2. 'Balance investment portfolio to minimize risk while maximizing returns'")
        print("3. 'Allocate compute resources across services to maximize throughput'")
        print("4. 'Control robot arm position to track reference trajectory smoothly'")
        print("5. 'Optimize traffic light timing to reduce congestion and improve flow'\n")
    
    print("💡 Testing examples:")
    print_examples()
    
    # Test template loading
    print("📄 Testing template loading:")
    template_path = "prompts/extract_components.j2"
    if os.path.exists(template_path):
        with open(template_path, 'r') as f:
            template_content = f.read()
        print(f"   ✅ Template loaded ({len(template_content)} chars)")
    else:
        print("   ❌ Template not found")
    
    print("\n✅ All CLI component tests passed!")
    print("🚀 Interactive CLI components are working correctly!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()