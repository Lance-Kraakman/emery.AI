"""
Example showing how context flows between agent steps using persistent disk storage.
"""

import asyncio
import json
from emery_agents import AgentRunner, Agent, AgentStep, AgentType
from emery_agents.integrations import EmeryClientIntegration, SmolAgentsIntegration, MCPServerIntegration


async def main():
    """Demonstrate multi-step context flow."""
    
    # Initialize integrations
    emery_client = EmeryClientIntegration(
        api_url="http://localhost:3000",
        agent_id="demo"
    )
    smolagents = SmolAgentsIntegration()
    mcp_servers = MCPServerIntegration(emery_client)
    
    # Create runner
    runner = AgentRunner(emery_client, smolagents, mcp_servers)
    
    # Define multi-step agent
    agent = Agent(
        id="context_demo",
        name="Context Flow Demo",
        role="assistant",
        description="Demonstrates context flow between steps",
        persona="Helpful assistant",
        agent_type=AgentType.TOOL_CALLING_AGENT,
        model="claude-3-sonnet-20240229",
        steps=[
            AgentStep(
                id="step1_analyze",
                instructions="""
                Analyze the user's request and extract key information.
                Return a JSON object with:
                - intent: what the user wants
                - entities: important entities mentioned
                - priority: high/medium/low
                """,
                agent_type=AgentType.TOOL_CALLING_AGENT,
                tools=[]
            ),
            AgentStep(
                id="step2_plan",
                instructions="""
                Based on the analysis from step 1, create an action plan.
                Use the 'intent', 'entities', and 'priority' from the previous step.
                Return a JSON object with:
                - actions: list of actions to take
                - timeline: estimated timeline
                - resources_needed: what resources are required
                """,
                agent_type=AgentType.TOOL_CALLING_AGENT,
                tools=[]
            ),
            AgentStep(
                id="step3_execute",
                instructions="""
                Execute the plan from step 2 using the available servers.
                Use the 'actions' and 'resources_needed' from the previous step.
                Return execution results.
                """,
                agent_type=AgentType.TOOL_CALLING_AGENT,
                servers=["gmail"]  # Example: send email notification
            )
        ]
    )
    
    # Execute with initial trigger data
    trigger_data = {
        "user_request": "I need to schedule a team meeting for next week and send invitations",
        "user_email": "user@company.com",
        "trigger_type": "MANUAL"
    }
    
    print("🚀 Starting multi-step agent execution with context persistence...")
    execution = await runner.execute_agent(agent, trigger_data)
    
    print(f"\n✅ Execution completed with status: {execution.status}")
    
    # Show step-by-step context flow
    print("\n📋 Step-by-step context flow:")
    for i, step in enumerate(execution.steps):
        print(f"\nStep {i+1}: {step.step_id}")
        print(f"  Status: {step.status}")
        print(f"  Input keys: {list(step.input_data.keys()) if step.input_data else []}")
        print(f"  Output keys: {list(step.output_data.keys()) if step.output_data else []}")
        
        # Show how context accumulated
        if step.input_data:
            print(f"  Available context: {len(step.input_data)} items")
            
            # Show previous step outputs available to this step
            previous_steps = step.input_data.get('previous_steps', {})
            if previous_steps:
                print(f"  Previous step outputs: {list(previous_steps.keys())}")
    
    print(f"\n🎯 Final execution output keys: {list(execution.output_data.keys()) if execution.output_data else []}")
    

if __name__ == "__main__":
    asyncio.run(main())


"""
Expected context flow:

Step 1 (analyze):
- Input: user_request, user_email, execution_id, agent_id
- Output: intent, entities, priority
- Context file: /tmp/emery_agent_demo_exec123/step_outputs/step1_analyze.json

Step 2 (plan):  
- Input: user_request, user_email, intent, entities, priority, previous_steps
- Output: actions, timeline, resources_needed
- Context file: /tmp/emery_agent_demo_exec123/step_outputs/step2_plan.json

Step 3 (execute):
- Input: All previous data + actions, timeline, resources_needed
- Output: execution_results
- Context file: /tmp/emery_agent_demo_exec123/step_outputs/step3_execute.json

Final cleanup: All temp files removed via context manager
"""

# AIDEV-NOTE: This example shows how context persists between steps via disk storage
# AIDEV-TODO: Add example showing context debugging and inspection
# AIDEV-QUESTION: Should we provide context visualization tools for development?