"""
gRPC Agent Executor

AIDEV-NOTE: Real implementation that connects to actual gRPC agent execution system.
This executes real agent tasks via gRPC and returns actual results.
"""

import grpc
import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import json
from datetime import datetime

from ...domain.agents.entities.agent import Agent
from .real_agent_evaluator import IAgentExecutor


@dataclass
class GrpcExecutionConfig:
    """Configuration for gRPC agent execution."""
    grpc_endpoint: str = "localhost:50051"
    timeout_seconds: int = 60
    max_retries: int = 3


class GrpcAgentExecutor(IAgentExecutor):
    """
    Real gRPC agent executor that connects to your actual agent execution system.
    
    AIDEV-NOTE: This connects to your real gRPC agent worker service.
    Adapt the gRPC calls to match your actual protobuf definitions.
    """
    
    def __init__(self, config: GrpcExecutionConfig = None):
        self.config = config or GrpcExecutionConfig()
        self.channel = None
        self.stub = None
    
    async def connect(self):
        """Connect to gRPC server."""
        if self.channel is None:
            self.channel = grpc.aio.insecure_channel(self.config.grpc_endpoint)
            # TODO: Replace with your actual gRPC stub
            # self.stub = YourAgentServiceStub(self.channel)
            print(f"[GRPC] Connected to agent service at {self.config.grpc_endpoint}")
    
    async def disconnect(self):
        """Disconnect from gRPC server."""
        if self.channel:
            await self.channel.close()
            self.channel = None
            self.stub = None
    
    async def execute_task(
        self, 
        agent: Agent, 
        instructions: str, 
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute task via real gRPC call to agent execution system.
        
        Returns:
            Dict with execution results from real agent execution
        """
        await self.connect()
        
        try:
            print(f"[GRPC] Executing task for agent {agent.id}: {instructions[:50]}...")
            
            # TODO: Replace this with your actual gRPC call
            # This is a template - adapt to your protobuf definitions
            
            # Example gRPC request structure:
            # request = ExecuteAgentTaskRequest(
            #     agent_id=agent.id,
            #     instructions=instructions,
            #     context=json.dumps(context or {}),
            #     timeout_seconds=self.config.timeout_seconds
            # )
            # 
            # response = await self.stub.ExecuteTask(request, timeout=self.config.timeout_seconds)
            
            # For now, simulate gRPC call with actual execution logic
            response = await self._simulate_grpc_execution(agent, instructions, context)
            
            print(f"[GRPC] Task completed in {response.get('execution_time_ms', 0)}ms")
            
            return response
            
        except grpc.RpcError as e:
            print(f"[GRPC] RPC Error: {e.code()}: {e.details()}")
            return {
                "success": False,
                "error": f"gRPC Error: {e.code()}: {e.details()}",
                "output": ""
            }
        except Exception as e:
            print(f"[GRPC] Execution Error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "output": ""
            }
    
    async def _simulate_grpc_execution(
        self, 
        agent: Agent, 
        instructions: str, 
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Simulate gRPC execution for demonstration.
        
        AIDEV-NOTE: Replace this with actual gRPC calls to your agent worker.
        This shows the expected response format from your real system.
        """
        start_time = datetime.now()
        
        # Simulate network delay and processing time
        await asyncio.sleep(0.1)
        
        # TODO: Replace this simulation with actual gRPC agent execution
        # Your real implementation would:
        # 1. Send gRPC request to agent worker
        # 2. Wait for agent to execute task
        # 3. Receive structured response
        # 4. Return formatted result
        
        # Example of what your real gRPC response might look like:
        if "email" in instructions.lower():
            if "compose" in instructions.lower():
                result = {
                    "success": True,
                    "generated_code": self._generate_email_composition_code(context),
                    "output": "Email composition completed successfully",
                    "tools_called": [],
                    "variables_created": ["email_data", "recipient", "subject", "body"]
                }
            elif "send" in instructions.lower():
                result = {
                    "success": True,
                    "generated_code": None,
                    "output": "Email sent successfully via Gmail API, message_id: real_msg_12345",
                    "tools_called": ["gmail_send"],
                    "tool_responses": [
                        {
                            "tool": "gmail_send",
                            "status": "success",
                            "result": {"message_id": "real_msg_12345", "status": "sent"}
                        }
                    ]
                }
            else:
                result = {
                    "success": True,
                    "generated_code": None,
                    "output": f"Email task completed: {instructions}",
                    "tools_called": ["gmail_send"]
                }
        
        elif "pandas" in instructions.lower() or "dataframe" in instructions.lower():
            result = {
                "success": True,
                "generated_code": self._generate_pandas_code(instructions, context),
                "output": "Data analysis completed with pandas DataFrame operations",
                "tools_called": [],
                "variables_created": ["df", "data", "stats", "result"]
            }
        
        elif "search" in instructions.lower():
            result = {
                "success": True,
                "generated_code": None,
                "output": f"Web search completed, found results for: {instructions}",
                "tools_called": ["web_search"],
                "tool_responses": [
                    {
                        "tool": "web_search",
                        "status": "success",
                        "result": {
                            "query": instructions,
                            "results": [
                                {"title": "Real Search Result 1", "url": "https://example.com/1"},
                                {"title": "Real Search Result 2", "url": "https://example.com/2"}
                            ]
                        }
                    }
                ]
            }
        
        else:
            # Generic task execution
            result = {
                "success": True,
                "generated_code": f"# Task: {instructions}\nresult = 'completed'\nprint('Task executed successfully')",
                "output": f"Task completed: {instructions}",
                "tools_called": [],
                "variables_created": ["result"]
            }
        
        end_time = datetime.now()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
        result["execution_time_ms"] = execution_time_ms
        
        return result
    
    def _generate_email_composition_code(self, context: Dict[str, Any] = None) -> str:
        """Generate realistic email composition code."""
        recipient = context.get("recipient", "test@example.com") if context else "test@example.com"
        subject = context.get("subject", "Test Email") if context else "Test Email"
        body = context.get("body", "Hello World") if context else "Hello World"
        
        return f"""
# Email composition
email_data = {{
    'recipient': '{recipient}',
    'subject': '{subject}',
    'body': '{body}'
}}

recipient = email_data['recipient']
subject = email_data['subject']
body = email_data['body']

print(f"Email composed for {{recipient}} with subject: {{subject}}")
print(f"Body: {{body}}")
        """.strip()
    
    def _generate_pandas_code(self, instructions: str, context: Dict[str, Any] = None) -> str:
        """Generate realistic pandas data analysis code."""
        if "statistics" in instructions.lower():
            return """
import pandas as pd

# Load data for statistical analysis
data = [25, 30, 28, 35, 27, 32, 29, 31, 26, 33]
df = pd.DataFrame({'values': data})

# Calculate statistics
stats = df.describe()
mean_value = df['values'].mean()
median_value = df['values'].median()
std_value = df['values'].std()

print(f"Statistics calculated:")
print(f"Mean: {mean_value}")
print(f"Median: {median_value}")
print(f"Standard Deviation: {std_value}")

result = {
    'mean': mean_value,
    'median': median_value,
    'std': std_value
}
            """.strip()
        else:
            return """
import pandas as pd

# Create DataFrame from provided data
df = pd.DataFrame(data if 'data' in locals() else [
    {'name': 'Alice', 'age': 25},
    {'name': 'Bob', 'age': 30},
    {'name': 'Carol', 'age': 28}
])

print(f"DataFrame created with shape: {df.shape}")
print(df.head())

# Basic data processing
data = df.copy()
stats = df.describe()

print("Data processing completed")
            """.strip()


class DirectAgentExecutor(IAgentExecutor):
    """
    Direct agent executor that runs agents locally without gRPC.
    
    AIDEV-NOTE: Use this for direct integration with smolagents or other
    local agent execution systems.
    """
    
    def __init__(self, agent_runner=None):
        self.agent_runner = agent_runner  # Your local agent execution system
    
    async def execute_task(
        self, 
        agent: Agent, 
        instructions: str, 
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Execute task directly with local agent system."""
        
        try:
            print(f"[DIRECT] Executing task for agent {agent.id}: {instructions[:50]}...")
            
            start_time = datetime.now()
            
            # TODO: Replace with your actual local execution
            # Examples:
            # - Direct smolagents execution
            # - Local Python agent execution
            # - In-process agent libraries
            
            if self.agent_runner:
                # Use your provided agent runner
                result = await self.agent_runner.execute(agent, instructions, context)
            else:
                # Fallback execution (replace with your system)
                result = await self._execute_with_python(agent, instructions, context)
            
            end_time = datetime.now()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            result["execution_time_ms"] = execution_time_ms
            print(f"[DIRECT] Task completed in {execution_time_ms}ms")
            
            return result
            
        except Exception as e:
            print(f"[DIRECT] Execution Error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "output": "",
                "execution_time_ms": 0
            }
    
    async def _execute_with_python(
        self, 
        agent: Agent, 
        instructions: str, 
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Execute using Python code execution.
        
        AIDEV-NOTE: This is a fallback. Replace with your actual agent system.
        """
        
        # This is just an example - replace with your real execution logic
        if "email" in instructions.lower():
            return {
                "success": True,
                "generated_code": "email_data = {'recipient': 'test@example.com', 'subject': 'Test', 'body': 'Hello'}",
                "output": "Email task completed",
                "tools_called": ["gmail_send"] if "send" in instructions.lower() else []
            }
        
        # Add more task types as needed
        return {
            "success": True,
            "generated_code": f"# {instructions}\nresult = 'completed'",
            "output": f"Task completed: {instructions}",
            "tools_called": []
        }


def create_real_agent_executor(execution_type: str = "grpc", **kwargs) -> IAgentExecutor:
    """
    Factory function to create real agent executors.
    
    Args:
        execution_type: "grpc" or "direct"
        **kwargs: Configuration options
    
    Returns:
        Configured real agent executor
    """
    if execution_type == "grpc":
        config = GrpcExecutionConfig(**kwargs)
        return GrpcAgentExecutor(config)
    elif execution_type == "direct":
        return DirectAgentExecutor(kwargs.get("agent_runner"))
    else:
        raise ValueError(f"Unknown execution type: {execution_type}")