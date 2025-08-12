"""
Emery Python Client

Main client class for integrating with Emery agents.
"""

import hashlib
import hmac
import json
import logging
import threading
import time
from typing import Any, Dict, Optional
import requests
from flask import Flask, request, jsonify

from .data_types import (
    AgentCapabilities,
    ConnectedService,
    AvailableAction,
    ExecutionResult,
    ProxyResult,
    WebhookPayload,
    ServiceStatus,
)


logger = logging.getLogger(__name__)


class EmeryPythonClient:
    """Consolidated Python client for Emery Agent API."""
    
    def __init__(
        self, 
        api_url: str, 
        agent_id: int, 
        webhook_secret: str = "default-webhook-secret",
        debug: bool = False
    ):
        """
        Initialize Emery Python client.
        
        Args:
            api_url: Base URL of Emery API (e.g., http://localhost:3000)
            agent_id: ID of the agent to use
            webhook_secret: Secret for webhook HMAC verification
            debug: Enable debug logging
        """
        # AIDEV-NOTE: Consolidated initialization with better error handling
        self.api_url = api_url.rstrip('/')
        self.agent_id = agent_id
        self.webhook_secret = webhook_secret
        self.webhook_results: list[WebhookPayload] = []
        
        # Setup HTTP session with consistent headers
        self._setup_session()
        
        # Setup webhook handling
        self.webhook_app = Flask(__name__)
        self._setup_webhook_routes()
        
        # Configure logging
        if debug:
            self._setup_debug_logging()
        
        logger.info(f"Initialized EmeryPythonClient for agent {agent_id}")
    
    def _setup_session(self) -> None:
        """Configure HTTP session with required headers."""
        self.session = requests.Session()
        # AIDEV-NOTE: Development test user bypass headers - remove in production
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'EmeryPythonClient/1.0',
            'X-Test-User-Id': '550e8400-e29b-41d4-a716-446655440000'
        })
    
    def _setup_debug_logging(self) -> None:
        """Configure debug logging."""
        logging.basicConfig(level=logging.DEBUG)
        logger.setLevel(logging.DEBUG)
    def _setup_webhook_routes(self) -> None:
        """Set up Flask routes for webhook handling."""
        
        @self.webhook_app.route('/webhook/agent-result', methods=['POST'])
        def handle_webhook():
            """Handle incoming webhook from Emery agent execution."""
            try:
                data = request.get_json()
                if not data:
                    return jsonify({"error": "No JSON data provided"}), 400
                
                signature = request.headers.get('X-Emery-Signature')
                
                # AIDEV-NOTE: Critical security check - verify webhook signature
                if not self._verify_webhook_signature(data, signature):
                    logger.warning("Invalid webhook signature received")
                    return jsonify({"error": "Invalid signature"}), 401
                
                logger.info("✅ Webhook signature verified")  
                logger.info(f"🎣 Received webhook: {json.dumps(data, indent=2)}")
                
                # Convert to structured payload
                webhook_payload = self._create_webhook_payload(data)
                self.webhook_results.append(webhook_payload)
                
                return jsonify({"status": "received"})
            except Exception as e:
                logger.error(f"Webhook processing error: {e}")
                return jsonify({"error": "Internal server error"}), 500
    
    def _create_webhook_payload(self, data: Dict[str, Any]) -> WebhookPayload:
        """Create a structured webhook payload from raw data."""
        return WebhookPayload(
            execution_id=data["execution_id"],
            agent_id=data["agent_id"], 
            action=data["action"],
            result=data["result"],
            timestamp=data["timestamp"],
        )
    
    def _verify_webhook_signature(self, payload: Dict[str, Any], signature: Optional[str]) -> bool:
        """Verify HMAC signature for webhook payload."""
        if not signature:
            return False
            
        expected_signature = self._generate_webhook_signature(payload)
        return hmac.compare_digest(signature, expected_signature)
    
    def _generate_webhook_signature(self, payload: Dict[str, Any]) -> str:
        """Generate HMAC signature for webhook verification."""
        message = json.dumps(payload, separators=(',', ':')).encode()
        signature = hmac.new(
            self.webhook_secret.encode(),
            message,
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def start_webhook_server(self, port: int = 3001) -> str:
        """
        Start webhook server in background thread.
        
        Args:
            port: Port to run webhook server on
            
        Returns:
            Webhook URL for use in API calls
        """
        def run_server():
            # AIDEV-NOTE: Disable Flask debug mode to avoid conflicts
            self.webhook_app.run(host='0.0.0.0', port=port, debug=False)
        
        webhook_thread = threading.Thread(target=run_server, daemon=True)
        webhook_thread.start()
        time.sleep(1)  # Give server time to start
        
        webhook_url = f"http://localhost:{port}/webhook/agent-result"
        logger.info(f"📡 Webhook server started on {webhook_url}")
        return webhook_url
    
    def get_capabilities(self) -> AgentCapabilities:
        """
        Get agent capabilities including connected services and available actions.
        
        Returns:
            Agent capabilities with connected services and available actions
            
        Raises:
            requests.HTTPError: If API request fails
        """
        logger.info(f"📋 Getting capabilities for agent {self.agent_id}...")
        
        data = self._make_api_request("GET", f"/api/agents/{self.agent_id}/capabilities")
        
        # Convert to structured types
        connected_services = [
            ConnectedService(
                service=service["service"],
                account_name=service["account_name"],
                status=ServiceStatus(service["status"]),
                connected_at=service["connected_at"]
            )
            for service in data["connected_services"]
        ]
        
        available_actions = [
            AvailableAction(
                id=action["id"],
                name=action["name"],
                description=action["description"],
                service=action["service"],
                required_props=action["required_props"],
                optional_props=action["optional_props"]
            )
            for action in data["available_actions"]
        ]
        
        capabilities = AgentCapabilities(
            agent_id=data["agent_id"],
            agent_name=data["agent_name"],
            owner_id=data["owner_id"],
            connected_services=connected_services,
            available_actions=available_actions,
            proxy_endpoints=data["proxy_endpoints"]
        )
        
        logger.info(f"✅ Agent capabilities retrieved:")
        logger.info(f"   • Agent: {capabilities.agent_name}")
        logger.info(f"   • Connected Services: {', '.join([s.service for s in connected_services])}")
        logger.info(f"   • Available Actions: {len(available_actions)}")
        
        return capabilities
    
    def execute_action(
        self, 
        action: str, 
        props: Dict[str, Any], 
        use_webhook: bool = False, 
        timeout: int = 30
    ) -> ExecutionResult:
        """
        Execute a Pipedream action through the agent.
        
        Args:
            action: Action ID to execute
            props: Action properties/parameters
            use_webhook: Whether to use webhook for async result delivery
            timeout: Request timeout in seconds
            
        Returns:
            Execution result with success status and data/error
            
        Raises:
            requests.HTTPError: If API request fails
        """
        logger.info(f"🚀 Executing action: {action}")
        logger.debug(f"   Props: {json.dumps(props, indent=2)}")
        
        payload = {
            "action": action,
            "props": props,
            "timeout": timeout * 1000,  # Convert to milliseconds
        }
        
        if use_webhook:
            webhook_url = "http://localhost:3001/webhook/agent-result"
            payload["webhook_url"] = webhook_url
            logger.info(f"   📡 Using webhook: {webhook_url}")
        
        # AIDEV-NOTE: Consolidated API request with better error handling
        data = self._make_api_request("POST", f"/api/agents/{self.agent_id}/execute", payload, timeout)
        
        result = ExecutionResult(
            success=data["success"],
            execution_id=data.get("execution_id"),
            result=data.get("result"),
            error=data.get("error")
        )
        
        self._log_execution_result(result, use_webhook)
        return result
    
    def _make_api_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None, 
        timeout: int = 30
    ) -> Dict[str, Any]:
        """Make API request with consistent error handling."""
        url = f"{self.api_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, timeout=timeout)
            else:
                response = self.session.post(url, json=data, timeout=timeout)
            
            response.raise_for_status()
            return response.json()
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {method} {endpoint} - {e}")
            raise
    
    def _log_execution_result(self, result: ExecutionResult, use_webhook: bool) -> None:
        """Log execution result with appropriate detail."""
        if result.success:
            logger.info("✅ Action executed successfully")
            logger.info(f"   📄 Execution ID: {result.execution_id}")  
            if not use_webhook and result.result:
                logger.debug(f"   📤 Result: {json.dumps(result.result, indent=2)}")
        else:
            logger.error(f"❌ Action failed: {result.error}")
    
    def proxy_request(
        self, 
        service: str, 
        endpoint: str, 
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None, 
        params: Optional[Dict[str, str]] = None,
        timeout: int = 30
    ) -> ProxyResult:
        """
        Proxy an authenticated API request through the agent.
        
        Args:
            service: Service name (e.g., 'gmail', 'slack')
            endpoint: API endpoint path
            method: HTTP method
            data: Request body data
            params: Query parameters
            timeout: Request timeout in seconds
            
        Returns:
            Proxy result with response data and metadata
            
        Raises:
            requests.HTTPError: If API request fails
        """
        logger.info(f"🔗 Proxying {method} request to {service}{endpoint}")
        
        payload = {
            "service": service,
            "endpoint": endpoint,
            "method": method,
        }
        
        if data:
            payload["data"] = data
        if params:
            payload["params"] = params
        
        # AIDEV-NOTE: Use consolidated API request method
        result_data = self._make_api_request("POST", f"/api/agents/{self.agent_id}/proxy", payload, timeout)
        
        result = ProxyResult(
            success=result_data["success"],
            data=result_data.get("data"),
            status=result_data.get("status"),
            headers=result_data.get("headers"),
            error=result_data.get("error")
        )
        
        self._log_proxy_result(result)
        return result
    
    def _log_proxy_result(self, result: ProxyResult) -> None:
        """Log proxy result with appropriate detail."""
        if result.success:
            logger.info("✅ Proxy request successful")
            logger.info(f"   📊 Status: {result.status}")
            logger.debug(f"   📤 Data: {json.dumps(result.data, indent=2)}")
        else:
            logger.error(f"❌ Proxy request failed: {result.error}")
            raise Exception(result.error)
