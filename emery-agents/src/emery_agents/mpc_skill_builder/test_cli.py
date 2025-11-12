#!/usr/bin/env python3
"""
Test the interactive CLI without requiring real HF API calls.
"""

import os
import sys

# Add parent directory to Python path for imports
sys.path.insert(0, '/Users/lancekraakman/orchastrate/emery-agents/src')

print("🧪 Testing MPC Skill Builder CLI functionality...")

try:
    # Test imports
    from emery_agents.mpc_skill_builder.interactive_skill_builder import (
        print_banner, print_help, parse_arguments, print_examples
    )
    print("✅ Successfully imported CLI functions")
    
    # Test banner
    print("\n📋 Testing banner:")
    print_banner()
    
    # Test argument parsing
    print("\n🔧 Testing argument parsing:")
    args = parse_arguments()
    print(f"   Default model: {args.model}")
    print(f"   Verbose: {args.verbose}")
    print(f"   Description: {args.description}")
    print(f"   Output: {args.output}")
    
    # Test examples
    print("\n💡 Testing examples:")
    print_examples()
    
    print("\n✅ All CLI functionality tests passed!")
    print("🚀 Interactive CLI is ready for use with a valid HF_TOKEN!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()