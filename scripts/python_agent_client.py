#!/usr/bin/env python3
"""
Python Agent Client Example

This demonstrates how a Python backend application would 
integrate with Orchastrate agents for OAuth credential delegation.

Usage:
    python scripts/python_agent_client.py <agent_id>

Requirements:
    pip install requests flask
"""

import json
import time
import hmac
import hashlib
import requests
from typing import Dict, List, Optional, Any
from flask import Flask, request, jsonify
import threading


class OrchastratePythonClient:
    """Python client for Orchastrate Agent API"""
    
    def __init__(self, api_url: str, agent_id: int, webhook_secret: str = "default-webhook-secret"):
        self.api_url = api_url.rstrip('/')
        self.agent_id = agent_id
        self.webhook_secret = webhook_secret
        self.session = requests.Session()
        
        # Set up webhook server
        self.webhook_app = Flask(__name__)
        self.webhook_results = []
        self._setup_webhook_routes()
        
    def _setup_webhook_routes(self):
        """Set up Flask routes for webhook handling"""
        
        @self.webhook_app.route('/webhook/agent-result', methods=['POST'])
        def handle_webhook():
            data = request.get_json()
            signature = request.headers.get('X-Orchastrate-Signature')
            
            # Verify webhook signature
            expected_signature = self._generate_webhook_signature(data)
            if signature != expected_signature:
                print("❌ Invalid webhook signature")
                return jsonify({"error": "Invalid signature"}), 401
            
            print("\n🎣 [WEBHOOK] Received agent execution result:")
            print(json.dumps(data, indent=2))
            
            self.webhook_results.append(data)
            return jsonify({"status": "received"})
    
    def _generate_webhook_signature(self, payload: Dict) -> str:
        """Generate HMAC signature for webhook verification"""
        message = json.dumps(payload, separators=(',', ':')).encode()
        signature = hmac.new(
            self.webhook_secret.encode(),
            message,
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def start_webhook_server(self, port: int = 3001):
        """Start webhook server in background thread"""
        def run_server():
            self.webhook_app.run(host='0.0.0.0', port=port, debug=False)
        
        webhook_thread = threading.Thread(target=run_server, daemon=True)
        webhook_thread.start()
        time.sleep(1)  # Give server time to start
        print(f"📡 Webhook server started on port {port}")
        return f"http://localhost:{port}/webhook/agent-result"
    
    def get_capabilities(self) -> Dict:
        """Get agent capabilities including connected services and available actions"""
        print(f"\n📋 Getting capabilities for agent {self.agent_id}...")
        
        response = self.session.get(f"{self.api_url}/api/agents/{self.agent_id}/capabilities")
        response.raise_for_status()
        
        data = response.json()
        print("✅ Agent capabilities retrieved:")
        print(f"   • Agent: {data['agent_name']}")
        print(f"   • Connected Services: {', '.join([s['service'] for s in data['connected_services']])}")
        print(f"   • Available Actions: {len(data['available_actions'])}")
        
        return data
    
    def execute_action(self, action: str, props: Dict, use_webhook: bool = False, timeout: int = 30) -> Dict:
        """Execute a Pipedream action through the agent"""
        print(f"\n🚀 Executing action: {action}")
        print(f"   Props: {json.dumps(props, indent=2)}")
        
        payload = {
            "action": action,
            "props": props,
            "timeout": timeout * 1000,  # Convert to milliseconds
        }
        
        if use_webhook:
            webhook_url = "http://localhost:3001/webhook/agent-result"
            payload["webhook_url"] = webhook_url
            print(f"   📡 Using webhook: {webhook_url}")
        
        response = self.session.post(
            f"{self.api_url}/api/agents/{self.agent_id}/execute",
            json=payload
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data["success"]:
            print("✅ Action executed successfully")
            print(f"   📄 Execution ID: {data['execution_id']}")
            if not use_webhook and data.get("result"):
                print(f"   📤 Result: {json.dumps(data['result'], indent=2)}")
        else:
            print(f"❌ Action failed: {data.get('error')}")
        
        return data
    
    def proxy_request(self, service: str, endpoint: str, method: str = "GET", 
                     data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
        """Proxy an authenticated API request through the agent"""
        print(f"\n🔗 Proxying {method} request to {service}{endpoint}")
        
        payload = {
            "service": service,
            "endpoint": endpoint,
            "method": method,
        }
        
        if data:
            payload["data"] = data
        if params:
            payload["params"] = params
        
        response = self.session.post(
            f"{self.api_url}/api/agents/{self.agent_id}/proxy",
            json=payload
        )
        response.raise_for_status()
        
        result = response.json()
        
        if result["success"]:
            print("✅ Proxy request successful")
            print(f"   📊 Status: {result['status']}")
            print(f"   📤 Data: {json.dumps(result['data'], indent=2)}")
        else:
            raise Exception(result.get("error", "Proxy request failed"))
        
        return result


class GmailIntegration:
    """Gmail-specific integration examples"""
    
    def __init__(self, client: OrchastratePythonClient):
        self.client = client
    
    def send_email(self, to: str, subject: str, body: str, cc: Optional[str] = None) -> Dict:
        """Send an email via Gmail"""
        print('\n📧 === Gmail: Send Email ===')
        
        props = {
            "to": to,
            "subject": subject,
            "body": body,
        }
        
        if cc:
            props["cc"] = cc
        
        return self.client.execute_action("gmail-send-email", props)
    
    def get_messages(self, query: str = "is:unread", max_results: int = 5) -> Dict:
        """Get Gmail messages"""
        print('\n📬 === Gmail: Get Messages ===')
        
        return self.client.execute_action("gmail-get-messages", {
            "query": query,
            "maxResults": max_results,
        })
    
    def get_profile(self) -> Dict:
        """Get Gmail profile via proxy"""
        print('\n👤 === Gmail: Get Profile via Proxy ===')
        
        return self.client.proxy_request("gmail", "/gmail/v1/users/me/profile")
    
    def search_messages(self, query: str = "from:noreply", max_results: int = 3) -> Dict:
        """Search messages via proxy"""
        print('\n🔍 === Gmail: Search Messages via Proxy ===')
        
        return self.client.proxy_request(
            "gmail",
            "/gmail/v1/users/me/messages",
            params={"q": query, "maxResults": str(max_results)}
        )
    
    def send_email_via_proxy(self, to: str, subject: str, body: str) -> Dict:
        """Send email via direct proxy call"""
        print('\n📮 === Gmail: Send Email via Proxy ===')
        
        # Create RFC 2822 email message
        email_content = f"""To: {to}
Subject: {subject}
Content-Type: text/plain; charset=UTF-8

{body}"""
        
        # Encode as base64 for Gmail API
        import base64
        raw_message = base64.urlsafe_b64encode(email_content.encode()).decode()
        
        return self.client.proxy_request(
            "gmail",
            "/gmail/v1/users/me/messages/send",
            method="POST",
            data={"raw": raw_message}
        )
    
    def webhook_example(self) -> Dict:
        """Demonstrate webhook-based execution"""
        print('\n🎣 === Gmail: Webhook Example ===')
        
        return self.client.execute_action("gmail-get-messages", {
            "query": "is:inbox",
            "maxResults": 1,
        }, use_webhook=True)


def main():
    """Main test function"""
    import sys
    import os
    
    print("🚀 Orchastrate Python Agent Client Test")
    print("=" * 50)
    
    # Configuration
    api_url = os.getenv("ORCHASTRATE_API", "http://localhost:3000")
    agent_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    
    print(f"🤖 Testing with agent ID: {agent_id}")
    print(f"🌐 API URL: {api_url}")
    
    try:
        # Initialize client and start webhook server
        client = OrchastratePythonClient(api_url, agent_id)
        client.start_webhook_server(3001)
        
        gmail = GmailIntegration(client)
        
        # Test 1: Get capabilities
        print("\n🧪 TEST 1: Agent Capabilities")
        print("-" * 30)
        capabilities = client.get_capabilities()
        
        # Test 2: Gmail Actions
        print("\n🧪 TEST 2: Gmail Actions")
        print("-" * 30)
        
        try:
            gmail.get_messages(query="is:inbox", max_results=3)
        except Exception as e:
            print(f"⚠️  Gmail get messages failed: {e}")
        
        try:
            gmail.send_email(
                to="test@example.com",
                subject="Python Agent Test",
                body="This email was sent from a Python app via Orchastrate agent!"
            )
        except Exception as e:
            print(f"⚠️  Gmail send email failed: {e}")
        
        # Test 3: Proxy Requests
        print("\n🧪 TEST 3: Gmail Proxy Requests")
        print("-" * 30)
        
        try:
            gmail.get_profile()
        except Exception as e:
            print(f"⚠️  Gmail profile request failed: {e}")
        
        try:
            gmail.search_messages()
        except Exception as e:
            print(f"⚠️  Gmail search failed: {e}")
        
        # Test 4: Webhook Integration
        print("\n🧪 TEST 4: Webhook Integration")
        print("-" * 30)
        
        try:
            gmail.webhook_example()
            print("⏳ Waiting for webhook delivery...")
            time.sleep(3)
            print(f"📊 Received {len(client.webhook_results)} webhooks")
        except Exception as e:
            print(f"⚠️  Webhook test failed: {e}")
        
        print("\n✅ Python test suite completed!")
        print(f"📊 Webhook results received: {len(client.webhook_results)}")
        
        print("\n💡 To test with a real agent:")
        print("   1. Create an agent in Orchastrate dashboard")
        print("   2. Connect Gmail via /dashboard/connections")
        print("   3. Run: python scripts/python_agent_client.py <agent_id>")
        
    except Exception as e:
        print(f"\n💥 Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()