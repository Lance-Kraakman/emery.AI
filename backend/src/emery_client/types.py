"""
Type definitions for Emery Python client.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from enum import Enum


class ServiceStatus(str, Enum):
    """OAuth service connection status."""
    CONNECTED = "connected"
    ERROR = "error" 
    DISCONNECTED = "disconnected"


@dataclass
class ConnectedService:
    """Represents a connected OAuth service for an agent."""
    service: str
    account_name: str
    status: ServiceStatus
    connected_at: str


@dataclass 
class AvailableAction:
    """Represents an available Pipedream action for an agent."""
    id: str
    name: str
    description: str
    service: str
    required_props: List[str]
    optional_props: List[str]


@dataclass
class AgentCapabilities:
    """Agent capabilities including connected services and available actions."""
    agent_id: int
    agent_name: str
    owner_id: str
    connected_services: List[ConnectedService]
    available_actions: List[AvailableAction]
    proxy_endpoints: Dict[str, List[str]]


@dataclass
class ExecutionResult:
    """Result from executing an agent action."""
    success: bool
    execution_id: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class ProxyResult:
    """Result from a proxied API request."""
    success: bool
    data: Optional[Any] = None
    status: Optional[int] = None
    headers: Optional[Dict[str, str]] = None
    error: Optional[str] = None


@dataclass
class WebhookPayload:
    """Webhook payload structure."""
    execution_id: str
    agent_id: int
    action: str
    result: Any
    timestamp: str