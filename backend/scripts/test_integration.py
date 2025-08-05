#!/usr/bin/env python3
"""
Integration Test Runner for Emery Python Client

This script tests the integration between Python applications and 
Emery Next.js API routes for secure OAuth credential delegation.

Usage:
    uv run scripts/test_integration.py <agent_id>
    # or
    python scripts/test_integration.py <agent_id>
"""

import sys
import os
import time
import logging
from typing import Optional

# Add src to path for local development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from emery_client import EmeryPythonClient
from emery_client.gmail import GmailIntegration




def run_integration_tests(agent_id: int, api_url: str) -> None:
    """
    Run comprehensive integration tests for Emery Python client.
    
    Args:
        agent_id: ID of the agent to test
        api_url: Base URL of Emery API
    """
    print("🚀 Emery Python Agent Client Integration Test")
    print("=" * 60)
    print(f"🤖 Testing with agent ID: {agent_id}")
    print(f"🌐 API URL: {api_url}")
    
    try:
        # AIDEV-NOTE: Initialize client with debug logging for testing
        client = EmeryPythonClient(api_url, agent_id, debug=True)
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
            result = gmail.get_messages(query="is:inbox", max_results=3)
            print(f"✅ Get messages: {result.success}")
        except Exception as e:
            print(f"⚠️  Gmail get messages failed: {e}")
        
        try:
            result = gmail.send_email(
                to="test@example.com",
                subject="Python Agent Integration Test",
                body="This email was sent from a Python app via Emery agent!"
            )
            print(f"✅ Send email: {result.success}")
        except Exception as e:
            print(f"⚠️  Gmail send email failed: {e}")
        
        # Test 3: Proxy Requests
        print("\n🧪 TEST 3: Gmail Proxy Requests")
        print("-" * 30)
        
        try:
            result = gmail.get_profile()
            print(f"✅ Get profile: {result.success}")
        except Exception as e:
            print(f"⚠️  Gmail profile request failed: {e}")
        
        try:
            result = gmail.search_messages()
            print(f"✅ Search messages: {result.success}")
        except Exception as e:
            print(f"⚠️  Gmail search failed: {e}")
        
        try:
            result = gmail.list_labels()
            print(f"✅ List labels: {result.success}")
        except Exception as e:
            print(f"⚠️  Gmail list labels failed: {e}")
        
        # Test 4: Webhook Integration
        print("\n🧪 TEST 4: Webhook Integration")
        print("-" * 30)
        
        try:
            result = gmail.webhook_example()
            print(f"✅ Webhook execution started: {result.success}")
            print("⏳ Waiting for webhook delivery...")
            time.sleep(3)
            print(f"📊 Received {len(client.webhook_results)} webhooks")
            
            if client.webhook_results:
                latest_webhook = client.webhook_results[-1]
                print(f"📄 Latest webhook execution ID: {latest_webhook.execution_id}")
                
        except Exception as e:
            print(f"⚠️  Webhook test failed: {e}")
        
        print("\n✅ Integration test suite completed!")
        print(f"📊 Total webhook results received: {len(client.webhook_results)}")
        
        # Summary
        print("\n📋 Test Summary:")
        print(f"   • Agent: {capabilities.agent_name}")
        print(f"   • Connected Services: {len(capabilities.connected_services)}")
        print(f"   • Available Actions: {len(capabilities.available_actions)}")
        print(f"   • Webhook Results: {len(client.webhook_results)}")
        
        print("\n💡 Next Steps:")
        print("   1. Create agents in Emery dashboard (/dashboard/manage)")
        print("   2. Connect services via /dashboard/connections")
        print("   3. Use this Python client in your applications")
        
    except Exception as e:
        print(f"\n💥 Integration test failed: {e}")
        logging.exception("Full error details:")


def main() -> None:
    """Main entry point for integration test runner."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configuration from environment and command line
    api_url = os.getenv("EMERY_API", "http://localhost:3000")
    agent_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    
    run_integration_tests(agent_id, api_url)


if __name__ == "__main__":
    main()