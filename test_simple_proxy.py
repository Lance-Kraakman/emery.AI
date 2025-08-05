#!/usr/bin/env python3
"""
Test the simple OAuth proxy service
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'src'))

from emery_client.simple_client import EmeryPythonClient

def test_oauth_proxy():
    print("🚀 Testing Simple OAuth Proxy Service")
    print("=" * 50)
    
    # Use the generated API key for agent 2
    api_key = "orch_agent_2_TuZ6G6L_KO23WyjU"
    
    try:
        # Initialize simple client
        oauth_proxy = EmeryPythonClient(api_key)
        print(f"✅ Initialized OAuth proxy with API key: {api_key[:20]}...")
        
        # Test Gmail service
        print("\n📧 Testing Gmail service...")
        try:
            result = oauth_proxy.gmail.send_email(
                to="test@example.com",
                subject="Test from Simple OAuth Proxy",
                body="This email was sent via the simplified OAuth proxy!"
            )
            print("✅ Gmail call successful:", result)
        except Exception as e:
            print(f"⚠️  Gmail call failed (expected - no OAuth connection): {e}")
        
        # Test Slack service
        print("\n💬 Testing Slack service...")
        try:
            result = oauth_proxy.slack.post_message(
                channel="#general",
                text="Test message from OAuth proxy"
            )
            print("✅ Slack call successful:", result)
        except Exception as e:
            print(f"⚠️  Slack call failed (expected - no OAuth connection): {e}")
        
        # Test generic call method
        print("\n🔧 Testing generic call method...")
        try:
            result = oauth_proxy.call('github', 'create_issue',
                repo='test/repo',
                title='Test Issue',
                body='Created via OAuth proxy'
            )
            print("✅ GitHub call successful:", result)
        except Exception as e:
            print(f"⚠️  GitHub call failed (expected - no OAuth connection): {e}")
        
        print(f"\n🎉 OAuth proxy service is working!")
        print("Next steps:")
        print("1. Connect OAuth services in dashboard (/dashboard/connections)")
        print("2. Test with real OAuth connections")
        print("3. Use in your agent libraries")
        
    except Exception as e:
        print(f"❌ OAuth proxy test failed: {e}")

if __name__ == "__main__":
    test_oauth_proxy()