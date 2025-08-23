#!/usr/bin/env python3
"""
Real Agent Test Runner

AIDEV-NOTE: Tests real smolagents execution using JSON fixtures.
Demonstrates both capability-based and instruction-based execution
with streaming progress updates.

Usage:
    PYTHONPATH=src HF_TOKEN=your_token python test_real_agent_runner.py
    PYTHONPATH=src HF_TOKEN=your_token python test_real_agent_runner.py --scenario 1
    PYTHONPATH=src HF_TOKEN=your_token python test_real_agent_runner.py --list-scenarios
"""

import os
import sys
import asyncio
import argparse
import json
from typing import List, Dict, Any

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from tests.fixtures.fixture_loader import FixtureLoader
from emery_agents.core.types import TaskStatus

# Try to import smolagents execution service
try:
    from emery_agents.infrastructure.execution.smolagents_execution_service import SmolAgentsExecutionService
    SMOLAGENTS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ smolagents not available: {e}")
    print("💡 Install with: pip install smolagents")
    SMOLAGENTS_AVAILABLE = False
    SmolAgentsExecutionService = None


class RealAgentTestRunner:
    """Runs real agent tests using smolagents execution."""
    
    def __init__(self):
        self.fixture_loader = FixtureLoader()
        self.execution_service = SmolAgentsExecutionService() if SMOLAGENTS_AVAILABLE else None
        self.scenarios = self.fixture_loader.get_test_scenarios()
    
    def list_scenarios(self):
        """List all available test scenarios."""
        print("🎯 Available Test Scenarios:")
        print("=" * 60)
        
        for i, scenario in enumerate(self.scenarios, 1):
            execution_mode = scenario["execution_mode"]
            mode_icon = "🎯" if execution_mode == "capability" else "🧠"
            
            print(f"{i:2d}. {mode_icon} {scenario['name']}")
            print(f"    📝 {scenario['description']}")
            print(f"    🔧 Mode: {execution_mode}-based execution")
            
            # Show task details
            task = scenario["task"]
            if task.capability_name:
                print(f"    📋 Capability: {task.capability_name}")
            elif task.instruction_config:
                print(f"    💭 Instructions: {task.instruction_config.instructions[:80]}...")
            
            print()
    
    async def run_scenario(self, scenario_index: int):
        """Run a specific test scenario."""
        if scenario_index < 1 or scenario_index > len(self.scenarios):
            print(f"❌ Invalid scenario index. Must be 1-{len(self.scenarios)}")
            return False
        
        scenario = self.scenarios[scenario_index - 1]
        
        print(f"🚀 Running Scenario {scenario_index}: {scenario['name']}")
        print("=" * 80)
        print(f"📝 Description: {scenario['description']}")
        print(f"🔧 Execution Mode: {scenario['execution_mode']}-based")
        print(f"🤖 Agent: {scenario['agent'].name} ({scenario['agent'].role})")
        print(f"📋 Task: {scenario['task'].name}")
        print()
        
        # Show execution details
        task = scenario["task"]
        if task.capability_name:
            print(f"🎯 Using Capability: {task.capability_name}")
            
            # Show capability steps
            for cap in task.agent_config.capabilities:
                if cap.name == task.capability_name:
                    print(f"📚 Steps in capability:")
                    for i, step in enumerate(cap.steps, 1):
                        step_icon = "💻" if step.type.name == "CODE_STEP" else "🔧"
                        print(f"   {i}. {step_icon} {step.id}: {step.instructions[:60]}...")
                    break
        elif task.instruction_config:
            print(f"💭 Auto-routing Instructions: {task.instruction_config.instructions}")
            if task.instruction_config.tools:
                tools = [tool.name for tool in task.instruction_config.tools]
                print(f"🔧 With Tools: {', '.join(tools)}")
        
        print("\n⏳ Starting execution...\n")
        
        # Check if smolagents is available
        if not SMOLAGENTS_AVAILABLE:
            print("❌ Cannot execute: smolagents not available")
            print("💡 Install with: pip install smolagents")
            print("💡 Set HF_TOKEN environment variable")
            return False
        
        try:
            success = await self._execute_with_progress(task)
            return success
        except Exception as e:
            print(f"\n❌ Execution failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def _execute_with_progress(self, task_request) -> bool:
        """Execute task with real-time progress display."""
        progress_updates = []
        
        async for progress in self.execution_service.execute_task(task_request):
            progress_updates.append(progress)
            
            # Display progress update
            status_icon = self._get_status_icon(progress.status)
            step_icon = self._get_step_icon(progress.step_type)
            
            print(f"{status_icon} {step_icon} Step: {progress.step_id}")
            print(f"   📊 Progress: {progress.progress_percent:.1f}%")
            print(f"   ⏰ Timestamp: {progress.timestamp_ms}")
            
            if progress.output_json:
                try:
                    output_data = json.loads(progress.output_json)
                    print(f"   📤 Output: {self._format_output(output_data)}")
                except:
                    print(f"   📤 Output: {progress.output_json[:100]}...")
            
            if progress.error_message:
                print(f"   ❌ Error: {progress.error_message}")
            
            print()
            
            # Brief pause to make progress visible
            await asyncio.sleep(0.5)
        
        # Summary
        final_progress = progress_updates[-1] if progress_updates else None
        if final_progress:
            if final_progress.status == TaskStatus.TASK_COMPLETED.name:
                print("✅ Task completed successfully!")
                print(f"📊 Total progress updates: {len(progress_updates)}")
                return True
            else:
                print(f"❌ Task failed with status: {final_progress.status}")
                if final_progress.error_message:
                    print(f"💥 Error: {final_progress.error_message}")
                return False
        else:
            print("⚠️ No progress updates received")
            return False
    
    def _get_status_icon(self, status: str) -> str:
        """Get icon for task status."""
        status_icons = {
            "TASK_PENDING": "⏳",
            "TASK_IN_PROGRESS": "🔄", 
            "TASK_COMPLETED": "✅",
            "TASK_FAILED": "❌",
            "TASK_CANCELLED": "🛑",
            "TASK_TIMEOUT": "⏰"
        }
        return status_icons.get(status, "❓")
    
    def _get_step_icon(self, step_type: str) -> str:
        """Get icon for step type."""
        step_icons = {
            "CODE_STEP": "💻",
            "TOOL_STEP": "🔧", 
            "ROUTING": "🧭",
            "SETUP": "⚙️",
            "COMPLETION": "🎯",
            "ERROR": "💥"
        }
        return step_icons.get(step_type, "📋")
    
    def _format_output(self, output_data: Dict[str, Any]) -> str:
        """Format output data for display."""
        if isinstance(output_data, dict):
            if "message" in output_data:
                return output_data["message"]
            elif "result" in output_data:
                return str(output_data["result"])[:100]
            else:
                return str(output_data)[:100]
        else:
            return str(output_data)[:100]
    
    async def run_all_scenarios(self):
        """Run all test scenarios."""
        print(f"🚀 Running all {len(self.scenarios)} test scenarios...")
        print("=" * 80)
        
        results = []
        for i in range(len(self.scenarios)):
            print(f"\n📋 Scenario {i+1}/{len(self.scenarios)}")
            print("-" * 40)
            
            success = await self.run_scenario(i + 1)
            results.append(success)
            
            print(f"Result: {'✅ SUCCESS' if success else '❌ FAILED'}")
            print("-" * 40)
            
            if i < len(self.scenarios) - 1:
                print("⏳ Waiting 3 seconds before next scenario...")
                await asyncio.sleep(3)
        
        # Summary
        successful = sum(results)
        total = len(results)
        
        print(f"\n🎯 Overall Results: {successful}/{total} scenarios succeeded")
        if successful == total:
            print("🎉 All scenarios passed!")
        else:
            print(f"⚠️ {total - successful} scenarios failed")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Real Agent Test Runner")
    parser.add_argument("--scenario", type=int, help="Run specific scenario (1-based index)")
    parser.add_argument("--list-scenarios", action="store_true", help="List all available scenarios")
    parser.add_argument("--all", action="store_true", help="Run all scenarios")
    
    args = parser.parse_args()
    
    # Check HF_TOKEN
    if not os.getenv("HF_TOKEN"):
        print("❌ HF_TOKEN environment variable is required!")
        print("💡 Get your token from https://huggingface.co/settings/tokens")
        print("💡 Then run: HF_TOKEN=your_token python test_real_agent_runner.py")
        sys.exit(1)
    
    runner = RealAgentTestRunner()
    
    if args.list_scenarios:
        runner.list_scenarios()
    elif args.scenario:
        success = await runner.run_scenario(args.scenario)
        sys.exit(0 if success else 1)
    elif args.all:
        await runner.run_all_scenarios()
    else:
        # Interactive mode
        runner.list_scenarios()
        
        try:
            choice = input(f"\n🎯 Choose scenario (1-{len(runner.scenarios)}) or 'all': ").strip()
            
            if choice.lower() == "all":
                await runner.run_all_scenarios()
            else:
                scenario_num = int(choice)
                success = await runner.run_scenario(scenario_num)
                if success:
                    print("\n🎉 Scenario completed successfully!")
                else:
                    print("\n💥 Scenario failed!")
        except (ValueError, KeyboardInterrupt):
            print("\n👋 Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())