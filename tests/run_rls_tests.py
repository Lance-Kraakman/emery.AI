#!/usr/bin/env python3
"""
RLS Test Runner
Simple script to run RLS tests with proper setup and teardown
"""

import subprocess
import sys
import os

def run_tests():
    """Run the RLS test suite"""
    # Change to the project root directory
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    print("🧪 Running RLS Multi-Tenancy Tests")
    print("=" * 50)
    
    # Run pytest with verbose output and specific test files
    cmd = [
        "python", "-m", "pytest", 
        "tests/rls/", 
        "-v",                    # Verbose output
        "--tb=short",            # Shorter traceback format
        "--color=yes",           # Colored output
        "-x",                    # Stop on first failure
        "--disable-warnings"     # Disable warnings for cleaner output
    ]
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n🎉 All RLS tests passed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ RLS tests failed with exit code {e.returncode}")
        return False
    except FileNotFoundError:
        print("❌ pytest not found. Please install with: pip install pytest")
        return False

def run_specific_test(test_name):
    """Run a specific test or test class"""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    cmd = [
        "python", "-m", "pytest", 
        f"tests/rls/{test_name}",
        "-v", "--tb=short", "--color=yes", "--disable-warnings"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"\n🎉 Test {test_name} passed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Test {test_name} failed with exit code {e.returncode}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run specific test
        test_name = sys.argv[1]
        success = run_specific_test(test_name)
    else:
        # Run all tests
        success = run_tests()
    
    sys.exit(0 if success else 1)