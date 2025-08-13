"""
Integration with MCP servers via Pipedream Connect.
Leverages existing Emery OAuth proxy system for external service calls.
"""

import logging
from typing import Dict, Any, List, Optional, TypedDict

class ServiceInfo(TypedDict):
    service: str
    actions: List[Dict[str, Any]]

class AgentCapabilities(TypedDict):
    connected_services: List[ServiceInfo]

from .emery_client import EmeryClientIntegration

logger = logging.getLogger(__name__)


class MCPServerIntegration:
    """
    Integration with MCP (Model Context Protocol) servers.
    
    Uses Emery's existing Pipedream Connect system to route calls to 
    external services while maintaining OAuth credential delegation.
    """
    
    def __init__(self, emery_client: EmeryClientIntegration):
        self.emery_client = emery_client
        self.server_registry = {}
        logger.info("MCPServerIntegration initialized")
    
    async def execute_server_action(
        self, 
        server_name: str, 
        action: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute an action on an MCP server via Pipedream Connect.
        
        Args:
            server_name: Name of the MCP server/service (e.g., "gmail", "slack")
            action: Action to execute (e.g., "send_email", "post_message")
            params: Parameters for the action
            
        Returns:
            Dict with action results
        """
        logger.info(f"Executing {server_name}.{action} with params: {list(params.keys())}")
        
        try:
            # Map server name to Pipedream service
            service_name = self._map_server_to_service(server_name)
            
            # Execute via Emery's OAuth proxy
            result = await self.emery_client.proxy_oauth_call(
                service=service_name,
                action=action,
                params=params
            )
            
            logger.info(f"MCP server action {server_name}.{action} completed successfully")
            return {
                "success": True,
                "result": result,
                "server": server_name,
                "action": action,
                "status": "success"
            }
            
        except Exception as e:
            logger.exception(f"MCP server action failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "server": server_name,
                "action": action,
                "status": "failed"
            }
    
    def _map_server_to_service(self, server_name: str) -> str:
        """
        Map MCP server names to Pipedream service names.
        
        This allows the agent configuration to use logical server names
        while mapping them to the actual Pipedream Connect services.
        """
        # AIDEV-NOTE: This mapping allows flexible server naming in agent configs
        server_mapping = {
            "gmail": "gmail",
            "google_mail": "gmail",
            "email": "gmail",
            "slack": "slack",
            "github": "github",
            "sheets": "google_sheets",
            "google_sheets": "google_sheets",
            "drive": "google_drive",
            "google_drive": "google_drive",
            "discord": "discord",
            "twitter": "twitter",
            "x": "twitter",
            "filesystem": "filesystem",
            "file": "filesystem"
        }
        
        return server_mapping.get(server_name.lower()) or server_name
    
    async def list_available_servers(self) -> List[str]:
        """
        Get list of available MCP servers based on connected OAuth services.
        
        Returns:
            List of available server names
        """
        try:
            # Get connected services from Emery
            capabilities = await self.emery_client.get_agent_capabilities()
            
            # Extract connected services
            connected_services = []
            if "connected_services" in capabilities:
                for service in capabilities["connected_services"]:
                    if "service" in service:
                        connected_services.append(service["service"])
            
            logger.info(f"Available MCP servers: {connected_services}")
            return connected_services
            
        except Exception as e:
            logger.error(f"Failed to get available servers: {e}")
            return []
    
    async def get_server_actions(self, server_name: str) -> List[Dict[str, Any]]:
        """
        Get available actions for a specific MCP server.
        
        Args:
            server_name: Name of the server
            
        Returns:
            List of available actions with their schemas
        """
        try:
            service_name = self._map_server_to_service(server_name)
            
            # Get service capabilities from Emery
            capabilities = await self.emery_client.get_agent_capabilities()
            
            # Find actions for this service
            if "connected_services" in capabilities:
                for service in capabilities["connected_services"]:
                    if service.get("service") == service_name:
                        return service.get("actions") or []
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to get server actions for {server_name}: {e}")
            return []
    
    def register_server(self, name: str, config: Dict[str, Any]):
        """
        Register an MCP server configuration.
        
        Args:
            name: Server name
            config: Server configuration
        """
        self.server_registry[name] = config
        logger.info(f"Registered MCP server: {name}")
    
    def get_server_config(self, name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a registered server."""
        return self.server_registry.get(name)
    
    def list_servers(self) -> List[str]:
        """Get list of registered server names."""
        return list(self.server_registry.keys())
    
    def list_registered_servers(self) -> List[str]:
        """Get list of registered server names."""
        return list(self.server_registry.keys())


# AIDEV-NOTE: This integration leverages existing Emery OAuth proxy system
# AIDEV-TODO: Add support for MCP server configuration and discovery
# AIDEV-TODO: Implement server health checking and connection validation
# AIDEV-QUESTION: Should we cache server capabilities or fetch them each time?