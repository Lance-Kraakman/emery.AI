#!/usr/bin/env python3
"""
Run Real Agent Tests

AIDEV-NOTE: Demonstrates real agent execution using the new DDD test suite.
This script executes actual tasks from tasks.json with real smolagents and AI models.

Usage:
    HF_TOKEN=your_token python run_real_agent_tests.py
    HF_TOKEN=your_token python run_real_agent_tests.py --test simple
    HF_TOKEN=your_token python run_real_agent_tests.py --test analysis  
    HF_TOKEN=your_token python run_real_agent_tests.py --test workflow
    HF_TOKEN=your_token python run_real_agent_tests.py --test framework
    HF_TOKEN=your_token python run_real_agent_tests.py --list-tests
"""

import os
import sys
import asyncio
import argparse
from typing import Dict, Any

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def check_requirements():
    """Check that all requirements are available."""
    # Check HF_TOKEN
    hf_token = os.getenv('HF_TOKEN')
    if not hf_token:
        print("❌ HF_TOKEN environment variable is required")
        print("💡 Get your token from: https://huggingface.co/settings/tokens")
        print("💡 Then run: HF_TOKEN=your_token python run_real_agent_tests.py")
        return False
    
    # Check smolagents
    try:
        import smolagents
        print(f"✅ smolagents available: {smolagents.__version__}")
    except ImportError:
        print("❌ smolagents not available")
        print("💡 Install with: uv add smolagents")
        return False
    
    # Check pytest
    try:
        import pytest
        print(f"✅ pytest available")
    except ImportError:
        print("❌ pytest not available")
        print("💡 Install with: uv add pytest pytest-asyncio")
        return False
    
    print(f"✅ HF_TOKEN configured")
    return True


def list_available_tests():
    """List all available real agent tests."""
    tests = {
        'validation': {
            'name': 'Validation Tests',
            'description': 'Test fixture loading and smolagents availability',
            'command': 'tests/test_real_agent_execution.py::TestRealAgentValidation',
            'estimated_time': '< 1 minute',
            'requires': 'HF_TOKEN (for availability check only)'
        },
        'simple': {
            'name': 'Simple Task Execution',
            'description': 'Execute simple email task (task_001) with real AI agent',
            'command': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_simple_email_task_real_execution',
            'estimated_time': '2-5 minutes',
            'requires': 'HF_TOKEN, smolagents, AI model access'
        },
        'analysis': {
            'name': 'Website Analysis Task',
            'description': 'Execute Stripe website analysis (task_007) with adaptive intelligence',
            'command': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_stripe_website_analysis_real_execution',
            'estimated_time': '5-10 minutes',
            'requires': 'HF_TOKEN, analysis_api tool, AI model access'
        },
        'framework': {
            'name': 'Measurement Framework Creation',
            'description': 'Create e-commerce measurement framework (task_009) with KPI definitions',
            'command': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_measurement_framework_creation_real_execution',
            'estimated_time': '3-8 minutes',
            'requires': 'HF_TOKEN, kpi_api and measurement_api tools'
        },
        'workflow': {
            'name': 'Complete Stripe Workflow',
            'description': 'Execute complete Stripe analysis workflow (tasks 17→18→19) with context persistence',
            'command': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_complete_stripe_workflow_real_execution',
            'estimated_time': '10-20 minutes',
            'requires': 'HF_TOKEN, all domain tools, multi-agent coordination'
        }
    }
    
    print("🎯 Available Real Agent Tests:")
    print("=" * 70)
    
    for test_id, test_info in tests.items():
        print(f"\n📋 {test_id.upper()}: {test_info['name']}")
        print(f"   Description: {test_info['description']}")
        print(f"   Time: {test_info['estimated_time']}")
        print(f"   Requires: {test_info['requires']}")
        print(f"   Command: pytest {test_info['command']} -v")
    
    print("\n💡 Usage Examples:")
    print("   HF_TOKEN=your_token python run_real_agent_tests.py --test validation")
    print("   HF_TOKEN=your_token python run_real_agent_tests.py --test simple")
    print("   HF_TOKEN=your_token python run_real_agent_tests.py --test workflow")


def run_pytest_command(test_command: str, markers: str = ""):
    """Run pytest command with proper environment."""
    import subprocess
    
    # Build pytest command
    cmd = [
        sys.executable, "-m", "pytest",
        test_command,
        "-v", "--tb=short"
    ]
    
    if markers:
        cmd.extend(["-m", markers])
    
    # Set environment
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.join(os.path.dirname(__file__), 'src')
    
    print(f"🚀 Running: {' '.join(cmd)}")
    print(f"📁 PYTHONPATH: {env['PYTHONPATH']}")
    print("=" * 70)
    
    # Execute test
    try:
        result = subprocess.run(cmd, env=env, check=False)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Failed to run test: {e}")
        return False


async def run_individual_test(test_name: str):
    """Run individual test by name."""
    test_commands = {
        'validation': 'tests/test_real_agent_execution.py::TestRealAgentValidation',
        'simple': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_simple_email_task_real_execution',
        'analysis': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_stripe_website_analysis_real_execution', 
        'framework': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_measurement_framework_creation_real_execution',
        'workflow': 'tests/test_real_agent_execution.py::TestRealAgentExecution::test_complete_stripe_workflow_real_execution'
    }
    
    if test_name not in test_commands:
        print(f"❌ Unknown test: {test_name}")
        print(f"💡 Available tests: {list(test_commands.keys())}")
        return False
    
    print(f"🎯 Running {test_name.upper()} test...")
    print(f"📋 Test: {test_commands[test_name]}")
    
    success = run_pytest_command(test_commands[test_name])
    
    if success:
        print(f"\n✅ {test_name.upper()} test completed successfully!")
    else:
        print(f"\n❌ {test_name.upper()} test failed or was skipped")
    
    return success


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run real agent execution tests with DDD architecture",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_real_agent_tests.py --list-tests
  HF_TOKEN=your_token python run_real_agent_tests.py --test validation
  HF_TOKEN=your_token python run_real_agent_tests.py --test simple
  HF_TOKEN=your_token python run_real_agent_tests.py --test workflow
        """
    )
    
    parser.add_argument(
        '--test', '-t',
        choices=['validation', 'simple', 'analysis', 'framework', 'workflow'],
        help='Specific test to run'
    )
    parser.add_argument(
        '--list-tests', '-l',
        action='store_true',
        help='List all available tests'
    )
    
    args = parser.parse_args()
    
    print("🤖 Real Agent Execution Test Runner")
    print("=" * 50)
    
    if args.list_tests:
        list_available_tests()
        return
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    if args.test:
        # Run specific test
        success = asyncio.run(run_individual_test(args.test))
        sys.exit(0 if success else 1)
    else:
        # Show help and available tests
        print("💡 Use --test to run a specific test or --list-tests to see all options")
        print("\n🚀 Quick Start:")
        print("   1. Get HF token: https://huggingface.co/settings/tokens")
        print("   2. Run: HF_TOKEN=your_token python run_real_agent_tests.py --test validation")
        print("   3. Run: HF_TOKEN=your_token python run_real_agent_tests.py --test simple")
        

if __name__ == "__main__":
    main()