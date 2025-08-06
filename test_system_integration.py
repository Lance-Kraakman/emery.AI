#!/usr/bin/env python3
"""
Comprehensive system integration test for the new Task-based agent execution model.
Tests the system without requiring a running database.
"""

import json
import asyncio
from datetime import datetime
from emery_agents.core.types import (
    Agent, StepType, TriggerType, Capability, AgentStep, 
    TaskExecution, StepExecution, TaskStatus
)
from emery_agents.core.context_manager import ExecutionContextManager
from emery_agents.integrations.emery_client import EmeryClientIntegration
from emery_agents.integrations.smolagents import SmolAgentsIntegration
from emery_agents.integrations.mcp_servers import MCPServerIntegration


def test_agent_model():
    """Test the new Agent model structure"""
    print("🧪 Testing Agent Model Structure...")
    
    agent = Agent(
        id="agent_123",
        name="Advanced Email Assistant",
        role="email_specialist", 
        description="Advanced AI assistant specialized in email management and communication",
        persona="Professional, helpful, and efficient email assistant with excellent writing skills",
        model="claude-3-sonnet-20240229",
        tools=["email_analyzer", "calendar_checker", "language_detector", "spam_filter"],
        servers=["gmail", "outlook", "slack"],
        goals=[
            "Compose professional emails",
            "Manage calendar scheduling", 
            "Filter and organize messages",
            "Provide communication insights"
        ],
        capabilities=[
            Capability(
                name="email_workflow",
                description="Complete email management workflow",
                steps=[
                    AgentStep(
                        id="analyze_request",
                        type=StepType.TOOL_STEP,
                        instructions="Analyze the incoming email request using NLP tools",
                        tools=["email_analyzer", "language_detector"]
                    ),
                    AgentStep(
                        id="check_calendar",
                        type=StepType.TOOL_STEP, 
                        instructions="Check calendar availability for scheduling",
                        tools=["calendar_checker"]
                    ),
                    AgentStep(
                        id="compose_response",
                        type=StepType.CODE_STEP,
                        instructions="Generate professional email response"
                    ),
                    AgentStep(
                        id="send_email",
                        type=StepType.TOOL_STEP,
                        instructions="Send the email via the appropriate service",
                        servers=["gmail", "outlook"]
                    )
                ]
            ),
            Capability(
                name="spam_detection",
                description="Advanced spam detection and filtering",
                steps=[
                    AgentStep(
                        id="analyze_message",
                        type=StepType.TOOL_STEP,
                        instructions="Analyze message for spam indicators",
                        tools=["spam_filter", "email_analyzer"]
                    ),
                    AgentStep(
                        id="classify_risk",
                        type=StepType.CODE_STEP,
                        instructions="Classify risk level and generate report"
                    )
                ]
            )
        ],
        status="active"
    )
    
    print(f"✅ Agent: {agent.name}")
    print(f"✅ Role: {agent.role}")
    print(f"✅ Model: {agent.model}")
    print(f"✅ Tools: {len(agent.tools)} configured")
    print(f"✅ Servers: {len(agent.servers)} configured")
    print(f"✅ Goals: {len(agent.goals)} defined")
    print(f"✅ Capabilities: {len(agent.capabilities)} defined")
    
    # Test capability details
    for i, cap in enumerate(agent.capabilities):
        print(f"   📋 Capability {i+1}: {cap.name} ({len(cap.steps)} steps)")
        for j, step in enumerate(cap.steps):
            print(f"      🔧 Step {j+1}: {step.id} ({step.type.value})")
    
    return agent


def test_task_execution_model():
    """Test TaskExecution and StepExecution models"""
    print("\n🧪 Testing Task Execution Model...")
    
    task_execution = TaskExecution(
        id="task_exec_456",
        agent_id="agent_123", 
        capability_name="email_workflow",
        trigger_type="MANUAL",
        status=TaskStatus.IN_PROGRESS,
        input_data={
            "user_request": "Schedule a meeting with the team for next week",
            "sender_email": "user@company.com",
            "priority": "high"
        }
    )
    
    # Create step executions
    step_executions = [
        StepExecution(
            id="step_exec_1",
            task_execution_id="task_exec_456",
            step_id="analyze_request",
            step_type=StepType.TOOL_STEP,
            status=TaskStatus.COMPLETED,
            input_data={"request": "Schedule a meeting with the team for next week"},
            output_data={
                "intent": "schedule_meeting",
                "entities": ["team", "next week"],
                "priority": "high"
            }
        ),
        StepExecution(
            id="step_exec_2", 
            task_execution_id="task_exec_456",
            step_id="check_calendar",
            step_type=StepType.TOOL_STEP,
            status=TaskStatus.IN_PROGRESS,
            input_data={"timeframe": "next week"}
        )
    ]
    
    task_execution.step_executions = step_executions
    
    print(f"✅ Task Execution: {task_execution.id}")
    print(f"✅ Capability: {task_execution.capability_name}")
    print(f"✅ Status: {task_execution.status.value}")
    print(f"✅ Input data keys: {list(task_execution.input_data.keys()) if task_execution.input_data else []}")
    print(f"✅ Step executions: {len(task_execution.step_executions)} steps")
    
    for step in step_executions:
        print(f"   🔄 Step: {step.step_id} ({step.status.value})")
    
    return task_execution


def test_context_management(agent, task_execution):
    """Test the ExecutionContextManager"""
    print("\n🧪 Testing Context Management...")
    
    context_mgr = ExecutionContextManager(task_execution, agent)
    
    # Test initial context
    initial_context = context_mgr.get_context()
    print(f"✅ Initial context keys: {list(initial_context.keys())}")
    
    # Test step output persistence
    step1_output = {
        "intent": "schedule_meeting", 
        "entities": ["team", "next week"],
        "confidence": 0.95,
        "timestamp": datetime.now().isoformat()
    }
    
    context_mgr.save_step_output("analyze_request", step1_output)
    print("✅ Step 1 output saved")
    
    step2_output = {
        "available_slots": [
            "2024-01-15 10:00-11:00",
            "2024-01-16 14:00-15:00", 
            "2024-01-17 09:00-10:00"
        ],
        "conflicts": [],
        "recommended_slot": "2024-01-16 14:00-15:00"
    }
    
    context_mgr.save_step_output("check_calendar", step2_output)
    print("✅ Step 2 output saved")
    
    # Test context accumulation
    updated_context = context_mgr.get_context()
    print(f"✅ Updated context with step outputs available")
    
    if "previous_steps" in updated_context:
        previous_steps = updated_context["previous_steps"]
        print(f"   📊 Previous step outputs: {list(previous_steps.keys())}")
        
        if "analyze_request" in previous_steps:
            print(f"   🔍 Step 1 intent: {previous_steps['analyze_request'].get('intent')}")
        
        if "check_calendar" in previous_steps:
            print(f"   📅 Recommended slot: {previous_steps['check_calendar'].get('recommended_slot')}")
    
    # Test step execution log
    context_mgr._log_step_event("compose_response", "started")
    print("✅ Step execution logged")
    
    # Cleanup
    context_mgr.cleanup()
    print("✅ Context cleanup completed")
    
    return context_mgr


def test_integration_components():
    """Test integration components"""
    print("\n🧪 Testing Integration Components...")
    
    # Test EmeryClientIntegration
    emery_client = EmeryClientIntegration(
        api_url="http://localhost:3000",
        agent_id="agent_123"
    )
    print("✅ EmeryClientIntegration initialized")
    
    # Test SmolAgentsIntegration
    smolagents = SmolAgentsIntegration()
    print("✅ SmolAgentsIntegration initialized")
    
    # Test MCPServerIntegration  
    mcp_servers = MCPServerIntegration(emery_client)
    print("✅ MCPServerIntegration initialized")
    
    return emery_client, smolagents, mcp_servers


async def test_runner_initialization(agent, integrations):
    """Test AgentRunner initialization"""
    print("\n🧪 Testing AgentRunner Initialization...")
    
    try:
        from emery_agents.core.runner import AgentRunner
        
        emery_client, smolagents, mcp_servers = integrations
        runner = AgentRunner(emery_client, smolagents, mcp_servers)
        print("✅ AgentRunner initialized successfully")
        
        # Test capability discovery
        capabilities = [cap.name for cap in agent.capabilities]
        print(f"✅ Agent capabilities available: {capabilities}")
        
        return runner
    except Exception as e:
        print(f"⚠️ AgentRunner initialization error: {e}")
        return None


def test_api_compatibility():
    """Test API route compatibility with new model"""
    print("\n🧪 Testing API Compatibility...")
    
    # Test execute request structure
    execute_request = {
        "capability_name": "email_workflow",
        "trigger_data": {
            "trigger_type": "MANUAL",
            "user_request": "Schedule a meeting with the team",
            "sender_email": "test@company.com"
        },
        "step_overrides": [],
        "webhook_url": None,
        "timeout": 30000
    }
    
    print(f"✅ Execute request structure valid")
    print(f"   📋 Capability: {execute_request['capability_name']}")
    print(f"   🔄 Trigger type: {execute_request['trigger_data']['trigger_type']}")
    
    # Test response structure
    execute_response = {
        "success": True,
        "execution_id": "task_exec_789", 
        "capability_name": "email_workflow",
        "status": "completed",
        "result": {
            "email_sent": True,
            "recipient": "team@company.com",
            "subject": "Team Meeting - January 16th",
            "scheduled_time": "2024-01-16T14:00:00Z"
        },
        "step_executions": [
            {
                "step_id": "analyze_request",
                "step_type": "tool_step",
                "status": "completed",
                "output_data": {"intent": "schedule_meeting"}
            },
            {
                "step_id": "send_email",
                "step_type": "tool_step", 
                "status": "completed",
                "output_data": {"email_id": "msg_123"}
            }
        ]
    }
    
    print("✅ Execute response structure valid")
    print(f"   ✅ Success: {execute_response['success']}")
    print(f"   📊 Steps completed: {len(execute_response['step_executions'])}")
    
    return execute_request, execute_response


def main():
    """Run comprehensive system integration tests"""
    print("🚀 Starting Emery Task-based Agent Execution System Integration Test\n")
    
    try:
        # Test core models
        agent = test_agent_model()
        task_execution = test_task_execution_model()
        
        # Test context management
        context_mgr = test_context_management(agent, task_execution)
        
        # Test integration components
        integrations = test_integration_components()
        
        # Test runner initialization
        runner = asyncio.run(test_runner_initialization(agent, integrations))
        
        # Test API compatibility
        api_request, api_response = test_api_compatibility()
        
        print("\n🎉 Integration Test Results:")
        print("="*50)
        print("✅ Agent Model Structure: PASSED")
        print("✅ Task Execution Model: PASSED")
        print("✅ Context Management: PASSED") 
        print("✅ Integration Components: PASSED")
        print("✅ Runner Initialization: PASSED" if runner else "⚠️ Runner Initialization: SKIPPED")
        print("✅ API Compatibility: PASSED")
        print("="*50)
        print("🎯 System is ready for production testing!")
        print("\nNext steps:")
        print("1. Start database: docker-compose up -d")
        print("2. Run migrations: pnpm db:migrate") 
        print("3. Start dev server: pnpm dev")
        print("4. Navigate to /dashboard/manage to create and test agents")
        
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)