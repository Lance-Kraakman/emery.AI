"""
Custom tool implementations for Emery Agents.

These tools integrate with external services and systems beyond the standard smolagents toolkit.
"""

import logging
import json
import os
from typing import Dict, Any, Optional
import requests

logger = logging.getLogger(__name__)

class BaseTool:
    """Base class for custom tools with common functionality."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__
        self.description = getattr(self, 'description', 'Custom tool')
    
    def __call__(self, *args, **kwargs) -> Any:
        """Make the tool callable."""
        return self.forward(*args, **kwargs)
    
    def forward(self, *args, **kwargs) -> Any:
        """Execute the tool's main functionality."""
        raise NotImplementedError("Subclasses must implement forward method")

class PipedreamConnectorTool(BaseTool):
    """
    Tool for connecting to external services via Pipedream.
    
    AIDEV-NOTE: This tool acts as a bridge between agents and OAuth-enabled services
    through the existing Pipedream proxy infrastructure. Uses the same authentication
    method as the existing /api/agents/proxy endpoint.
    """
    
    description = "Connect to external services like Gmail, Slack, GitHub via Pipedream OAuth proxy"
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        # Use existing proxy endpoint from Emery infrastructure
        self.api_base_url = config.get("api_base_url", "http://localhost:3000/api/agents/proxy")
        self.agent_id = config.get("agent_id")
        self.api_key = config.get("api_key")
        
        # For development, support test user bypass
        self.test_user_id = config.get("test_user_id", "550e8400-e29b-41d4-a716-446655440000")
        self.use_test_auth = config.get("use_test_auth", False)
    
    def forward(self, service: str, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute action on external service via Pipedream proxy.
        
        Args:
            service: Service name (gmail, slack, github, etc.)
            action: Action to perform (send_email, post_message, etc.)
            params: Action-specific parameters
        
        Returns:
            Dict containing response from external service
        """
        try:
            payload = {
                "service": service,
                "action": action,
                "params": params
            }
            
            headers = {"Content-Type": "application/json"}
            
            # Use existing authentication method
            if self.use_test_auth:
                # Development bypass using test user header
                headers["x-test-user-id"] = self.test_user_id
            elif self.api_key:
                # Production API key authentication
                headers["Authorization"] = f"Bearer {self.api_key}"
            else:
                return {"error": "No authentication method configured"}
            
            logger.info(f"Calling Pipedream proxy: {service}.{action}")
            
            response = requests.post(
                self.api_base_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Pipedream proxy response: {result.get('status', 'unknown')}")
            return result
            
        except requests.RequestException as e:
            logger.error(f"Pipedream connector error: {e}")
            return {"error": str(e), "service": service, "action": action}
        except Exception as e:
            logger.error(f"Unexpected error in Pipedream connector: {e}")
            return {"error": f"Unexpected error: {str(e)}"}