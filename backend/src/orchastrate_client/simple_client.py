"""
Simple OAuth Proxy Client for Agent Libraries

This is the ONLY file your agent libraries need.
"""

import requests
from typing import Any, Dict, Optional


class OrchastratePythonClient:
    """Simple OAuth proxy client for agent libraries."""
    
    def __init__(self, agent_api_key: str, api_url: str = "http://localhost:3000"):
        """
        Initialize OAuth proxy client.
        
        Args:
            agent_api_key: API key from agent dashboard (e.g., "orch_agent_123_abc")
            api_url: Orchastrate API URL
        """
        self.api_key = agent_api_key
        self.api_url = api_url.rstrip('/')
        
        # Set up requests session with auth
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {agent_api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'OrchastratePythonClient/1.0'
        })
        
        # Create dynamic service proxies
        self.gmail = ServiceProxy(self, 'gmail')
        self.slack = ServiceProxy(self, 'slack') 
        self.github = ServiceProxy(self, 'github')
        self.twitter = ServiceProxy(self, 'twitter')
        self.notion = ServiceProxy(self, 'notion')
    
    def call(self, service: str, action: str, **params) -> Dict[str, Any]:
        """
        Make OAuth proxy call to any service.
        
        Args:
            service: Service name (gmail, slack, github, etc.)
            action: Action name (send_email, post_message, etc.)
            **params: Action parameters
            
        Returns:
            API response data
            
        Raises:
            requests.HTTPError: If API call fails
            ValueError: If response indicates failure
        """
        response = self.session.post(f"{self.api_url}/api/agents/proxy", json={
            'service': service,
            'action': action,
            'params': params
        })
        
        response.raise_for_status()
        result = response.json()
        
        if not result.get('success'):
            raise ValueError(f"Action failed: {result.get('error', 'Unknown error')}")
            
        return result.get('data', {})


class ServiceProxy:
    """Dynamic proxy for OAuth service calls."""
    
    def __init__(self, client: OrchastratePythonClient, service: str):
        self.client = client
        self.service = service
    
    def __getattr__(self, action: str):
        """Allow any action call: client.gmail.send_email(), etc."""
        def call_action(**params):
            return self.client.call(self.service, action, **params)
        return call_action
    
    # Common pre-defined methods for better IDE support
    def send_email(self, to: str, subject: str, body: str, **kwargs):
        """Send email via Gmail."""
        return self.client.call(self.service, 'send_email', 
                              to=to, subject=subject, body=body, **kwargs)
    
    def post_message(self, channel: str, text: str, **kwargs):
        """Post message to Slack."""
        return self.client.call(self.service, 'post_message',
                              channel=channel, text=text, **kwargs)
    
    def create_issue(self, repo: str, title: str, body: str, **kwargs):
        """Create GitHub issue."""
        return self.client.call(self.service, 'create_issue',
                              repo=repo, title=title, body=body, **kwargs)


# Example usage for your agent libraries:
if __name__ == "__main__":
    # Initialize with agent API key from dashboard
    oauth_proxy = OrchastratePythonClient("orch_agent_123_abc")
    
    # Use any connected OAuth service
    try:
        # Send email using user's Gmail OAuth
        result = oauth_proxy.gmail.send_email(
            to="user@example.com",
            subject="Test from Agent",
            body="This email was sent via OAuth proxy!"
        )
        print("Email sent:", result)
        
        # Post to Slack using user's Slack OAuth  
        result = oauth_proxy.slack.post_message(
            channel="#general",
            text="Agent completed task successfully!"
        )
        print("Slack message posted:", result)
        
    except Exception as e:
        print(f"Error: {e}")