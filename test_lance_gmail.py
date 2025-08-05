#!/usr/bin/env python3
"""
Test Gmail OAuth proxy with Lance's agent
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'src'))

from emery_client.simple_client import EmeryPythonClient

def test_lance_gmail():
    print("📧 Testing Gmail OAuth with Lance's Agent")
    print("=" * 50)
    
    # Use Lance's agent API key
    api_key = "orch_agent_3_PA1-THeNhUtNSoWK"
    
    try:
        # Initialize OAuth proxy for Lance's agent
        oauth_proxy = EmeryPythonClient(api_key)
        print(f"✅ Initialized OAuth proxy for Lance's agent")
        print(f"   API Key: {api_key}")
        
        # Test Gmail send email - this should work with your OAuth connection!
        print("\n📧 Testing Gmail send_email...")
        try:
            result = oauth_proxy.gmail.send_email(
                to="lance@aifactory.nz",  # Send to yourself for testing
                subject="🚀 OAuth Proxy Test - SUCCESS!",
                body="This email was sent via Emery OAuth proxy using your Gmail connection!\n\nIf you're reading this, the OAuth proxy is working perfectly! 🎉"
            )
            print("🎉 SUCCESS! Gmail email sent via OAuth proxy:")
            print(f"   Result: {result}")
            
        except Exception as e:
            print(f"❌ Gmail send failed: {e}")
            
            # Let's also try a simple Gmail API call
            print("\n📬 Trying Gmail get messages...")
            try:
                result = oauth_proxy.call('gmail', 'get_messages', 
                    query='is:inbox', 
                    maxResults=1
                )
                print("✅ Gmail API call successful:", result)
            except Exception as e2:
                print(f"❌ Gmail API call also failed: {e2}")
        
        print(f"\n✨ Test completed!")
        
    except Exception as e:
        print(f"❌ OAuth proxy initialization failed: {e}")

if __name__ == "__main__":
    test_lance_gmail()