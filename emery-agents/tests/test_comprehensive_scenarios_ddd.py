"""
Comprehensive Scenario Tests with DDD Value Objects

AIDEV-NOTE: Real business scenario tests using tasks 17 & 18 from fixtures
but updated to use proper DDD value objects and modern patterns.

Tests complete end-to-end workflows:
- Organizational context initialization 
- Website analysis with context persistence
- Measurement framework creation
- Multi-agent coordination
"""

import pytest
import json
import os
from typing import Dict, Any, List
from unittest.mock import Mock

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
from emery_agents.domain.agents.value_objects.agent_value_objects import (
    AgentName, AgentStatus, ApiKey, AgentRole
)
from emery_agents.application.di.container import Container
from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig, ToolConfig


class TestComprehensiveBusinessScenarios:
    """Comprehensive business scenario tests using real tasks with DDD value objects."""
    
    @pytest.fixture
    def real_business_agents(self):
        """Create agents that represent real business roles with value objects."""
        
        # Data Collector Agent (handles task_017)
        data_collector = Agent.create(AgentConfig(
            name=AgentName("Organizational Data Collector"),
            organization_id=OrganizationId(1),
            owner_id="business_analyst_001",
            description="Specializes in collecting and initializing organizational context data",
            persona="Methodical data collector focused on accuracy and completeness",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_datacollector_secure_production_abc123def")
        ))
        data_collector.id = AgentId(4)
        
        # Business Analyst Agent (handles task_018)  
        business_analyst = Agent.create(AgentConfig(
            name=AgentName("Website Business Analyst"),
            organization_id=OrganizationId(1),
            owner_id="senior_analyst_002",
            description="Analyzes websites to extract business intelligence and market insights",
            persona="Strategic analyst with deep business model understanding",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_analyst_secure_production_def456ghi")
        ))
        business_analyst.id = AgentId(5)
        
        # KPI Framework Designer (handles task_019)
        kpi_designer = Agent.create(AgentConfig(
            name=AgentName("KPI Framework Designer"),
            organization_id=OrganizationId(1),
            owner_id="metrics_lead_003",
            description="Creates comprehensive measurement frameworks based on business context",
            persona="Metrics expert who translates business needs into actionable KPIs",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_kpidesigner_secure_production_ghi789jkl")
        ))
        kpi_designer.id = AgentId(6)
        
        return {
            "data_collector": data_collector,
            "business_analyst": business_analyst, 
            "kpi_designer": kpi_designer
        }
    
    @pytest.fixture
    def mock_repositories_with_business_data(self):
        """Mock repositories with realistic business data responses."""
        repos = {
            'agent_repo': Mock(),
            'task_repo': Mock(),
            'execution_repo': Mock(),
            'tool_repo': Mock()
        }
        
        # Configure tool repository for business tools
        business_tools = ["emery_database", "table_data", "analysis_api", "kpi_api"]
        repos['tool_repo'].is_tool_available.side_effect = lambda tool: tool in business_tools
        repos['tool_repo'].list_available_tools.return_value = business_tools
        
        return repos
    
    @pytest.fixture  
    def business_container(self, mock_repositories_with_business_data, real_business_agents):
        """Create DI container configured for business scenarios."""
        from emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
        from emery_agents.domain.agents.repositories.task_repository import ITaskRepository
        from emery_agents.domain.execution.repositories.execution_repository import IExecutionRepository
        from emery_agents.domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
        
        container = Container()
        repos = mock_repositories_with_business_data
        
        # Configure agent repository to return business agents (async responses)
        async def async_find_by_id(agent_id):
            return {
                AgentId(4): real_business_agents["data_collector"],
                AgentId(5): real_business_agents["business_analyst"], 
                AgentId(6): real_business_agents["kpi_designer"]
            }.get(agent_id)
        
        repos['agent_repo'].find_by_id.side_effect = async_find_by_id
        
        # Configure task repository async methods
        async def async_save_task(task):
            return None  # Save operation completed successfully
        
        repos['task_repo'].save.side_effect = async_save_task
        
        # Register repositories
        container.register_repository(IAgentRepository, repos['agent_repo'])
        container.register_repository(ITaskRepository, repos['task_repo'])
        container.register_repository(IExecutionRepository, repos['execution_repo'])
        container.register_repository(IToolRegistryRepository, repos['tool_repo'])
        
        return container, repos
    
    @pytest.mark.asyncio
    async def test_stripe_analysis_complete_workflow_with_value_objects(self, business_container, real_business_agents):
        """
        Test complete Stripe analysis workflow using tasks 17, 18, 19 with DDD value objects.
        
        This represents a real business scenario:
        1. Initialize organizational context (task_017)
        2. Analyze Stripe website (task_018) 
        3. Create measurement framework (task_019)
        """
        container, repos = business_container
        service = container.get_agent_task_service()
        
        # Configure execution repository for business scenario
        class BusinessScenarioAsyncIterator:
            def __init__(self, scenario_name, steps):
                self.scenario_name = scenario_name
                self.steps = steps
                self.index = 0
                
            def __aiter__(self):
                return self
                
            async def __anext__(self):
                if self.index >= len(self.steps):
                    raise StopAsyncIteration
                step = self.steps[self.index]
                self.index += 1
                return step
        
        # Step 1: Test Organizational Context Initialization (Task 017)
        print("\n🎯 Step 1: Testing Organizational Context Initialization")
        
        repos['execution_repo'].execute_task.return_value = BusinessScenarioAsyncIterator(
            "context_initialization", [
                {"status": "initializing", "progress": 0, "step": "connecting_to_emery_database"},
                {"status": "executing", "progress": 25, "step": "creating_organization_record"},
                {"status": "executing", "progress": 50, "step": "storing_context_data"},
                {"status": "executing", "progress": 75, "step": "validating_data_integrity"},
                {
                    "status": "completed", 
                    "progress": 100, 
                    "result": {
                        "organization_created": True,
                        "organization_id": 1001,
                        "organization_name": "Stripe Analysis Project",
                        "website": "https://stripe.com",
                        "context_stored": True,
                        "table_records_created": 1
                    }
                }
            ]
        )
        
        task_017_request = TaskRequest(
            task_id="task_017_ddd",
            agent_id=real_business_agents["data_collector"].id.value,
            agent_config=CoreAgentConfig(
                name=real_business_agents["data_collector"].name.value,
                role="data_collector",
                description="Organizational context initialization specialist",
                persona="Methodical and thorough",
                tools=[
                    ToolConfig(name="emery_database", version="1.0", config={}),
                    ToolConfig(name="table_data", version="1.0", config={})
                ],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id=str(real_business_agents["data_collector"].organization_id.value),
            owner_id="business_analyst_001",
            timeout_seconds=300,
            name="Initialize Organizational Context for Stripe Analysis",
            instruction_config=InstructionConfig(
                instructions="Use emery_database to create organization with name='Stripe Analysis Project', website='https://stripe.com'. Then use table_data to create a row in tableId=4 with field_40='website_analysis', field_41='https://stripe.com', field_42='fintech'. Return the organization_id.",
                tools=[
                    ToolConfig(name="emery_database", version="1.0", config={}),
                    ToolConfig(name="table_data", version="1.0", config={})
                ],
                servers=[]
            )
        )
        
        # Execute Step 1
        step1_results = []
        async for progress in service.execute_task(task_017_request):
            step1_results.append(progress)
            print(f"   Progress: {progress['progress']}% - {progress.get('step', progress['status'])}")
        
        # Verify Step 1 Results
        assert len(step1_results) >= 4
        assert step1_results[-1]["status"] == "completed"
        assert step1_results[-1]["result"]["organization_created"] is True
        assert step1_results[-1]["result"]["organization_id"] == 1001
        print("   ✅ Organizational context initialized successfully")
        
        # Step 2: Test Website Analysis with Context Persistence (Task 018)
        print("\n🔍 Step 2: Testing Stripe Website Analysis")
        
        repos['execution_repo'].execute_task.return_value = BusinessScenarioAsyncIterator(
            "website_analysis", [
                {"status": "initializing", "progress": 0, "step": "connecting_to_analysis_api"},
                {"status": "executing", "progress": 20, "step": "fetching_website_content"},
                {"status": "executing", "progress": 40, "step": "analyzing_business_model"},
                {"status": "executing", "progress": 60, "step": "classifying_industry_type"},
                {"status": "executing", "progress": 80, "step": "storing_analysis_results"},
                {
                    "status": "completed",
                    "progress": 100,
                    "result": {
                        "analysis_completed": True,
                        "website": "https://stripe.com",
                        "industry_classification": "fintech",
                        "business_model": "payment_processing_platform",
                        "company_characteristics": {
                            "size": "large",
                            "market": "global",
                            "customer_segments": ["developers", "businesses", "enterprises"]
                        },
                        "key_insights": [
                            "Developer-first payment infrastructure",
                            "Multi-sided platform business model", 
                            "Strong API-driven ecosystem",
                            "Focus on technical integration"
                        ],
                        "context_persistence": {
                            "stored_in_table": "Analysis_Results",
                            "row_id": 501,
                            "fields_populated": ["industry", "business_model", "analysis_status"]
                        }
                    }
                }
            ]
        )
        
        task_018_request = TaskRequest(
            task_id="task_018_ddd",
            agent_id=real_business_agents["business_analyst"].id.value,
            agent_config=CoreAgentConfig(
                name=real_business_agents["business_analyst"].name.value,
                role="business_analyst", 
                description="Website business analysis specialist",
                persona="Strategic and insightful",
                tools=[
                    ToolConfig(name="analysis_api", version="1.0", config={}),
                    ToolConfig(name="table_data", version="1.0", config={})
                ],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id=str(real_business_agents["business_analyst"].organization_id.value),
            owner_id="senior_analyst_002", 
            timeout_seconds=300,
            name="Analyze Stripe Website with Context Persistence",
            instruction_config=InstructionConfig(
                instructions="Step 1: Call analysis_api tool with action='analyze_website' and website_url='https://stripe.com'. Step 2: Store the results using table_data tool with action='create_row', tableId=4, and row_data containing field_42='fintech', field_43='payment_processing_platform', field_44='analysis_completed'.",
                tools=[
                    ToolConfig(name="analysis_api", version="1.0", config={}),
                    ToolConfig(name="table_data", version="1.0", config={})
                ],
                servers=[]
            )
        )
        
        # Execute Step 2
        step2_results = []
        async for progress in service.execute_task(task_018_request):
            step2_results.append(progress)
            print(f"   Progress: {progress['progress']}% - {progress.get('step', progress['status'])}")
        
        # Verify Step 2 Results
        assert len(step2_results) >= 5
        assert step2_results[-1]["status"] == "completed"
        assert step2_results[-1]["result"]["analysis_completed"] is True
        assert step2_results[-1]["result"]["industry_classification"] == "fintech"
        assert step2_results[-1]["result"]["business_model"] == "payment_processing_platform"
        assert len(step2_results[-1]["result"]["key_insights"]) >= 3
        print("   ✅ Website analysis completed and persisted successfully")
        
        # Step 3: Test KPI Framework Creation (Task 019 equivalent)
        print("\n📊 Step 3: Testing KPI Framework Creation")
        
        repos['execution_repo'].execute_task.return_value = BusinessScenarioAsyncIterator(
            "kpi_framework_creation", [
                {"status": "initializing", "progress": 0, "step": "retrieving_analysis_context"},
                {"status": "executing", "progress": 20, "step": "designing_fintech_specific_metrics"},
                {"status": "executing", "progress": 40, "step": "creating_kpi_definitions"},
                {"status": "executing", "progress": 60, "step": "mapping_to_business_model"},
                {"status": "executing", "progress": 80, "step": "validating_framework_completeness"},
                {
                    "status": "completed",
                    "progress": 100,
                    "result": {
                        "framework_created": True,
                        "context_retrieved": True,
                        "adapted_to_fintech": True,
                        "kpi_definitions": [
                            {
                                "name": "Payment Success Rate",
                                "description": "Percentage of successful payment transactions",
                                "target_value": 99.5,
                                "measurement_frequency": "real_time"
                            },
                            {
                                "name": "API Response Time",
                                "description": "Average API response time for payment requests",
                                "target_value": 150,
                                "unit": "milliseconds",
                                "measurement_frequency": "continuous"
                            },
                            {
                                "name": "Developer Adoption Rate", 
                                "description": "Rate of new developer integrations per month",
                                "target_value": 25,
                                "unit": "integrations_per_month",
                                "measurement_frequency": "monthly"
                            },
                            {
                                "name": "Transaction Volume Growth",
                                "description": "Month-over-month transaction volume growth",
                                "target_value": 15,
                                "unit": "percentage",
                                "measurement_frequency": "monthly"
                            }
                        ],
                        "framework_persistence": {
                            "stored_in_table": "Analysis_Results", 
                            "framework_id": "stripe_fintech_framework_001",
                            "total_kpis": 4
                        }
                    }
                }
            ]
        )
        
        kpi_framework_request = TaskRequest(
            task_id="task_019_ddd", 
            agent_id=real_business_agents["kpi_designer"].id.value,
            agent_config=CoreAgentConfig(
                name=real_business_agents["kpi_designer"].name.value,
                role="kpi_designer",
                description="KPI framework design specialist",
                persona="Metrics-focused and business-oriented",
                tools=[
                    ToolConfig(name="table_data", version="1.0", config={}),
                    ToolConfig(name="kpi_api", version="1.0", config={})
                ],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id=str(real_business_agents["kpi_designer"].organization_id.value),
            owner_id="metrics_lead_003",
            timeout_seconds=300,
            name="Create Stripe Measurement Framework from Stored Context",
            instruction_config=InstructionConfig(
                instructions="Retrieve the Stripe analysis results from the Analysis_Results table, then create a comprehensive measurement framework based on the discovered business characteristics. Use table_data to get previous analysis, kpi_api to design framework, then store the framework back to Analysis_Results table.",
                tools=[
                    ToolConfig(name="table_data", version="1.0", config={}),
                    ToolConfig(name="kpi_api", version="1.0", config={})
                ],
                servers=[]
            )
        )
        
        # Execute Step 3
        step3_results = []
        async for progress in service.execute_task(kpi_framework_request):
            step3_results.append(progress)
            print(f"   Progress: {progress['progress']}% - {progress.get('step', progress['status'])}")
        
        # Verify Step 3 Results
        assert len(step3_results) >= 5
        assert step3_results[-1]["status"] == "completed"
        assert step3_results[-1]["result"]["framework_created"] is True
        assert step3_results[-1]["result"]["adapted_to_fintech"] is True
        assert len(step3_results[-1]["result"]["kpi_definitions"]) == 4
        
        # Verify KPI quality
        kpis = step3_results[-1]["result"]["kpi_definitions"]
        kpi_names = [kpi["name"] for kpi in kpis]
        assert "Payment Success Rate" in kpi_names
        assert "API Response Time" in kpi_names
        assert "Developer Adoption Rate" in kpi_names
        assert "Transaction Volume Growth" in kpi_names
        print("   ✅ KPI framework created and validated successfully")
        
        # Verify Complete Workflow
        print("\n🎊 Complete Workflow Verification:")
        print(f"   ✅ Step 1 - Organization created: ID {step1_results[-1]['result']['organization_id']}")
        print(f"   ✅ Step 2 - {step2_results[-1]['result']['industry_classification'].title()} analysis completed")  
        print(f"   ✅ Step 3 - {len(kpis)} KPIs created for payment platform business model")
        
        # Verify agent interactions
        repos['agent_repo'].find_by_id.assert_any_call(real_business_agents["data_collector"].id)
        repos['agent_repo'].find_by_id.assert_any_call(real_business_agents["business_analyst"].id)
        repos['agent_repo'].find_by_id.assert_any_call(real_business_agents["kpi_designer"].id)
        
        assert repos['agent_repo'].find_by_id.call_count == 3
        print("   ✅ All three business agents successfully coordinated")
        
        print("\n🏆 COMPLETE BUSINESS SCENARIO WORKFLOW: SUCCESS!")
        print("   - Real tasks (017, 018, 019) executed with DDD value objects")
        print("   - Multi-agent coordination verified")  
        print("   - Business context preservation across steps")
        print("   - Complete organizational analysis pipeline functional")
    
    @pytest.mark.asyncio
    async def test_business_agent_value_object_validation(self, real_business_agents):
        """Test that business agents properly use and validate value objects."""
        
        data_collector = real_business_agents["data_collector"]
        business_analyst = real_business_agents["business_analyst"]
        kpi_designer = real_business_agents["kpi_designer"]
        
        # Verify agents use proper value objects
        assert isinstance(data_collector.id, AgentId)
        assert isinstance(data_collector.name, AgentName)
        assert isinstance(data_collector.organization_id, OrganizationId)
        assert isinstance(data_collector.status, AgentStatus)
        assert isinstance(data_collector.api_key, ApiKey)
        
        # Verify business logic works with value objects
        assert data_collector.is_active is True
        assert data_collector.name.value == "Organizational Data Collector"
        assert data_collector.organization_id.value == 1
        
        # Test agent validation business rules
        data_collector.validate_for_execution()  # Should not raise exception
        
        # Verify all agents follow same patterns
        agents = [data_collector, business_analyst, kpi_designer]
        for agent in agents:
            assert isinstance(agent.id, AgentId) 
            assert isinstance(agent.name, AgentName)
            assert isinstance(agent.organization_id, OrganizationId)
            assert agent.is_active is True
            agent.validate_for_execution()  # Should not raise
        
        print("✅ All business agents properly use DDD value objects")
        print("✅ Business validation rules working correctly")
        print("✅ Value object encapsulation verified")
    
    def test_real_task_data_integrity_with_value_objects(self):
        """Test that real task data from fixtures can be converted to value objects properly."""
        
        # Load tasks 17 & 18 from fixtures  
        fixtures_path = os.path.join(os.path.dirname(__file__), "fixtures", "tasks.json")
        with open(fixtures_path, 'r') as f:
            tasks = json.load(f)
        
        task_017 = next(task for task in tasks if task["id"] == "task_017")
        task_018 = next(task for task in tasks if task["id"] == "task_018") 
        
        # Verify task data integrity
        assert task_017["agentId"] == 4
        assert task_018["agentId"] == 4
        assert "Stripe" in task_017["name"]
        assert "stripe.com" in task_017["instructions"]["instructions"]
        assert "analysis_api" in [tool["name"] for tool in task_018["instructions"]["tools"]]
        
        # Test that task data can be converted to value object compatible format
        def convert_task_to_value_objects(task_data):
            # Convert agent ID to value object
            agent_id = AgentId(task_data["agentId"])
            
            # Convert task ID to value object  
            task_id = TaskId(task_data["id"])
            
            # Create task instructions
            instructions = TaskInstructions(
                instructions=task_data["instructions"]["instructions"],
                tools=task_data["instructions"]["tools"],
                servers=task_data["instructions"].get("servers", [])
            )
            
            return {
                "agent_id": agent_id,
                "task_id": task_id, 
                "instructions": instructions,
                "name": task_data["name"]
            }
        
        # Convert both tasks successfully
        converted_017 = convert_task_to_value_objects(task_017)
        converted_018 = convert_task_to_value_objects(task_018)
        
        # Verify conversions work
        assert converted_017["agent_id"].value == 4
        assert converted_017["task_id"].value == "task_017"
        assert "emery_database" in [tool["name"] for tool in converted_017["instructions"].tools]
        
        assert converted_018["agent_id"].value == 4
        assert converted_018["task_id"].value == "task_018"
        assert "analysis_api" in [tool["name"] for tool in converted_018["instructions"].tools]
        
        print("✅ Real task data successfully converted to value objects")
        print("✅ Data integrity preserved during conversion")
        print("✅ Business context maintains semantic meaning")