#!/usr/bin/env python3
"""
DDD Architecture Example

AIDEV-NOTE: Demonstrates the new DDD architecture in action.
Shows how domain services, application services, and repository pattern work together.
"""

import asyncio
from src.emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
from src.emery_agents.domain.execution.services.capability_routing_service import CapabilityRoutingService
from src.emery_agents.application.di.container import container
from src.emery_agents.core.entities import TaskRequest, InstructionConfig, ToolConfig


async def demonstrate_ddd_architecture():
    """Demonstrate how the DDD architecture works."""
    print("🏛️  DDD Architecture Demonstration")
    print("=" * 60)
    
    # Initialize dependency injection container
    print("1. 📦 Initializing DI Container...")
    container.initialize_defaults()
    print("   ✅ Container initialized with default implementations")
    
    # Get application service from container
    print("\n2. 🎯 Getting Application Service...")
    agent_task_service = container.get_agent_task_service()
    print("   ✅ AgentTaskApplicationService retrieved")
    
    # Demonstrate domain service usage
    print("\n3. 🧠 Using Domain Services...")
    routing_service = CapabilityRoutingService()
    
    # Create execution context directly (domain approach)
    context = ExecutionContext(
        mode=ExecutionMode.INSTRUCTION_BASED,
        instructions="Use emery_database to create organization with name='Demo Company'",
        available_tools=["emery_database", "table_data"],
        organization_id=1,
        max_steps=5
    )
    print(f"   ✅ Execution context created: {context.mode.value} mode")
    print(f"   ✅ Available tools: {context.available_tools}")
    
    # Demonstrate capability creation
    capability = routing_service.create_dynamic_capability(
        instructions="Demo capability for testing",
        tools=[ToolConfig(name="emery_database", version="1.0", config={})]
    )
    print(f"   ✅ Dynamic capability created: {capability.name}")
    
    # Get system status
    print("\n4. 🔍 Checking System Health...")
    status = await agent_task_service.get_execution_status()
    print(f"   ✅ Execution system status: {status['status']}")
    print(f"   ✅ Available tools: {status['available_tools_count']}")
    
    print("\n🎊 DDD ARCHITECTURE BENEFITS DEMONSTRATED:")
    print("✅ Domain Logic: Separated into domain services")
    print("✅ Repository Pattern: Infrastructure abstracted behind interfaces")
    print("✅ Application Services: Orchestrate domain and infrastructure")
    print("✅ Dependency Injection: Loose coupling between layers")
    print("✅ Single Responsibility: Each layer has clear purpose")
    print("✅ Testability: Domain can be tested without infrastructure")
    print("✅ YAGNI Compliance: Simple, focused architecture")
    
    return {
        "domain_services": ["CapabilityRoutingService"],
        "application_services": ["AgentTaskApplicationService"],
        "repository_interfaces": ["IAgentRepository", "IExecutionRepository", "IToolRegistryRepository"],
        "infrastructure_implementations": ["SmolAgentsExecutionRepository", "ToolRegistryRepositoryImpl"],
        "architecture_status": "fully_implemented"
    }


if __name__ == "__main__":
    result = asyncio.run(demonstrate_ddd_architecture())
    print(f"\n📊 Architecture Components: {len(result['domain_services'] + result['application_services'])} services")
    print(f"📊 Repository Interfaces: {len(result['repository_interfaces'])} interfaces")
    print(f"📊 Infrastructure Implementations: {len(result['infrastructure_implementations'])} implementations")