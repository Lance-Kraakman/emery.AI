#!/usr/bin/env uv run python
"""
Test runner for Emery Agents with different test categories.

Usage:
    python run_tests.py [category] [options]
    
Categories:
    unit        - Run unit tests only
    integration - Run integration tests  
    smolagents  - Run smolagents tests (requires HF_TOKEN)
    grpc        - Run gRPC tests
    all         - Run all tests (default)
    
Examples:
    python run_tests.py unit
    python run_tests.py smolagents --verbose
    python run_tests.py all --coverage
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


def check_environment():
    """Check required environment variables."""
    issues = []
    
    # Check for HF_TOKEN for smolagents tests
    if not os.getenv("HF_TOKEN"):
        issues.append("⚠️  HF_TOKEN not set - smolagents tests will be skipped")
    
    if issues:
        print("Environment Issues:")
        for issue in issues:
            print(f"  {issue}")
        print()


def run_command(cmd, description):
    """Run command and handle output."""
    print(f"🏃 {description}")
    print(f"   Command: {' '.join(cmd)}")
    print()
    
    try:
        result = subprocess.run(
            cmd, 
            capture_output=False,
            text=True,
            cwd=Path(__file__).parent
        )
        
        if result.returncode == 0:
            print(f"✅ {description} - PASSED")
        else:
            print(f"❌ {description} - FAILED")
            
        return result.returncode == 0
        
    except FileNotFoundError:
        print(f"❌ {description} - Command not found")
        return False
    except Exception as e:
        print(f"❌ {description} - Error: {e}")
        return False


def build_pytest_command(category, verbose=False, coverage=False):
    """Build pytest command for category."""
    base_cmd = ["uv", "run", "pytest"]
    
    # Test selection
    if category == "unit":
        base_cmd.extend([
            "tests/test_types.py",
            "tests/test_runner.py", 
            "tests/test_mcp_local.py",
            "-v" if verbose else ""
        ])
    elif category == "integration": 
        base_cmd.extend([
            "tests/test_integration.py",
            "-m", "integration",
            "-v" if verbose else ""
        ])
    elif category == "smolagents":
        base_cmd.extend([
            "tests/test_smolagents.py", 
            "tests/test_integration.py",
            "-m", "smolagents",
            "-v" if verbose else ""
        ])
    elif category == "grpc":
        base_cmd.extend([
            "tests/test_grpc.py",
            "-v" if verbose else ""
        ])
    elif category == "all":
        base_cmd.extend([
            "tests/",
            "-v" if verbose else ""
        ])
    
    # Coverage (check if pytest-cov is available)
    if coverage and category in ["unit", "all"]:
        try:
            # Check if pytest-cov is installed
            import subprocess
            result = subprocess.run(["uv", "run", "python", "-c", "import pytest_cov"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                base_cmd.extend([
                    "--cov=src/emery_agents",
                    "--cov-report=term-missing",
                    "--cov-report=html:htmlcov"
                ])
            else:
                print("⚠️  pytest-cov not installed, skipping coverage")
        except Exception:
            print("⚠️  Coverage disabled (pytest-cov not available)")
    
    # Remove empty strings
    return [arg for arg in base_cmd if arg]


def main():
    """Main test runner."""
    parser = argparse.ArgumentParser(
        description="Run Emery Agents tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split('Examples:')[1] if 'Examples:' in __doc__ else ""
    )
    
    parser.add_argument(
        "category",
        nargs="?",
        default="all",
        choices=["unit", "integration", "smolagents", "grpc", "all"],
        help="Test category to run (default: all)"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )
    
    parser.add_argument(
        "-c", "--coverage",
        action="store_true", 
        help="Generate coverage report"
    )
    
    parser.add_argument(
        "--install-deps",
        action="store_true",
        help="Install test dependencies first"
    )
    
    args = parser.parse_args()
    
    print("🧪 Emery Agents Test Runner")
    print("=" * 40)
    print()
    
    # Check environment
    check_environment()
    
    # Install dependencies if requested
    if args.install_deps:
        install_cmd = ["uv", "sync", "--dev"]
        if not run_command(install_cmd, "Installing test dependencies"):
            print("❌ Failed to install dependencies")
            sys.exit(1)
        print()
    
    # Build and run test command
    test_cmd = build_pytest_command(args.category, args.verbose, args.coverage)
    
    print(f"Running {args.category} tests...")
    print()
    
    success = run_command(test_cmd, f"{args.category.title()} tests")
    
    print()
    print("=" * 40)
    
    if success:
        print("🎉 All tests passed!")
        if args.coverage:
            print("📊 Coverage report generated in htmlcov/")
    else:
        print("💥 Some tests failed")
        sys.exit(1)


if __name__ == "__main__":
    main()