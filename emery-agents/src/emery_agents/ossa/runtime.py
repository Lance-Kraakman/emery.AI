"""
Runtime Manifest Generation

Generates OSSA runtime manifests for each request, providing structured
representation of intent + constraints that drives routing and instruction generation.

Runtime manifests are different from static agent manifests:
- Static manifests define what agents exist and can do
- Runtime manifests define what needs to be done for this specific request
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..grpc.generated.agent_worker_pb2 import SkillConfig, ImageAttachment, FileAttachment

logger = logging.getLogger(__name__)


@dataclass
class IntentAnalysis:
    """Analysis of user intent for routing decisions."""
    
    primary_intent: str          # Main user goal
    domain: Optional[str]        # Business domain (email, data, documents, etc.)
    task_type: Optional[str]     # Type of task (query, create, modify, analyze)
    complexity: str             # simple, moderate, complex
    confidence: float            # Confidence in analysis (0-1)
    entities: Dict[str, Any]     # Extracted entities (IDs, names, etc.)
    required_capabilities: List[str]  # Capabilities needed to fulfill request


@dataclass
class RuntimeConstraints:
    """Runtime constraints and policies for the current request."""
    
    max_execution_time: int = 300
    allowed_operations: List[str] = field(default_factory=list)
    data_access_level: str = "user"
    pii_handling: str = "respect"
    approval_required: bool = False
    cost_limits: Dict[str, float] = field(default_factory=dict)


@dataclass
class RoutingDecision:
    """Routing decision based on intent analysis."""
    
    target_agent: str               # Agent that should handle request
    delegation_chain: List[str]     # Chain of agent delegations
    execution_mode: str            # direct, delegated, collaborative
    reasoning: str                 # Why this routing was chosen
    confidence: float              # Confidence in routing decision


@dataclass
class OssaRuntimeManifest:
    """
    OSSA Runtime Manifest for a specific request.
    
    This is the "Runtime Manifest" from OSSA architecture - a structured
    representation of intent + constraints that drives routing decisions.
    
    NOT sent to LLM - used for routing and instruction generation.
    """
    
    # Core request information
    request_id: str
    timestamp: datetime
    user_id: str
    organization_id: str
    original_request: str
    intent_analysis: IntentAnalysis
    
    # Optional fields
    session_id: Optional[str] = None
    request_context: Dict[str, Any] = field(default_factory=dict)
    attachments: List[FileAttachment] = field(default_factory=list)
    images: List[ImageAttachment] = field(default_factory=list)
    session_attachments: List[FileAttachment] = field(default_factory=list)
    constraints: RuntimeConstraints = field(default_factory=RuntimeConstraints)
    routing_decision: Optional[RoutingDecision] = None
    available_agents: List[str] = field(default_factory=list)
    available_tools: List[str] = field(default_factory=list)
    available_skills: List[SkillConfig] = field(default_factory=list)
    execution_context: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert runtime manifest to dictionary for serialization."""
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "session_id": self.session_id,
            "original_request": self.original_request,
            "intent_analysis": {
                "primary_intent": self.intent_analysis.primary_intent,
                "domain": self.intent_analysis.domain,
                "task_type": self.intent_analysis.task_type,
                "complexity": self.intent_analysis.complexity,
                "confidence": self.intent_analysis.confidence,
                "entities": self.intent_analysis.entities,
                "required_capabilities": self.intent_analysis.required_capabilities
            },
            "routing_decision": {
                "target_agent": self.routing_decision.target_agent,
                "delegation_chain": self.routing_decision.delegation_chain,
                "execution_mode": self.routing_decision.execution_mode,
                "reasoning": self.routing_decision.reasoning,
                "confidence": self.routing_decision.confidence
            } if self.routing_decision else None,
            "available_agents": self.available_agents,
            "available_tools": self.available_tools,
            "constraints": {
                "max_execution_time": self.constraints.max_execution_time,
                "allowed_operations": self.constraints.allowed_operations,
                "data_access_level": self.constraints.data_access_level,
                "pii_handling": self.constraints.pii_handling,
                "approval_required": self.constraints.approval_required,
                "cost_limits": self.constraints.cost_limits
            }
        }


class RuntimeManifestGenerator:
    """
    Generates runtime manifests from user requests and context.
    
    This class analyzes user intent and creates structured manifests
    that drive routing and instruction generation.
    """
    
    def __init__(self):
        """Initialize the runtime manifest generator."""
        self.logger = logging.getLogger(__name__)
    
    def generate_manifest(
        self,
        request_id: str,
        user_id: str,
        organization_id: str,
        original_request: str,
        available_agents: List[str],
        available_tools: List[str],
        session_id: Optional[str] = None,
        attachments: Optional[List[FileAttachment]] = None,
        images: Optional[List[ImageAttachment]] = None,
        session_attachments: Optional[List[FileAttachment]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> OssaRuntimeManifest:
        """
        Generate a runtime manifest for the given request.
        
        Args:
            request_id: Unique identifier for this request
            user_id: User making the request
            organization_id: Organization context
            original_request: The user's original request text
            available_agents: List of available agent names
            available_tools: List of available tool names
            session_id: Optional session identifier
            attachments: Files in current message
            images: Images in current message
            session_attachments: All files in session
            context: Additional request context
            
        Returns:
            OssaRuntimeManifest for this request
        """
        self.logger.info(f"📋 Generating runtime manifest for request {request_id}")
        
        # Analyze user intent
        intent_analysis = self._analyze_intent(
            original_request,
            attachments or [],
            images or [],
            context or {}
        )
        
        # Determine routing
        routing_decision = self._determine_routing(
            intent_analysis,
            available_agents
        )
        
        # Set constraints based on intent and user context
        constraints = self._set_constraints(
            intent_analysis,
            routing_decision,
            user_id,
            organization_id
        )
        
        # Create runtime manifest
        manifest = OssaRuntimeManifest(
            request_id=request_id,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            organization_id=organization_id,
            session_id=session_id,
            original_request=original_request,
            intent_analysis=intent_analysis,
            request_context=context or {},
            attachments=attachments or [],
            images=images or [],
            session_attachments=session_attachments or [],
            constraints=constraints,
            routing_decision=routing_decision,
            available_agents=available_agents,
            available_tools=available_tools
        )
        
        self.logger.info(
            f"📋 Runtime manifest generated: {intent_analysis.primary_intent} "
            f"-> {routing_decision.target_agent} "
            f"(confidence: {routing_decision.confidence:.2f})"
        )
        
        return manifest
    
    def _analyze_intent(
        self,
        request: str,
        attachments: List[FileAttachment],
        images: List[ImageAttachment],
        context: Dict[str, Any]
    ) -> IntentAnalysis:
        """
        Analyze user intent from request and context.
        
        In production, this would use NLP/classification.
        For now, uses rule-based analysis.
        """
        request_lower = request.lower()
        
        # Simple rule-based intent analysis
        if any(word in request_lower for word in ["create skill", "new skill", "make skill"]):
            return IntentAnalysis(
                primary_intent="create_skill",
                domain="skill-management",
                task_type="create",
                complexity="moderate",
                confidence=0.9,
                entities={},
                required_capabilities=["create_skill", "modify_skill"]
            )
        
        elif any(word in request_lower for word in ["modify skill", "update skill", "change skill"]):
            return IntentAnalysis(
                primary_intent="modify_skill",
                domain="skill-management",
                task_type="modify",
                complexity="moderate",
                confidence=0.9,
                entities={},
                required_capabilities=["modify_skill", "validate_skill"]
            )
        
        elif any(word in request_lower for word in ["create document", "new document", "write document"]):
            return IntentAnalysis(
                primary_intent="create_document",
                domain="document-management",
                task_type="create",
                complexity="moderate",
                confidence=0.85,
                entities={},
                required_capabilities=["create_document", "edit_document"]
            )
        
        elif any(word in request_lower for word in ["list", "show", "get", "find", "search"]):
            return IntentAnalysis(
                primary_intent="query_data",
                domain="data-query",
                task_type="query",
                complexity="simple",
                confidence=0.8,
                entities={},
                required_capabilities=["handle_simple_query"]
            )
        
        else:
            return IntentAnalysis(
                primary_intent="general_assistance",
                domain="general",
                task_type="assist",
                complexity="moderate",
                confidence=0.6,
                entities={},
                required_capabilities=["handle_simple_query"]
            )
    
    def _determine_routing(
        self,
        intent_analysis: IntentAnalysis,
        available_agents: List[str]
    ) -> RoutingDecision:
        """
        Determine routing based on intent analysis and available agents.
        """
        domain = intent_analysis.domain
        primary_intent = intent_analysis.primary_intent
        confidence = intent_analysis.confidence
        
        # Simple routing logic based on domain and intent
        if domain == "skill-management" and "skill" in primary_intent:
            if "skill_builder" in available_agents:
                return RoutingDecision(
                    target_agent="skill_builder",
                    delegation_chain=["chat_planner", "skill_builder"],
                    execution_mode="delegated",
                    reasoning=f"Skill management request requires specialized skill_builder agent",
                    confidence=0.95
                )
        
        elif domain == "document-management":
            if "document_builder" in available_agents:
                return RoutingDecision(
                    target_agent="document_builder",
                    delegation_chain=["chat_planner", "document_builder"],
                    execution_mode="delegated",
                    reasoning=f"Document creation requires specialized document_builder agent",
                    confidence=0.9
                )
        
        # Default to chat_planner for simple queries or when no specialist available
        return RoutingDecision(
            target_agent="chat_planner",
            delegation_chain=["chat_planner"],
            execution_mode="direct",
            reasoning=f"Request can be handled by chat_planner directly",
            confidence=max(0.7, confidence)
        )
    
    def _set_constraints(
        self,
        intent_analysis: IntentAnalysis,
        routing_decision: RoutingDecision,
        user_id: str,
        organization_id: str
    ) -> RuntimeConstraints:
        """
        Set runtime constraints based on intent and routing.
        """
        complexity = intent_analysis.complexity
        
        # Base constraints
        constraints = RuntimeConstraints()
        
        # Adjust based on complexity
        if complexity == "simple":
            constraints.max_execution_time = 60
            constraints.allowed_operations = ["read", "list", "query"]
        elif complexity == "moderate":
            constraints.max_execution_time = 300
            constraints.allowed_operations = ["read", "list", "query", "create", "update"]
        elif complexity == "complex":
            constraints.max_execution_time = 900
            constraints.allowed_operations = ["*"]  # All operations
            constraints.approval_required = True
        
        # Adjust based on routing
        if routing_decision.execution_mode == "delegated":
            constraints.approval_required = True
        
        return constraints