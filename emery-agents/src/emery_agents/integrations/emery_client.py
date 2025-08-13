"""
Integration with Emery API system.
Handles communication back to the main Emery application.
"""

import logging
from typing import Dict, Any, Optional
import os

from ..core.types import Task

logger = logging.getLogger(__name__)


class EmeryClientIntegration:
    """
    Integration with Emery API system.
    
    Provides methods for:
    - Reporting execution results back to Emery
    - Making OAuth proxy calls via Emery's Pipedream Connect
    - Getting agent capabilities and connected services
    """
    
    def __init__(self, api_url: Optional[str] = None, agent_id: Optional[str] = None):
        self.api_url = api_url or os.getenv("EMERY_API_URL", "http://localhost:3000")
        self.agent_id = agent_id or os.getenv("EMERY_AGENT_ID")
        self.api_key = os.getenv("EMERY_API_KEY")
        
        if not self.agent_id:
            raise ValueError("Agent ID must be provided via constructor or EMERY_AGENT_ID env var")
        
        logger.info(f"EmeryClientIntegration initialized for agent {self.agent_id}")
    
    async def execute_oauth_action(
        self, 
        service: str, 
        action: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute an OAuth action via Emery's Pipedream Connect proxy.
        
        Args:
            service: Service name (e.g., "gmail", "slack")
            action: Action to execute
            params: Action parameters
            
        Returns:
            Dict with action results
        """
        try:
            # Import the existing Emery client
            from emery_client.simple_client import EmeryPythonClient
            
            # Create client instance
            client = EmeryPythonClient(self.api_key, self.api_url)
            
            # Execute via OAuth proxy
            result = await client.execute_oauth_action(
                service=service,
                action=action,
                params=params
            )
            
            logger.info(f"OAuth action {service}.{action} completed successfully")
            return result
            
        except ImportError:
            logger.error("emery_client not available - cannot execute OAuth actions")
            raise RuntimeError("emery_client package not found")
        except Exception as e:
            logger.exception(f"OAuth action failed: {e}")
            raise
    
    async def get_agent_capabilities(self) -> Dict[str, Any]:
        """
        Get agent capabilities including connected OAuth services.
        
        Returns:
            Dict with agent capabilities
        """
        try:
            from emery_client.simple_client import EmeryPythonClient
            
            client = EmeryPythonClient(self.api_key, self.api_url)
            capabilities = await client.get_capabilities()
            
            logger.info("Retrieved agent capabilities")
            return capabilities
            
        except ImportError:
            logger.error("emery_client not available - cannot get capabilities")
            return {"connected_services": [], "actions": []}
        except Exception as e:
            logger.exception(f"Failed to get capabilities: {e}")
            return {"connected_services": [], "actions": []}
    
    async def report_execution_result(self, task: Task) -> None:
        """
        Report task execution results back to Emery.
        
        Args:
            task_execution: Completed task execution
        """
        try:
            # AIDEV-TODO: Implement API endpoint for reporting execution results
            # For now, just log the results
            logger.info(f"Task execution {task.id} completed with status: {task.status}")
            logger.info(f"Capability executed: {task.capabilityName}")
            
            if task.error:
                logger.error(f"Task execution error: {task.error}")
            
            # Log task completion
            logger.info(f"Task {task.id}: {task.status}")
            if task.error:
                logger.error(f"Task error: {task.error}")
            
        except Exception as e:
            logger.exception(f"Failed to report execution results: {e}")
    
    async def get_agent_config(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get agent configuration from Emery.
        
        Args:
            agent_id: Agent ID (defaults to instance agent_id)
            
        Returns:
            Agent configuration dict
        """
        target_agent_id = agent_id or self.agent_id
        
        try:
            # AIDEV-TODO: Implement API call to get agent configuration
            # For now, return from environment variable
            config_json = os.getenv("EMERY_AGENT_CONFIG")
            if config_json:
                import json
                return json.loads(config_json)
            
            logger.warning(f"No configuration found for agent {target_agent_id}")
            return {}
            
        except Exception as e:
            logger.exception(f"Failed to get agent config: {e}")
            return {}
    
    async def update_agent_status(self, status: str, message: Optional[str] = None) -> None:
        """
        Update agent status in Emery.
        
        Args:
            status: New status
            message: Optional status message
        """
        try:
            logger.info(f"Agent {self.agent_id} status: {status}")
            if message:
                logger.info(f"Status message: {message}")
            
            # AIDEV-TODO: Implement API call to update agent status
            
        except Exception as e:
            logger.exception(f"Failed to update agent status: {e}")


# AIDEV-NOTE: This integration bridges the agent execution system with Emery
# AIDEV-TODO: Implement proper API endpoints for execution reporting
# AIDEV-TODO: Add authentication and error handling for API calls