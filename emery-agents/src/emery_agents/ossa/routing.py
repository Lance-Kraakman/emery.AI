"""
OSSA-Enhanced Routing Engine

Enhances the existing chat_planner routing to use OSSA manifests for 
agent selection and routing decisions.

This sits between the existing ChatProcessingService and the 
actual agent execution, providing OSSA-compliant routing logic.
"""

import logging
from typing import List, Optional, Dict, Any, Tuple

from .registry import get_registry, OSSAAgentManifest
from .runtime import (
    RuntimeManifestGenerator, 
    OssaRuntimeManifest,
    IntentAnalysis,
    RoutingDecision
)

logger = logging.getLogger(__name__)


class OssaRoutingEngine:
    """
    Enhanced routing engine that uses OSSA manifests for intelligent agent selection.
    
    This replaces the informal routing logic in chat_planner with 
    structured, manifest-based routing decisions.
    """
    
    def __init__(self):
        """Initialize the routing engine."""
        self.registry = get_registry()
        self.manifest_generator = RuntimeManifestGenerator()
        self.logger = logging.getLogger(__name__)
        
        # Load all agent manifests
        if not self.registry.list_all_agents():
            self.registry.load_all_agents()
        
        self.logger.info(f"🧭 OSSA Routing Engine initialized with {len(self.registry.list_all_agents())} agents")
    
    def route_request(
        self,
        original_request: str,
        user_id: str,
        organization_id: str,
        available_agents: List[str],
        available_tools: List[str],
        session_id: Optional[str] = None,
        attachments: Optional[List[Any]] = None,
        images: Optional[List[Any]] = None,
        session_attachments: Optional[List[Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[OssaRuntimeManifest, Optional[OSSAAgentManifest]]:
        """
        Route a request using OSSA manifest-based routing.
        
        Args:
            original_request: The user's original request
            user_id: User making the request
            organization_id: Organization context
            available_agents: List of available agent names
            available_tools: List of available tool names
            session_id: Optional session identifier
            attachments: Files in current message
            images: Images in current message
            session_attachments: All files in session
            context: Additional request context
            
        Returns:
            Tuple of (runtime_manifest, selected_agent_manifest)
        """
        self.logger.info(f"🧭 Routing request: {original_request[:100]}...")
        
        # Generate runtime manifest
        request_id = f"req_{user_id}_{organization_id}_{hash(original_request) % 10000}"
        runtime_manifest = self.manifest_generator.generate_manifest(
            request_id=request_id,
            user_id=user_id,
            organization_id=organization_id,
            original_request=original_request,
            available_agents=available_agents,
            available_tools=available_tools,
            session_id=session_id,
            attachments=attachments,
            images=images,
            session_attachments=session_attachments,
            context=context
        )
        
        # Get selected agent from routing decision
        routing_decision = runtime_manifest.routing_decision
        if not routing_decision:
            raise ValueError("No routing decision generated")
        
        # Get agent manifest for selected target
        selected_agent = self.registry.get_agent(routing_decision.target_agent)
        if not selected_agent:
            self.logger.warning(f"⚠️ Selected agent '{routing_decision.target_agent}' not found in registry")
            # Fallback to chat_planner
            selected_agent = self.registry.get_agent("chat_planner")
            if not selected_agent:
                raise RuntimeError("chat_planner agent not found in registry")
        
        # Validate selected agent can handle the request
        self._validate_agent_selection(selected_agent, runtime_manifest)
        
        self.logger.info(
            f"🧭 Routed to {selected_agent.name} "
            f"(confidence: {routing_decision.confidence:.2f}, "
            f"mode: {routing_decision.execution_mode})"
        )
        
        return runtime_manifest, selected_agent
    
    def _validate_agent_selection(
        self, 
        agent: OSSAAgentManifest, 
        manifest: OssaRuntimeManifest
    ) -> None:
        """
        Validate that the selected agent can handle the request.
        """
        intent = manifest.intent_analysis
        required_capabilities = intent.required_capabilities
        
        # Check if agent has required capabilities
        agent_capabilities = [cap.get("name") for cap in agent.capabilities]
        
        missing_capabilities = [
            cap for cap in required_capabilities 
            if cap not in agent_capabilities
        ]
        
        if missing_capabilities:
            self.logger.warning(
                f"⚠️ Agent {agent.name} missing capabilities: {missing_capabilities}"
            )
        
        # Check execution constraints
        max_steps = agent.spec.get("execution", {}).get("max_steps", 10)
        if intent.complexity == "complex" and max_steps < 15:
            self.logger.warning(
                f"⚠️ Agent {agent.name} may need more steps for complex task"
            )
    
    def get_managed_agents(
        self, 
        primary_agent: OSSAAgentManifest
    ) -> List[OSSAAgentManifest]:
        """
        Get managed agents for a primary agent based on OSSA manifests.
        
        This replaces the hardcoded managed agent logic in chat_planner.
        """
        managed_agent_names = []
        
        # Check if primary agent has managed_agent tools
        for tool in primary_agent.tools:
            if tool.get("type") == "managed_agent":
                agent_name = tool.get("name")
                if agent_name:
                    managed_agent_names.append(agent_name)
        
        # Get actual agent manifests
        managed_agents = []
        for agent_name in managed_agent_names:
            agent_manifest = self.registry.get_agent(agent_name)
            if agent_manifest:
                managed_agents.append(agent_manifest)
            else:
                self.logger.warning(f"⚠️ Managed agent '{agent_name}' not found in registry")
        
        self.logger.info(
            f"🧭 Managed agents for {primary_agent.name}: "
            f"{[a.name for a in managed_agents]}"
        )
        
        return managed_agents
    
    def get_agent_tools(
        self, 
        agent: OSSAAgentManifest
    ) -> List[Dict[str, Any]]:
        """
        Get tool configurations for an agent from its OSSA manifest.
        
        This converts OSSA tool specifications to the format expected
        by the existing tool loading system.
        """
        tools = []
        
        for tool in agent.tools:
            tool_type = tool.get("type")
            
            if tool_type == "emery_crud":
                # Convert OSSA emery_crud to tool config
                resource = tool.get("resource")
                operations = tool.get("operations", [])
                
                for operation in operations:
                    tools.append({
                        "name": f"emery_{operation}_{resource}",
                        "type": "emery_crud",
                        "config": {
                            "resource": resource,
                            "operation": operation
                        }
                    })
            
            elif tool_type == "managed_agent":
                # Skip managed agents - handled separately
                continue
            
            else:
                # Pass through other tool types
                tools.append(tool)
        
        return tools
    
    def get_execution_context(
        self,
        agent: OSSAAgentManifest,
        runtime_manifest: OssaRuntimeManifest
    ) -> Dict[str, Any]:
        """
        Generate execution context for agent from OSSA manifest and runtime manifest.
        
        This provides the agent with all the context it needs to execute
        the request according to OSSA specifications.
        """
        return {
            "agent_manifest": {
                "name": agent.name,
                "version": agent.metadata.get("version"),
                "capabilities": agent.capabilities,
                "execution_mode": agent.execution_mode
            },
            "runtime_manifest": {
                "request_id": runtime_manifest.request_id,
                "intent": runtime_manifest.intent_analysis.primary_intent,
                "domain": runtime_manifest.intent_analysis.domain,
                "complexity": runtime_manifest.intent_analysis.complexity,
                "constraints": {
                    "max_execution_time": runtime_manifest.constraints.max_execution_time,
                    "allowed_operations": runtime_manifest.constraints.allowed_operations,
                    "approval_required": runtime_manifest.constraints.approval_required
                }
            },
            "routing": {
                "target_agent": runtime_manifest.routing_decision.target_agent,
                "execution_mode": runtime_manifest.routing_decision.execution_mode,
                "delegation_chain": runtime_manifest.routing_decision.delegation_chain
            }
        }


class OssaEnhancedChatPlanner:
    """
    OSSA-enhanced version of chat_planner that uses manifest-based routing.
    
    This wraps the existing chat_planner logic with OSSA routing decisions.
    """
    
    def __init__(self, routing_engine: OssaRoutingEngine):
        """Initialize the enhanced chat planner."""
        self.routing_engine = routing_engine
        self.logger = logging.getLogger(__name__)
    
    def plan_execution(
        self,
        original_request: str,
        user_id: str,
        organization_id: str,
        available_agents: List[str],
        available_tools: List[str],
        session_id: Optional[str] = None,
        attachments: Optional[List[Any]] = None,
        images: Optional[List[Any]] = None,
        session_attachments: Optional[List[Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Plan execution using OSSA routing.
        
        Returns a plan that can be used by the existing chat processing system.
        """
        self.logger.info(f"🧭 Planning execution for: {original_request[:100]}...")
        
        # Route the request
        runtime_manifest, selected_agent = self.routing_engine.route_request(
            original_request=original_request,
            user_id=user_id,
            organization_id=organization_id,
            available_agents=available_agents,
            available_tools=available_tools,
            session_id=session_id,
            attachments=attachments,
            images=images,
            session_attachments=session_attachments,
            context=context
        )
        
        # Get managed agents
        managed_agents = self.routing_engine.get_managed_agents(selected_agent)
        
        # Get execution context
        execution_context = self.routing_engine.get_execution_context(
            selected_agent, runtime_manifest
        )
        
        # Create execution plan
        plan = {
            "primary_agent": selected_agent.name,
            "agent_manifest": selected_agent,
            "managed_agents": managed_agents,
            "execution_context": execution_context,
            "routing_decision": runtime_manifest.routing_decision,
            "runtime_manifest": runtime_manifest,
            "tools": self.routing_engine.get_agent_tools(selected_agent),
            "llm_config": selected_agent.spec.get("llm", {}),
            "execution_config": selected_agent.spec.get("execution", {}),
            "security_config": selected_agent.spec.get("security", {})
        }
        
        self.logger.info(
            f"🧭 Execution plan created: {selected_agent.name} "
            f"with {len(managed_agents)} managed agents"
        )
        
        return plan